/**
 * Simplified Path class for web environments
 * Pure string manipulation without filesystem dependencies
 */
export class Path {
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
	private _workingDirectory: string;
	private _sourceString: string = "";

	constructor(path: string, workingDirectory: string = "/") {
		// Convert backslashes to forward slashes for consistent handling
		path = Path.normalizeSlashes(path);
		workingDirectory = Path.normalizeSlashes(workingDirectory);
		
		this._workingDirectory = Path.parsePath(workingDirectory).fullPath;
		this.reparse(path);
		if (this.isAbsolute) this._workingDirectory = "";
	}

	public reparse(path: string): Path {
		// Convert backslashes to forward slashes for consistent handling
		path = Path.normalizeSlashes(path);
		
		let parsed = Path.parsePath(path);
		if (path === "") {
			parsed = { root: "", dir: "", parent: "", base: "", ext: "", name: "", fullPath: "" };
		}

		this._root = parsed.root;
		this._dir = parsed.dir;
		this._parent = parsed.parent;
		this._base = parsed.base;
		this._ext = parsed.ext.split("#")[0] ?? parsed.ext;
		this._hash = parsed.ext.split("#")[1] ?? "";
		this._name = parsed.name;
		this._fullPath = parsed.fullPath;
		this._isDirectory = this._ext === "";
		this._isFile = this._ext !== "";
		this._sourceString = path;

		if (this._base.lastIndexOf("#") > this._base.lastIndexOf(".")) {
			this._base = this._base.split("#")[0] ?? this._base;
		}

		return this;
	}

	/**
	 * Joins the path with other paths formatted as strings (returns copy)
	 */
	public joinString(...paths: string[]): Path {
		return this.copy.reparse(Path.joinStringPaths(this.path, ...paths));
	}

	/**
	 * Joins the path with other path objects (returns copy)
	 */
	public join(...paths: Path[]): Path {
		return new Path(Path.joinStringPaths(this.path, ...paths.map(p => p.path)), this._workingDirectory);
	}

	/**
	 * Makes the path absolute using the working directory (in-place)
	 */
	absolute(workingDirectory: string | Path = this._workingDirectory): Path {
		if (workingDirectory instanceof Path && !workingDirectory.isAbsolute) {
			throw new Error("workingDirectory must be an absolute path: " + workingDirectory.path);
		}

		if (!this.isAbsolute) {
			this._fullPath = Path.joinStringPaths(workingDirectory.toString(), this.path);
			this._workingDirectory = "";
			this.reparse(this.path);
		}

		return this;
	}

	/**
	 * Returns a copy of the path made absolute (returns copy)
	 */
	absoluted(workingDirectory: string | Path = this._workingDirectory): Path {
		if (this.isAbsolute) return this.copy;
		return this.copy.absolute(workingDirectory);
	}

	/**
	 * Forces the path to be a directory (in-place)
	 */
	folderize(): Path {
		if (!this.isDirectory) {
			this.reparse(this.path + "/");
		}
		return this;
	}

	/**
	 * Returns a copy forced to be a directory
	 */
	folderized(): Path {
		return this.copy.folderize();
	}

	/**
	 * Normalizes the path to remove redundant parts (in-place)
	 */
	normalize(): Path {
		const fullPath = Path.normalizePath(this.absoluted().path);
		let newWorkingDir = "";
		let newFullPath = "";
		let reachedEndOfWorkingDir = false;

		for (let i = 0; i < fullPath.length; i++) {
			const fullChar = fullPath.charAt(i);
			const workingChar = this.workingDirectory.charAt(i);
			if (fullChar === workingChar && !reachedEndOfWorkingDir) {
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
	 * Returns a normalized copy of the path
	 */
	normalized(): Path {
		return this.copy.normalize();
	}

	/**
	 * Sluggifies the path to make it web friendly (in-place)
	 */
	slugify(makeWebStyle: boolean = true): Path {
		if (!makeWebStyle) return this;
		this._fullPath = Path.slugify(this.path);
		this.reparse(this.path);
		return this;
	}

	/**
	 * Returns a sluggified copy
	 */
	slugified(makeWebStyle: boolean = true): Path {
		return this.copy.slugify(makeWebStyle);
	}

	/**
	 * Sets the working directory (in-place)
	 */
	setWorkingDirectory(workingDirectory: string): Path {
		this._workingDirectory = workingDirectory;
		return this;
	}

	/**
	 * Sets the extension (in-place)
	 */
	setExtension(extension: string): Path {
		if (!extension.includes(".")) extension = "." + extension;

		this._ext = extension;
		this._base = this._name + this._ext;
		this._fullPath = Path.joinStringPaths(this._dir, this._base);

		this.reparse(this._fullPath);
		return this;
	}

	/**
	 * Sets the file name (in-place)
	 */
	setFileName(name: string): Path {
		this._name = name;
		this._base = this._name + this._ext;
		this._fullPath = Path.joinStringPaths(this._dir, this._base);

		this.reparse(this._fullPath);
		return this;
	}

	/**
	 * Replaces the extension if it matches (in-place)
	 */
	replaceExtension(searchExt: string, replaceExt: string): Path {
		if (!searchExt.includes(".")) searchExt = "." + searchExt;
		if (!replaceExt.includes(".")) replaceExt = "." + replaceExt;

		this._ext = this._ext.replace(searchExt, replaceExt);
		this._base = this._name + this._ext;
		this._fullPath = Path.joinStringPaths(this._dir, this._base);

		this.reparse(this._fullPath);
		return this;
	}

	toString(): string {
		return this.path;
	}

	public split(): string[] {
		return this.path.split("/");
	}

	// Getters and Setters

	get root(): string {
		return this._root;
	}

	get directory(): Path {
		const newPath = this.copy;
		newPath.reparse(this._dir);
		newPath.setWorkingDirectory(this._workingDirectory);
		return newPath;
	}

	set directory(dir: Path) {
		this._dir = dir.path;
		if (!this.isDirectory) {
			this._fullPath = Path.joinStringPaths(this._dir, this._base);
		} else {
			this._fullPath = this._dir;
		}
		this.reparse(this._fullPath);
	}

	get parent(): Path | undefined {
		if (this._parent === "") return undefined;
		const newPath = this.copy;
		newPath.reparse(this._parent);
		return newPath;
	}

	set parent(parent: Path | undefined) {
		this._parent = parent?.path ?? "";
		this._fullPath = Path.joinStringPaths(this._parent, this._base);
		this.reparse(this._fullPath);
	}

	get fullName(): string {
		return this._base;
	}

	set fullName(name: string) {
		this._base = name;
		this._fullPath = Path.joinStringPaths(this._parent, this._base);
		this.reparse(this._fullPath);
	}

	get extension(): string {
		return this._ext;
	}

	set extension(ext: string) {
		this.setExtension(ext);
	}

	get extensionName(): string {
		return this._ext.replace(".", "");
	}

	get hash(): string {
		return this._hash;
	}

	get basename(): string {
		return this._name;
	}

	get depth(): number {
		let depth = 0;
		const splits = this.path.split("/");

		for (let i = 0; i < splits.length - 1; i++) {
			if (splits[i] === "..") {
				depth--;
			} else if (splits[i] !== ".") {
				depth++;
			}
		}

		if (this.isAbsolute) depth--;
		return depth;
	}

	get maxDepth(): number {
		let initialDirection = 0;
		let maxDepth = 0;
		let depth = 0;
		const splits = this.path.split("/");

		for (let i = 0; i < splits.length - 1; i++) {
			if (splits[i] === "..") {
				depth--;
				if (initialDirection === 0) initialDirection = -1;
			} else if (splits[i] !== ".") {
				depth++;
				if (initialDirection === 0) initialDirection = 1;
			}

			if (initialDirection === -1 && depth < maxDepth) maxDepth = depth;
			if (initialDirection === 1 && depth > maxDepth) maxDepth = depth;
		}

		if (this.isAbsolute) maxDepth--;
		return maxDepth;
	}

	get sourceString(): string {
		return this._sourceString;
	}

	get path(): string {
		return this._fullPath;
	}

	get pathname(): string {
		if (this.isDirectory) return this.path;
		return this.directory.joinString(this.fullName).path;
	}

	get isDirectory(): boolean {
		return this._isDirectory;
	}

	get isEmpty(): boolean {
		return this.path === "";
	}

	get isFile(): boolean {
		return this._isFile;
	}

	get workingDirectory(): string {
		return this._workingDirectory;
	}

	get isAbsolute(): boolean {
		const asString = this.path;
		if (asString.startsWith("http:") || asString.startsWith("https:")) return true;
		if (asString.startsWith("file://")) return true;
		if (asString.startsWith("/")) return true;
		return false;
	}

	get isRelative(): boolean {
		return !this.isAbsolute;
	}

	get copy(): Path {
		return new Path(this.path, this._workingDirectory);
	}

	// Static methods

	private static parsePath(path: string): { 
		root: string, 
		dir: string, 
		parent: string, 
		base: string, 
		ext: string, 
		name: string, 
		fullPath: string 
	} {
		// Normalize slashes first
		path = Path.normalizeSlashes(path);
		
		const args = path.split("?")[1] ?? "";
		path = path.split("?")[0];

		// Decode URI if possible
		try {
			path = decodeURI(path);
		} catch (e) {
			// Ignore decode errors
		}

		// Simple path parsing (slashes already normalized)
		const parts = path.split("/");
		const lastPart = parts[parts.length - 1] || "";
		
		let root = "";
		let dir = "";
		let parent = "";
		let base = lastPart;
		let ext = "";
		let name = lastPart;
		let fullPath = path;

		// Detect root (including Windows drive letters)
		if (path.startsWith("http://")) root = "http://";
		else if (path.startsWith("https://")) root = "https://";
		else if (path.startsWith("/")) root = "/";
		else if (/^[A-Za-z]:/.test(path)) root = path.substring(0, 2); // Windows drive letter

		// Check if it's a directory (ends with / or no extension)
		const isDir = path.endsWith("/") || !lastPart.includes(".");

		if (isDir) {
			dir = Path.normalizePath(path);
			name = parts[parts.length - 1] || parts[parts.length - 2] || "";
			base = name;
			ext = "";
			fullPath = dir;
			parent = parts.slice(0, -1).join("/");
		} else {
			// It's a file
			const lastDotIndex = lastPart.lastIndexOf(".");
			if (lastDotIndex > 0) {
				ext = lastPart.substring(lastDotIndex);
				name = lastPart.substring(0, lastDotIndex);
			}
			dir = parts.slice(0, -1).join("/");
			parent = dir;
			fullPath = path;
		}

		if (args) fullPath += "?" + args;

		return { root, dir, parent, base, ext, name, fullPath };
	}

	private static normalizePath(path: string): string {
		// Normalize slashes first
		path = Path.normalizeSlashes(path);
		
		const parts = path.split("/");
		const normalized: string[] = [];

		for (const part of parts) {
			if (part === "..") {
				normalized.pop();
			} else if (part !== "." && part !== "") {
				normalized.push(part);
			}
		}

		let result = normalized.join("/");
		
		// Preserve leading slash for absolute paths
		if (path.startsWith("/") && !result.startsWith("/")) {
			result = "/" + result;
		}
		
		// Handle protocols
		if (result.startsWith("http:/") && !result.startsWith("http://")) {
			result = result.replace("http:/", "http://");
		}
		if (result.startsWith("https:/") && !result.startsWith("https://")) {
			result = result.replace("https:/", "https://");
		}

		return result;
	}

	private static joinStringPaths(...paths: string[]): string {
		// Normalize all paths first
		const normalizedPaths = paths.map(p => Path.normalizeSlashes(p));
		
		const joined = normalizedPaths
			.filter(p => p !== "")
			.join("/")
			.replace(/\/+/g, "/");

		// Fix protocol slashes
		const protocolFixed = joined
			.replace(/^(https?):\//, "$1://")
			.replace(/^(https?):\/\/+/, "$1://");

		return protocolFixed;
	}

	public static joinPath(...paths: Path[]): Path {
		return new Path(
			Path.joinStringPaths(...paths.map(p => p.path)), 
			paths[0]._workingDirectory
		);
	}

	public static joinStrings(...paths: string[]): Path {
		return new Path(Path.joinStringPaths(...paths));
	}

	/**
	 * Get relative path from source to destination
	 */
	public static getRelativePath(from: Path, to: Path): Path {
		const fromParts = from.directory.path.split("/").filter(p => p !== "");
		const toParts = to.path.split("/").filter(p => p !== "");

		// Find common base
		let commonLength = 0;
		for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
			if (fromParts[i] === toParts[i]) {
				commonLength++;
			} else {
				break;
			}
		}

		// Build relative path
		const upCount = fromParts.length - commonLength;
		const relativeParts: string[] = [];

		// Add ".." for each level up
		for (let i = 0; i < upCount; i++) {
			relativeParts.push("..");
		}

		// Add remaining path
		relativeParts.push(...toParts.slice(commonLength));

		const relativePath = relativeParts.join("/") || ".";
		return new Path(relativePath, from.absoluted().directory.path);
	}

	static get emptyPath(): Path {
		return new Path("", "");
	}

	static get rootPath(): Path {
		return new Path("/", "");
	}

	static slugify(path: string): string {
		return path
			.replace(/\s+/g, "-")
			.replace(/-{2,}/g, "-")
			.toLowerCase();
	}

	/**
	 * Normalize backslashes to forward slashes for consistent path handling
	 */
	private static normalizeSlashes(path: string): string {
		return path.replace(/\\/g, "/");
	}
}