import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Settings } from "src/plugin/settings/settings";
import { Path } from "src/plugin/utils/path";
import defaultIcon from "src/assets/icon.png";

export class Favicon extends AssetLoader
{
    constructor()
    {
        super("favicon.png", "", null, AssetType.Media, InlinePolicy.AutoHead, false, Mutability.Dynamic);
    }
    
    override async load()
    {
        if (this.exportOptions.faviconPath == "") this.data = Buffer.from(defaultIcon);

        const iconPath = new Path(this.exportOptions.faviconPath);
		if (iconPath.isEmpty) 
			return;
        
		const icon = await iconPath.readAsBuffer();
        if (icon) 
        {
            this.data = icon;
            this.targetPath.fullName = "favicon" + iconPath.extension;
			this.source = app.vault.getFileByPath(iconPath.path);
			if (!this.source)
			{
				const stat = iconPath.stat;
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
        if (this.exportOptions.inlineMedia)
        {
            return `<link rel="icon" href="data:image/png;base64,${this.data.toString("base64")}">`;
        }
        else
        {
            return `<link rel="icon" href="${this.getAssetPath()}">`;
        }
    }
}
