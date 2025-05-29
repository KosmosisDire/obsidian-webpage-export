const pathTools = require('upath');
import { Stats, existsSync, statSync, promises as fs } from 'fs';
import { FileSystemAdapter } from 'obsidian';
import internal from 'stream'; 
import { homedir, platform } from 'os';
import { readdir, rmdir } from 'fs/promises';
import { i18n } from '../translations/language';

export class Path
{
	private static logQueue: { title: string, message: any, type: "info" | "warn" | "error" | "fatal" }[] = [];
	private static log(title: string, message: any, type: "info" | "warn" | "error" | "fatal")
	{
		this.logQueue.push({ title: title, message: message, type: type });
	}
	public static dequeueLog(): { title: string, message: any, type: "info" | "warn" | "error" | "fatal" }[]
	{
		const queue = this.logQueue;
		this.logQueue = [];
		return queue;
	}
	
	private _root: string = "";
	private _dir: string = "";
	private _parent: string = "";
	private _base: string = "";
	private _ext: string = "";
	private _hash: string = "";
	private _name: string = "";
	private _fullPath: string = "";
	private _isDirectory: boolean = false;
	private _isFile: boolean = false;
	private _exists: boolean | undefined = undefined;
	private _workingDirectory: string;
	private _sourceString: string = "";
	private _useBackslashes: boolean = false;

	constructor(path: string, workingDirectory: string = Path.vaultPath.path)
	{
		this._workingDirectory = Path.parsePath(workingDirectory).fullPath;

		this.reparse(path);

		if (this.isAbsolute) this._workingDirectory = "";
	}

	public reparse(path: string): Path
	{
		let parsed = Path.parsePath(path);
		if (path == "") parsed = { root: "", dir: "", parent: "", base: "", ext: "", name: "", fullPath: ""}

		for (const key in parsed)
		{
			if (this._useBackslashes)
			{
				// @ts-ignore
				parsed[key] = parsed[key].replaceAll("/", "\\"); 
			}
			else
			{
				// @ts-ignore
				parsed[key] = parsed[key].replaceAll("\\", "/");
			}
		}

		this._root = parsed.root;
		this._dir = parsed.dir;
		this._parent = parsed.parent;
		this._base = parsed.base;
		this._ext = parsed.ext.split("#")[0] ?? parsed.ext;
		this._hash = parsed.ext.split("#")[1] ?? "";
		this._name = parsed.name;
		this._fullPath = parsed.fullPath;
		this._isDirectory = this._ext == "";
		this._isFile = this._ext != "";
		this._exists = undefined;
		this._sourceString = path;

		if (this._base.lastIndexOf("#") > this._base.lastIndexOf("."))
		{
			this._base = this._base.split("#")[0] ?? this._base;
		}

		this._exists; // force a re-evaluation of the exists property which will also throw an error if the path does not exist
		return this;
	}

	/**
	 * Joins the path with other paths formatted as strings. (returns copy).
	 * Accepts multiple arguments.
	 */
	public joinString(...paths: string[]): Path
	{
		return this.copy.reparse(Path.joinStringPaths(this.path, ...paths));
	}

	/**
	 * Joins the path with other path objects. (returns copy).
	 * Accepts multiple arguments.
	 */
	public join(...paths: Path[]): Path
	{
		return new Path(Path.joinStringPaths(this.path, ...paths.map(p => p.path)), this._workingDirectory);
	}

	/**
	 * Makes the path absolute using the working directory. (in-place).
	 * @param workingDirectory (optional) The working directory to use. If not provided the path's normal working directory will be used.
	 */
	absolute(workingDirectory: string | Path = this._workingDirectory): Path
	{
		if(workingDirectory instanceof Path && !workingDirectory.isAbsolute) throw new Error("workingDirectory must be an absolute path: " + workingDirectory.path);

		if (!this.isAbsolute)
		{
			this._fullPath = Path.joinStringPaths(workingDirectory.toString(), this.path);
			this._workingDirectory = "";
			this.reparse(this.path);
		}

		return this;
	}

	/**
	 * Returns a copy of the path made absolute using the working directory. (returns copy).
	 * @param workingDirectory (optional) The working directory to use. If not provided the path's normal working directory will be used.
	 */
	absoluted(workingDirectory: string | Path = this._workingDirectory): Path
	{
		if (this.isAbsolute) return this.copy;
		return this.copy.absolute(workingDirectory);
	}

	/**
	 * Forces the path to be a directory. (in-place).
	 */
	folderize(): Path
	{
		if (!this.isDirectory)
		{
			this.reparse(this.path + "/");
		}

		return this;
	}

	/**
	 * Returns a copy of the path forced to be a directory. (returns copy).
	 */
	folderized(): Path
	{
		return this.copy.folderize();
	}

	/**
	 * Normalizes the path to remove any redundant parts. (in-place).
	 */
	normalize(): Path
	{
		const fullPath = pathTools.normalizeSafe(this.absoluted().path);
		let newWorkingDir = "";
		let newFullPath = "";
		let reachedEndOfWorkingDir = false;
		for (let i = 0; i < fullPath.length; i++)
		{
			const fullChar = fullPath.charAt(i);
			const workingChar = this.workingDirectory.charAt(i);
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

	/**
	 * Returns a normalized copy of the path. (returns copy).
	 */
	normalized(): Path
	{
		return this.copy.normalize();
	}

	/**
	 * Sluggifies the path to make it web friendly. (in-place).
	 */
	slugify(makeWebStyle: boolean = true): Path
	{
		if (!makeWebStyle) return this;
		this._fullPath = Path.slugify(this.path);
		this.reparse(this.path);
		return this;
	}

	/**
	 * Returns a sluggified copy of the path. (returns copy).
	 */
	slugified(makeWebStyle: boolean = true): Path
	{
		return this.copy.slugify(makeWebStyle);
	}

	/**
	 * Makes the path use backslashes instead of forward slashes. (in-place).
	 */
	backslashify(): Path
	{
		this._useBackslashes = true;
		const path = this.path.replaceAll("/", "\\");
		this.reparse(path);
		return this;
	}

	/**
	 * Returns a copy of the path using backslashes instead of forward slashes. (returns copy).
	 */
	backslashified(): Path
	{
		return this.copy.backslashify();
	}

	makePlatformSafe(): Path
	{
		if (platform() == "win32") return this.backslashify();
		return this;
	}

	/**
	 * Sets the working directory of the path. (in-place).
	 */
	setWorkingDirectory(workingDirectory: string): Path {
		this._workingDirectory = workingDirectory;
		return this;
	}

	/**
	 * Sets the extension of the file (accepts with or without the dot). (in-place).
	 */
	setExtension(extension: string): Path
	{
		if (!extension.contains(".")) extension = "." + extension;

		this._ext = extension;
		this._base = this._name + this._ext;
		this._fullPath = Path.joinStringPaths(this._dir, this._base);

		this.reparse(this._fullPath);
		return this;
	}

	setFileName(name: string): Path
	{
		this._name = name;
		this._base = this._name + this._ext;
		this._fullPath = Path.joinStringPaths(this._dir, this._base);

		this.reparse(this._fullPath);
		return this;
	}

	/**
	 * Replaces the extension with a new one if it matches the search extension. (in-place).
	 */
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
		return this.path;
	}

	public split(): string[]
	{
		return this.path.split(/[\/\\]/);
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
		const newPath = this.copy;
		newPath.reparse(this._dir);
		newPath.setWorkingDirectory(this._workingDirectory);
		return newPath;
	}

	set directory(dir: Path)
	{
		this._dir = dir.path;
		if (!this.isDirectory) this._fullPath = Path.joinStringPaths(this._dir, this._base);
		else this._fullPath = this._dir;

		this.reparse(this._fullPath);
	}

	/**
	 * Same as dir, but if the path is a directory this will be the parent directory not the full path.
	 */
	get parent(): Path | undefined
	{
		if (this._parent == "") return;
		const newPath = this.copy;
		newPath.reparse(this._parent);
		return newPath;
	}

	set parent(parent: Path | undefined)
	{
		this._parent = parent?.path ?? "";
		this._fullPath = Path.joinStringPaths(this._parent, this._base);
		this.reparse(this._fullPath);
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

	set fullName(name: string)
	{
		this._base = name;
		this._fullPath = Path.joinStringPaths(this._parent, this._base);
		this.reparse(this._fullPath);
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

	set extension(ext: string)
	{
		this.setExtension(ext);
	}

	/**
	 * The extension of the file or folder without the dot.
	 */
	get extensionName(): string
	{
		return this._ext.replace(".", "");
	}

	/**
	 * The hash which was appended to the end of the path.
	 * @example
	 * Given, "/path/to/file.txt#hash" -> "#hash"
	 */
	get hash(): string
	{
		return this._hash;
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
		let depth = 0;
		const splits = this.path.split("/");

		for (let i = 0; i < splits.length-1; i++)
		{
			if (splits[i] == "..") 
			{
				depth--;
			}
			else if (splits[i] != ".")
			{
				depth++;
			}
		}

		if (this.isAbsolute) depth--;

		return depth;
	}

	/**
	 * The maximum depth of the path.
	 * @example
	 * "C:/Users/JohnDoe/Documents/file.txt" = 4
	 * "/home/johndoe/Documents/file.txt" = 4
	 * "JohnDoe/Documents/Documents" = 2
	 */
	get maxDepth(): number
	{
		let initialDirection = 0;
		let maxDepth = 0;
		let depth = 0;
		const splits = this.path.split("/");

		for (let i = 0; i < splits.length-1; i++)
		{
			if (splits[i] == "..") 
			{
				depth--;
				if (initialDirection == 0) initialDirection = -1;
			}
			else if (splits[i] != ".")
			{
				depth++;
				if (initialDirection == 0) initialDirection = 1;
			}

			if (initialDirection == -1 && depth < maxDepth) maxDepth = depth;
			if (initialDirection == 1 && depth > maxDepth) maxDepth = depth;
		}

		if (this.isAbsolute) maxDepth--;

		return maxDepth;
	}

	/**
	 * The original unparsed uncleaned string that was used to create this path.
	 * @example
	 * Can be any string: "C:/Users//John Doe/../Documents\file.txt " or ""
	 */
	get sourceString(): string
	{
		return this._sourceString;
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
	get path(): string
	{
		return this._fullPath;
	}

	/**
	 * Indentical to path, except it leaves out the hash from the end of the path if it exists.
	 */
	get pathname(): string
	{
		if (this.isDirectory) return this.path;
		return this.directory.joinString(this.fullName).path;
	}

	/**
	 * True if this is a directory.
	 */
	get isDirectory(): boolean
	{
		return this._isDirectory;
	}

	/**
	 * Uses the file system to check if the path is a directory rather than just checking the extension.
	 */
	get isDirectoryFS(): boolean
	{
		if(this.isDirectory) return true;

		try
		{
			const stat = statSync(this.absoluted().pathname);
			return stat.isDirectory();
		}
		catch (error)
		{
			Path.log("Error checking if path is directory: " + this.pathname, error, "error");
			return false;
		}
	}

	/**
	 * True if this is an empty path: "".
	 * AKA is the path just referencing its working directory.
	 */
	get isEmpty(): boolean
	{
		return this.path == "";
	}

	/**
	 * True if this is a file, not a folder.
	 */
	get isFile(): boolean
	{
		return this._isFile;
	}

	/**
	 * Uses the file system to check if the path is a file rather than just checking the extension.
	 */
	get isFileFS(): boolean
	{
		if (!this.isFile) return false;
		
		try
		{
			const stat = statSync(this.absoluted().pathname);
			return stat.isFile();
		}
		catch (error)
		{
			Path.log("Error checking if path is file: " + this.pathname, error, "error");
			return false;
		}
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
				const absPath = this.absoluted().pathname;
				this._exists = Path.pathExists(absPath);
			}
			catch (error)
			{
				this._exists = false;
				Path.log("Error checking if path exists: " + this.pathname, error, "error");
			}
		}

		return this._exists;
	}

	/**
	 * The fs stats of the file or folder.
	 */
	get stat(): Stats | undefined
	{
		if(!this.exists) return;

		try
		{
		
			const stat = statSync(this.absoluted().pathname);
			return stat;
		}
		catch (error)
		{
			Path.log("Error getting stat: " + this.pathname, error, "error");
			return;
		}
	}

	/**
	 * True if the path is an absolute path.
	 */
	get isAbsolute(): boolean
	{
		let asString = this.path;
		if (asString.startsWith("http:") || asString.startsWith("https:")) return true;
		if (asString.startsWith("file://")) return true;

		if(platform() == "win32")
		{
			asString = asString.replaceAll("/", "\\");
			if (asString.startsWith("\\\\")) return true;
			if (asString.match(/^[A-Za-z]:\\/)) return true;
			if (asString.startsWith("\\") && !asString.contains(":")) return true;
			else return false;
		}
		else
		{
			if (asString.startsWith("/")) return true;
			else return false;
		}
	}

	/**
	 * True if the path is a relative path.
	 */
	get isRelative(): boolean
	{
		return !this.isAbsolute;
	}

	/**
	 * Returns a copy of the path so you can modify it without changing the original.
	 */
	get copy(): Path
	{
		const newPath = new Path(this.path, this._workingDirectory);
		newPath._useBackslashes = this._useBackslashes;
		newPath.reparse(this.path);
		return newPath;
	}

	validate(options: {allowEmpty?: boolean, requireExists?: boolean, allowAbsolute?: boolean, allowRelative?: boolean, allowTildeHomeDirectory?: boolean, allowFiles?: boolean, allowDirectories?: boolean, requireExtentions?: string[]}): {valid: boolean, isEmpty: boolean, error: string}
	{
		let error = "";
		let valid = true;
		const isEmpty = this.sourceString.trim() == "";

		// remove dots from requireExtention
		options.requireExtentions = options.requireExtentions?.map(e => e.replace(".", "")) ?? [];
		const dottedExtention = options.requireExtentions.map(e => "." + e);

		const lang = i18n.pathValidations;

		if (!options.allowEmpty && isEmpty)
		{
			error += lang.noEmpty;
			valid = false;
		}
		else if (options.allowEmpty && isEmpty)
		{
			return { valid: true, isEmpty: isEmpty, error: "" };
		}
		
		if (options.requireExists && !this.exists)
		{
			error += lang.mustExist;
			valid = false;
		}
		else if (!options.allowTildeHomeDirectory && this.path.startsWith("~"))
		{
			error += lang.noTilde;
			valid = false;
		}
		else if (!options.allowAbsolute && this.isAbsolute)
		{
			error += lang.noAbsolute;
			valid = false;
		}
		else if (!options.allowRelative && this.isRelative)
		{
			error += lang.noRelative;
			valid = false;
		}
		else if (!options.allowFiles && this.isFileFS)
		{
			error += lang.noFiles;
			valid = false;
		}
		else if (!options.allowDirectories && this.isDirectoryFS)
		{
			error += lang.noFolders;
			valid = false;
		}
		else if (options.requireExtentions.length > 0 && !options.requireExtentions.includes(this.extensionName) && !isEmpty)
		{
			error += lang.mustHaveExtension.format(dottedExtention.join(", "));
			valid = false;
		}

		return { valid: valid, isEmpty: isEmpty, error: error };
	}

	async createDirectory(): Promise<boolean>
	{
		if (!this.exists)
		{
			const path = this.absoluted().directory.path;

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

	async readAsString(encoding: "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "base64url" | "latin1" | "binary" | "hex" = "utf-8"): Promise<string|undefined>
	{
		if(!this.exists || this.isDirectory) return;

		try
		{
			const data = await fs.readFile(this.absoluted().pathname, { encoding: encoding });
			return data;
		}
		catch (error)
		{
			Path.log("Error reading file: " + this.pathname, error, "error");
			return;
		}
	}

	async readAsBuffer(): Promise<Buffer|undefined>
	{
		if(!this.exists || this.isDirectory)
		{
			console.error("Error reading file buffer: " + this.pathname, (this.isDirectory ? "Path is directory" : "Path does not exist"));
			return;
		}

		try
		{
			const data = await fs.readFile(this.absoluted().pathname);
			return data;
		}
		catch (error)
		{
			Path.log("Error reading file buffer: " + this.pathname, error, "error");
			return;
		}
	}

	async write(data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | internal.Stream, encoding: "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "base64url" | "latin1" | "binary" | "hex" = "utf-8"): Promise<boolean>
	{
		if (this.isDirectory) return false;

		try
		{
			await fs.writeFile(this.absoluted().pathname, data, { encoding: encoding });
			return true;
		}
		catch (error)
		{
			const dirExists = await this.createDirectory();
			if (!dirExists) return false;

			try
			{
				await fs.writeFile(this.absoluted().pathname, data, { encoding: encoding });
				return true;
			}
			catch (error)
			{
				Path.log("Error writing file: " + this.pathname, error, "error");
				return false;
			}
		}
	}

	async delete(recursive: boolean = false): Promise<boolean>
	{
		if (!this.exists) return false;

		try
		{
			await fs.rm(this.absoluted().pathname, { recursive: recursive });
			return true;
		}
		catch (error)
		{
			Path.log("Error deleting file: " + this.pathname, error, "error");
			return false;
		}
	}

	private static parsePath(path: string): { root: string, dir: string, parent: string, base: string, ext: string, name: string, fullPath: string }
	{
		const args = path.split("?")[1] ?? "";
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

		const parsed = pathTools.parse(path) as { root: string, dir: string, base: string, ext: string, name: string };
		
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
			const items = parsed.dir.split("/");
			parsed.name = items[items.length - 1];
			parsed.base = parsed.name;
			parsed.ext = "";
			fullPath = parsed.dir;
			parent = parsed.dir.substring(0, parsed.dir.length - parsed.name.length);
		}
		else
		{
			fullPath = pathTools.join(parent, parsed.base);
		}


		if (args && args.trim() != "") fullPath += "?" + args; 

		if(fullPath.startsWith("http:")) parsed.root = "http://";
		else if(fullPath.startsWith("https:")) parsed.root = "https://"; 

		// make sure that protocols use two slashes
		const protocolRegex = /(https?)[:][\\/](?![\\/])/g;
		parsed.dir = parsed.dir.replace(protocolRegex, "$1://");
		parent = parent.replace(protocolRegex, "$1://");
		fullPath = fullPath.replace(protocolRegex, "$1://");

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
		return new Path(Path.joinStringPaths(...paths.map(p => p.path)), paths[0]._workingDirectory);
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
		const fromUse = useAbsolute ? from.absoluted() : from;
		const toUse = useAbsolute ? to.absoluted() : to;
		const relative = pathTools.relative(fromUse.directory.path, toUse.path);
		const workingDir = from.absoluted().directory.path;
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

		const adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) 
		{
			const basePath = adapter.getBasePath() ?? "";
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
	
	static slugify(path: string): string
	{
		return path.replaceAll(" ", "-").replaceAll(/-{2,}/g, "-").toLowerCase();
	}

	/**
	 * Recursively removes empty directories from the given directory.
	 *
	 * If the directory itself is empty, it is also removed.
	 *
	 * Code taken from: https://gist.github.com/jakub-g/5903dc7e4028133704a4
	 *
	 * @param {string} directory Path to the directory to clean up
	 */
	public static async removeEmptyDirectories(directory: string): Promise<void>
	{
		const path = new Path(directory);
		if (!path.isDirectory || !path.exists || path.isFile) 
			return;

		try
		{
			const stats = await fs.stat(directory);
			if (!stats?.isDirectory()) 
				return;

			let fileNames = await readdir(directory);
			if (fileNames.length > 0) {
				const recursiveRemovalPromises = fileNames.map((fileName) => 
				{
					const newPath = path.joinString(fileName).path;
					return this.removeEmptyDirectories(newPath);
				});
				await Promise.all(recursiveRemovalPromises);

				// re-evaluate fileNames; after deleting subdirectory
				// we may have parent directory empty now
				fileNames = await readdir(directory);
			}

			if (fileNames.length === 0) 
			{
				await rmdir(directory);
			}
		}
		catch (error)
		{
			Path.log("Problem removing directory", error, "warn");
		}
	}

}


