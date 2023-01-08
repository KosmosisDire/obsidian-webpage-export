import { open, readFile, writeFile, existsSync, mkdirSync, close } from 'fs';
import { FileSystemAdapter, MarkdownView, TextFileView, TFile } from 'obsidian';
import { ExportSettings } from './settings';
import JSZip from "jszip";
import { fileURLToPath } from 'url';

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;

export class Utils
{
	static async delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}

	static makePathUnicode(path: string) : string
	{
		let newPath = path;
		return newPath;
	}


	static async getText(path: string): Promise<string>
	{
		path = this.fixPath(path);

		if(!existsSync(path))
		{ 
			console.log("File not found: " + path); 
			return "";
		}

		return new Promise((resolve, reject) =>
		{
			readFile(path, { encoding: 'utf8' }, (err, data) => 
			{
				if (err)
				{
					console.error("Error:" + err);
					reject(err);
				}
				else resolve(data);
			});
		});
	}

	static fixPath(path: string) : string
	{
		if (!path.contains('file:///'))
		{
			if(path.contains(':'))
				path = 'file:///' + path;
			else
				path = fileURLToPath("file:///" + this.getVaultPath() + "/" + path);
		}

		return fileURLToPath(path);
	}

	static async getTextBase64(path: string): Promise<string>
	{
		path = this.fixPath(path);

		if(!existsSync(path))
		{
			console.log("File not found: " + path); 
			return "";
		}

		console.log(path);

		return new Promise((resolve, reject) =>
		{
			readFile(path, { encoding: 'base64' }, (err, data) => 
			{
				if (err)
				{
					console.error("Error:" + err);
					reject(err);
				}
				else resolve(data);
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
		let charCode, byteArray = [];

		// BE BOM
		byteArray.push(254, 255);

		for (let i = 0; i < content.length; ++i) 
		{
			charCode = content.charCodeAt(i);

			// BE Bytes
			byteArray.push((charCode & 0xFF00) >>> 8);
			byteArray.push(charCode & 0xFF);
		}

		return new Uint8Array(byteArray);
	}

	static async showSaveDialog(defaultPath: string, defaultFileName: string, showAllFilesOption: boolean = true): Promise<string | null>
	{
		let type = (defaultFileName.split(".").pop() ?? "txt");

		let filters = [{
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

		let array = Utils.createUnicodeArray(data);

		writeFile(Utils.fixPath(path), array, (err) => {
			if (err) throw err;
			console.log('The file has been saved at ' + path + '!');
		});
	}

	static async downloadFilesAsZip(files: {filename: string, data: string, type: string, relativePath?: string}[], zipFileName: string)
	{
		let blobs = files.map(file => new Blob([file.data], {type: file.type}));
		let zip = new JSZip();
		for (let i = 0; i < files.length; i++)
		{
			let path = ((files[i].relativePath ?? "") + "/" + files[i].filename).replaceAll("//", "/");
			zip.file(path, blobs[i]);
		}

		let zipBlob = await zip.generateAsync({type: "uint8array"});
		
		let path = await Utils.showSaveDialog(Utils.idealDefaultPath(), zipFileName, false) ?? "";

		if (path == "") return;

		writeFile(Utils.fixPath(path), zipBlob, (err) => {
			if (err) throw err;
			console.log('The file has been saved at ' + path + '!');
		});
	}

	static async downloadFiles(files: {filename: string, data: string, type?: string, relativePath?: string, unicode?: boolean}[], folderPath: string)
	{
		for (let i = 0; i < files.length; i++)
		{
			let array = (files[i].unicode ?? true) ? Utils.createUnicodeArray(files[i].data) : Buffer.from(files[i].data, 'base64');

			let path = (folderPath + "/" + (files[i].relativePath ?? "") + "/" + files[i].filename).replaceAll("\\", "/").replaceAll("//", "/").replaceAll("//", "/");
			
			let dir = Utils.getDirectoryFromFilePath(path);
			if (!existsSync(dir))
			{
				mkdirSync(dir, { recursive: true });
			}
			
			writeFile(Utils.fixPath(path), array, (err) => {
				if (err) throw err;
				console.log('The file has been saved at ' + path + '!');
			});
		}
	}

	static getDirectoryFromFilePath(path: string): string
	{
		let forwardIndex = path.lastIndexOf("/");
		let backwardIndex = path.lastIndexOf("\\");
		
		let index = forwardIndex > backwardIndex ? forwardIndex : backwardIndex;

		if (index == -1) return "";

		return path.substring(0, index);
	}

	static getFileNameFromFilePath(path: string): string
	{
		let forwardIndex = path.lastIndexOf("/");
		let backwardIndex = path.lastIndexOf("\\");

		let index = forwardIndex > backwardIndex ? forwardIndex : backwardIndex;

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

		for (let i = 0; i < enabledSnippets.length; i++)
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

	static getActiveView(): TextFileView | null
	{
		let view = app.workspace.getActiveViewOfType(TextFileView);
		if (!view)
		{
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
			let sizers = document.querySelectorAll(".workspace-leaf.mod-active .markdown-preview-sizer");
			if (sizers.length > 0)
			{
				sizers[0].setAttribute("style", `${sizers[0].getAttr("style") ?? ""} max-width: ${width}px; width: unset;`);
			}
		}
	}

	static trimEnd(inputString: string, trimString: string): string
	{
		if (inputString.endsWith(trimString))
		{
			return inputString.substring(0, inputString.length - trimString.length);
		}

		return inputString;
	}

	static trimStart(inputString: string, trimString: string): string
	{
		if (inputString.startsWith(trimString))
		{
			return inputString.substring(trimString.length);
		}

		return inputString;
	}
}
