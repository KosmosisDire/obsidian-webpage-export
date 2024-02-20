const pathTools = require('upath');
import {  Stats, existsSync } from 'fs';
import { FileSystemAdapter, Notice } from 'obsidian';
import { Utils } from './utils';
import { promises as fs } from 'fs';
import { statSync } from 'fs';
import internal from 'stream'; 
import { ExportLog } from 'scripts/html-generation/render-log';
import { join } from 'path';
import { homedir } from 'os';

export class Path
{
	private static logQueue: { title: string, message: any, type: "info" | "warn" | "error" | "fatal" }[] = [];
	private static log(title: string, message: any, type: "info" | "warn" | "error" | "fatal")
	{
		this.logQueue.push({ title: title, message: message, type: type });
	}
	public static dequeueLog(): { title: string, message: any, type: "info" | "warn" | "error" | "fatal" }[]
	{
		let queue = this.logQueue;
		this.logQueue = [];
		return queue;
	}
	
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
	private _rawString: string = "";

	private _isWindows: boolean = process.platform === "win32";

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
		this._rawString = path;

		if (this._isWindows)
		{
			if (this._root.startsWith("http:") || this._root.startsWith("https:"))
			{
				this._isWindows = false;
				this.reparse(this._fullPath.replaceAll("\\", "/"));
			}
			else
			{
				this._root = this._root.replaceAll("/", "\\");
				this._dir = this._dir.replaceAll("/", "\\");
				this._parent = this._parent.replaceAll("/", "\\");
				this._fullPath = this._fullPath.replaceAll("/", "\\");
				this._workingDirectory = this._workingDirectory.replaceAll("/", "\\");
			}
		}

		this._exists; // force a re-evaluation of the exists property which will also throw an error if the path does not exist
		return this;
	}

	joinString(...paths: string[]): Path
	{
		return this.copy.reparse(Path.joinStringPaths(this.asString, ...paths));
	}

	join(...paths: Path[]): Path
	{
		return new Path(Path.joinStringPaths(this.asString, ...paths.map(p => p.asString)), this._workingDirectory);
	}

	makeAbsolute(workingDirectory: string | Path = this._workingDirectory): Path
	{
		if(workingDirectory instanceof Path && !workingDirectory.isAbsolute) throw new Error("workingDirectory must be an absolute path: " + workingDirectory.asString);

		if (!this.isAbsolute)
		{
			this._fullPath = Path.joinStringPaths(workingDirectory.toString(), this.asString);
			this._workingDirectory = "";
			this.reparse(this.asString);
		}

		return this;
	}

	makeForceFolder(): Path
	{
		if (!this.isDirectory)
		{
			this.reparse(this.asString + "/");
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

	makeWebStyle(makeWebStyle: boolean = true): Path
	{
		if (!makeWebStyle) return this;
		this._fullPath = Path.toWebStyle(this.asString);
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

	replaceExtension(searchExt: string, replaceExt: string): Path
	{
		if (!searchExt.contains(".")) searchExt = "." + searchExt;
		if (!replaceExt.contains(".")) replaceExt = "." + replaceExt;

		this._ext = this._ext.replace(searchExt, replaceExt);
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
	get extension(): string
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
	 * The depth of the path.
	 * @example
	 * "C:/Users/JohnDoe/Documents/file.txt" = 4
	 * "/home/johndoe/Documents/file.txt" = 4
	 * "JohnDoe/Documents/Documents" = 2
	 */
	get depth(): number
	{
		return this.asString.replaceAll("\\", "/").replaceAll("//", "/").split("/").length - 1;
	}

	/**
	 * The original unparsed uncleaned string that was used to create this path.
	 * @example
	 * Can be any string: "C:/Users//John Doe/../Documents\file.txt " or ""
	 */
	get rawString(): string
	{
		return this._rawString;
	}

	/**
	 * The full path of the file or folder.
	 * @example
	 * "C:/Users/John Doe/Documents/file.txt"
	 * "/home/john doe/Documents/file.txt"
	 * "C:/Users/John Doe/Documents/Documents"
	 * "/home/john doe/Documents/Documents"
	 * "relative/path/to/example.txt"
	 * "relative/path/to/folder"
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
		if(this._exists == undefined) 
		{
			try
			{
				this._exists = Path.pathExists(this.absolute().asString);
			}
			catch (error)
			{
				this._exists = false;
				Path.log("Error checking if path exists: " + this.asString, error, "error");
			}
		}

		return this._exists;
	}

	get stat(): Stats|undefined
	{
		if(!this.exists) return;

		try
		{
		
			let stat = statSync(this.absolute().asString);
			return stat;
		}
		catch (error)
		{
			Path.log("Error getting stat: " + this.asString, error, "error");
			return;
		}
	}

	assertExists(): boolean
	{
		if(!this.exists)
		{
			new Notice("Error: Path does not exist: \n\n" + this.asString, 5000);
			ExportLog.error("Path does not exist: " + this.asString);
		}

		return this.exists;
	}

	get isAbsolute(): boolean
	{
		let asString = this.asString;
		if (asString.startsWith("http:") || asString.startsWith("https:")) return true;

		if(this._isWindows)
		{
			if (asString.match(/^[A-Za-z]:[\\|\/|\\\\|\/\/]/)) return true;
			if (asString.startsWith("\\") && !asString.contains(":")) return true;
			else return false;
		}
		else
		{
			if (asString.startsWith("/")) return true;
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

	getDepth(): number
	{
		return this.asString.split("/").length - 1;
	}

	absolute(workingDirectory: string | Path = this._workingDirectory): Path
	{
		return this.copy.makeAbsolute(workingDirectory);
	}

	validate(options: {allowEmpty?: boolean, requireExists?: boolean, allowAbsolute?: boolean, allowRelative?: boolean, allowTildeHomeDirectory?: boolean, allowFiles?: boolean, allowDirectories?: boolean, requireExtentions?: string[]}): {valid: boolean, isEmpty: boolean, error: string}
	{
		let error = "";
		let valid = true;
		let isEmpty = this.rawString.trim() == "";

		// remove dots from requireExtention
		options.requireExtentions = options.requireExtentions?.map(e => e.replace(".", "")) ?? [];
		let dottedExtention = options.requireExtentions.map(e => "." + e);

		if (!options.allowEmpty && isEmpty)
		{
			error += "Path cannot be empty\n";
			valid = false;
		}
		else if (options.allowEmpty && isEmpty)
		{
			return { valid: true, isEmpty: isEmpty, error: "" };
		}
		
		if (options.requireExists && !this.exists)
		{
			error += "Path does not exist";
			valid = false;
		}
		else if (!options.allowTildeHomeDirectory && this.asString.startsWith("~"))
		{
			error += "Home directory with tilde (~) is not allowed";
			valid = false;
		}
		else if (!options.allowAbsolute && this.isAbsolute)
		{
			error += "Path cannot be absolute";
			valid = false;
		}
		else if (!options.allowRelative && this.isRelative)
		{
			error += "Path cannot be relative";
			valid = false;
		}
		else if (!options.allowFiles && this.isFile)
		{
			error += "Path cannot be a file";
			valid = false;
		}
		else if (!options.allowDirectories && this.isDirectory)
		{
			error += "Path cannot be a directory";
			valid = false;
		}
		else if (options.requireExtentions.length > 0 && !options.requireExtentions.includes(this.extensionName) && !isEmpty)
		{
			error += "Path must be: " + dottedExtention.join(", ");
			valid = false;
		}

		return { valid: valid, isEmpty: isEmpty, error: error };
	}

	async createDirectory(): Promise<boolean>
	{
		if (!this.exists)
		{
			let path = this.absolute().directory.asString;

			try
			{
				await fs.mkdir(path, { recursive: true });
			}
			catch (error)
			{
				Path.log("Error creating directory: " + path, error, "error");
				return false;
			}
		}

		return true;
	}

	async readFileString(encoding: "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "base64url" | "latin1" | "binary" | "hex" = "utf-8"): Promise<string|undefined>
	{
		if(!this.exists || this.isDirectory) return;

		try
		{
			let data = await fs.readFile(this.absolute().asString, { encoding: encoding });
			return data;
		}
		catch (error)
		{
			Path.log("Error reading file: " + this.asString, error, "error");
			return;
		}
	}

	async readFileBuffer(): Promise<Buffer|undefined>
	{
		if(!this.exists || this.isDirectory) return;

		try
		{
			let data = await fs.readFile(this.absolute().asString);
			return data;
		}
		catch (error)
		{
			Path.log("Error reading file buffer: " + this.asString, error, "error");
			return;
		}
	}

	async writeFile(data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | internal.Stream, encoding: "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "base64url" | "latin1" | "binary" | "hex" = "utf-8"): Promise<boolean>
	{
		if (this.isDirectory) return false;

		try
		{
			await fs.writeFile(this.absolute().asString, data, { encoding: encoding });
			return true;
		}
		catch (error)
		{
			let dirExists = await this.createDirectory();
			if (!dirExists) return false;

			try
			{
				await fs.writeFile(this.absolute().asString, data, { encoding: encoding });
				return true;
			}
			catch (error)
			{
				Path.log("Error writing file: " + this.asString, error, "error");
				return false;
			}
		}
	}

	async delete(recursive: boolean = false): Promise<boolean>
	{
		if (!this.exists) return false;

		try
		{
			await fs.rm(this.absolute().asString, { recursive: recursive });
			return true;
		}
		catch (error)
		{
			Path.log("Error deleting file: " + this.asString, error, "error");
			return false;
		}
	}

	public static fromString(path: string): Path
	{
		return new Path(path);
	}

	private static parsePath(path: string): { root: string, dir: string, parent: string, base: string, ext: string, name: string, fullPath: string }
	{
		let args = path.split("?")[1] ?? "";
		path = path.split("?")[0];

		if (process.platform === "win32")
		{
			if (path.startsWith("~"))
			{
				path = path.replace("~", homedir());
			}
		}

		try
		{
			path = decodeURI(path);
		}
		catch (trash)
		{
			try
			{
				path = decodeURI(path.replaceAll("%", ""));
			}
			catch (e)
			{
				this.log("Could not decode path:" + path, e, "info");
			}
		}

		let parsed = pathTools.parse(path) as { root: string, dir: string, base: string, ext: string, name: string };
		
		if (parsed.ext.contains(" "))
		{
			parsed.ext = "";
		}

		if(parsed.name.endsWith(" "))
		{
			parsed.name += parsed.ext;
			parsed.ext = "";
		}

		let parent = parsed.dir;
		let fullPath = "";

		if(path.endsWith("/") || path.endsWith("\\") || parsed.ext == "")
		{
			if (path.endsWith("/") || path.endsWith("\\")) path = path.substring(0, path.length - 1);

			parsed.dir = pathTools.normalizeSafe(path);
			let items = parsed.dir.split("/");
			parsed.name = items[items.length - 1];
			parsed.base = parsed.name;
			parsed.ext = "";
			fullPath = parsed.dir;
		}
		else
		{
			fullPath = pathTools.join(parent, parsed.base);
		}


		if (args && args.trim() != "") fullPath += "?" + args; 

		if(fullPath.startsWith("http:")) parsed.root = "http://";
		else if(fullPath.startsWith("https:")) parsed.root = "https://"; 

		// make sure that protocols and windows drives use two slashes
		parsed.dir = parsed.dir.replace(/[:][\\/](?![\\/])/g, "://");
		parent = parsed.dir;
		fullPath = fullPath.replace(/[:][\\/](?![\\/])/g, "://");

		return { root: parsed.root, dir: parsed.dir, parent: parent, base: parsed.base, ext: parsed.ext, name: parsed.name, fullPath: fullPath };
	}

	private static pathExists(path: string): boolean
	{
		return existsSync(path);
	}

	private static joinStringPaths(...paths: string[]): string
	{
		let joined = pathTools.join(...paths);

		if (joined.startsWith("http")) 
		{
			joined = joined.replaceAll(":/", "://");
		}

		try
		{
			return decodeURI(joined);
		}
		catch (e)
		{
			this.log("Could not decode joined paths: " + joined, e, "info");
			return joined;
		}
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

	public static getRelativePathFromVault(path: Path, useAbsolute: boolean = false): Path
	{
		return Path.getRelativePath(Path.vaultPath, path, useAbsolute);
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

	private static vaultConfigDirCache: Path | undefined = undefined;
	static get vaultConfigDir(): Path
	{
		if (this.vaultConfigDirCache == undefined) 
		{
			this.vaultConfigDirCache = new Path(app.vault.configDir, "");
		}

		return this.vaultConfigDirCache;
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
		return path.replaceAll(" ", "-").replaceAll(/-{2,}/g, "-").toLowerCase();
	}

	static equal(path1: string, path2: string): boolean
	{
		let path1Parsed = new Path(path1).makeUnixStyle().makeWebStyle().asString;
		let path2Parsed = new Path(path2).makeUnixStyle().makeWebStyle().asString;
		return path1Parsed == path2Parsed;
	}

	public static async getAllEmptyFoldersRecursive(folder: Path): Promise<Path[]>
	{
		if (!folder.isDirectory) throw new Error("folder must be a directory: " + folder.asString);

		let folders: Path[] = [];

		let folderFiles = await fs.readdir(folder.asString);
		for (let i = 0; i < folderFiles.length; i++)
		{
			let file = folderFiles[i];
			let path = folder.joinString(file);

			if ((await fs.stat(path.asString)).isDirectory())
			{
				let subFolders = await this.getAllEmptyFoldersRecursive(path);
				if (subFolders.length == 0)
				{
					let subFiles = await fs.readdir(path.asString);
					if (subFiles.length == 0) folders.push(path);
				}
				else
				{
					folders.push(...subFolders);
				}
			}
		}

		return folders;
	}

	public static async getAllFilesInFolderRecursive(folder: Path): Promise<Path[]>
	{
		if (!folder.isDirectory) throw new Error("folder must be a directory: " + folder.asString);

		let files: Path[] = [];

		let folderFiles = await fs.readdir(folder.asString);
		for (let i = 0; i < folderFiles.length; i++)
		{
			let file = folderFiles[i];
			let path = folder.joinString(file);

			ExportLog.progress(i, folderFiles.length, "Finding Old Files", "Searching: " + folder.asString, "var(--color-yellow)");

			if ((await fs.stat(path.asString)).isDirectory())
			{
				files.push(...await this.getAllFilesInFolderRecursive(path));
			}
			else
			{
				files.push(path);
			}
		}

		return files;
	}

}


