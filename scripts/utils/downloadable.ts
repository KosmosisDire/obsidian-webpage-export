import { Path } from "./path";

export class Downloadable
{
	filename: string;
	content: string | Buffer;
	relativeDownloadPath: Path;
	encoding: BufferEncoding | undefined;

	constructor(filename: string, content: string | Buffer, vaultRelativeDestination: Path, encoding: BufferEncoding | undefined = "utf8")
	{
		if(vaultRelativeDestination.isFile) throw new Error("vaultRelativeDestination must be a folder: " + vaultRelativeDestination.asString);

		this.filename = filename;
		this.content = content;
		this.relativeDownloadPath = vaultRelativeDestination;
		this.encoding = encoding;
	}

	async download(downloadDirectory: Path)
	{
		let data = this.content instanceof Buffer ? this.content : Buffer.from(this.content.toString(), this.encoding);
		let writePath = this.relativeDownloadPath.absolute(downloadDirectory).joinString(this.filename);
		await writePath.writeFile(data, this.encoding);
	}
}