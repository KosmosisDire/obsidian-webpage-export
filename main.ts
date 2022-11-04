import { createWriteStream, open, readdirSync, readFile, write, writeFile, WriteFileOptions } from 'fs';
var JSZip = require("jszip");
import { MarkdownView, Plugin, TAbstractFile, TFile, PaneType, OpenViewState, SplitDirection, FileSystemAdapter, WorkspaceLeaf } from 'obsidian';
import {  ExportSettings } from './settings';
import { saveAs, FileSaverOptions } from 'file-saver';
import { NewWindowEvent } from 'electron';

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;
declare const window: any;

export default class HTMLExportPlugin extends Plugin {

	pluginPath : string = Utils.getVaultPath() + "/.obsidian/plugins/obsidian-webpage-export";
	configPath : string = Utils.getVaultPath() + "/.obsidian";
	leafHandler : LeafHandler = new LeafHandler();

	async onload() 
	{
		console.log('loading obsidian-webpage-export plugin');

		new ExportSettings(this);
		ExportSettings.loadSettings();

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source) => {
				menu.addItem((item) => {item
					.setTitle("Export to HTML")
					.setIcon("document")
					.onClick(async () => 
					{
						this.export(file);
					});
				});
			})
		);
	}

	async export(file: TAbstractFile)
	{
		this.leafHandler.switchToLeafWithFile(file as TFile, true);
						
		// Open the settings modal and wait until it's closed
		var exportCanceled = !await new ExportSettings(this).open();
		if (exportCanceled) return;

		var html = await this.GetCurrentFileHTML();
		if (!html) return;
		
		if(ExportSettings.settings.singleFile)
		{
			Utils.downloadFile(html, file.name.replace(".md", ".html"));
		}
		else
		{
			var appcss = await Utils.getText(this.pluginPath + "/app.css");
			var plugincss = await Utils.getText(this.pluginPath + "/plugin-styles.css");
			var togglejs = await Utils.getText(this.pluginPath + "/toggle.js");
			var themecss = await Utils.getThemeContent(Utils.getCurrentTheme());
			var snippetsList = await Utils.getStyleSnippetsContent();
			var snippetsNames = await Utils.getEnabledSnippets();
			var snippets = "";

			for (var i = 0; i < snippetsList.length; i++)
			{
				snippets += `/* --- ${snippetsNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
			}

			if (ExportSettings.settings.uzeZip)
			{
				Utils.downloadFilesAsZip([
					{ filename: "app.css", data: appcss, type: "text/css" },
					{ filename: "plugin-styles.css", data: plugincss, type: "text/css" },
					{ filename: "toggle.js", data: togglejs, type: "text/javascript" },
					{ filename: "theme.css", data: themecss, type: "text/css" },
					{ filename: "snippets.css", data: snippets, type: "text/css" },
					{ filename: file.name.replace(".md", ".html"), data: html, type: "text/html" }
				], file.name.replace(".md", ".zip"));
			}
			else
			{
				let htmlPath = await Utils.showSaveDialog(Utils.idealDefaultPath(), file.name.replace(".md", ".html"), false);
				if (!htmlPath) return;
				let filename = Utils.getFileNameFromFilePath(htmlPath);
				let folderPath = Utils.getDirectoryFromFilePath(htmlPath);

				Utils.downloadFiles([
					{ filename: "app.css", data: appcss },
					{ filename: "plugin-styles.css", data: plugincss },
					{ filename: "toggle.js", data: togglejs },
					{ filename: "theme.css", data: themecss },
					{ filename: "snippets.css", data: snippets },
					{ filename: filename, data: html }
				], folderPath);
			}
		}
	}

	async GetCurrentFileHTML(): Promise<string | null>
	{
		await Utils.delay(200);

		let view = await Utils.getActiveView();
		if (!view) return null;

		Utils.setLineWidth(ExportSettings.settings.customLineWidth);
		Utils.viewEnableFullRender(view);
		var header = await this.generateHeader(view);

		var html = this.generateBodyHTML();
	
		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle)
		{
			html = await this.injectToggle(html);
		}

		// combine header and body
		html = header + html;

		// enclose in <html> tags
		html = "<!DOCTYPE html>\n<html>\n" + html + "\n</html>";

		return html;
	}

	async generateHeader(view: MarkdownView) : Promise<string>
	{
		let appStyles = await Utils.getText(this.pluginPath + "/app.css");
		let pluginStyles = await Utils.getText(this.pluginPath +"/plugin-styles.css");
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		let snippets = await Utils.getStyleSnippetsContent();
		let snippetNames = Utils.getEnabledSnippets();
		let theme = await Utils.getThemeContent(Utils.getCurrentTheme());

		let scripts = "\n\n<script src='https://code.jquery.com/jquery-3.6.0.js'></script>"
					+ ((ExportSettings.settings.singleFile ? ("<script>\n" + await Utils.getText(this.pluginPath + "/toggle.js"))
					: "<script src='toggle.js'></script>\n") + "\n</script>\n");

		let meta = 
		`
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="mobile-web-app-capable" content="yes">
		<title>${view.file.basename}</title>
		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		`

		if (ExportSettings.settings.singleFile)
		{
			var header = 
			`
			<head>

			${meta}
			
			<!-- Theme Styles ( ${Utils.getCurrentTheme()} ) -->
			<style> ${theme} </style>

			<!-- Snippets: ${snippetNames.join(", ")} -->
			<style> ${snippets.join("</style><style>")} </style>
		
			<!-- Web Export Plugin Styles (light/dark toggle, outline) -->
			<style> ${pluginStyles} </style>

			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${appStyles} </style>
			<style> ${cssSettings} </style>

			${scripts}

			</head>
			`;
		}
		else
		{
			header = 
			`
			<head>

			${meta}

			<link rel="stylesheet" href="app.css">
			<link rel="stylesheet" href="plugin-styles.css">
			<link rel="stylesheet" href="theme.css">
			<link rel="stylesheet" href="snippets.css">

			<style> ${cssSettings} </style>

			${scripts}

			</head>
			`;
		}

		return header;
	}

	generateBodyHTML() : string
	{
		var bodyClasses = document.body.getAttribute("class") ?? "";
		var bodyStyle = document.body.getAttribute("style") ?? "";
		/*@ts-ignore*/
		bodyClasses = bodyClasses.replaceAll("\"", "'");
		/*@ts-ignore*/
		bodyStyle = bodyStyle.replaceAll("\"", "'");
		var html = document.getElementsByClassName("markdown-reading-view")[0].outerHTML;
		
		html = "\n<body class=\"" + bodyClasses + "\" style=\"" + bodyStyle + "\">\n" + html + "\n</body>\n";

		return html;
	}

	async injectToggle(html: string) : Promise<string>
	{
		var darkModeToggle =
		`\n\n
		<div>
		<label class="toggle_inline" for="theme_toggle">
			<input class="toggle__input" type="checkbox" id="theme_toggle">
			<div class="toggle__fill"></div>
		</label>
		</div>
		\n\n`
		
		if (html.contains("\\theme-toggle"))
		{
			/*@ts-ignore*/
			html = html.replaceAll("\\theme-toggle", darkModeToggle);
		}
		else
		{
			//insert fixed toggle in corner
			darkModeToggle = darkModeToggle.replace("toggle_inline", "toggle");
			html = darkModeToggle + html;
		}

		return html;
	}

	onunload() 
	{
		console.log('unloading obsidian-webpage-export plugin');
	}
}

export class Utils
{
	static async delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}


	static async getText(path: string): Promise<string>
	{
		return new Promise((resolve, reject) => {
			open(path, 'r', (err, fd) => {
				if (err) {
					reject(err);
				} else {
					readFile(fd, { encoding: 'utf8' }, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				}
			});
		});
	}

	static changeViewMode(view: MarkdownView, modeName: "preview" | "source")
	{
		/*@ts-ignore*/
		const mode = view.modes[modeName]; 
		/*@ts-ignore*/
		mode && view.setMode(mode);
	};

	static createUnicodeArray(content: string) : Uint8Array
	{
		var charCode, byteArray = [];

		// BE BOM
		byteArray.push(254, 255);

		// LE BOM
		// byteArray.push(255, 254);

		for (var i = 0; i < content.length; ++i) {

		charCode = content.charCodeAt(i);

		// BE Bytes
		byteArray.push((charCode & 0xFF00) >>> 8);
		byteArray.push(charCode & 0xFF);

		// LE Bytes
		// byteArray.push(charCode & 0xff);
		// byteArray.push(charCode / 256 >>> 0);
		}

		return new Uint8Array(byteArray);
	}

	static async showSaveDialog(defaultPath: string, defaultFileName: string, showAllFilesOption: boolean = true): Promise<string | null>
	{
		let type = (defaultFileName.split(".").pop() ?? "txt");

		var filters = [{
			name: type.toUpperCase() + " Files",
			extensions: [type]
		}];

		if (showAllFilesOption)
		{
			filters.push({
				name: "All Files",
				extensions: ["*"]
			});
		}

		console.log(defaultPath + "/" + defaultFileName);

		let picker = await dialog.showSaveDialog({
			defaultPath: (defaultPath + "/" + defaultFileName).replaceAll("\\", "/").replaceAll("//", "/"),
			filters: filters,
			properties: ["showOverwriteConfirmation"]
		})

		if (picker.canceled) return null;
		
		let path = picker.filePath ?? "";

		if (path != "")
		{
			ExportSettings.settings.lastExportPath = path;
			ExportSettings.saveSettings();
		}
		
		return path;
	}

	static idealDefaultPath() : string
	{
		return ExportSettings.settings.lastExportPath == "" ? (Utils.getVaultPath() ?? "") : ExportSettings.settings.lastExportPath;
	}

	static async downloadFile(data: string, filename: string, path: string = "")
	{
		if (path == "")
		{
			path = await Utils.showSaveDialog(Utils.idealDefaultPath(), filename) ?? "";

			if (path == "") return;
		}

		var array = Utils.createUnicodeArray(data);

		writeFile(path, array, (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	}

	static async downloadFilesAsZip(files: {filename: string, data: string, type: string}[], zipFileName: string)
	{
		var blobs = files.map(file => new Blob([file.data], {type: file.type}));
		var zip = new JSZip();
		for (var i = 0; i < files.length; i++)
		{
			zip.file(files[i].filename, blobs[i]);
		}

		var zipBlob = await zip.generateAsync({type: "uint8array"});
		
		var path = await Utils.showSaveDialog(Utils.idealDefaultPath(), zipFileName, false) ?? "";

		if (path == "") return;

		writeFile(path, zipBlob, (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	}

	static async downloadFiles(files: {filename: string, data: string}[], folderPath: string)
	{
		for (var i = 0; i < files.length; i++)
		{
			var array = Utils.createUnicodeArray(files[i].data);
			writeFile(folderPath + "/" + files[i].filename, array, (err) => {
				if (err) throw err;
				console.log('The file has been saved!');
			});
		}
	}

	static getDirectoryFromFilePath(path: string): string
	{
		var forwardIndex = path.lastIndexOf("/");
		var backwardIndex = path.lastIndexOf("\\");
		
		var index = forwardIndex > backwardIndex ? forwardIndex : backwardIndex;

		if (index == -1) return path;

		return path.substring(0, index);
	}

	static getFileNameFromFilePath(path: string): string
	{
		var forwardIndex = path.lastIndexOf("/");
		var backwardIndex = path.lastIndexOf("\\");

		var index = forwardIndex > backwardIndex ? forwardIndex : backwardIndex;

		if (index == -1) return path;

		return path.substring(index + 1);
	}

	static getVaultPath(): string | null
	{
		let adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}

		return null;
	}

	//async function that awaits until a condition is met
	static async waitUntil(condition: () => boolean, timeout: number = 1000, interval: number = 100): Promise<void>
	{
		return new Promise((resolve, reject) => {
			let timer = 0;
			let intervalId = setInterval(() => {
				if (condition()) {
					clearInterval(intervalId);
					resolve();
				} else {
					timer += interval;
					if (timer >= timeout) {
						clearInterval(intervalId);
						reject();
					}
				}
			}, interval);
		});
	}

	static async getThemeContent(themeName: string): Promise<string>
	{
		let themePath = this.getVaultPath() + "/.obsidian/themes/" + themeName + "/theme.css";
		let themeContent = await Utils.getText(themePath);
		return themeContent;
	}

	static getCurrentTheme(): string
	{
		/*@ts-ignore*/ // config does exist
		return app.vault.config?.cssTheme ?? "Default";
	}

	static getEnabledSnippets(): string[]
	{
		/*@ts-ignore*/
		return app.vault.config?.enabledCssSnippets ?? [];
	}

	static async getStyleSnippetsContent(): Promise<string[]>
	{
		let snippetContents : string[] = [];
		let enabledSnippets = this.getEnabledSnippets();

		for (var i = 0; i < enabledSnippets.length; i++)
		{
			snippetContents.push(await Utils.getText(Utils.getVaultPath() + "/.obsidian/snippets/" + enabledSnippets[i] + ".css"));
		}

		return snippetContents;
	}

	static async viewEnableFullRender(view: MarkdownView)
	{
		Utils.changeViewMode(view, "preview");
		await this.delay(200);
		/*@ts-ignore*/
		view.currentMode.renderer.showAll = true;
		/*@ts-ignore*/
		await Utils.waitUntil(() => view ? view.currentMode.renderer.parsing == false : false, 5000, 100); 
	}

	static async getActiveView(): Promise<MarkdownView | null>
	{
		let view = app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
		{
			console.log("Failed to find active view");
			return null;
		}

		return view;
	}

	static setLineWidth(width: number) : void
	{
		if (width != 0)
		{
			document.getElementsByClassName("markdown-preview-sizer markdown-preview-section")[0].setAttribute("style", "max-width: " + width + "px");
		}
	}
}

export class LeafHandler
{
	isMainPanelLeaf(leaf: WorkspaceLeaf): boolean 
	{
		const { workspace } = app;
		const root = leaf?.getRoot();
		/*@ts-ignore*/
		return root === workspace.rootSplit || root === workspace.floatingSplit;
	}

	getOpenLeaves(excludeMainPanelViewTypes?: string[], includeSidePanelViewTypes?: string[]): WorkspaceLeaf[] 
	{
		const leaves: WorkspaceLeaf[] = [];

		const saveLeaf = (l: WorkspaceLeaf) => {
		const viewType = l.view?.getViewType();

		if (this.isMainPanelLeaf(l)) {
			if (!excludeMainPanelViewTypes?.includes(viewType)) {
			leaves.push(l);
			}
		} else if (includeSidePanelViewTypes?.includes(viewType)) {
			leaves.push(l);
		}
		};

		app.workspace.iterateAllLeaves(saveLeaf);
		return leaves;
	}

	openFileInNewLeaf( // from obsidian-switcher-plus by darlal: https://github.com/darlal/obsidian-switcher-plus/blob/27d337039883008bcbf40ca13ea2f9287469dde4/src/Handlers/handler.ts#L388
		file: TFile,
		navType: PaneType | boolean,
		openState?: OpenViewState,
		errorContext?: string,
		splitDirection: SplitDirection = 'vertical',
	): void 
	{
		const { workspace } = app;
		errorContext = errorContext ?? '';
		const message = `Switcher++: error opening file. ${errorContext}`;

		const getLeaf = () => {
			return navType === 'split'
				? workspace.getLeaf(navType, splitDirection)
				: workspace.getLeaf(navType);
		};

		try {
			getLeaf()
				.openFile(file, openState)
				.catch((reason) => {
					console.log(message, reason);
				});
		} catch (error) {
			console.log(message, error);
		}
	}

	getLeafByFile(file: TFile): WorkspaceLeaf | null
	{
		const leaves = this.getOpenLeaves();
		for (let leaf of leaves) {
			if (leaf.view instanceof MarkdownView) 
			{
				if (leaf.view.file.path === file.path) {
					return leaf;
				}
			}
		}

		return null;
	}

	switchToLeafWithFile(file: TFile, openNewIfNotOpen: boolean): void
	{
		const { workspace } = app;
		const leaf = this.getLeafByFile(file);

		if (leaf) 
		{
			workspace.setActiveLeaf(leaf);
		}
		else if (openNewIfNotOpen)
		{
			this.openFileInNewLeaf(file, true, { active: true }, "Failed to open file to new tab after it was found to not be open yet.");
		}
	}
}

