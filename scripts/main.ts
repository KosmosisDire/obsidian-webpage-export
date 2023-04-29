// imports from obsidian API
import { Notice, Plugin, TFile, TFolder, loadMathJax, loadMermaid} from 'obsidian';

// modules that are part of the plugin
import { ExportModal, ExportSettings } from './export-settings';
import { Utils, Downloadable, Path } from './utils';
import { ExportFile, HTMLGenerator } from './html-gen';
import { GraphGenerator } from './graph-view/graph-gen';
const {shell} = require('electron') 

export default class HTMLExportPlugin extends Plugin
{
	static plugin: HTMLExportPlugin;
	static updateInfo: {updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string};

	addTogglePostprocessor()
	{
		this.registerMarkdownCodeBlockProcessor("theme-toggle", (source, el, ctx) =>
		{
			let toggleEl = HTMLGenerator.generateDarkmodeToggle();
			el.replaceWith(toggleEl);
		});

		//also replace `theme-toggle` and ```theme-toggle``` for better inline toggles, or in places you couldn't use a normal code block
		this.registerMarkdownPostProcessor((element, context) =>
		{
			let codeBlocks = element.querySelectorAll('code, span.cm-inline-code');
			codeBlocks.forEach((codeBlock) =>
			{
				if (codeBlock instanceof HTMLElement && codeBlock.innerText == "theme-toggle")
				{
					let toggleEl = HTMLGenerator.generateDarkmodeToggle();
					codeBlock.replaceWith(toggleEl);
				}
			});
		});
	}

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
							window.require('electron').remote.shell.openExternal(exportedFile.exportPathAbsolute.asString);
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
							window.require('electron').remote.shell.openExternal(exportedFile.exportPathAbsolute.asString);
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

	async onload()
	{
		console.log('loading webpage-html-export plugin');
		HTMLExportPlugin.plugin = this;

		await this.checkForUpdates();

		// init html generator
		HTMLGenerator.initialize("webpage-html-export");

		// init settings
		this.addSettingTab(new ExportSettings(this));
		ExportSettings.loadSettings();

		// add export vault icon to ribbon
		this.addRibbonIcon("folder-up", "Export Vault to HTML", async () =>
		{
			let exportInfo = await this.exportFolder(Path.emptyPath);
			if (exportInfo.success && ExportSettings.settings.openAfterExport)
			{
				window.require('electron').remote.shell.openExternal(exportInfo.exportedPath.asString);
			}
		});

		// add toggle postprocessor
		this.addTogglePostprocessor();

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
									window.require('electron').remote.shell.openExternal(exportedFile.exportPathAbsolute.asString);
								}
							}
							else if(file instanceof TFolder)
							{
								let exportInfo = await this.exportFolder(new Path(file.path));
								if (exportInfo.success && ExportSettings.settings.openAfterExport)
								{
									window.require('electron').remote.shell.openExternal(exportInfo.exportedPath.asString);
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

		if (!partOfBatch)
		{
			// if we are starting a new export then we need to regenerate the graph in case it changed.
			GraphGenerator.clearGraphCache();
		}

		// the !partOfBatch is passed to forceExportToRoot. 
		// If this is a single file export then export it to the folder specified rather than into it's subfolder.
		let exportedFile = new ExportFile(file, exportToPath.directory.absolute(), exportFromPath.directory, partOfBatch, exportToPath.fullName, !partOfBatch);
		await HTMLGenerator.generateWebpage(exportedFile);

		if(!partOfBatch) 
		{
			// file downloads are handled outside of the export function if we are exporting a batch.
			// If this is not a batch export, then we need to download the files here instead.
			await Utils.downloadFiles(exportedFile.downloads, exportToPath.directory, false);
			new Notice("✅ Finished HTML Export:\n\n" + exportToPath.asString, 5000);
		}

		return exportedFile;
	}

	async exportFolder(folderPath: Path, showSettings: boolean = true) : Promise<{success: boolean, exportedPath: Path}>
	{
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
		let filesToExport = folderPath.isEmpty ? allFiles : allFiles.filter((file) => file.path.startsWith(folderPath.asString) && file.extension == "md");

		if (filesToExport.length > 100000 || filesToExport.length <= 0)
		{
			new Notice(`❗Invalid number of files to export: ${filesToExport.length}.\n\nPlease report on GitHub.`, 0);
			return {success: false, exportedPath: htmlPath};
		}

		GraphGenerator.clearGraphCache();

		let lastProgressMessage = Utils.generateProgressbar("Generating HTML", 1, filesToExport.length, 15, "▰","▱");
		let progressNotice = new Notice(lastProgressMessage, 0);

		let externalFiles: Downloadable[] = [];

		try
		{
			for (let i = 0; i < filesToExport.length; i++)
			{
				let file = filesToExport[i];
				let filePath = htmlPath.joinString(file.name).setExtension("html");
				let exportedFile = await this.exportFile(file, folderPath, true, filePath, false);
				if (exportedFile) 
				{
					externalFiles.push(...exportedFile.downloads);

					// remove duplicates
					externalFiles = externalFiles.filter((file, index) => externalFiles.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath && f.filename == file.filename) == index);
				}

				lastProgressMessage = Utils.generateProgressbar("Generating HTML", i+1, filesToExport.length, 15, "▰","▱");
				progressNotice.setMessage(lastProgressMessage);
			}
		}
		catch (e)
		{
			console.error(e);
			progressNotice.setMessage("❗ " + lastProgressMessage);
			return {success: false, exportedPath: htmlPath};
		}

		await Utils.delay(100);
		progressNotice.hide();

		await Utils.downloadFiles(externalFiles, htmlPath, true);

		new Notice("✅ Finished HTML Export:\n\n" + htmlPath, 5000);
		console.log("Finished HTML Export: " + htmlPath);

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
		console.log('unloading webpage-html-export plugin');
	}
}
