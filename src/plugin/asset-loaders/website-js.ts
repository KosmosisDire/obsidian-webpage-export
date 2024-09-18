import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types";
import { AssetLoader } from "./base-asset";
import websiteJS from "src/frontend/dist/index.txt.js";

export class WebsiteJS extends AssetLoader
{
	constructor()
	{
		super("webpage.js", "", null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async);
	}

	override async load()
	{
		this.data = websiteJS;

		// remove excess shared code using regex

		// remove info_ variables
		this.data = this.data.replace(/this\.info_[\S\s]+?;/gm, "");

		// remove require statements
		this.data = this.data.replace(/var .+?__require\(.+?\);/gm, "");
		
		await super.load();
	}
}
