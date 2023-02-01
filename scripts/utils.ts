import {  readFile, writeFile, existsSync, mkdirSync } from 'fs';
import { FileSystemAdapter, MarkdownView, Notice, TextFileView, TFile } from 'obsidian';
import { ExportSettings } from './settings';
import { fileURLToPath } from 'url';
import process from 'process';
const pathTools = require('upath');

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;

export class Utils
{
	static async delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}

	static parsePath(path: string): { root: string, dir: string, base: string, ext: string, name: string, fullPath: string }
	{
		path = this.makePathUnicodeCompatible(path);
		let parsed = pathTools.parse(path);
		if(path.endsWith("/") || parsed.ext == "") 
		{
			parsed.dir = pathTools.normalizeSafe(path);
			parsed.base = "";
		}

		let fullPath = pathTools.join(parsed.dir, parsed.base);

		return { root: parsed.root, dir: parsed.dir, base: parsed.base, ext: parsed.ext, name: parsed.name, fullPath: fullPath };
	}

	static parseFullPath(path: string): string
	{
		return this.parsePath(path).fullPath;
	}

	static joinPaths(...paths: string[]): string
	{
		return this.makePathUnicodeCompatible(pathTools.join(...paths));
	}

	static pathExists(path: string, showErrors: boolean = true): boolean
	{
		if(!existsSync(path))
		{ 
			if(showErrors) new Notice("Error: Path does not exist: \n\n" + path, 10000);
			if(showErrors) console.error("Path does not exist: " + path);
			return false;
		}

		return true;
	}

	static createDirectory(path: string)
	{
		path = this.parsePath(this.getAbsolutePath(path, false) ?? path).dir;

		console.log("Checking directory exists: " + path);

		if (!this.pathExists(path, false))
		{
			console.log("Creating directory at: " + path);
			mkdirSync(path, { recursive: true });
		}
	}

	static makePathUnicodeCompatible(path: string): string
	{
		return decodeURI(path);
	}

	static pathIsAbsolute(path: string): boolean
	{
		if(process.platform == "win32")
		{
			if (path.match(/^[A-Za-z]:[\\|\/]/)) return true;
			else return false;
		}
		else
		{
			if (path.match(/^[\/]/)) return true;
			else return false;
		}
	}

	static forceRelativePath(path: string, forcePOSIX: boolean = false): string
	{
		path = path.replaceAll("\\", "/");

		if(process.platform == "win32" && !forcePOSIX)
		{
			if(!path.startsWith("/")) return "/" + path;
		}
		else
		{
			if(path.startsWith("/")) return path.slice(1);
		}

		return path;
	}

	static forceAbsolutePath(path: string, forcePOSIX: boolean = false): string
	{
		path = path.replaceAll("\\", "/");

		if(process.platform == "win32" && !forcePOSIX)
		{
			if(path.startsWith("/")) return path = Utils.trimStart(path, "/");
		}
		else
		{
			if(!path.startsWith("/")) return "/" + path;
		}

		return path;
	}

	static getAbsolutePath(path: string, mustExist: boolean = true, workingDirectory: string = this.getVaultPath()): string | undefined
	{
		let reliablePath = this.parseFullPath(path);

		if (!Utils.pathIsAbsolute(reliablePath))
		{
			reliablePath = this.joinPaths(workingDirectory, reliablePath);
		}

		if (mustExist && !this.pathExists(reliablePath)) return undefined;

		return this.makePathUnicodeCompatible(reliablePath);
	}

	static getRelativePath(path: string, workingDirectory: string = this.getVaultPath()) : string
	{
		let absolutePath = this.getAbsolutePath(Utils.parsePath(path).dir);
		let absoluteWorkingDirectory = this.getAbsolutePath(Utils.parsePath(workingDirectory).dir);

		if (!absolutePath || !absoluteWorkingDirectory) return path;

		return pathTools.relative(absoluteWorkingDirectory, absolutePath);
	}

	static async getText(path: string): Promise<string>
	{
		let absolutePath = this.getAbsolutePath(path);
		if (!absolutePath) return "";

		return new Promise((resolve, reject) =>
		{
			readFile(absolutePath as string, { encoding: 'utf8' }, (err, data) => 
			{
				if (err)
				{
					new Notice("Error: could not read text file at path: \n\n" + path + "\n\n" + err, 10000);
					console.error("Error: could not read text file at path: \n\n" + path + "\n\n" + err);
					reject(err);
				}
				else resolve(data);
			});
		});
	}

	// static fixPath(path: string) : string
	// {
	// 	let filePath = path;
	// 	if (!filePath.contains('file:///'))
	// 	{
	// 		if(pathTools.resolve(filePath) === pathTools.normalize(filePath)) // if it's an absolute path
	// 		{
	// 			filePath = 'file:///' + filePath;
	// 		}
	// 		else
	// 		{
	// 			filePath = "file:///" + this.getVaultPath() + "/" + filePath;
	// 		}
	// 	}

	// 	try
	// 	{
	// 		return fileURLToPath(filePath);
	// 	}
	// 	catch
	// 	{
	// 		new Notice("Error: Invalid path to file: " + filePath);
	// 		return path;
	// 	}
	// }

	static async getTextBase64(path: string): Promise<string>
	{
		let absolutePath = this.getAbsolutePath(path);
		if (!absolutePath) return "";

		return new Promise((resolve, reject) =>
		{
			readFile(absolutePath as string, { encoding: 'base64' }, (err, data) => 
			{
				if (err)
				{
					new Notice("Error: could not read base64 text file at path: \n\n" + path + "\n\n" + err, 10000);
					console.error("Error: could not read base64 text file at path: \n\n" + path + "\n\n" + err);
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
		// get paths
		let absoluteDefaultPath = this.getAbsolutePath(this.parsePath(defaultPath).dir);
		if (!absoluteDefaultPath) absoluteDefaultPath = this.getVaultPath();
		absoluteDefaultPath += "/" + defaultFileName;

		let defaultPathParsed = this.parsePath(absoluteDefaultPath);
		
		// add filters
		let filters = [{
			name: Utils.trimStart(defaultPathParsed.ext, ".").toUpperCase() + " Files",
			extensions: [Utils.trimStart(defaultPathParsed.ext, ".")]
		}];

		if (showAllFilesOption)
		{
			filters.push({
				name: "All Files",
				extensions: ["*"]
			});
		}

		// show picker
		let picker = await dialog.showSaveDialog({
			defaultPath: defaultPathParsed.fullPath,
			filters: filters,
			properties: ["showOverwriteConfirmation"]
		})

		if (picker.canceled) return null;
		
		let pickedPath = picker.filePath;
		ExportSettings.settings.lastExportPath = Utils.parsePath(pickedPath).fullPath;
		ExportSettings.saveSettings();
		
		return pickedPath;
	}

	static async showSelectFolderDialog(defaultPath: string): Promise<string | null>
	{
		// get paths
		let absoluteDefaultPath = this.getAbsolutePath(defaultPath);
		if (!absoluteDefaultPath) absoluteDefaultPath = this.getVaultPath();

		// show picker
		let picker = await dialog.showOpenDialog({
			defaultPath: Utils.parsePath(absoluteDefaultPath).dir,
			properties: ["openDirectory"]
		});

		if (picker.canceled) return null;

		let path = picker.filePaths[0];
		ExportSettings.settings.lastExportPath = Utils.parsePath(path).dir;
		ExportSettings.saveSettings();

		return path;
	}

	static idealDefaultPath() : string
	{
		return ExportSettings.settings.lastExportPath == "" ? Utils.getVaultPath() : Utils.parsePath(ExportSettings.settings.lastExportPath).dir;
	}

	static async downloadFile(data: string, filename: string, path: string = "")
	{
		if (path == "")
		{
			path = await Utils.showSaveDialog(Utils.idealDefaultPath(), filename) ?? "";
			if (path == "") return;
		}

		let absolutePath = this.getAbsolutePath(path, false);
		if (!absolutePath) return "";

		this.createDirectory(absolutePath);

		let array = Utils.createUnicodeArray(data);

		writeFile(absolutePath, array, (err) => 
		{
			if (err)
			{
				console.error("Error: could not write file at path: \n\n" + absolutePath + "\n\n" + err);
				new Notice("Error: could not write file at path: \n\n" + absolutePath + "\n\n" + err, 10000);
			}
		});
	}

	static async downloadFiles(files: {filename: string, data: string, type?: string, relativePath?: string, unicode?: boolean}[], folderPath: string)
	{
		for (let i = 0; i < files.length; i++)
		{
			let array = (files[i].unicode ?? true) ? Utils.createUnicodeArray(files[i].data) : Buffer.from(files[i].data, 'base64');

			let parsedPath = this.parsePath(this.joinPaths(folderPath, files[i].relativePath ?? "", files[i].filename));
			
			this.createDirectory(parsedPath.fullPath);
			
			writeFile(parsedPath.fullPath, array, (err) => 
			{
				if (err) 
				{
					console.error("Error: could not write file at path: \n\n" + parsedPath.fullPath + "\n\n" + err);
					new Notice("Error: could not write file at path: \n\n" + parsedPath.fullPath + "\n\n" + err, 10000);
				}
			});
		}
	}

	static getVaultPath(): string
	{
		let adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) 
		{
			return this.parsePath(adapter.getBasePath() ?? "").fullPath;
		}

		return "";
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
		let themePath = this.getAbsolutePath(`/.obsidian/themes/${themeName}/theme.css`);
		if (!themePath) return "/* Error: Theme not found */";

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
			snippetContents.push(await Utils.getText(`/.obsidian/snippets/${enabledSnippets[i]}.css`));
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

	static async getRendererHeight(view: MarkdownView, rerender: boolean = false): Promise<number>
	{
		if(rerender) await Utils.viewEnableFullRender(view);

		/*@ts-ignore*/
		let height = view.previewMode.renderer.sizerEl.offsetHeight;

		return height;
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

	static findFileInVaultByName(name: string): TFile | undefined
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

	static beautifyHTML(html: string) : string
	{
		var div = document.createElement('div');
		div.innerHTML = html.trim();
	
		return this._beautifyhtmlrecursive(div, 0).innerHTML;
	}

	static _beautifyhtmlrecursive(node: Element, level: number) : Element
	{
		var indentBefore = new Array(level++ + 1).join('  '),
			indentAfter  = new Array(level - 1).join('  '),
			textNode;
	
		for (var i = 0; i < node.children.length; i++) {
	
			textNode = document.createTextNode('\n' + indentBefore);
			node.insertBefore(textNode, node.children[i]);
	
			this._beautifyhtmlrecursive(node.children[i], level);
	
			if (node.lastElementChild == node.children[i]) {
				textNode = document.createTextNode('\n' + indentAfter);
				node.appendChild(textNode);
			}
		}
	
		return node;
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
