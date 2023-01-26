// imports from obsidian API
import { Notice, Plugin, TFile, TFolder} from 'obsidian';

// modules that are part of the plugin
import { ExportSettings } from './settings';
import { Utils } from './utils';
import { LeafHandler } from './leaf-handler';
import { HTMLGenerator } from './html-gen';
const {shell} = require('electron') 
const pathTools = require('path');

export default class HTMLExportPlugin extends Plugin
{
	leafHandler: LeafHandler = new LeafHandler();
	htmlGenerator: HTMLGenerator = new HTMLGenerator();

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
				let file = (Utils.getActiveView())?.file;
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

		//"app://local/" + Utils.getAbsolutePath(Utils.makeRelative(".obsidian/plugins/webpage-html-export/webpage.js"));

		// init settings
		new ExportSettings(this);
		ExportSettings.loadSettings();

		// Register the Export As HTML button in the file menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) =>
			{
				menu.addItem((item) =>
				{
					item
						.setTitle("Export to HTML")
						.setIcon("download")
						.setSection("action")
						.onClick(async () =>
						{
							if(file instanceof TFile)
							{
								let success = await this.exportFile(file);
								if (success && ExportSettings.settings.openAfterExport)
								{
									shell.openPath(ExportSettings.settings.lastExportPath);
								}
							}
							else if(file instanceof TFolder)
							{
								let success = await this.exportFolder(file.path);
								if (success && ExportSettings.settings.openAfterExport)
								{
									shell.openPath(ExportSettings.settings.lastExportPath);
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
		
		// add export vault icon to ribbon
		this.addRibbonIcon("folder-up", "Export Vault to HTML", async () =>
		{
			this.exportFolder("");
		});

		// add toggle postprocessor
		this.addTogglePostprocessor();

		// add commands
		this.addCommands();

		// init html generator
		this.htmlGenerator.initialize();
	}

	onunload()
	{
		console.log('unloading webpage-html-export plugin');
	}

	async exportFile(file: TFile, fullPath: string = "", showSettings: boolean = true) : Promise<boolean>
	{
		// Open the settings modal and wait until it's closed
		let copyDocToClipboard = false;
		if (showSettings)
		{
			let validSelection = false;
			while (!validSelection)
			{
				let result = await new ExportSettings(this).open();
				if (result.canceled) return false;

				copyDocToClipboard = result.copyToClipboard;

				if(copyDocToClipboard && (!ExportSettings.settings.inlineCSS || !ExportSettings.settings.inlineJS || !ExportSettings.settings.inlineImages))
				{
					let error = "To copy to the clipboard please enable inline CSS, JS and Images";
					console.error(error);
					new Notice(error, 5000);
					validSelection = false;
					continue;
				}

				validSelection = true;
			}
		}

		let parsedPath = Utils.parsePath(fullPath);
		if (fullPath == "") 
		{
			let saveDialogPath = await Utils.showSaveDialog(Utils.idealDefaultPath(), file.basename + ".html", false) ?? undefined;
			if (saveDialogPath == undefined) return false;
			parsedPath = Utils.parsePath(saveDialogPath);
		}

		let fileTab = this.leafHandler.openFileInNewLeaf(file as TFile, true);

		let htmlEl : string | HTMLHtmlElement | null = await this.htmlGenerator.getCurrentFileHTML();
		if (htmlEl == null) 
		{
			console.error("Failed to get HTML for file " + file.name);
			new Notice("Failed to get HTML for file " + file.name, 5000);
			return false;
		}

		let htmlText = (htmlEl instanceof HTMLHtmlElement) ? htmlEl.outerHTML : htmlEl;

		let filesToDownload = await this.htmlGenerator.getSeperateFilesToDownload();

		// Close the file tab after HTML is generated
		fileTab.detach();

		// if onlyCopy is true, then we don't want to download the file, we just want to copy it to the clipboard
		if (copyDocToClipboard)
		{
			navigator.clipboard.writeText(htmlText);
			return false;
		}

		// Download files
		let htmlDownload = { filename: file.basename + ".html", data: htmlText, type: "text/html" };
		filesToDownload.unshift(htmlDownload);

		let filename = parsedPath.base;
		let folderPath = parsedPath.dir;

		filesToDownload[0].filename = filename;

		await Utils.downloadFiles(filesToDownload, folderPath);

		new Notice("Exported " + file.name + " to " + parsedPath.fullPath, 5000);

		return true;
	}

	async exportFolder(folderPath: string, showSettings: boolean = true) : Promise<boolean>
	{
		// folder path is the path relative to the vault that we are exporting

		// Open the settings modal and wait until it's closed
		if (showSettings)
		{
			let validSelection = false;
			while (!validSelection)
			{
				let result = await new ExportSettings(this).open();
				if (result.canceled) return false;
				
				if (result.copyToClipboard) 
				{
					let error = "You cannot export a folder or vault to the clipboard.";
					console.error(error);
					new Notice(error, 5000);
					validSelection = false;
					continue;
				}

				validSelection = true;
			}
		}

		let htmlPath = await Utils.showSelectFolderDialog(Utils.parsePath(Utils.idealDefaultPath()).dir);
		if (!htmlPath) return false;

		let files = this.app.vault.getFiles();

		for (let i = 0; i < files.length; i++)
		{
			let file = files[i];
			if (file.path.startsWith(folderPath) && file.extension == "md")
			{
				let fullPath = Utils.joinPaths(htmlPath, Utils.parsePath(file.path).dir, file.basename + ".html");
				await this.exportFile(file, fullPath, false);
			}
		}

		new Notice("Folder exported " + folderPath + " to " + htmlPath, 10000);

		return true;
	}
}
