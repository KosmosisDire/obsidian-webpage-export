import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options";
import { Path } from "./path";
import { FileStats, TFile } from "obsidian";

export class Attachment
{
	/**
	 * The raw data of the file
	 */
	public data: string | Buffer;
	private _source: TFile | null;
	private _sourcePath: string | undefined;
	private _sourcePathRootRelative: string | undefined;
	private _targetPath: Path;
	public sourceStat: FileStats;
	public exportOptions: MarkdownWebpageRendererAPIOptions;
	public showInTree: boolean = false;
	public treeOrder: number = 0;

	public get filename() { return this.targetPath.fullName; }
	public get basename() { return this.targetPath.basename; }
	public get extension() { return this.targetPath.extension; }
	public get extensionName() { return this.targetPath.extensionName; }
	public get sourcePath() { return this._sourcePath; }
	public set sourcePath(source: string | undefined)
	{
		this._sourcePath = source;
		this._sourcePathRootRelative = this.removeRootFromPath(new Path(source ?? ""), false).stringify;
	}
	public get sourcePathRootRelative() { return this._sourcePathRootRelative;};
	public set source(source: TFile | null)
	{
		this._source = source;
		this.sourceStat = source?.stat ?? { ctime: 0, mtime: Date.now(), size: this.data.length };
		this.sourcePath = source?.path;
	}
	public get source() { return this._source; }
	public get targetPath() { return this._targetPath; }
	public set targetPath(target: Path)
	{
		target.slugify(this.exportOptions.slugifyPaths).unixify();
		target = this.removeRootFromPath(target);
		this._targetPath = target;
	}


	constructor(data: string | Buffer, target: Path, source: TFile | undefined | null, options: MarkdownWebpageRendererAPIOptions)
	{
		if (target.isDirectory) throw new Error("target must be a file: " + target.stringify);
		if (target.isAbsolute) throw new Error("(absolute) Target must be a relative path with the working directory set to the root: " + target.stringify);
		this.exportOptions = options;
		this.data = data;
		this.source = source ?? null;
		this.targetPath = target;
	}

	private removeRootFromPath(path: Path, allowSlugify: boolean = true)
	{
		// remove the export root from the target path
		let root = new Path(this.exportOptions.exportRoot ?? "").unixify().slugify(allowSlugify && this.exportOptions.slugifyPaths).stringify + "/";
		if (path.stringify.startsWith(root))
		{
			path.reparse(path.stringify.substring(root.length));
		}
		return path;
	}

	async download()
	{
		if (this.targetPath.workingDirectory == Path.vaultPath.stringify)
		{ 
			console.log(this.targetPath.workingDirectory, Path.vaultPath.stringify, this.targetPath.stringify);
			throw new Error("(working dir) Target should be a relative path with the working directory set to the root: " + this.targetPath.absoluted().stringify);
		}

		let data = this.data instanceof Buffer ? this.data : Buffer.from(this.data.toString());
		await this.targetPath.write(data);
	}
}
