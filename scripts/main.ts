// imports from obsidian API
import { MarkdownRenderChild, Plugin, TAbstractFile, TFile, TFolder} from 'obsidian';

// modules that are part of the plugin
import { ExportSettings } from './settings';
import { Utils } from './utils';
import { LeafHandler } from './leaf-handler';
import { HTMLGenerator } from './html-gen';
import { open } from 'fs';
import { fileURLToPath } from 'url';

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

	async onload()
	{
		console.log('loading obsidian-webpage-export plugin');

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
						.setIcon("document")
						.onClick(() =>
						{
							if(file instanceof TFile)
							{
								this.exportFile(file);
							}
							else if(file instanceof TFolder)
							{
								this.exportFolder(file.path);
							}
							else
							{
								console.error("File is not a TFile or TFolder, invalid type: " + typeof file + "");
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

		// init html generator
		this.htmlGenerator.initialize();
	}

	onunload()
	{
		console.log('unloading obsidian-webpage-export plugin');
	}

	async exportFile(file: TAbstractFile, fullPath: string = "", showSettings: boolean = true)
	{
		// Open the settings modal and wait until it's closed
		let onlyCopy = false;
		if (showSettings)
		{
			let result = await new ExportSettings(this).open();
			if (result.canceled) return;
			onlyCopy = result.onlyCopy;
		}

		let fileTab = this.leafHandler.openFileInNewLeaf(file as TFile, true);

		let htmlEl : HTMLHtmlElement | null = await this.htmlGenerator.getCurrentFileHTML();
		if (!htmlEl) return;

		let htmlText = htmlEl.outerHTML;

		let toDownload = await this.htmlGenerator.getSeperateFilesToDownload();

		// Close the file tab after HTML is generated
		fileTab.detach();

		// if onlyCopy is true, then we don't want to download the file, we just want to copy it to the clipboard
		if (onlyCopy)
		{
			navigator.clipboard.writeText(htmlText);
			return;
		}

		// Download files
		let htmlDownload = { filename: file.name.replace(".md", ".html"), data: htmlText, type: "text/html" };
		toDownload.push(htmlDownload);

		let htmlPath: string | null = fullPath;
		if (htmlPath == "")
			htmlPath = await Utils.showSaveDialog(Utils.idealDefaultPath(), file.name.replace(".md", ".html"), false);

		if (!htmlPath) return;

		let filename = Utils.getFileNameFromFilePath(htmlPath);
		let folderPath = Utils.getDirectoryFromFilePath(htmlPath);

		toDownload[toDownload.length - 1].filename = filename;

		await Utils.downloadFiles(toDownload, folderPath);
	}

	async exportFolder(folderPath: string)
	{
		// folder path is the path relative to the vault that we are exporting

		// Open the settings modal and wait until it's closed
		let exportCanceled = !await new ExportSettings(this).open();
		if (exportCanceled) return;

		let htmlPath = await Utils.showSelectFolderDialog(Utils.idealDefaultPath());

		let files = this.app.vault.getFiles();

		for (let i = 0; i < files.length; i++)
		{
			let file = files[i];
			if (file.path.startsWith(folderPath) && file.extension == "md")
			{
				let fullPath = htmlPath + "/" + file.path.replace(".md", ".html");
				await this.exportFile(file, fullPath, false);
			}
		}
	}
}
