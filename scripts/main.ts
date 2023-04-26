// imports from obsidian API
import { Component, Notice, Plugin, TFile, TFolder} from 'obsidian';

// modules that are part of the plugin
import { ExportModal, ExportSettings } from './export-settings';
import { Utils, Downloadable } from './utils';
import { ExportFile, HTMLGenerator } from './html-gen';
import { GraphGenerator } from './graph-view/graph-gen';
const {shell} = require('electron') 

export default class HTMLExportPlugin extends Plugin
{
	htmlGenerator: HTMLGenerator = new HTMLGenerator("webpage-html-export");
	static plugin: HTMLExportPlugin;
	static updateInfo: {updateAvailable: boolean, latestVersion: string, currentVersion: string};

	addTogglePostprocessor()
	{
		this.registerMarkdownCodeBlockProcessor("theme-toggle", (source, el, ctx) =>
		{
			let toggleEl = this.htmlGenerator.generateDarkmodeToggle();
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
					let toggleEl = this.htmlGenerator.generateDarkmodeToggle();
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

					this.exportFile(file);
				}

				return false;
			}
		});

		this.addCommand({
			id: 'export-html-vault',
			name: 'Export vault to HTML',
			callback: () =>
			{
				this.exportFolder("");
			}
		});
	}

	async onload()
	{
		console.log('loading webpage-html-export plugin');
		HTMLExportPlugin.plugin = this;

		await this.checkForUpdates();

		// init settings
		this.addSettingTab(new ExportSettings(this));
		ExportSettings.loadSettings();

		// add export vault icon to ribbon
		this.addRibbonIcon("folder-up", "Export Vault to HTML", async () =>
		{
			let exportInfo = await this.exportFolder("");
			if (exportInfo.success && ExportSettings.settings.openAfterExport)
			{
				window.require('electron').remote.shell.openPath(exportInfo.exportedPath);
			}
		});

		// add toggle postprocessor
		this.addTogglePostprocessor();

		// add commands
		this.addCommands();

		// init html generator
		this.htmlGenerator.initialize();

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
								let exportedFile = await this.exportFile(file);
								if (exportedFile && ExportSettings.settings.openAfterExport)
								{
									shell.openPath(exportedFile.pathToRoot);
								}
							}
							else if(file instanceof TFolder)
							{
								let exportInfo = await this.exportFolder(file.path);
								if (exportInfo.success && ExportSettings.settings.openAfterExport)
								{
									window.require('electron').remote.shell.openPath(exportInfo.exportedPath);
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

	onunload()
	{
		console.log('unloading webpage-html-export plugin');
	}

	generateProgressbar(title: string, progress: number, max: number, barLength: number, fullChar: string, emptyChar: string): string
	{
		function padStringBeggining(str: string, length: number, char: string)
		{
			return char.repeat(length - str.length) + str;
		}

		return `${title}: ${padStringBeggining(progress + "/" + max, 13, " ")}\n\n${fullChar.repeat(Math.floor((progress / max) * barLength))}${emptyChar.repeat(barLength - Math.floor((progress / max) * barLength))}`;
	}

	async exportFile(file: TFile, partOfBatch: boolean = false, exportPath: string | undefined = undefined, showSettings: boolean = true) : Promise<ExportFile | undefined>
	{
		// Open the settings modal and wait until it's closed
		if (showSettings)
		{
			let validSelection = false;
			while (!validSelection)
			{
				let result = await new ExportModal().open();
				if (result.canceled) return undefined;

				validSelection = true;
			}
		}

		let exportPathParsed = Utils.parsePath(exportPath ?? "");
		if (exportPath === undefined) // if no export path is specified, show a save dialog
		{
			let defaultFileName = (ExportSettings.settings.makeNamesWebStyle ? Utils.makePathWebStyle(file.basename) : file.basename) + ".html";
			let saveDialogPath = await Utils.showSaveDialog(Utils.idealDefaultPath(), defaultFileName, false) ?? undefined;
			if (saveDialogPath == undefined) return undefined;
			exportPathParsed = Utils.parsePath(saveDialogPath);
		}

		if (!partOfBatch)
		{
			GraphGenerator.clearGraphCache();
		}

		let exportedFile = new ExportFile(file, exportPathParsed.fullPath, !partOfBatch);
		await this.htmlGenerator.generateWebpage(exportedFile);

		if(!partOfBatch) 
		{
			new Notice("Exported " + file.name + " to " + exportPathParsed.fullPath, 5000);
			Utils.downloadFiles(exportedFile.downloads, exportPathParsed.dir);
		}

		return exportedFile;
	}

	async exportFolder(folderPath: string, showSettings: boolean = true) : Promise<{success: boolean, exportedPath: string}>
	{
		// folder path is the path relative to the vault that we are exporting

		// Open the settings modal and wait until it's closed
		if (showSettings)
		{
			let validSelection = false;
			while (!validSelection)
			{
				let result = await new ExportModal().open();
				if (result.canceled) return {success: false, exportedPath: ""};
				
				validSelection = true;
			}
		}

		let htmlPath = await Utils.showSelectFolderDialog(Utils.parsePath(Utils.idealDefaultPath()).dir);
		if (!htmlPath) return {success: false, exportedPath: ""};

		let allFiles = this.app.vault.getMarkdownFiles();
		let filesToExport = allFiles.filter((file) => file.path.startsWith(folderPath) && file.extension == "md");
		let externalFiles: Downloadable[] = [];
		let progressNotice = new Notice(this.generateProgressbar("Generating HTML", 1, filesToExport.length, 15, "▰","▱"), 0);

		GraphGenerator.clearGraphCache();

		for (let i = 0; i < filesToExport.length; i++)
		{
			let file = filesToExport[i];
			
			let exportedFile = await this.exportFile(file, true, htmlPath, false);
			if (exportedFile) externalFiles.push(...exportedFile.downloads);
			
			// remove duplicates
			externalFiles = externalFiles.filter((file, index) => externalFiles.findIndex((f) => f.relativePath == file.relativePath && f.filename == file.filename) == index);
			
			progressNotice.setMessage(this.generateProgressbar("Generating HTML", i+1, filesToExport.length, 15, "▰","▱"));
		}

		await Utils.delay(100);

		await Utils.downloadFiles(externalFiles, htmlPath);

		new Notice("✅ Finished HTML Export:\n\n" + htmlPath, 5000);
		console.log("Finished HTML Export: " + htmlPath);
		progressNotice.hide();

		return {success: true, exportedPath: htmlPath};
	}

	async checkForUpdates(): Promise<{updateAvailable: boolean, latestVersion: string, currentVersion: string}>
	{	
		let currentVersion = this.manifest.version;

		try
		{
			let url = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/manifest.json";
			let manifest = await fetch(url, {cache: "no-store"}).then((response) => response.json());

			let latestVersion = manifest.version;
			let updateAvailable = currentVersion < latestVersion;
			
			HTMLExportPlugin.updateInfo = {updateAvailable: updateAvailable, latestVersion: latestVersion, currentVersion: currentVersion};
			
			if(updateAvailable) console.log("Update available: " + latestVersion + " (current: " + currentVersion + ")");
			
			return HTMLExportPlugin.updateInfo;
		}
		catch
		{
			console.log("Could not check for update");
			HTMLExportPlugin.updateInfo = {updateAvailable: false, latestVersion: currentVersion, currentVersion: currentVersion};
			return HTMLExportPlugin.updateInfo;
		}
	}
}
