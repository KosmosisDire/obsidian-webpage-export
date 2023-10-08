import { __awaiter } from "tslib";
const pathTools = require('upath');
import { existsSync } from 'fs';
import { FileSystemAdapter, Notice } from 'obsidian';
import { Utils } from './utils';
import { promises as fs } from 'fs';
import { statSync } from 'fs';
import { RenderLog } from 'scripts/html-generation/render-log';
export class Path {
    static log(title, message, type) {
        this.logQueue.push({ title: title, message: message, type: type });
    }
    static dequeueLog() {
        let queue = this.logQueue;
        this.logQueue = [];
        return queue;
    }
    constructor(path, workingDirectory = Path.vaultPath.asString) {
        this._root = "";
        this._dir = "";
        this._parent = "";
        this._base = "";
        this._ext = "";
        this._name = "";
        this._fullPath = "";
        this._isDirectory = false;
        this._isFile = false;
        this._exists = undefined;
        this._isWindows = process.platform === "win32";
        this._workingDirectory = Path.parsePath(workingDirectory).fullPath;
        this.reparse(path);
        if (this.isAbsolute)
            this._workingDirectory = "";
    }
    reparse(path) {
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
        if (this._isWindows) {
            this._root = this._root.replaceAll("/", "\\");
            this._dir = this._dir.replaceAll("/", "\\");
            this._parent = this._parent.replaceAll("/", "\\");
            this._fullPath = this._fullPath.replaceAll("/", "\\");
        }
        this._exists; // force a re-evaluation of the exists property which will also throw an error if the path does not exist
        return this;
    }
    static parsePath(path) {
        try {
            path = decodeURI(path);
        }
        catch (trash) {
            try {
                path = decodeURI(path.replaceAll("%", ""));
            }
            catch (e) {
                this.log("Could not decode path:" + path, e, "error");
            }
        }
        let parsed = pathTools.parse(path);
        if (parsed.ext.contains(" ")) {
            parsed.ext = "";
        }
        if (parsed.name.endsWith(" ")) {
            parsed.name += parsed.ext;
            parsed.ext = "";
        }
        let parent = parsed.dir;
        let fullPath = "";
        if (path.endsWith("/") || path.endsWith("\\") || parsed.ext == "") {
            if (path.endsWith("/") || path.endsWith("\\"))
                path = path.substring(0, path.length - 1);
            parsed.dir = pathTools.normalizeSafe(path);
            let items = parsed.dir.split("/");
            parsed.name = items[items.length - 1];
            parsed.base = parsed.name;
            parsed.ext = "";
            fullPath = parsed.dir;
        }
        else {
            fullPath = pathTools.join(parent, parsed.base);
        }
        return { root: parsed.root, dir: parsed.dir, parent: parent, base: parsed.base, ext: parsed.ext, name: parsed.name, fullPath: fullPath };
    }
    static pathExists(path) {
        return existsSync(path);
    }
    static joinStringPaths(...paths) {
        let joined = pathTools.join(...paths);
        try {
            return decodeURI(joined);
        }
        catch (e) {
            this.log("Could not decode joined paths: " + joined, e, "error");
            return joined;
        }
    }
    static joinPath(...paths) {
        return new Path(Path.joinStringPaths(...paths.map(p => p.asString)), paths[0]._workingDirectory);
    }
    static joinStrings(...paths) {
        return new Path(Path.joinStringPaths(...paths));
    }
    /**
     * @param from The source path / working directory
     * @param to The destination path
     * @returns The relative path to the destination from the source
     */
    static getRelativePath(from, to, useAbsolute = false) {
        let fromUse = useAbsolute ? from.absolute() : from;
        let toUse = useAbsolute ? to.absolute() : to;
        let relative = pathTools.relative(fromUse.directory.asString, toUse.asString);
        let workingDir = from.absolute().directory.asString;
        return new Path(relative, workingDir);
    }
    static getRelativePathFromVault(path, useAbsolute = false) {
        return Path.getRelativePath(Path.vaultPath, path, useAbsolute);
    }
    static get vaultPath() {
        var _a;
        if (this.vaultPathCache != undefined)
            return this.vaultPathCache;
        let adapter = app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            let basePath = (_a = adapter.getBasePath()) !== null && _a !== void 0 ? _a : "";
            this.vaultPathCache = new Path(basePath, "");
            return this.vaultPathCache;
        }
        throw new Error("Vault path could not be determined");
    }
    static get vaultConfigDir() {
        if (this.vaultConfigDirCache == undefined) {
            this.vaultConfigDirCache = new Path(app.vault.configDir, "");
        }
        return this.vaultConfigDirCache;
    }
    static get emptyPath() {
        return new Path("", "");
    }
    static get rootPath() {
        return new Path("/", "");
    }
    static toWebStyle(path) {
        return path.replaceAll(" ", "-").replaceAll(/-{2,}/g, "-").replace(".-", "-").toLowerCase();
    }
    joinString(...paths) {
        return this.copy.reparse(Path.joinStringPaths(this.asString, ...paths));
    }
    join(...paths) {
        return new Path(Path.joinStringPaths(this.asString, ...paths.map(p => p.asString)), this._workingDirectory);
    }
    makeAbsolute(workingDirectory = this._workingDirectory) {
        if (workingDirectory instanceof Path && !workingDirectory.isAbsolute)
            throw new Error("workingDirectory must be an absolute path: " + workingDirectory.asString);
        if (!this.isAbsolute) {
            this._fullPath = Path.joinStringPaths(workingDirectory.toString(), this.asString);
            this._workingDirectory = "";
            this.reparse(this.asString);
        }
        return this;
    }
    makeForceFolder() {
        if (!this.isDirectory) {
            this.reparse(this.asString + "/");
        }
        return this;
    }
    makeNormalized() {
        let fullPath = pathTools.normalizeSafe(this.absolute().asString);
        let newWorkingDir = "";
        let newFullPath = "";
        let reachedEndOfWorkingDir = false;
        for (let i = 0; i < fullPath.length; i++) {
            let fullChar = fullPath.charAt(i);
            let workingChar = this.workingDirectory.charAt(i);
            if (fullChar == workingChar && !reachedEndOfWorkingDir) {
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
    normalized() {
        return this.copy.makeNormalized();
    }
    makeRootAbsolute() {
        if (!this.isAbsolute) {
            if (this._isWindows) {
                if (this._fullPath.contains(":")) {
                    this._fullPath = this.asString.substring(this._fullPath.indexOf(":") - 1);
                }
                else {
                    this._fullPath = "\\" + this.asString;
                }
            }
            else {
                this._fullPath = "/" + this.asString;
            }
            this.reparse(this.asString);
        }
        return this;
    }
    setWorkingDirectory(workingDirectory) {
        this._workingDirectory = workingDirectory;
        return this;
    }
    makeRootRelative() {
        if (this.isAbsolute) {
            if (this._isWindows) {
                // replace the drive letter and colon with nothing
                this._fullPath = this.asString.replace(/^.:\/\//i, "").replace(/^.:\//i, "");
                this._fullPath = Utils.trimStart(this._fullPath, "\\");
            }
            else {
                this._fullPath = Utils.trimStart(this._fullPath, "/");
            }
            this.reparse(this.asString);
        }
        return this;
    }
    makeWebStyle() {
        this._fullPath = Path.toWebStyle(this.asString);
        this.reparse(this.asString);
        return this;
    }
    makeWindowsStyle() {
        this._isWindows = true;
        this._fullPath = this.asString.replaceAll("/", "\\");
        this.reparse(this.asString);
        return this;
    }
    makeUnixStyle() {
        this._isWindows = false;
        this._fullPath = this.asString.replaceAll("\\", "/").replace(/^.:\/\//i, "/");
        this.reparse(this.asString);
        return this;
    }
    setExtension(extension) {
        if (!extension.contains("."))
            extension = "." + extension;
        this._ext = extension;
        this._base = this._name + this._ext;
        this._fullPath = Path.joinStringPaths(this._dir, this._base);
        this.reparse(this._fullPath);
        return this;
    }
    // overide the default toString() method
    toString() {
        return this.asString;
    }
    /**
     * The root of the path
     * @example
     * "C:/" or "/".
     */
    get root() {
        return this._root;
    }
    /**
     * The parent directory of the file, or if the path is a directory this will be the full path.
     * @example
     * "C:/Users/JohnDoe/Documents" or "/home/johndoe/Documents".
     */
    get directory() {
        return new Path(this._dir, this._workingDirectory);
    }
    /**
     * Same as dir, but if the path is a directory this will be the parent directory not the full path.
     */
    get parent() {
        return new Path(this._parent, this._workingDirectory);
    }
    /**
     * The name of the file or folder including the extension.
     * @example
     * "file.txt" or "Documents".
     */
    get fullName() {
        return this._base;
    }
    /**
     * The extension of the file or folder.
     * @example
     * ".txt" or "".
     */
    get extension() {
        return this._ext;
    }
    get extensionName() {
        return this._ext.replace(".", "");
    }
    /**
     * The name of the file or folder without the extension.
     * @example
     * "file" or "Documents".
     */
    get basename() {
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
    get asString() {
        return this._fullPath;
    }
    /**
     * True if this is a directory.
     */
    get isDirectory() {
        return this._isDirectory;
    }
    /**
     * True if this is an empty path: ".".
     * AKA is the path just referencing its working directory.
     */
    get isEmpty() {
        return this.asString == ".";
    }
    /**
     * True if this is a file, not a folder.
     */
    get isFile() {
        return this._isFile;
    }
    get workingDirectory() {
        return this._workingDirectory;
    }
    /**
     * True if the file or folder exists on the filesystem.
     */
    get exists() {
        if (this._exists == undefined) {
            try {
                this._exists = Path.pathExists(this.absolute().asString);
            }
            catch (error) {
                this._exists = false;
                Path.log("Error checking if path exists: " + this.asString, error, "error");
            }
        }
        return this._exists;
    }
    get stat() {
        if (!this.exists)
            return;
        try {
            let stat = statSync(this.absolute().asString);
            return stat;
        }
        catch (error) {
            Path.log("Error getting stat: " + this.asString, error, "error");
            return;
        }
    }
    assertExists() {
        if (!this.exists) {
            new Notice("Error: Path does not exist: \n\n" + this.asString, 5000);
            RenderLog.error("Path does not exist: " + this.asString);
        }
        return this.exists;
    }
    get isAbsolute() {
        if (this._isWindows) {
            if (this.asString.match(/^[A-Za-z]:[\\|\/|\\\\|\/\/]/))
                return true;
            if (this.asString.startsWith("\\") && !this.asString.contains(":"))
                return true;
            else
                return false;
        }
        else {
            if (this.asString.startsWith("/"))
                return true;
            else
                return false;
        }
    }
    get isRelative() {
        return !this.isAbsolute;
    }
    get copy() {
        return new Path(this.asString, this._workingDirectory);
    }
    getDepth() {
        return this.asString.split("/").length - 1;
    }
    absolute(workingDirectory = this._workingDirectory) {
        return this.copy.makeAbsolute(workingDirectory);
    }
    createDirectory() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.exists) {
                let path = this.absolute().directory.asString;
                try {
                    yield fs.mkdir(path, { recursive: true });
                }
                catch (error) {
                    Path.log("Error creating directory: " + path, error, "error");
                    return false;
                }
            }
            return true;
        });
    }
    readFileString(encoding = "utf-8") {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.exists || this.isDirectory)
                return;
            try {
                let data = yield fs.readFile(this.absolute().asString, { encoding: encoding });
                return data;
            }
            catch (error) {
                Path.log("Error reading file: " + this.asString, error, "error");
                return;
            }
        });
    }
    readFileBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.exists || this.isDirectory)
                return;
            try {
                let data = yield fs.readFile(this.absolute().asString);
                return data;
            }
            catch (error) {
                Path.log("Error reading file buffer: " + this.asString, error, "error");
                return;
            }
        });
    }
    writeFile(data, encoding = "utf-8") {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDirectory)
                return false;
            let dirExists = yield this.createDirectory();
            if (!dirExists)
                return false;
            try {
                yield fs.writeFile(this.absolute().asString, data, { encoding: encoding });
                return true;
            }
            catch (error) {
                Path.log("Error writing file: " + this.asString, error, "error");
                return false;
            }
        });
    }
}
Path.logQueue = [];
Path.vaultPathCache = undefined;
Path.vaultConfigDirCache = undefined;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhdGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNuQyxPQUFPLEVBQVUsVUFBVSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDckQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUNoQyxPQUFPLEVBQUUsUUFBUSxJQUFJLEVBQUUsRUFBRSxNQUFNLElBQUksQ0FBQztBQUNwQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBRTlCLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUUvRCxNQUFNLE9BQU8sSUFBSTtJQUdSLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBYSxFQUFFLE9BQVksRUFBRSxJQUF5QztRQUV4RixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBQ00sTUFBTSxDQUFDLFVBQVU7UUFFdkIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUMxQixJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUNuQixPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFnQkQsWUFBWSxJQUFZLEVBQUUsbUJBQTJCLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUTtRQWRwRSxVQUFLLEdBQVcsRUFBRSxDQUFDO1FBQ25CLFNBQUksR0FBVyxFQUFFLENBQUM7UUFDbEIsWUFBTyxHQUFXLEVBQUUsQ0FBQztRQUNyQixVQUFLLEdBQVcsRUFBRSxDQUFDO1FBQ25CLFNBQUksR0FB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QUcsTUFBTSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLFNBQVM7Z0JBQUUsT0FBTyxLQUFLLENBQUM7WUFFN0IsSUFDQTtnQkFDQyxNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDM0UsT0FBTyxJQUFJLENBQUM7YUFDWjtZQUNELE9BQU8sS0FBSyxFQUNaO2dCQUNDLElBQUksQ0FBQyxHQUFHLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2pFLE9BQU8sS0FBSyxDQUFDO2FBQ2I7UUFDRixDQUFDO0tBQUE7O0FBL21CYyxhQUFRLEdBQWlGLEVBQUUsQUFBbkYsQ0FBb0Y7QUFtSzVGLG1CQUFjLEdBQXFCLFNBQVMsQUFBOUIsQ0FBK0I7QUFnQjdDLHdCQUFtQixHQUFxQixTQUFTLEFBQTlCLENBQStCIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgcGF0aFRvb2xzID0gcmVxdWlyZSgndXBhdGgnKTtcclxuaW1wb3J0IHsgIFN0YXRzLCBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xyXG5pbXBvcnQgeyBGaWxlU3lzdGVtQWRhcHRlciwgTm90aWNlIH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMnO1xyXG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcclxuaW1wb3J0IHsgc3RhdFN5bmMgfSBmcm9tICdmcyc7XHJcbmltcG9ydCBpbnRlcm5hbCBmcm9tICdzdHJlYW0nO1xyXG5pbXBvcnQgeyBSZW5kZXJMb2cgfSBmcm9tICdzY3JpcHRzL2h0bWwtZ2VuZXJhdGlvbi9yZW5kZXItbG9nJztcclxuXHJcbmV4cG9ydCBjbGFzcyBQYXRoXHJcbntcclxuXHRwcml2YXRlIHN0YXRpYyBsb2dRdWV1ZTogeyB0aXRsZTogc3RyaW5nLCBtZXNzYWdlOiBhbnksIHR5cGU6IFwiaW5mb1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCIgfCBcImZhdGFsXCIgfVtdID0gW107XHJcblx0cHJpdmF0ZSBzdGF0aWMgbG9nKHRpdGxlOiBzdHJpbmcsIG1lc3NhZ2U6IGFueSwgdHlwZTogXCJpbmZvXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIiB8IFwiZmF0YWxcIilcclxuXHR7XHJcblx0XHR0aGlzLmxvZ1F1ZXVlLnB1c2goeyB0aXRsZTogdGl0bGUsIG1lc3NhZ2U6IG1lc3NhZ2UsIHR5cGU6IHR5cGUgfSk7XHJcblx0fVxyXG5cdHB1YmxpYyBzdGF0aWMgZGVxdWV1ZUxvZygpOiB7IHRpdGxlOiBzdHJpbmcsIG1lc3NhZ2U6IGFueSwgdHlwZTogXCJpbmZvXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIiB8IFwiZmF0YWxcIiB9W11cclxuXHR7XHJcblx0XHRsZXQgcXVldWUgPSB0aGlzLmxvZ1F1ZXVlO1xyXG5cdFx0dGhpcy5sb2dRdWV1ZSA9IFtdO1xyXG5cdFx0cmV0dXJuIHF1ZXVlO1xyXG5cdH1cclxuXHRcclxuXHRwcml2YXRlIF9yb290OiBzdHJpbmcgPSBcIlwiO1xyXG5cdHByaXZhdGUgX2Rpcjogc3RyaW5nID0gXCJcIjtcclxuXHRwcml2YXRlIF9wYXJlbnQ6IHN0cmluZyA9IFwiXCI7XHJcblx0cHJpdmF0ZSBfYmFzZTogc3RyaW5nID0gXCJcIjtcclxuXHRwcml2YXRlIF9leHQ6IHN0cmluZyA9IFwiXCI7XHJcblx0cHJpdmF0ZSBfbmFtZTogc3RyaW5nID0gXCJcIjtcclxuXHRwcml2YXRlIF9mdWxsUGF0aDogc3RyaW5nID0gXCJcIjtcclxuXHRwcml2YXRlIF9pc0RpcmVjdG9yeTogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdHByaXZhdGUgX2lzRmlsZTogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdHByaXZhdGUgX2V4aXN0czogYm9vbGVhbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuXHRwcml2YXRlIF93b3JraW5nRGlyZWN0b3J5OiBzdHJpbmc7XHJcblxyXG5cdHByaXZhdGUgX2lzV2luZG93czogYm9vbGVhbiA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIjtcclxuXHJcblx0Y29uc3RydWN0b3IocGF0aDogc3RyaW5nLCB3b3JraW5nRGlyZWN0b3J5OiBzdHJpbmcgPSBQYXRoLnZhdWx0UGF0aC5hc1N0cmluZylcclxuXHR7XHJcblx0XHR0aGlzLl93b3JraW5nRGlyZWN0b3J5ID0gUGF0aC5wYXJzZVBhdGgod29ya2luZ0RpcmVjdG9yeSkuZnVsbFBhdGg7XHJcblxyXG5cdFx0dGhpcy5yZXBhcnNlKHBhdGgpO1xyXG5cclxuXHRcdGlmICh0aGlzLmlzQWJzb2x1dGUpIHRoaXMuX3dvcmtpbmdEaXJlY3RvcnkgPSBcIlwiO1xyXG5cdH1cclxuXHJcblx0cmVwYXJzZShwYXRoOiBzdHJpbmcpOiBQYXRoXHJcblx0e1xyXG5cdFx0bGV0IHBhcnNlZCA9IFBhdGgucGFyc2VQYXRoKHBhdGgpO1xyXG5cdFx0dGhpcy5fcm9vdCA9IHBhcnNlZC5yb290O1xyXG5cdFx0dGhpcy5fZGlyID0gcGFyc2VkLmRpcjtcclxuXHRcdHRoaXMuX3BhcmVudCA9IHBhcnNlZC5wYXJlbnQ7XHJcblx0XHR0aGlzLl9iYXNlID0gcGFyc2VkLmJhc2U7XHJcblx0XHR0aGlzLl9leHQgPSBwYXJzZWQuZXh0O1xyXG5cdFx0dGhpcy5fbmFtZSA9IHBhcnNlZC5uYW1lO1xyXG5cdFx0dGhpcy5fZnVsbFBhdGggPSBwYXJzZWQuZnVsbFBhdGg7XHJcblx0XHR0aGlzLl9pc0RpcmVjdG9yeSA9IHRoaXMuX2V4dCA9PSBcIlwiO1xyXG5cdFx0dGhpcy5faXNGaWxlID0gdGhpcy5fZXh0ICE9IFwiXCI7XHJcblx0XHR0aGlzLl9leGlzdHMgPSB1bmRlZmluZWQ7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2lzV2luZG93cylcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5fcm9vdCA9IHRoaXMuX3Jvb3QucmVwbGFjZUFsbChcIi9cIiwgXCJcXFxcXCIpO1xyXG5cdFx0XHR0aGlzLl9kaXIgPSB0aGlzLl9kaXIucmVwbGFjZUFsbChcIi9cIiwgXCJcXFxcXCIpO1xyXG5cdFx0XHR0aGlzLl9wYXJlbnQgPSB0aGlzLl9wYXJlbnQucmVwbGFjZUFsbChcIi9cIiwgXCJcXFxcXCIpO1xyXG5cdFx0XHR0aGlzLl9mdWxsUGF0aCA9IHRoaXMuX2Z1bGxQYXRoLnJlcGxhY2VBbGwoXCIvXCIsIFwiXFxcXFwiKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9leGlzdHM7IC8vIGZvcmNlIGEgcmUtZXZhbHVhdGlvbiBvZiB0aGUgZXhpc3RzIHByb3BlcnR5IHdoaWNoIHdpbGwgYWxzbyB0aHJvdyBhbiBlcnJvciBpZiB0aGUgcGF0aCBkb2VzIG5vdCBleGlzdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBwYXJzZVBhdGgocGF0aDogc3RyaW5nKTogeyByb290OiBzdHJpbmcsIGRpcjogc3RyaW5nLCBwYXJlbnQ6IHN0cmluZywgYmFzZTogc3RyaW5nLCBleHQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBmdWxsUGF0aDogc3RyaW5nIH1cclxuXHR7XHJcblx0XHR0cnlcclxuXHRcdHtcclxuXHRcdFx0cGF0aCA9IGRlY29kZVVSSShwYXRoKTtcclxuXHRcdH1cclxuXHRcdGNhdGNoICh0cmFzaClcclxuXHRcdHtcclxuXHRcdFx0dHJ5XHJcblx0XHRcdHtcclxuXHRcdFx0XHRwYXRoID0gZGVjb2RlVVJJKHBhdGgucmVwbGFjZUFsbChcIiVcIiwgXCJcIikpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhdGNoIChlKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGhpcy5sb2coXCJDb3VsZCBub3QgZGVjb2RlIHBhdGg6XCIgKyBwYXRoLCBlLCBcImVycm9yXCIpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHBhcnNlZCA9IHBhdGhUb29scy5wYXJzZShwYXRoKSBhcyB7IHJvb3Q6IHN0cmluZywgZGlyOiBzdHJpbmcsIGJhc2U6IHN0cmluZywgZXh0OiBzdHJpbmcsIG5hbWU6IHN0cmluZyB9O1xyXG5cdFx0XHJcblx0XHRpZiAocGFyc2VkLmV4dC5jb250YWlucyhcIiBcIikpXHJcblx0XHR7XHJcblx0XHRcdHBhcnNlZC5leHQgPSBcIlwiO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmKHBhcnNlZC5uYW1lLmVuZHNXaXRoKFwiIFwiKSlcclxuXHRcdHtcclxuXHRcdFx0cGFyc2VkLm5hbWUgKz0gcGFyc2VkLmV4dDtcclxuXHRcdFx0cGFyc2VkLmV4dCA9IFwiXCI7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHBhcmVudCA9IHBhcnNlZC5kaXI7XHJcblx0XHRsZXQgZnVsbFBhdGggPSBcIlwiO1xyXG5cclxuXHRcdGlmKHBhdGguZW5kc1dpdGgoXCIvXCIpIHx8IHBhdGguZW5kc1dpdGgoXCJcXFxcXCIpIHx8IHBhcnNlZC5leHQgPT0gXCJcIilcclxuXHRcdHtcclxuXHRcdFx0aWYgKHBhdGguZW5kc1dpdGgoXCIvXCIpIHx8IHBhdGguZW5kc1dpdGgoXCJcXFxcXCIpKSBwYXRoID0gcGF0aC5zdWJzdHJpbmcoMCwgcGF0aC5sZW5ndGggLSAxKTtcclxuXHJcblx0XHRcdHBhcnNlZC5kaXIgPSBwYXRoVG9vbHMubm9ybWFsaXplU2FmZShwYXRoKTtcclxuXHRcdFx0bGV0IGl0ZW1zID0gcGFyc2VkLmRpci5zcGxpdChcIi9cIik7XHJcblx0XHRcdHBhcnNlZC5uYW1lID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XHJcblx0XHRcdHBhcnNlZC5iYXNlID0gcGFyc2VkLm5hbWU7XHJcblx0XHRcdHBhcnNlZC5leHQgPSBcIlwiO1xyXG5cdFx0XHRmdWxsUGF0aCA9IHBhcnNlZC5kaXI7XHJcblx0XHR9XHJcblx0XHRlbHNlXHJcblx0XHR7XHJcblx0XHRcdGZ1bGxQYXRoID0gcGF0aFRvb2xzLmpvaW4ocGFyZW50LCBwYXJzZWQuYmFzZSk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdHJldHVybiB7IHJvb3Q6IHBhcnNlZC5yb290LCBkaXI6IHBhcnNlZC5kaXIsIHBhcmVudDogcGFyZW50LCBiYXNlOiBwYXJzZWQuYmFzZSwgZXh0OiBwYXJzZWQuZXh0LCBuYW1lOiBwYXJzZWQubmFtZSwgZnVsbFBhdGg6IGZ1bGxQYXRoIH07XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBwYXRoRXhpc3RzKHBhdGg6IHN0cmluZyk6IGJvb2xlYW5cclxuXHR7XHJcblx0XHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgc3RhdGljIGpvaW5TdHJpbmdQYXRocyguLi5wYXRoczogc3RyaW5nW10pOiBzdHJpbmdcclxuXHR7XHJcblx0XHRsZXQgam9pbmVkID0gcGF0aFRvb2xzLmpvaW4oLi4ucGF0aHMpO1xyXG5cdFx0dHJ5XHJcblx0XHR7XHJcblx0XHRcdHJldHVybiBkZWNvZGVVUkkoam9pbmVkKTtcclxuXHRcdH1cclxuXHRcdGNhdGNoIChlKVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLmxvZyhcIkNvdWxkIG5vdCBkZWNvZGUgam9pbmVkIHBhdGhzOiBcIiArIGpvaW5lZCwgZSwgXCJlcnJvclwiKTtcclxuXHRcdFx0cmV0dXJuIGpvaW5lZDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgam9pblBhdGgoLi4ucGF0aHM6IFBhdGhbXSk6IFBhdGhcclxuXHR7XHJcblx0XHRyZXR1cm4gbmV3IFBhdGgoUGF0aC5qb2luU3RyaW5nUGF0aHMoLi4ucGF0aHMubWFwKHAgPT4gcC5hc1N0cmluZykpLCBwYXRoc1swXS5fd29ya2luZ0RpcmVjdG9yeSk7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgc3RhdGljIGpvaW5TdHJpbmdzKC4uLnBhdGhzOiBzdHJpbmdbXSk6IFBhdGhcclxuXHR7XHJcblx0XHRyZXR1cm4gbmV3IFBhdGgoUGF0aC5qb2luU3RyaW5nUGF0aHMoLi4ucGF0aHMpKTtcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogQHBhcmFtIGZyb20gVGhlIHNvdXJjZSBwYXRoIC8gd29ya2luZyBkaXJlY3RvcnlcclxuXHQgKiBAcGFyYW0gdG8gVGhlIGRlc3RpbmF0aW9uIHBhdGhcclxuXHQgKiBAcmV0dXJucyBUaGUgcmVsYXRpdmUgcGF0aCB0byB0aGUgZGVzdGluYXRpb24gZnJvbSB0aGUgc291cmNlXHJcblx0ICovXHJcblx0cHVibGljIHN0YXRpYyBnZXRSZWxhdGl2ZVBhdGgoZnJvbTogUGF0aCwgdG86IFBhdGgsIHVzZUFic29sdXRlOiBib29sZWFuID0gZmFsc2UpOiBQYXRoXHJcblx0e1xyXG5cdFx0bGV0IGZyb21Vc2UgPSB1c2VBYnNvbHV0ZSA/IGZyb20uYWJzb2x1dGUoKSA6IGZyb207XHJcblx0XHRsZXQgdG9Vc2UgPSB1c2VBYnNvbHV0ZSA/IHRvLmFic29sdXRlKCkgOiB0bztcclxuXHRcdGxldCByZWxhdGl2ZSA9IHBhdGhUb29scy5yZWxhdGl2ZShmcm9tVXNlLmRpcmVjdG9yeS5hc1N0cmluZywgdG9Vc2UuYXNTdHJpbmcpO1xyXG5cdFx0bGV0IHdvcmtpbmdEaXIgPSBmcm9tLmFic29sdXRlKCkuZGlyZWN0b3J5LmFzU3RyaW5nO1xyXG5cdFx0cmV0dXJuIG5ldyBQYXRoKHJlbGF0aXZlLCB3b3JraW5nRGlyKTtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgZ2V0UmVsYXRpdmVQYXRoRnJvbVZhdWx0KHBhdGg6IFBhdGgsIHVzZUFic29sdXRlOiBib29sZWFuID0gZmFsc2UpOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIFBhdGguZ2V0UmVsYXRpdmVQYXRoKFBhdGgudmF1bHRQYXRoLCBwYXRoLCB1c2VBYnNvbHV0ZSk7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyB2YXVsdFBhdGhDYWNoZTogUGF0aCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuXHRzdGF0aWMgZ2V0IHZhdWx0UGF0aCgpOiBQYXRoXHJcblx0e1xyXG5cdFx0aWYgKHRoaXMudmF1bHRQYXRoQ2FjaGUgIT0gdW5kZWZpbmVkKSByZXR1cm4gdGhpcy52YXVsdFBhdGhDYWNoZTtcclxuXHJcblx0XHRsZXQgYWRhcHRlciA9IGFwcC52YXVsdC5hZGFwdGVyO1xyXG5cdFx0aWYgKGFkYXB0ZXIgaW5zdGFuY2VvZiBGaWxlU3lzdGVtQWRhcHRlcikgXHJcblx0XHR7XHJcblx0XHRcdGxldCBiYXNlUGF0aCA9IGFkYXB0ZXIuZ2V0QmFzZVBhdGgoKSA/PyBcIlwiO1xyXG5cdFx0XHR0aGlzLnZhdWx0UGF0aENhY2hlID0gbmV3IFBhdGgoYmFzZVBhdGgsIFwiXCIpO1xyXG5cdFx0XHRyZXR1cm4gdGhpcy52YXVsdFBhdGhDYWNoZTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVmF1bHQgcGF0aCBjb3VsZCBub3QgYmUgZGV0ZXJtaW5lZFwiKTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgc3RhdGljIHZhdWx0Q29uZmlnRGlyQ2FjaGU6IFBhdGggfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblx0c3RhdGljIGdldCB2YXVsdENvbmZpZ0RpcigpOiBQYXRoXHJcblx0e1xyXG5cdFx0aWYgKHRoaXMudmF1bHRDb25maWdEaXJDYWNoZSA9PSB1bmRlZmluZWQpIFxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLnZhdWx0Q29uZmlnRGlyQ2FjaGUgPSBuZXcgUGF0aChhcHAudmF1bHQuY29uZmlnRGlyLCBcIlwiKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy52YXVsdENvbmZpZ0RpckNhY2hlO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGdldCBlbXB0eVBhdGgoKTogUGF0aFxyXG5cdHtcclxuXHRcdHJldHVybiBuZXcgUGF0aChcIlwiLCBcIlwiKTtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBnZXQgcm9vdFBhdGgoKTogUGF0aFxyXG5cdHtcclxuXHRcdHJldHVybiBuZXcgUGF0aChcIi9cIiwgXCJcIik7XHJcblx0fVxyXG5cdFxyXG5cdHN0YXRpYyB0b1dlYlN0eWxlKHBhdGg6IHN0cmluZyk6IHN0cmluZ1xyXG5cdHtcclxuXHRcdHJldHVybiBwYXRoLnJlcGxhY2VBbGwoXCIgXCIsIFwiLVwiKS5yZXBsYWNlQWxsKC8tezIsfS9nLCBcIi1cIikucmVwbGFjZShcIi4tXCIsIFwiLVwiKS50b0xvd2VyQ2FzZSgpO1xyXG5cdH1cclxuXHJcblx0am9pblN0cmluZyguLi5wYXRoczogc3RyaW5nW10pOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuY29weS5yZXBhcnNlKFBhdGguam9pblN0cmluZ1BhdGhzKHRoaXMuYXNTdHJpbmcsIC4uLnBhdGhzKSk7XHJcblx0fVxyXG5cclxuXHRqb2luKC4uLnBhdGhzOiBQYXRoW10pOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIG5ldyBQYXRoKFBhdGguam9pblN0cmluZ1BhdGhzKHRoaXMuYXNTdHJpbmcsIC4uLnBhdGhzLm1hcChwID0+IHAuYXNTdHJpbmcpKSwgdGhpcy5fd29ya2luZ0RpcmVjdG9yeSk7XHJcblx0fVxyXG5cclxuXHRtYWtlQWJzb2x1dGUod29ya2luZ0RpcmVjdG9yeTogc3RyaW5nIHwgUGF0aCA9IHRoaXMuX3dvcmtpbmdEaXJlY3RvcnkpOiBQYXRoXHJcblx0e1xyXG5cdFx0aWYod29ya2luZ0RpcmVjdG9yeSBpbnN0YW5jZW9mIFBhdGggJiYgIXdvcmtpbmdEaXJlY3RvcnkuaXNBYnNvbHV0ZSkgdGhyb3cgbmV3IEVycm9yKFwid29ya2luZ0RpcmVjdG9yeSBtdXN0IGJlIGFuIGFic29sdXRlIHBhdGg6IFwiICsgd29ya2luZ0RpcmVjdG9yeS5hc1N0cmluZyk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLmlzQWJzb2x1dGUpXHJcblx0XHR7XHJcblx0XHRcdHRoaXMuX2Z1bGxQYXRoID0gUGF0aC5qb2luU3RyaW5nUGF0aHMod29ya2luZ0RpcmVjdG9yeS50b1N0cmluZygpLCB0aGlzLmFzU3RyaW5nKTtcclxuXHRcdFx0dGhpcy5fd29ya2luZ0RpcmVjdG9yeSA9IFwiXCI7XHJcblx0XHRcdHRoaXMucmVwYXJzZSh0aGlzLmFzU3RyaW5nKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG1ha2VGb3JjZUZvbGRlcigpOiBQYXRoXHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmlzRGlyZWN0b3J5KVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLnJlcGFyc2UodGhpcy5hc1N0cmluZyArIFwiL1wiKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG1ha2VOb3JtYWxpemVkKCk6IFBhdGhcclxuXHR7XHJcblx0XHRsZXQgZnVsbFBhdGggPSBwYXRoVG9vbHMubm9ybWFsaXplU2FmZSh0aGlzLmFic29sdXRlKCkuYXNTdHJpbmcpO1xyXG5cdFx0bGV0IG5ld1dvcmtpbmdEaXIgPSBcIlwiO1xyXG5cdFx0bGV0IG5ld0Z1bGxQYXRoID0gXCJcIjtcclxuXHRcdGxldCByZWFjaGVkRW5kT2ZXb3JraW5nRGlyID0gZmFsc2U7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGZ1bGxQYXRoLmxlbmd0aDsgaSsrKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgZnVsbENoYXIgPSBmdWxsUGF0aC5jaGFyQXQoaSk7XHJcblx0XHRcdGxldCB3b3JraW5nQ2hhciA9IHRoaXMud29ya2luZ0RpcmVjdG9yeS5jaGFyQXQoaSk7XHJcblx0XHRcdGlmIChmdWxsQ2hhciA9PSB3b3JraW5nQ2hhciAmJiAhcmVhY2hlZEVuZE9mV29ya2luZ0RpcilcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5ld1dvcmtpbmdEaXIgKz0gZnVsbENoYXI7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJlYWNoZWRFbmRPZldvcmtpbmdEaXIgPSB0cnVlO1xyXG5cdFx0XHRuZXdGdWxsUGF0aCArPSBmdWxsQ2hhcjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLnJlcGFyc2UobmV3RnVsbFBhdGgpO1xyXG5cdFx0dGhpcy5fd29ya2luZ0RpcmVjdG9yeSA9IG5ld1dvcmtpbmdEaXI7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRub3JtYWxpemVkKCk6IFBhdGhcclxuXHR7XHJcblx0XHRyZXR1cm4gdGhpcy5jb3B5Lm1ha2VOb3JtYWxpemVkKCk7XHJcblx0fVxyXG5cclxuXHRtYWtlUm9vdEFic29sdXRlKCk6IFBhdGhcclxuXHR7XHJcblx0XHRpZiAoIXRoaXMuaXNBYnNvbHV0ZSlcclxuXHRcdHtcclxuXHRcdFx0aWYgKHRoaXMuX2lzV2luZG93cylcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGlmKHRoaXMuX2Z1bGxQYXRoLmNvbnRhaW5zKFwiOlwiKSlcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHR0aGlzLl9mdWxsUGF0aCA9IHRoaXMuYXNTdHJpbmcuc3Vic3RyaW5nKHRoaXMuX2Z1bGxQYXRoLmluZGV4T2YoXCI6XCIpIC0gMSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHR0aGlzLl9mdWxsUGF0aCA9IFwiXFxcXFwiICsgdGhpcy5hc1N0cmluZztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGhpcy5fZnVsbFBhdGggPSBcIi9cIiArIHRoaXMuYXNTdHJpbmc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMucmVwYXJzZSh0aGlzLmFzU3RyaW5nKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHNldFdvcmtpbmdEaXJlY3Rvcnkod29ya2luZ0RpcmVjdG9yeTogc3RyaW5nKTogUGF0aFxyXG5cdHtcclxuXHRcdHRoaXMuX3dvcmtpbmdEaXJlY3RvcnkgPSB3b3JraW5nRGlyZWN0b3J5O1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRtYWtlUm9vdFJlbGF0aXZlKCk6IFBhdGhcclxuXHR7XHJcblx0XHRpZiAodGhpcy5pc0Fic29sdXRlKVxyXG5cdFx0e1xyXG5cdFx0XHRpZiAodGhpcy5faXNXaW5kb3dzKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0Ly8gcmVwbGFjZSB0aGUgZHJpdmUgbGV0dGVyIGFuZCBjb2xvbiB3aXRoIG5vdGhpbmdcclxuXHRcdFx0XHR0aGlzLl9mdWxsUGF0aCA9IHRoaXMuYXNTdHJpbmcucmVwbGFjZSgvXi46XFwvXFwvL2ksIFwiXCIpLnJlcGxhY2UoL14uOlxcLy9pLCBcIlwiKTtcclxuXHRcdFx0XHR0aGlzLl9mdWxsUGF0aCA9IFV0aWxzLnRyaW1TdGFydCh0aGlzLl9mdWxsUGF0aCwgXCJcXFxcXCIpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2VcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHRoaXMuX2Z1bGxQYXRoID0gVXRpbHMudHJpbVN0YXJ0KHRoaXMuX2Z1bGxQYXRoLCBcIi9cIik7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMucmVwYXJzZSh0aGlzLmFzU3RyaW5nKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG1ha2VXZWJTdHlsZSgpOiBQYXRoXHJcblx0e1xyXG5cdFx0dGhpcy5fZnVsbFBhdGggPSBQYXRoLnRvV2ViU3R5bGUodGhpcy5hc1N0cmluZyk7XHJcblx0XHR0aGlzLnJlcGFyc2UodGhpcy5hc1N0cmluZyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG1ha2VXaW5kb3dzU3R5bGUoKTogUGF0aFxyXG5cdHtcclxuXHRcdHRoaXMuX2lzV2luZG93cyA9IHRydWU7XHJcblx0XHR0aGlzLl9mdWxsUGF0aCA9IHRoaXMuYXNTdHJpbmcucmVwbGFjZUFsbChcIi9cIiwgXCJcXFxcXCIpO1xyXG5cdFx0dGhpcy5yZXBhcnNlKHRoaXMuYXNTdHJpbmcpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRtYWtlVW5peFN0eWxlKCk6IFBhdGhcclxuXHR7XHJcblx0XHR0aGlzLl9pc1dpbmRvd3MgPSBmYWxzZTtcclxuXHRcdHRoaXMuX2Z1bGxQYXRoID0gdGhpcy5hc1N0cmluZy5yZXBsYWNlQWxsKFwiXFxcXFwiLCBcIi9cIikucmVwbGFjZSgvXi46XFwvXFwvL2ksIFwiL1wiKTtcclxuXHRcdHRoaXMucmVwYXJzZSh0aGlzLmFzU3RyaW5nKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0c2V0RXh0ZW5zaW9uKGV4dGVuc2lvbjogc3RyaW5nKTogUGF0aFxyXG5cdHtcclxuXHRcdGlmICghZXh0ZW5zaW9uLmNvbnRhaW5zKFwiLlwiKSkgZXh0ZW5zaW9uID0gXCIuXCIgKyBleHRlbnNpb247XHJcblxyXG5cdFx0dGhpcy5fZXh0ID0gZXh0ZW5zaW9uO1xyXG5cdFx0dGhpcy5fYmFzZSA9IHRoaXMuX25hbWUgKyB0aGlzLl9leHQ7XHJcblx0XHR0aGlzLl9mdWxsUGF0aCA9IFBhdGguam9pblN0cmluZ1BhdGhzKHRoaXMuX2RpciwgdGhpcy5fYmFzZSk7XHJcblxyXG5cdFx0dGhpcy5yZXBhcnNlKHRoaXMuX2Z1bGxQYXRoKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0Ly8gb3ZlcmlkZSB0aGUgZGVmYXVsdCB0b1N0cmluZygpIG1ldGhvZFxyXG5cdHRvU3RyaW5nKCk6IHN0cmluZ1xyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLmFzU3RyaW5nO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVGhlIHJvb3Qgb2YgdGhlIHBhdGhcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIFwiQzovXCIgb3IgXCIvXCIuXHJcblx0ICovXHJcblx0Z2V0IHJvb3QoKTogc3RyaW5nXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuX3Jvb3Q7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgcGFyZW50IGRpcmVjdG9yeSBvZiB0aGUgZmlsZSwgb3IgaWYgdGhlIHBhdGggaXMgYSBkaXJlY3RvcnkgdGhpcyB3aWxsIGJlIHRoZSBmdWxsIHBhdGguXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiBcIkM6L1VzZXJzL0pvaG5Eb2UvRG9jdW1lbnRzXCIgb3IgXCIvaG9tZS9qb2huZG9lL0RvY3VtZW50c1wiLlxyXG5cdCAqL1xyXG5cdGdldCBkaXJlY3RvcnkoKTogUGF0aFxyXG5cdHtcclxuXHRcdHJldHVybiBuZXcgUGF0aCh0aGlzLl9kaXIsIHRoaXMuX3dvcmtpbmdEaXJlY3RvcnkpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2FtZSBhcyBkaXIsIGJ1dCBpZiB0aGUgcGF0aCBpcyBhIGRpcmVjdG9yeSB0aGlzIHdpbGwgYmUgdGhlIHBhcmVudCBkaXJlY3Rvcnkgbm90IHRoZSBmdWxsIHBhdGguXHJcblx0ICovXHJcblx0Z2V0IHBhcmVudCgpOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIG5ldyBQYXRoKHRoaXMuX3BhcmVudCwgdGhpcy5fd29ya2luZ0RpcmVjdG9yeSk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgbmFtZSBvZiB0aGUgZmlsZSBvciBmb2xkZXIgaW5jbHVkaW5nIHRoZSBleHRlbnNpb24uXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiBcImZpbGUudHh0XCIgb3IgXCJEb2N1bWVudHNcIi5cclxuXHQgKi9cclxuXHRnZXQgZnVsbE5hbWUoKTogc3RyaW5nXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuX2Jhc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgZXh0ZW5zaW9uIG9mIHRoZSBmaWxlIG9yIGZvbGRlci5cclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIFwiLnR4dFwiIG9yIFwiXCIuXHJcblx0ICovXHJcblx0Z2V0IGV4dGVuc2lvbigpOiBzdHJpbmdcclxuXHR7XHJcblx0XHRyZXR1cm4gdGhpcy5fZXh0O1xyXG5cdH1cclxuXHJcblx0Z2V0IGV4dGVuc2lvbk5hbWUoKTogc3RyaW5nXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuX2V4dC5yZXBsYWNlKFwiLlwiLCBcIlwiKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBuYW1lIG9mIHRoZSBmaWxlIG9yIGZvbGRlciB3aXRob3V0IHRoZSBleHRlbnNpb24uXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiBcImZpbGVcIiBvciBcIkRvY3VtZW50c1wiLlxyXG5cdCAqL1xyXG5cdGdldCBiYXNlbmFtZSgpOiBzdHJpbmdcclxuXHR7XHJcblx0XHRyZXR1cm4gdGhpcy5fbmFtZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBmdWxsIHBhdGggb2YgdGhlIGZpbGUgb3IgZm9sZGVyLlxyXG5cdCAqIEBleGFtcGxlXHJcblx0ICogXCJDOi9Vc2Vycy9Kb2huIERvZS9Eb2N1bWVudHMvZmlsZS50eHRcIlxyXG5cdCAqIFwiL2hvbWUvam9obiBkb2UvRG9jdW1lbnRzL2ZpbGUudHh0XCJcclxuXHQgKiBcIkM6L1VzZXJzL0pvaG4gRG9lL0RvY3VtZW50cy9Eb2N1bWVudHNcIlxyXG5cdCAqIFwiL2hvbWUvam9obiBkb2UvRG9jdW1lbnRzL0RvY3VtZW50c1wiXHJcblx0ICovXHJcblx0Z2V0IGFzU3RyaW5nKCk6IHN0cmluZ1xyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLl9mdWxsUGF0aDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRydWUgaWYgdGhpcyBpcyBhIGRpcmVjdG9yeS5cclxuXHQgKi9cclxuXHRnZXQgaXNEaXJlY3RvcnkoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLl9pc0RpcmVjdG9yeTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRydWUgaWYgdGhpcyBpcyBhbiBlbXB0eSBwYXRoOiBcIi5cIi5cclxuXHQgKiBBS0EgaXMgdGhlIHBhdGgganVzdCByZWZlcmVuY2luZyBpdHMgd29ya2luZyBkaXJlY3RvcnkuXHJcblx0ICovXHJcblx0Z2V0IGlzRW1wdHkoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLmFzU3RyaW5nID09IFwiLlwiO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVHJ1ZSBpZiB0aGlzIGlzIGEgZmlsZSwgbm90IGEgZm9sZGVyLlxyXG5cdCAqL1xyXG5cdGdldCBpc0ZpbGUoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLl9pc0ZpbGU7XHJcblx0fVxyXG5cdFxyXG5cdGdldCB3b3JraW5nRGlyZWN0b3J5KCk6IHN0cmluZ1xyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLl93b3JraW5nRGlyZWN0b3J5O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVHJ1ZSBpZiB0aGUgZmlsZSBvciBmb2xkZXIgZXhpc3RzIG9uIHRoZSBmaWxlc3lzdGVtLlxyXG5cdCAqL1xyXG5cdGdldCBleGlzdHMoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdGlmKHRoaXMuX2V4aXN0cyA9PSB1bmRlZmluZWQpIFxyXG5cdFx0e1xyXG5cdFx0XHR0cnlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHRoaXMuX2V4aXN0cyA9IFBhdGgucGF0aEV4aXN0cyh0aGlzLmFic29sdXRlKCkuYXNTdHJpbmcpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhdGNoIChlcnJvcilcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHRoaXMuX2V4aXN0cyA9IGZhbHNlO1xyXG5cdFx0XHRcdFBhdGgubG9nKFwiRXJyb3IgY2hlY2tpbmcgaWYgcGF0aCBleGlzdHM6IFwiICsgdGhpcy5hc1N0cmluZywgZXJyb3IsIFwiZXJyb3JcIik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fZXhpc3RzO1xyXG5cdH1cclxuXHJcblx0Z2V0IHN0YXQoKTogU3RhdHN8dW5kZWZpbmVkXHJcblx0e1xyXG5cdFx0aWYoIXRoaXMuZXhpc3RzKSByZXR1cm47XHJcblxyXG5cdFx0dHJ5XHJcblx0XHR7XHJcblx0XHRcclxuXHRcdFx0bGV0IHN0YXQgPSBzdGF0U3luYyh0aGlzLmFic29sdXRlKCkuYXNTdHJpbmcpO1xyXG5cdFx0XHRyZXR1cm4gc3RhdDtcclxuXHRcdH1cclxuXHRcdGNhdGNoIChlcnJvcilcclxuXHRcdHtcclxuXHRcdFx0UGF0aC5sb2coXCJFcnJvciBnZXR0aW5nIHN0YXQ6IFwiICsgdGhpcy5hc1N0cmluZywgZXJyb3IsIFwiZXJyb3JcIik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGFzc2VydEV4aXN0cygpOiBib29sZWFuXHJcblx0e1xyXG5cdFx0aWYoIXRoaXMuZXhpc3RzKVxyXG5cdFx0e1xyXG5cdFx0XHRuZXcgTm90aWNlKFwiRXJyb3I6IFBhdGggZG9lcyBub3QgZXhpc3Q6IFxcblxcblwiICsgdGhpcy5hc1N0cmluZywgNTAwMCk7XHJcblx0XHRcdFJlbmRlckxvZy5lcnJvcihcIlBhdGggZG9lcyBub3QgZXhpc3Q6IFwiICsgdGhpcy5hc1N0cmluZyk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuZXhpc3RzO1xyXG5cdH1cclxuXHJcblx0Z2V0IGlzQWJzb2x1dGUoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdGlmKHRoaXMuX2lzV2luZG93cylcclxuXHRcdHtcclxuXHRcdFx0aWYgKHRoaXMuYXNTdHJpbmcubWF0Y2goL15bQS1aYS16XTpbXFxcXHxcXC98XFxcXFxcXFx8XFwvXFwvXS8pKSByZXR1cm4gdHJ1ZTtcclxuXHRcdFx0aWYgKHRoaXMuYXNTdHJpbmcuc3RhcnRzV2l0aChcIlxcXFxcIikgJiYgIXRoaXMuYXNTdHJpbmcuY29udGFpbnMoXCI6XCIpKSByZXR1cm4gdHJ1ZTtcclxuXHRcdFx0ZWxzZSByZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRlbHNlXHJcblx0XHR7XHJcblx0XHRcdGlmICh0aGlzLmFzU3RyaW5nLnN0YXJ0c1dpdGgoXCIvXCIpKSByZXR1cm4gdHJ1ZTtcclxuXHRcdFx0ZWxzZSByZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRnZXQgaXNSZWxhdGl2ZSgpOiBib29sZWFuXHJcblx0e1xyXG5cdFx0cmV0dXJuICF0aGlzLmlzQWJzb2x1dGU7XHJcblx0fVxyXG5cclxuXHRnZXQgY29weSgpOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIG5ldyBQYXRoKHRoaXMuYXNTdHJpbmcsIHRoaXMuX3dvcmtpbmdEaXJlY3RvcnkpO1xyXG5cdH1cclxuXHJcblx0Z2V0RGVwdGgoKTogbnVtYmVyXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuYXNTdHJpbmcuc3BsaXQoXCIvXCIpLmxlbmd0aCAtIDE7XHJcblx0fVxyXG5cclxuXHRhYnNvbHV0ZSh3b3JraW5nRGlyZWN0b3J5OiBzdHJpbmcgfCBQYXRoID0gdGhpcy5fd29ya2luZ0RpcmVjdG9yeSk6IFBhdGhcclxuXHR7XHJcblx0XHRyZXR1cm4gdGhpcy5jb3B5Lm1ha2VBYnNvbHV0ZSh3b3JraW5nRGlyZWN0b3J5KTtcclxuXHR9XHJcblxyXG5cdGFzeW5jIGNyZWF0ZURpcmVjdG9yeSgpOiBQcm9taXNlPGJvb2xlYW4+XHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmV4aXN0cylcclxuXHRcdHtcclxuXHRcdFx0bGV0IHBhdGggPSB0aGlzLmFic29sdXRlKCkuZGlyZWN0b3J5LmFzU3RyaW5nO1xyXG5cclxuXHRcdFx0dHJ5XHJcblx0XHRcdHtcclxuXHRcdFx0XHRhd2FpdCBmcy5ta2RpcihwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXRjaCAoZXJyb3IpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRQYXRoLmxvZyhcIkVycm9yIGNyZWF0aW5nIGRpcmVjdG9yeTogXCIgKyBwYXRoLCBlcnJvciwgXCJlcnJvclwiKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGFzeW5jIHJlYWRGaWxlU3RyaW5nKGVuY29kaW5nOiBcImFzY2lpXCIgfCBcInV0ZjhcIiB8IFwidXRmLThcIiB8IFwidXRmMTZsZVwiIHwgXCJ1Y3MyXCIgfCBcInVjcy0yXCIgfCBcImJhc2U2NFwiIHwgXCJiYXNlNjR1cmxcIiB8IFwibGF0aW4xXCIgfCBcImJpbmFyeVwiIHwgXCJoZXhcIiA9IFwidXRmLThcIik6IFByb21pc2U8c3RyaW5nfHVuZGVmaW5lZD5cclxuXHR7XHJcblx0XHRpZighdGhpcy5leGlzdHMgfHwgdGhpcy5pc0RpcmVjdG9yeSkgcmV0dXJuO1xyXG5cclxuXHRcdHRyeVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKHRoaXMuYWJzb2x1dGUoKS5hc1N0cmluZywgeyBlbmNvZGluZzogZW5jb2RpbmcgfSk7XHJcblx0XHRcdHJldHVybiBkYXRhO1xyXG5cdFx0fVxyXG5cdFx0Y2F0Y2ggKGVycm9yKVxyXG5cdFx0e1xyXG5cdFx0XHRQYXRoLmxvZyhcIkVycm9yIHJlYWRpbmcgZmlsZTogXCIgKyB0aGlzLmFzU3RyaW5nLCBlcnJvciwgXCJlcnJvclwiKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0YXN5bmMgcmVhZEZpbGVCdWZmZXIoKTogUHJvbWlzZTxCdWZmZXJ8dW5kZWZpbmVkPlxyXG5cdHtcclxuXHRcdGlmKCF0aGlzLmV4aXN0cyB8fCB0aGlzLmlzRGlyZWN0b3J5KSByZXR1cm47XHJcblxyXG5cdFx0dHJ5XHJcblx0XHR7XHJcblx0XHRcdGxldCBkYXRhID0gYXdhaXQgZnMucmVhZEZpbGUodGhpcy5hYnNvbHV0ZSgpLmFzU3RyaW5nKTtcclxuXHRcdFx0cmV0dXJuIGRhdGE7XHJcblx0XHR9XHJcblx0XHRjYXRjaCAoZXJyb3IpXHJcblx0XHR7XHJcblx0XHRcdFBhdGgubG9nKFwiRXJyb3IgcmVhZGluZyBmaWxlIGJ1ZmZlcjogXCIgKyB0aGlzLmFzU3RyaW5nLCBlcnJvciwgXCJlcnJvclwiKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0YXN5bmMgd3JpdGVGaWxlKGRhdGE6IHN0cmluZyB8IE5vZGVKUy5BcnJheUJ1ZmZlclZpZXcgfCBJdGVyYWJsZTxzdHJpbmcgfCBOb2RlSlMuQXJyYXlCdWZmZXJWaWV3PiB8IEFzeW5jSXRlcmFibGU8c3RyaW5nIHwgTm9kZUpTLkFycmF5QnVmZmVyVmlldz4gfCBpbnRlcm5hbC5TdHJlYW0sIGVuY29kaW5nOiBcImFzY2lpXCIgfCBcInV0ZjhcIiB8IFwidXRmLThcIiB8IFwidXRmMTZsZVwiIHwgXCJ1Y3MyXCIgfCBcInVjcy0yXCIgfCBcImJhc2U2NFwiIHwgXCJiYXNlNjR1cmxcIiB8IFwibGF0aW4xXCIgfCBcImJpbmFyeVwiIHwgXCJoZXhcIiA9IFwidXRmLThcIik6IFByb21pc2U8Ym9vbGVhbj5cclxuXHR7XHJcblx0XHRpZiAodGhpcy5pc0RpcmVjdG9yeSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdGxldCBkaXJFeGlzdHMgPSBhd2FpdCB0aGlzLmNyZWF0ZURpcmVjdG9yeSgpO1xyXG5cdFx0aWYgKCFkaXJFeGlzdHMpIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR0cnlcclxuXHRcdHtcclxuXHRcdFx0YXdhaXQgZnMud3JpdGVGaWxlKHRoaXMuYWJzb2x1dGUoKS5hc1N0cmluZywgZGF0YSwgeyBlbmNvZGluZzogZW5jb2RpbmcgfSk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0Y2F0Y2ggKGVycm9yKVxyXG5cdFx0e1xyXG5cdFx0XHRQYXRoLmxvZyhcIkVycm9yIHdyaXRpbmcgZmlsZTogXCIgKyB0aGlzLmFzU3RyaW5nLCBlcnJvciwgXCJlcnJvclwiKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG4iXX0=