import { MainSettings } from "scripts/settings/main-settings";
import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { AssetHandler } from "../asset-handler";

export class OtherPluginStyles extends Asset
{
    public content: string = "";
    private lastEnabledPluginStyles: string = "";

    constructor()
    {
        super("other-plugins.css", "", AssetType.Style, InlinePolicy.Auto, true, Mutability.Dynamic, 6);
    }
    
    override async load()
    {
        if(this.lastEnabledPluginStyles == MainSettings.settings.includePluginCSS) return;

        this.content = "";        
        let thirdPartyPluginStyleNames = MainSettings.settings.includePluginCSS.split("\n");
        for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
        {
            if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
            
            let path = AssetHandler.vaultPluginsPath.joinString(thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
            if (!path.exists) continue;
            
            let style = await path.readFileString();
            if (style)
            {
                this.content += style;
            }
        }

		this.modifiedTime = Date.now();
        this.lastEnabledPluginStyles = MainSettings.settings.includePluginCSS;
        this.content = Asset.filterBodyClasses(this.content);
        await super.load();
    }
}
