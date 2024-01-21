import { RenderLog } from "scripts/html-generation/render-log";
import { Path } from "./path";

export class Downloadable
{
	public filename: string;
	public content: string | Buffer;
	public relativeDownloadDirectory: Path;
	public relativeDownloadPath: Path;
	public encoding: BufferEncoding | undefined;
	public modifiedTime: number = 0; // when was the source file last modified

	constructor(filename: string, content: string | Buffer, vaultRelativeDestination: Path, encoding: BufferEncoding | undefined = "utf8")
	{
		if(vaultRelativeDestination.isFile) throw new Error("vaultRelativeDestination must be a folder: " + vaultRelativeDestination.asString);

		this.filename = filename;
		this.content = content;
		this.relativeDownloadDirectory = vaultRelativeDestination;
		this.relativeDownloadPath = vaultRelativeDestination.joinString(filename);
		this.encoding = encoding;
	}

	async download(downloadDirectory: Path)
	{
		let data = this.content instanceof Buffer ? this.content : Buffer.from(this.content.toString(), this.encoding);
		let writePath = this.getAbsoluteDownloadDirectory(downloadDirectory).joinString(this.filename);
		await writePath.writeFile(data, this.encoding);
	}

	public setFilename(filename: string): void
	{
		this.filename = filename;
		this.relativeDownloadPath = this.relativeDownloadDirectory.joinString(filename);
	}

	public setRelativeDownloadDirectory(relativeDownloadDirectory: Path): void
	{
		if (relativeDownloadDirectory.isFile) throw new Error("relativeDownloadDirectory must be a folder: " + relativeDownloadDirectory.asString);
		this.relativeDownloadDirectory = relativeDownloadDirectory;
		this.relativeDownloadPath = relativeDownloadDirectory.joinString(this.filename);
	}

	public getAbsoluteDownloadPath(downloadDirectory: Path): Path
	{
		return this.relativeDownloadDirectory.absolute(downloadDirectory).joinString(this.filename);
	}

	public getAbsoluteDownloadDirectory(downloadDirectory: Path): Path
	{
		return this.relativeDownloadDirectory.absolute(downloadDirectory);
	}
}
