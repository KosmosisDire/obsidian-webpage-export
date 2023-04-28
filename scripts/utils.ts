import {  readFile, writeFile, existsSync, mkdirSync, PathLike } from 'fs';
import { FileSystemAdapter, MarkdownView, Notice, PluginManifest, TextFileView, TFile } from 'obsidian';
import { ExportSettings } from './export-settings';
import process from 'process';
import { css } from 'jquery';
const pathTools = require('upath');

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;

export class Downloadable
{
	filename: string = "";
	content: string | Buffer = "";
	type: string = "text/plain";
	relativeDownloadPath: Path;
	useUnicode: boolean = true;

	constructor(filename: string, content: string | Buffer, type: string = "text/plain", vaultRelativeDestination: Path, useUnicode: boolean = true)
	{
		this.filename = filename;
		this.content = content;
		this.type = type;
		this.relativeDownloadPath = vaultRelativeDestination;
		this.useUnicode = useUnicode;
	}
}

export class Path
{
	private _root: string = "";
	private _dir: string = "";
	private _parent: string = "";
	private _base: string = "";
	private _ext: string = "";
	private _name: string = "";
	private _fullPath: string = "";
	private _isDirectory: boolean = false;
	private _isFile: boolean = false;
	private _exists: boolean | undefined = undefined;
	private _workingDirectory: string;

	private _isWindows: boolean = process.platform == "win32";

	constructor(path: string, workingDirectory: string = Path.vaultPath.asString)
	{
		this._workingDirectory = Path.parsePath(workingDirectory).fullPath;

		this.reparse(path);

		if (this.isAbsolute) this._workingDirectory = "";
	}

	reparse(path: string): Path
	{
		let parsed = Path.parsePath(path);
		this._root = parsed.root;
		this._dir = parsed.dir;
		this._parent = parsed.parent;
		this._base = parsed.base;
		this._ext = parsed.ext;
		this._name = parsed.name;
		this._fullPath = parsed.fullPath;
		this._isDirectory = this._ext == "";
		this._isFile = this._ext != "";
		this._exists = undefined;

		// if (this._isWindows)
		// {
		// 	this._root = this._root.replaceAll("/", "\\");
		// 	this._dir = this._dir.replaceAll("/", "\\");
		// 	this._parent = this._parent.replaceAll("/", "\\");
		// 	this._fullPath = this._fullPath.replaceAll("/", "\\");
		// }

		this._exists; // force a re-evaluation of the exists property which will also throw an error if the path does not exist
		return this;
	}

	private static makePathUnicodeCompatible(path: string): string
	{
		return decodeURI(path);
	}

	private static parsePath(path: string): { root: string, dir: string, parent: string, base: string, ext: string, name: string, fullPath: string }
	{
		path = this.makePathUnicodeCompatible(path);
		let parsed = pathTools.parse(path);

		let parent = parsed.dir;
		if(path.endsWith("/") || path.endsWith("\\") || parsed.ext == "")
		{
			parsed.dir = pathTools.normalizeSafe(path);
		}


		let fullPath = pathTools.join(parent, parsed.base);

		return { root: parsed.root, dir: parsed.dir, parent: parent, base: parsed.base, ext: parsed.ext, name: parsed.name, fullPath: fullPath };
	}

	private static pathExists(path: string): boolean
	{
		return existsSync(path);
	}

	private static joinStringPaths(...paths: string[]): string
	{
		return this.makePathUnicodeCompatible(pathTools.join(...paths));
	}

	public static joinPath(...paths: Path[]): Path
	{
		return new Path(Path.joinStringPaths(...paths.map(p => p.asString)), paths[0]._workingDirectory);
	}

	public static joinStrings(...paths: string[]): Path
	{
		return new Path(Path.joinStringPaths(...paths));
	}
	
	/**
	 * @param from The source path / working directory
	 * @param to The destination path
	 * @returns The relative path to the destination from the source
	 */
	public static getRelativePath(from: Path, to: Path, useAbsolute: boolean = false): Path
	{
		let fromUse = useAbsolute ? from.absolute() : from;
		let toUse = useAbsolute ? to.absolute() : to;
		let relative = pathTools.relative(fromUse.directory.asString, toUse.asString);
		let workingDir = from.absolute().directory.asString;
		return new Path(relative, workingDir);
	}

	public static getRelativePathFromVault(path: Path): Path
	{
		return Path.getRelativePath(Path.vaultPath, path);
	}

	private static vaultPathCache: Path | undefined = undefined;
	static get vaultPath(): Path
	{
		if (this.vaultPathCache != undefined) return this.vaultPathCache;

		let adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) 
		{
			let basePath = adapter.getBasePath() ?? "";
			this.vaultPathCache = new Path(basePath, "");
			return this.vaultPathCache;
		}
		
		throw new Error("Vault path could not be determined");
	}

	static get emptyPath(): Path
	{
		return new Path("", "");
	}

	static get rootPath(): Path
	{
		return new Path("/", "");
	}
	
	static toWebStyle(path: string): string
	{
		return path.replaceAll(" ", "-").toLowerCase();
	}

	joinString(...paths: string[]): Path
	{
		return this.copy.reparse(Path.joinStringPaths(this.asString, ...paths));
	}

	join(...paths: Path[]): Path
	{
		return new Path(Path.joinStringPaths(this.asString, ...paths.map(p => p.asString)), this._workingDirectory);
	}

	makeAbsolute(workingDirectory: string = this._workingDirectory): Path
	{
		if (!this.isAbsolute)
		{
			this._fullPath = Path.joinStringPaths(workingDirectory, this.asString);
			this._workingDirectory = "";
			this.reparse(this.asString);
		}

		return this;
	}

	makeNormalized(): Path
	{
		let fullPath = pathTools.normalizeSafe(this.absolute().asString);
		let newWorkingDir = "";
		let newFullPath = "";
		let reachedEndOfWorkingDir = false;
		for (let i = 0; i < fullPath.length; i++)
		{
			let fullChar = fullPath.charAt(i);
			let workingChar = this.workingDirectory.charAt(i);
			if (fullChar == workingChar && !reachedEndOfWorkingDir)
			{
				newWorkingDir += fullChar;
				continue;
			}

			reachedEndOfWorkingDir = true;
			newFullPath += fullChar;
		}

		this.reparse(newFullPath);
		this._workingDirectory = newWorkingDir;

		return this;
	}

	normalized(): Path
	{
		return this.copy.makeNormalized();
	}

	makeRootAbsolute(): Path
	{
		if (!this.isAbsolute)
		{
			if (this._isWindows)
			{
				if(this._fullPath.contains(":"))
				{
					this._fullPath = this.asString.substring(this._fullPath.indexOf(":") - 1);
				}
				else
				{
					this._fullPath = "\\" + this.asString;
				}
			}
			else
			{
				this._fullPath = "/" + this.asString;
			}

			this.reparse(this.asString);
		}

		return this;
	}

	setWorkingDirectory(workingDirectory: string): Path
	{
		this._workingDirectory = workingDirectory;
		return this;
	}

	makeRootRelative(): Path
	{
		if (this.isAbsolute)
		{
			if (this._isWindows)
			{
				// replace the drive letter and colon with nothing
				this._fullPath = this.asString.replace(/^.:\/\//i, "").replace(/^.:\//i, "");
				this._fullPath = Utils.trimStart(this._fullPath, "\\");
			}
			else
			{
				this._fullPath = Utils.trimStart(this._fullPath, "/");
			}

			this.reparse(this.asString);
		}

		return this;
	}

	makeWebStyle(): Path
	{
		this._fullPath = this.asString.replaceAll(" ", "-").toLowerCase();
		this.reparse(this.asString);
		return this;
	}

	makeWindowsStyle(): Path
	{
		this._isWindows = true;
		this._fullPath = this.asString.replaceAll("/", "\\");
		this.reparse(this.asString);
		return this;
	}

	makeUnixStyle(): Path
	{
		this._isWindows = false;
		this._fullPath = this.asString.replaceAll("\\", "/").replace(/^.:\/\//i, "/");
		this.reparse(this.asString);
		return this;
	}

	setExtension(extension: string): Path
	{
		if (!extension.contains(".")) extension = "." + extension;

		this._ext = extension;
		this._base = this._name + this._ext;
		this._fullPath = Path.joinStringPaths(this._dir, this._base);

		this.reparse(this._fullPath);
		return this;
	}

	// overide the default toString() method
	toString(): string
	{
		return this.asString;
	}

	/**
	 * The root of the path
	 * @example
	 * "C:/" or "/".
	 */
	get root(): string
	{
		return this._root;
	}

	/**
	 * The parent directory of the file, or if the path is a directory this will be the full path.
	 * @example
	 * "C:/Users/JohnDoe/Documents" or "/home/johndoe/Documents".
	 */
	get directory(): Path
	{
		return new Path(this._dir, this._workingDirectory);
	}

	/**
	 * Same as dir, but if the path is a directory this will be the parent directory not the full path.
	 */
	get parent(): Path
	{
		return new Path(this._parent, this._workingDirectory);
	}

	/**
	 * The name of the file or folder including the extension.
	 * @example
	 * "file.txt" or "Documents".
	 */
	get fullName(): string
	{
		return this._base;
	}

	/**
	 * The extension of the file or folder.
	 * @example
	 * ".txt" or "".
	 */
	get extenstion(): string
	{
		return this._ext;
	}

	get extensionName(): string
	{
		return this._ext.replace(".", "");
	}

	/**
	 * The name of the file or folder without the extension.
	 * @example
	 * "file" or "Documents".
	 */
	get basename(): string
	{
		return this._name;
	}

	/**
	 * The full path of the file or folder.
	 * @example
	 * "C:/Users/John Doe/Documents/file.txt"
	 * "/home/john doe/Documents/file.txt"
	 * "C:/Users/John Doe/Documents/Documents"
	 * "/home/john doe/Documents/Documents"
	 */
	get asString(): string
	{
		return this._fullPath;
	}

	/**
	 * True if this is a directory.
	 */
	get isDirectory(): boolean
	{
		return this._isDirectory;
	}

	/**
	 * True if this is an empty path: ".".
	 * AKA is the path just referencing its working directory.
	 */
	get isEmpty(): boolean
	{
		return this.asString == ".";
	}

	/**
	 * True if this is a file, not a folder.
	 */
	get isFile(): boolean
	{
		return this._isFile;
	}
	
	get workingDirectory(): string
	{
		return this._workingDirectory;
	}

	/**
	 * True if the file or folder exists on the filesystem.
	 */
	get exists(): boolean
	{
		if(this._exists == undefined) this._exists = Path.pathExists(this.absolute().asString);

		return this._exists;
	}

	assertExists(): boolean
	{
		if(!this.exists)
		{
			new Notice("Error: Path does not exist: \n\n" + this.asString, 5000);
			console.error("Path does not exist: " + this.asString);
		}

		return this.exists;
	}

	get isAbsolute(): boolean
	{
		if(this._isWindows)
		{
			if (this.asString.match(/^[A-Za-z]:[\\|\/|\\\\|\/\/]/)) return true;
			if (this.asString.startsWith("\\") && !this.asString.contains(":")) return true;
			else return false;
		}
		else
		{
			if (this.asString.startsWith("/")) return true;
			else return false;
		}
	}

	get isRelative(): boolean
	{
		return !this.isAbsolute;
	}

	get copy(): Path
	{
		return new Path(this.asString, this._workingDirectory);
	}

	absolute(workingDirectory: string = this._workingDirectory): Path
	{
		return this.copy.makeAbsolute(workingDirectory);
	}

	createDirectory(): boolean
	{
		if (!this.exists)
		{
			mkdirSync(this.absolute().directory.asString, { recursive: true });

			return true;
		}

		return false;
	}
}

export class Utils
{
	static async delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}

	static generateProgressbar(title: string, progress: number, max: number, barLength: number, fullChar: string, emptyChar: string): string
	{

		function padStringBeggining(str: string, length: number, char: string)
		{
			return char.repeat(length - str.length) + str;
		}

		return `${title}: ${padStringBeggining(progress + "/" + max, 13, " ")}\n\n${fullChar.repeat(Math.floor((progress / max) * barLength))}${emptyChar.repeat(barLength - Math.floor((progress / max) * barLength))}`;
	}


	static async getText(path: Path): Promise<string | undefined>
	{
		return new Promise((resolve, reject) =>
		{
			readFile(path.absolute().asString, { encoding: 'utf8' }, (err, data) => 
			{
				if (err)
				{
					new Notice("Error: could not read text file at path: \n\n" + path + "\n\n" + err, 10000);
					console.error("Error: could not read text file at path: \n\n" + path + "\n\n" + err);
					resolve(undefined);
				}
				else resolve(data);
			});
		});
	}

	static async getTextBase64(path: Path): Promise<string>
	{
		return new Promise((resolve, reject) =>
		{
			readFile(path.absolute().asString, { encoding: 'base64' }, (err, data) => 
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

	static async getFileBuffer(path: Path): Promise<Buffer | undefined>
	{
		return new Promise((resolve, reject) =>
		{
			readFile(path.absolute().asString, (err, data) =>
			{
				if (err)
				{
					new Notice("Error: could not read file at path: \n\n" + path + "\n\n" + err, 10000);
					console.error("Error: could not read file at path: \n\n" + path + "\n\n" + err);
					resolve(undefined);
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

	static async showSaveDialog(defaultPath: Path, defaultFileName: string, showAllFilesOption: boolean = true): Promise<Path | undefined>
	{
		// get paths
		let absoluteDefaultPath = defaultPath.directory.absolute().joinString(defaultFileName);
		
		// add filters
		let filters = [{
			name: Utils.trimStart(absoluteDefaultPath.extenstion, ".").toUpperCase() + " Files",
			extensions: [Utils.trimStart(absoluteDefaultPath.extenstion, ".")]
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
			defaultPath: absoluteDefaultPath.asString,
			filters: filters,
			properties: ["showOverwriteConfirmation"]
		})

		if (picker.canceled) return undefined;
		
		let pickedPath = new Path(picker.filePath);
		ExportSettings.settings.lastExportPath = pickedPath.asString;
		ExportSettings.saveSettings();
		
		return pickedPath;
	}

	static async showSelectFolderDialog(defaultPath: Path): Promise<Path | undefined>
	{
		if(!defaultPath.exists) defaultPath = Path.vaultPath;

		// show picker
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath.directory.asString,
			properties: ["openDirectory"]
		});

		if (picker.canceled) return undefined;

		let path = new Path(picker.filePaths[0]);
		ExportSettings.settings.lastExportPath = path.directory.asString;
		ExportSettings.saveSettings();

		return path;
	}

	static idealDefaultPath() : Path
	{
		let lastPath = new Path(ExportSettings.settings.lastExportPath);

		if (lastPath.asString != "" && lastPath.exists)
		{
			return lastPath.directory;
		}

		return Path.vaultPath;
	}

	static async downloadFiles(files: Downloadable[], folderPath: Path, showProgress: boolean)
	{
		let lastProgressMessage = Utils.generateProgressbar("Saving Files", 1, files.length, 15, "▰","▱");
		let progressNotice = new Notice(lastProgressMessage, 0);

		try
		{
			for (let i = 0; i < files.length; i++)
			{
			
				let file = files[i];
				let array: string | NodeJS.ArrayBufferView = file.content;
				if (!file.useUnicode && file.content instanceof String) array = Buffer.from(file.content, 'base64');
				if (file.useUnicode && file.content instanceof String) array = Utils.createUnicodeArray(file.content.toString());


				let parsedPath = folderPath.join(file.relativeDownloadPath).joinString(file.filename);

				parsedPath.createDirectory();

				if (!parsedPath.directory.assertExists()) continue;
				
				writeFile(parsedPath.asString, array, (err) => 
				{
					if (err) 
					{
						console.error("Error: could not write file at path: \n\n" + parsedPath.asString + "\n\n" + err);
						new Notice("Error: could not write file at path: \n\n" + parsedPath.asString + "\n\n" + err, 10000);
					}
				});

				lastProgressMessage = Utils.generateProgressbar("Saving Files", i+1, files.length, 15, "▰","▱");
				progressNotice.setMessage(lastProgressMessage);
			}
		}
		catch (e)
		{
			progressNotice.setMessage("❗ " + lastProgressMessage);
			console.error("Error while saving HTML files: \n\n" + e);
			return;
		}


		progressNotice.hide();
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
		if (themeName == "Default") return "/* Using default theme. */";

		// MIGHT NEED TO FORCE A RELATIVE PATH HERE IDKK
		let themePath = new Path(`.obsidian/themes/${themeName}/theme.css`).absolute();
		if (!themePath.exists)
		{
			console.warn("Warning: could not find theme at path: \n\n" + themePath);
			new Notice("Warning: could not find theme at path: \n\n" + themePath, 1000);
			return "";
		}

		let themeContent = await Utils.getText(themePath) ?? "";
		return themeContent;
	}

	static getCurrentThemeName(): string
	{
		/*@ts-ignore*/
		let themeName = app.vault.config?.cssTheme;
		return (themeName ?? "") == "" ? "Default" : themeName;
	}

	static getEnabledSnippets(): string[]
	{
		/*@ts-ignore*/
		return app.vault.config?.enabledCssSnippets ?? [];
	}

	static getPluginIDs(): string[]
	{
		/*@ts-ignore*/
		let pluginsArray: string[] = Array.from(app.plugins.enabledPlugins.values()) as string[];
		for (let i = 0; i < pluginsArray.length; i++)
		{
			/*@ts-ignore*/
			if (app.plugins.manifests[pluginsArray[i]] == undefined)
			{
				pluginsArray.splice(i, 1);
				i--;
			}
		}

		return pluginsArray;
	}

	static getPluginManifest(pluginID: string): PluginManifest | null
	{
		// @ts-ignore
		return app.plugins.manifests[pluginID] ?? null;
	}

	static async getStyleSnippetsContent(): Promise<string[]>
	{
		let snippetContents : string[] = [];
		let enabledSnippets = this.getEnabledSnippets();

		for (let i = 0; i < enabledSnippets.length; i++)
		{
			let path = new Path(`.obsidian/snippets/${enabledSnippets[i]}.css`).absolute();
			if (path.exists) snippetContents.push(await Utils.getText(path) ?? "\n");
		}

		return snippetContents;
	}

	static async rerenderView(view: MarkdownView)
	{
		await Utils.delay(300);
		/*@ts-ignore*/
		await view.previewMode.renderer.rerender();
		await Utils.delay(300);
	}

	static async doFullRender(view: MarkdownView)
	{
		Utils.changeViewMode(view, "preview");
		await this.delay(200);

		/*@ts-ignore*/
		view.previewMode.renderer.showAll = true;
		/*@ts-ignore*/
		await view.previewMode.renderer.unfoldAllHeadings();
		
		await this.rerenderView(view);
	}

	static async getRendererHeight(view: MarkdownView, rerender: boolean = false): Promise<number>
	{
		if(rerender) await Utils.doFullRender(view);

		/*@ts-ignore*/
		let height = view.previewMode.renderer.sizerEl.offsetHeight;

		return height;
	}

	static getActiveTextView(): TextFileView | null
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
