import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { ExportLog } from "../render-log";
import { RequestUrlResponse, requestUrl } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { fileTypeFromBuffer } from "file-type";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class FetchBuffer extends Asset
{
    public content: Buffer;
    public url: Path | string;

    constructor(filename: string, url: Path | string, type: AssetType, inlinePolicy: InlinePolicy, minify: boolean, mutability: Mutability, loadPriority?: number)
    {
		
        super(filename, "", type, inlinePolicy, minify, mutability, LoadMethod.Default, loadPriority);
        this.url = url;
		
		let stringURL = this.url instanceof Path ? this.url.asString : this.url;
		if (stringURL.startsWith("http")) this.onlineURL = stringURL;
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {

		if (this.url instanceof Path) 
		{
			if (this.url.isRelative)
			{
				this.url.setWorkingDirectory("").makeAbsolute();
			}

			this.url = this.url.makeUnixStyle().asString;
		}

		if (options.offlineResources === false && this.url.startsWith("http")) return;

		if (this.url.startsWith("http") && (this.url.split(".").length <= 2 || this.url.split("/").length <= 2)) 
		{
			this.onlineURL = undefined;
			return;
		}
		
		let res: RequestUrlResponse | Response;
		try
		{
			if (this.url.startsWith("http"))
			{
				// first ping with a fetch "no-cors" request to see if the server is available
				let testResp = await Utils.urlAvailable(this.url);

				if (testResp.type == "opaque")
					res = await requestUrl(this.url);
				else
				{
					ExportLog.log(`Url ${this.url} is not available`);
					return;
				}
			}
			else
			{
				// local file
				res = await fetch(this.url);
			}
		}
		catch (e)
		{
			ExportLog.log(e, `Failed to fetch ${this.url}`);
			return;
		}

        if (res.status != 200)
        {
            ExportLog.log(`Failed to fetch ${this.url} with status ${res.status}`);
            return;
        }

        let data;
		if (res instanceof Response)
		{
		 	data = await res.arrayBuffer();
		}
		else 
		{
			data = res.arrayBuffer;
		}

        this.content = Buffer.from(data);
		this.modifiedTime = Date.now();

		if (this.relativePath.extension == '')
		{
			let type = await fileTypeFromBuffer(this.content);
			if (type)
			{
				this.relativePath.setExtension(type.ext);
				this.filename = this.relativePath.fullName;
				this.type = Asset.extentionToType(type.ext);
				this.relativeDirectory = Asset.typeToPath(this.type);
			}	
		}

        await super.load(options);
    }
}
