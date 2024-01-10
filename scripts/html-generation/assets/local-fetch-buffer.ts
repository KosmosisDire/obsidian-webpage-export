import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { RenderLog } from "../render-log";

export class FetchBuffer extends Asset
{
    public content: Buffer;
    public url: Path | string;

    constructor(filename: string, url: Path | string, type: AssetType, inlinePolicy: InlinePolicy, minify: boolean, mutability: Mutability, loadPriority?: number)
    {
        super(filename, "", type, inlinePolicy, minify, mutability, loadPriority);
        this.url = url;
    }
    
    override async load()
    {
		if (this.url instanceof Path) 
		{
			if (this.url.isRelative)
			{
				this.url.setWorkingDirectory("").makeAbsolute();
			}

			this.url = this.url.makeUnixStyle().asString;
		}
		
		let res: Response;
		try
		{
        	res = await fetch(this.url);
		}
		catch (e)
		{
			RenderLog.error(`Failed to fetch ${this.url}`);
			return;
		}

        if (!res || !res.ok)
        {
            RenderLog.error(`Failed to fetch ${this.url} with status ${res.status}`);
            return;
        }

        let data = await res.arrayBuffer();
        this.content = Buffer.from(data);
		this.modifiedTime = Date.now();

        await super.load();
    }
}
