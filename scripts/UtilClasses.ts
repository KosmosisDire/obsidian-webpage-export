const pathTools = require('upath');
import {  existsSync } from 'fs';
import { FileSystemAdapter, Notice } from 'obsidian';
import { Utils } from './utils';
import { promises as fs } from 'fs';

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

	async createDirectory(): Promise<boolean>
	{
		if (!this.exists)
		{
			await fs.mkdir(this.absolute().directory.asString, { recursive: true });

			return true;
		}

		return false;
	}
}
