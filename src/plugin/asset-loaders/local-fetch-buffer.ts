import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Path } from "src/plugin/utils/path";
import { ExportLog } from "src/plugin/render-api/render-api.js";
import { RequestUrlResponse, requestUrl } from "obsidian";
import { Utils } from "src/plugin/utils/utils";
import { fileTypeFromBuffer } from "file-type";

export class FetchBuffer extends AssetLoader
{
    public url: Path | string;

    constructor(filename: string, url: Path | string, type: AssetType, inlinePolicy: InlinePolicy, minify: boolean, mutability: Mutability, loadPriority?: number)
    {
        super(filename, "", null, type, inlinePolicy, minify, mutability, LoadMethod.Default, loadPriority);
        this.url = url;
		
		const stringURL = this.url instanceof Path ? this.url.path : this.url;
		if (stringURL.startsWith("http")) this.onlineURL = stringURL;
    }
    
    override async load()
    {
		if (this.url instanceof Path) 
		{
			if (this.url.isRelative)
			{
				this.url.setWorkingDirectory("").absolute();
			}

			this.url = this.url.path;
		}

		if (this.exportOptions.offlineResources === false && this.url.startsWith("http")) return;

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
				const testResp = await Utils.urlAvailable(this.url);

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

        this.data = Buffer.from(data);

		if (this.targetPath.extension == '')
		{
			const type = await fileTypeFromBuffer(this.data);
			if (type)
			{
				this.targetPath.setExtension(type.ext);
				this.type = AssetLoader.extentionToType(type.ext);
				this.targetPath.directory = AssetLoader.typeToDir(this.type);
			}	
		}

        await super.load();
    }
}
