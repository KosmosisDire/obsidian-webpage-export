import { RenderLog } from "../html-generation/render-log";
import { Path } from "./path";

export class Downloadable
{
	filename: string;
	content: string | Buffer;
	relativeDownloadPath: Path;
	encoding: BufferEncoding | undefined;

	constructor(filename: string, content: string | Buffer, vaultRelativeDestination: Path, encoding: BufferEncoding | undefined = "utf8")
	{
		if(vaultRelativeDestination.isFile) throw new Error("vaultRelativeDestination must be a folder");

		this.filename = filename;
		this.content = content;
		this.relativeDownloadPath = vaultRelativeDestination;
		this.encoding = encoding;
	}

	async download(downloadDirectory: Path)
	{
		// let array: string | NodeJS.ArrayBufferView = this.content;
		// if (!this.isText && this.content instanceof String) array = Buffer.from(this.content, 'base64');
		// if (this.isText && this.content instanceof String) array = Utils.createUnicodeArray(this.content.toString());
		let data = this.content instanceof Buffer ? this.content : Buffer.from(this.content.toString(), this.encoding);
		let writePath = this.relativeDownloadPath.absolute(downloadDirectory).joinString(this.filename);
		await writePath.writeFile(data);
	}
}