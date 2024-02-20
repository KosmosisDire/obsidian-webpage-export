import { Settings, SettingsPage } from "scripts/settings/settings";
import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { AssetHandler } from "../asset-handler";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class OtherPluginStyles extends Asset
{
    public content: string = "";
    private lastEnabledPluginStyles: string = "";

    constructor()
    {
        super("other-plugins.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 9);
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        if(this.lastEnabledPluginStyles == Settings.includePluginCSS) return;

        this.content = "";        
        let thirdPartyPluginStyleNames = Settings.includePluginCSS.split("\n");
        for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
        {
            if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
            
            let path = AssetHandler.vaultPluginsPath.joinString(thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
            if (!path.exists) continue;
            
            let style = await path.readFileString();
            if (style)
            {
                this.content += style;
				console.log("Loaded plugin style: " + thirdPartyPluginStyleNames[i] + " size: " + style.length);
            }
        }

		this.modifiedTime = Date.now();
        this.lastEnabledPluginStyles = Settings.includePluginCSS;
        await super.load(options);
    }
}
