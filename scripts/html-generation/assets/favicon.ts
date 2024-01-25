import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Settings } from "scripts/settings/settings";
import { Path } from "scripts/utils/path";
import defaultIcon from "assets/icon.png";

export class Favicon extends Asset
{
    public content: Buffer;

    constructor()
    {
        super("favicon.png", "", AssetType.Media, InlinePolicy.Auto, true, Mutability.Dynamic, 0);
    }
    
    override async load()
    {
        if (Settings.settings.faviconPath == "") this.content = Buffer.from(defaultIcon);

        let iconPath = new Path(Settings.settings.faviconPath);
        let icon = await iconPath.readFileBuffer();
        if (icon) 
        {
            this.content = icon;
            this.setFilename("favicon" + iconPath.extension);
			this.modifiedTime = iconPath.stat?.mtimeMs ?? this.modifiedTime;
        }
		
        await super.load();
    }

    public override getHTMLInclude(checkInlinePolicy: boolean = false): string 
    {
		if (checkInlinePolicy && !this.shouldBeInlined()) return "";
		
        if (Settings.settings.inlineAssets)
        {
            return `<link rel="icon" href="data:image/png;base64,${this.content.toString("base64")}">`;
        }
        else
        {
            return `<link rel="icon" href="${this.getAssetPath()}">`;
        }
    }
}
