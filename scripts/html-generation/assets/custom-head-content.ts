import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { Settings, SettingsPage } from "scripts/settings/settings";
import { RenderLog } from "../render-log";

export class CustomHeadContent extends Asset
{
    public content: string = "";

    constructor()
    {
        super("custom-head-content.html", "", AssetType.HTML, InlinePolicy.Auto, false, Mutability.Dynamic);
    }
    
    override async load()
    {
        let customHeadPath = new Path(Settings.customHeadContentPath);
		if (customHeadPath.isEmpty)
		{
			this.content = "";
			return;
		}

        let validation = customHeadPath.validate(false, true, true, false, true, false, ["html"]);
        if (!validation.valid)
        {
            this.content = "";
            RenderLog.error(validation.error + customHeadPath.asString);
            return;
        }

		this.modifiedTime = customHeadPath.stat?.mtimeMs ?? this.modifiedTime;
        this.content = await customHeadPath.readFileString() ?? "";
        await super.load();
    }
}
