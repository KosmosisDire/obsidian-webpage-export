import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { Settings, SettingsPage } from "scripts/settings/settings";
import { ExportLog } from "scripts/utils/export-log";
import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options";

export class CustomHeadContent extends Asset
{
    public content: string = "";

    constructor()
    {
        super("custom-head-content.html", "", AssetType.HTML, InlinePolicy.AutoHead, false, Mutability.Dynamic);
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
		if (!SettingsPage.loaded) return;

        let customHeadPath = new Path(Settings.customHeadContentPath);
		if (customHeadPath.isEmpty)
		{
			this.content = "";
			return;
		}

        let validation = customHeadPath.validate(
			{
				allowEmpty: false,
				allowFiles: true,
				allowAbsolute: true,
				allowRelative: true,
				requireExists: true
			});

        if (!validation.valid)
        {
            this.content = "";
            ExportLog.error(validation.error + customHeadPath.stringify);
            return;
        }

		this.modifiedTime = customHeadPath.stat?.mtimeMs ?? this.modifiedTime;
        this.content = await customHeadPath.readAsString() ?? "";
        await super.load(options);
    }
}
