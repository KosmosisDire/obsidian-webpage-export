import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { MainSettings } from "scripts/settings/main-settings";
import { RenderLog } from "../render-log";

export class CustomHeadContent extends Asset
{
    public content: string = "";

    constructor()
    {
        super("custom-head-content.html", "", AssetType.HTML, InlinePolicy.Auto, false, Mutability.Dynamic, 100);
    }
    
    override async load()
    {
        let customHeadPath = new Path(MainSettings.settings.customHeadContentPath);
		if (customHeadPath.isEmpty)
		{
			this.content = "";
			return;
		}

        let validation = customHeadPath.validate(true, true, false, true, false, ["html"]);
        if (!validation.vaild)
        {
            this.content = "";
            RenderLog.error(validation.error + customHeadPath.asString);
            return;
        }
        this.content = await customHeadPath.readFileString() ?? "";
        await super.load();
    }
}
