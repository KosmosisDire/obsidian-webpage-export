// imports from obsidian API
import { Plugin, TAbstractFile, TFile} from 'obsidian';

// modules that are part of the plugin
import { ExportSettings } from './settings';
import { Utils } from './utils';
import { LeafHandler } from './leaf-handler';
import { HTMLGenerator } from './html-gen';

export default class HTMLExportPlugin extends Plugin
{
	leafHandler: LeafHandler = new LeafHandler();
	htmlGenerator: HTMLGenerator = new HTMLGenerator();

	addTogglePostprocessor()
	{
		this.registerMarkdownCodeBlockProcessor("theme-toggle", (source, el, ctx) =>
		{
			let parent = el.createEl('div');
			parent.innerHTML = this.htmlGenerator.darkModeToggle;
		});

		//also replace `theme-toggle` and ```theme-toggle``` for better inline toggles, or in places you couldn't use a normal code block
		this.registerMarkdownPostProcessor((element, context) =>
		{
			let codeBlocks = element.querySelectorAll('code, span.cm-inline-code');
			codeBlocks.forEach((codeBlock) =>
			{
				// console.log(codeBlock);
				if (codeBlock instanceof HTMLElement && codeBlock.innerText == "theme-toggle")
				{
					codeBlock.outerHTML = this.htmlGenerator.darkModeToggle;
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
						.onClick(async () =>
						{
							if (Utils.getFileNameFromFilePath(file.path).contains("."))
								this.exportFile(file);

							else
								this.exportFolder(file.path);
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

		var html = await this.htmlGenerator.GetCurrentFileHTML();
		if (!html) return;

		let toDownload = await this.htmlGenerator.getSeperateFilesToDownload();

		// Close the file tab after HTML is generated
		fileTab.detach();


		// if onlyCopy is true, then we don't want to download the file, we just want to copy it to the clipboard
		if (onlyCopy)
		{
			navigator.clipboard.writeText(html);
			return;
		}

		// Download files
		var htmlDownload = { filename: file.name.replace(".md", ".html"), data: html, type: "text/html" };
		toDownload.push(htmlDownload);

		var htmlPath: string | null = fullPath;
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
		var exportCanceled = !await new ExportSettings(this).open();
		if (exportCanceled) return;

		let htmlPath = await Utils.showSelectFolderDialog(Utils.idealDefaultPath());

		var files = this.app.vault.getFiles();

		for (var i = 0; i < files.length; i++)
		{
			var file = files[i];
			if (file.path.startsWith(folderPath) && file.extension == "md")
			{
				var fullPath = htmlPath + "/" + file.path.replace(".md", ".html");
				await this.exportFile(file, fullPath, false);
			}
		}
	}
}
