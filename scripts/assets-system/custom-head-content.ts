import { WebAsset } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Path } from "scripts/utils/path";
import { Settings, SettingsPage } from "scripts/settings/settings";
import { ExportLog } from "scripts/render-api/render-api";

export class CustomHeadContent extends WebAsset
{
    public data: string = "";

    constructor()
    {
        super("custom-head-content.html", "", null, AssetType.HTML, InlinePolicy.AutoHead, false, Mutability.Dynamic);
    }
    
    override async load()
    {
		if (!SettingsPage.loaded) return;

        let customHeadPath = new Path(Settings.customHeadContentPath);
		if (customHeadPath.isEmpty)
		{
			this.data = "";
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
            this.data = "";
            ExportLog.error(validation.error + customHeadPath.stringify);
            return;
        }

		this.source = app.vault.getFileByPath(customHeadPath.unixified().stringify);
		if (!this.source)
		{
			console.error("Custom head source tfile not found: " + customHeadPath.unixified().stringify);
			let stat = customHeadPath.stat;
			if (stat)
			{
				this.sourceStat = {ctime: stat.ctimeMs, mtime: stat.mtimeMs, size: stat.size};
			}
		}
        this.data = await customHeadPath.readAsString() ?? "";
        await super.load();
    }
}
