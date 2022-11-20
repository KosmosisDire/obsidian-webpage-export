import { open, readFile, writeFile, existsSync, mkdirSync } from 'fs';
import { FileSystemAdapter, MarkdownView, TextFileView, TFile } from 'obsidian';
import { ExportSettings } from './settings';
var JSZip = require("jszip");

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;

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

	static async getTextBase64(path: string): Promise<string>
	{
		return new Promise((resolve, reject) => {
			open(path, 'r', (err, fd) => {
				if (err) {
					reject(err);
				} else {
					readFile(fd, { encoding: 'base64' }, (err, data) => {
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

	static async showSelectFolderDialog(defaultPath: string): Promise<string | null>
	{
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath,
			properties: ["openDirectory"]
		});

		if (picker.canceled) return null;

		let path = picker.filePaths[0] ?? "";

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

	static async downloadFilesAsZip(files: {filename: string, data: string, type: string, relativePath?: string}[], zipFileName: string)
	{
		var blobs = files.map(file => new Blob([file.data], {type: file.type}));
		var zip = new JSZip();
		for (var i = 0; i < files.length; i++)
		{
			let path = ((files[i].relativePath ?? "") + "/" + files[i].filename).replaceAll("//", "/");
			zip.file(path, blobs[i]);
		}

		var zipBlob = await zip.generateAsync({type: "uint8array"});
		
		var path = await Utils.showSaveDialog(Utils.idealDefaultPath(), zipFileName, false) ?? "";

		if (path == "") return;

		writeFile(path, zipBlob, (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	}

	static async downloadFiles(files: {filename: string, data: string, type?: string, relativePath?: string, unicode?: boolean}[], folderPath: string)
	{
		for (var i = 0; i < files.length; i++)
		{
			var array = (files[i].unicode ?? true) ? Utils.createUnicodeArray(files[i].data) : Buffer.from(files[i].data, 'base64');

			let path = (folderPath + "/" + (files[i].relativePath ?? "") + "/" + files[i].filename).replaceAll("\\", "/").replaceAll("//", "/").replaceAll("//", "/");
			
			let dir = Utils.getDirectoryFromFilePath(path);
			if (!existsSync(dir))
			{
				mkdirSync(dir, { recursive: true });
			}
			
			writeFile(path, array, (err) => {
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

		if (index == -1) return "";

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
			return adapter.getBasePath().replaceAll("\\", "/");
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
		if (!existsSync(themePath)) return "";
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
		view.previewMode.renderer.showAll = true;
		/*@ts-ignore*/
		await view.previewMode.renderer.unfoldAllHeadings();
		await Utils.delay(300);
		/*@ts-ignore*/
		await view.previewMode.renderer.rerender();
	}

	static async getActiveView(): Promise<TextFileView | null>
	{
		let view = app.workspace.getActiveViewOfType(TextFileView);
		if (!view)
		{
			console.log("Failed to find active view");
			return null;
		}

		return view;
	}

	static getFirstFileByName(name: string): TFile | undefined
	{
		return app.vault.getFiles().find(file =>
		{
			if(!name) return false;
			return file.basename == name;
		});
	}

	static setLineWidth(width: number) : void
	{
		if (width != 0)
		{
			let sizers = document.getElementsByClassName("markdown-preview-sizer markdown-preview-section");
			if (sizers.length > 0)
				sizers[0].setAttribute("style", "max-width: " + width + "px");
		}
	}
}
