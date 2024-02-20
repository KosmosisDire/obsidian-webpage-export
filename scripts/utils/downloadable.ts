import { Path } from "./path";

export class Downloadable
{
	/**
	 * The name of the file with the extention
	 */
	public filename: string;

	/**
	 * The raw data of the file
	 */
	public content: string | Buffer;

	public relativeDirectory: Path;
	public encoding: BufferEncoding | undefined;
	public modifiedTime: number = 0; // when was the source file last modified

	constructor(filename: string, content: string | Buffer, vaultRelativeDestination: Path, encoding: BufferEncoding | undefined = "utf8")
	{
		if(vaultRelativeDestination.isFile) throw new Error("vaultRelativeDestination must be a folder: " + vaultRelativeDestination.asString);

		this.filename = filename;
		this.content = content;
		this.relativeDirectory = vaultRelativeDestination;
		this.encoding = encoding;
	}

	public get relativePath(): Path
	{
		return this.relativeDirectory.joinString(this.filename);
	}

	async download(downloadDirectory: Path)
	{
		let data = this.content instanceof Buffer ? this.content : Buffer.from(this.content.toString(), this.encoding);
		let writePath = this.getAbsoluteDownloadDirectory(downloadDirectory).joinString(this.filename);
		await writePath.writeFile(data, this.encoding);
	}

	public getAbsoluteDownloadPath(downloadDirectory: Path): Path
	{
		return this.relativeDirectory.absolute(downloadDirectory).joinString(this.filename);
	}

	public getAbsoluteDownloadDirectory(downloadDirectory: Path): Path
	{
		return this.relativeDirectory.absolute(downloadDirectory);
	}
}
