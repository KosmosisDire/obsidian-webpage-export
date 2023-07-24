// imports from obsidian API
import { MarkdownView, Notice, Plugin, TFile, TFolder} from 'obsidian';

// modules that are part of the plugin
import { ExportModal, ExportSettings } from './export-settings';
import { Utils } from './utils/utils';
import { HTMLGenerator } from './html-generation/html-generator';
import { Path } from './utils/path';
import { ExportFile } from './html-generation/export-file';
import { AssetHandler } from './html-generation/asset-handler';
import { RenderLog } from './html-generation/render-log';
import { Downloadable } from './utils/downloadable';
import { GlobalDataGenerator, LinkTree } from './html-generation/global-gen';

const LOCALSTORAGE_KEY = 'webpage-html-export-lastExported';

export default class HTMLExportPlugin extends Plugin
{
	static plugin: HTMLExportPlugin;
	static updateInfo: {updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string};

	lastExported: Record<string, string>;

	async addCommands()
	{
		this.addCommand({
			id: 'export-html-file',
			name: 'Export current file to HTML',
			checkCallback: (checking: boolean) =>
			{
				let file = (Utils.getActiveTextView())?.file;
				if(file instanceof TFile)
				{
					if(checking) return true;

					this.exportFile(file, new Path(file.path)).then((exportedFile) =>
					{
						if (exportedFile && ExportSettings.settings.openAfterExport)
						{
							this.openPath(exportedFile.exportPathAbsolute);
						}
					});
				}

				return false;
			}
		});

		this.addCommand({
			id: 'export-html-file-default',
			name: 'Export current file to HTML - Previous Settings',
			checkCallback: (checking: boolean) =>
			{
				let file = (Utils.getActiveTextView())?.file;
				if(file instanceof TFile)
				{
					if(checking) return true;
					let path = Utils.idealDefaultPath().joinString(file.name).setExtension("html");
					this.exportFile(file, new Path(file.path), false, path, false).then((exportedFile) =>
					{
						if (exportedFile && ExportSettings.settings.openAfterExport)
						{
							this.openPath(exportedFile.exportPathAbsolute);
						}
					});
				}

				return false;
			}
		});

		this.addCommand({
			id: 'export-html-vault',
			name: 'Export vault to HTML',
			callback: () =>
			{
				this.exportFolder(Path.emptyPath);
			}
		});
	}

	async openPath(path: Path)
	{
		// @ts-ignore
		await window.electron.remote.shell.openPath(path.asString);
	}

	async onload()
	{
		console.log('loading webpage-html-export plugin');
		HTMLExportPlugin.plugin = this;

		await this.checkForUpdates();

		// init html generator
		AssetHandler.initialize("webpage-html-export");

		// init settings
		this.addSettingTab(new ExportSettings(this));
		ExportSettings.loadSettings();

		// init last exported data
		this.lastExported = this.app.loadLocalStorage(LOCALSTORAGE_KEY) ?? {};

		// add export vault icon to ribbon
		this.addRibbonIcon("folder-up", "Export Vault to HTML", async () =>
		{
			let exportInfo = await this.exportFolder(Path.emptyPath);
			if (exportInfo.success && ExportSettings.settings.openAfterExport)
			{
				console.log("Opening: "+exportInfo.exportedPath.asString);
				this.openPath(exportInfo.exportedPath);
			}			
		});

		// add commands
		this.addCommands();

		// Register the Export As HTML button in the file menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) =>
			{
				menu.addItem((item) =>
				{
					item
						.setTitle("Export to HTML")
						.setIcon("download")
						.setSection("export")
						.onClick(async () =>
						{
							if(file instanceof TFile)
							{
								let path = new Path(file.path);
								let exportedFile = await this.exportFile(file, path);
								if (exportedFile && ExportSettings.settings.openAfterExport)
								{
									console.log("Opening: "+exportedFile.exportPathAbsolute.asString);
									this.openPath(exportedFile.exportPathAbsolute);
								}
							}
							else if(file instanceof TFolder)
							{
								let exportInfo = await this.exportFolder(new Path(file.path));
								if (exportInfo.success && ExportSettings.settings.openAfterExport)
								{
									console.log("Opening: "+exportInfo.exportedPath.asString);
									this.openPath(exportInfo.exportedPath);
								}
							}
							else
							{
								console.error("File is not a TFile or TFolder! Invalid type: " + typeof file + "");
								new Notice("File is not a File or Folder! Invalid type: " + typeof file + "", 5000);
							}
						});
				});
			})
		);
	}

	async exportFile(file: TFile, exportFromPath: Path, partOfBatch: boolean = false, exportToPath: Path | undefined = undefined, showSettings: boolean = true) : Promise<ExportFile | undefined>
	{
		if(file.extension != "md")
		{
			new Notice(`❗ Unfortunately exporting ${file.extension.replaceAll(".", "")} files is not supported yet.`, 7000);
			return undefined;
		}

		// Open the settings modal and wait until it's closed
		if (showSettings)
		{
			let result = await new ExportModal().open();
			if (result.canceled) return undefined;
		}

		// if no export path is specified, show a save dialog
		if (exportToPath === undefined) 
		{
			let defaultFileName = file.basename + ".html";
			if (ExportSettings.settings.makeNamesWebStyle) defaultFileName = Path.toWebStyle(defaultFileName);
			let saveDialogPath = await Utils.showSaveDialog(Utils.idealDefaultPath(), defaultFileName, false);
			if (!saveDialogPath) return undefined;
			exportToPath = saveDialogPath;
		}

		if (
			ExportSettings.settings.incrementalExport &&
			this.lastExported &&
			file.stat.mtime <= this.lastExported[file.path]
		) {
			new Notice(
				`Skipping ${file.path}. File unchanged since last export.`,
				5000
			);
			RenderLog.progress(
				1,
				2,
				'File unchanged',
				`Skipping: ${file.path}`
			);
			return;
		}

		if (!partOfBatch)
		{
			// if we are starting a new export then begin a new batch
			await HTMLGenerator.beginBatch([]);
			RenderLog.progress(1, 2, "Generating HTML", "Exporting: " + file.path);
		}

		// the !partOfBatch is passed to forceExportToRoot. 
		// If this is a single file export then export it to the folder specified rather than into it's subfolder.
		try
		{
			var exportedFile = new ExportFile(file, exportToPath.directory.absolute(), exportFromPath.directory, partOfBatch, exportToPath.fullName, !partOfBatch);
			await HTMLGenerator.generateWebpage(exportedFile);
		}
		catch (e)
		{
			if(!partOfBatch)
			{
				RenderLog.error("Could not export file: " + file.name, e.stack, true);
			}

			throw e;
		}

		if(!partOfBatch) 
		{
			// file downloads are handled outside of the export function if we are exporting a batch.
			// If this is not a batch export, then we need to download the files here instead.
			await Utils.downloadFiles(exportedFile.downloads, exportToPath.directory);
			new Notice("✅ Finished HTML Export:\n\n" + exportToPath.asString, 5000);
			HTMLGenerator.endBatch();
		}

		this.lastExported[file.path] = new Date().getTime();

		return exportedFile;
	}

	async exportFolder(folderPath: Path, showSettings: boolean = true) : Promise<{success: boolean, exportedPath: Path}>
	{
		performance.mark("start");

		// Open the settings modal and wait until it's closed
		if (showSettings)
		{
			let result = await new ExportModal().open();
			if (result.canceled) return {success: false, exportedPath: Path.emptyPath};
		}

		let htmlPath = await Utils.showSelectFolderDialog(Utils.idealDefaultPath());
		if (!htmlPath) return {success: false, exportedPath: Path.emptyPath};

		// get files to export
		let allFiles = this.app.vault.getMarkdownFiles();
		// if we are at the root path export all files, otherwise only export files in the folder we are exporting
		let filesToExport = folderPath.isEmpty ? allFiles : allFiles.filter((file) => new Path(file.path).directory.asString.startsWith(folderPath.asString) && file.extension === "md");

		if (filesToExport.length > 100000 || filesToExport.length <= 0)
		{
			new Notice(`❗Invalid number of files to export: ${filesToExport.length}.\n\nPlease report on GitHub if there are markdown files in this folder.`, 0);
			return {success: false, exportedPath: htmlPath};
		}

		await HTMLGenerator.beginBatch(filesToExport);
		RenderLog.progress(0, filesToExport.length, "Generating HTML", "...", "var(--color-accent)");

		let externalFiles: Downloadable[] = [];

		
		for (let i = 0; i < filesToExport.length; i++)
		{
			let file = filesToExport[i];

			try
			{
				RenderLog.progress(i, filesToExport.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");

				let filePath = htmlPath.joinString(file.name).setExtension("html");
				let exportedFile = await this.exportFile(file, folderPath, true, filePath, false);
				if (exportedFile) 
				{
					externalFiles.push(...exportedFile.downloads);

					// remove duplicates
					externalFiles = externalFiles.filter((file, index) => externalFiles.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath && f.filename === file.filename) == index);
				}
			}
			catch (e)
			{
				let message = "Could not export file: " + file.name;
				RenderLog.error(message, e.stack);
				return {success: false, exportedPath: htmlPath};
			}
		}

		await Utils.downloadFiles(externalFiles, htmlPath);

		HTMLGenerator.endBatch();

		await Utils.delay(200);

		new Notice("✅ Finished HTML Export:\n\n" + htmlPath, 5000);
		console.log("Finished HTML Export: " + htmlPath);

		performance.mark("end");
		performance.measure("exportFolder", "start", "end");
		console.log(performance.getEntriesByName("exportFolder")[0].duration + "ms");

		return {success: true, exportedPath: htmlPath};
	}

	async checkForUpdates(): Promise<{updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string}>
	{	
		let currentVersion = this.manifest.version;

		try
		{
			let url = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/manifest.json";
			let manifest = await fetch(url, {cache: "no-store"}).then((response) => response.json());

			let latestVersion = manifest.version ?? currentVersion;
			let updateAvailable = currentVersion < latestVersion;
			let updateNote = manifest.updateNote ?? "";
			
			HTMLExportPlugin.updateInfo = {updateAvailable: updateAvailable, latestVersion: latestVersion, currentVersion: currentVersion, updateNote: updateNote};
			
			if(updateAvailable) console.log("Update available: " + latestVersion + " (current: " + currentVersion + ")");
			
			return HTMLExportPlugin.updateInfo;
		}
		catch
		{
			console.log("Could not check for update");
			HTMLExportPlugin.updateInfo = {updateAvailable: false, latestVersion: currentVersion, currentVersion: currentVersion, updateNote: ""};
			return HTMLExportPlugin.updateInfo;
		}
	}

	onunload()
	{
		this.app.saveLocalStorage(LOCALSTORAGE_KEY, this.lastExported);
		console.log('unloading webpage-html-export plugin');
	}
}
