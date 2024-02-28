import { WebAsset } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Settings } from "scripts/settings/settings";
import { Path } from "scripts/utils/path";
import defaultIcon from "assets/icon.png";

export class Favicon extends WebAsset
{
    public data: Buffer;

    constructor()
    {
        super("favicon.png", "", null, AssetType.Media, InlinePolicy.AutoHead, false, Mutability.Dynamic);
    }
    
    override async load()
    {
        if (Settings.faviconPath == "") this.data = Buffer.from(defaultIcon);

        let iconPath = new Path(Settings.faviconPath);
		if (iconPath.isEmpty) return;
        let icon = await iconPath.readAsBuffer();
        if (icon) 
        {
            this.data = icon;
            this.targetPath.fullName = "favicon" + iconPath.extension;
			this.source = app.vault.getFileByPath(iconPath.path);
			if (!this.source)
			{
				console.error("Favicon source tfile not found: " + iconPath.path);
				let stat = iconPath.stat;
				if (stat)
				{
					this.sourceStat = {ctime: stat.ctimeMs, mtime: stat.mtimeMs, size: stat.size};
				}
			}
        }
		
        await super.load();
    }

    public override getHTML(): string
    {
        if (Settings.inlineAssets)
        {
            return `<link rel="icon" href="data:image/png;base64,${this.data.toString("base64")}">`;
        }
        else
        {
            return `<link rel="icon" href="${this.getAssetPath()}">`;
        }
    }
}
