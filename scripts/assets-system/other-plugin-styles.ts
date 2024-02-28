import { Settings } from "scripts/settings/settings";
import { WebAsset } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { AssetHandler } from "./asset-handler";

export class OtherPluginStyles extends WebAsset
{
    public data: string = "";
    private lastEnabledPluginStyles: string[] = [];

    constructor()
    {
        super("other-plugins.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 9);
    }
    
    override async load()
    {
        if(this.lastEnabledPluginStyles == Settings.includePluginCSS) return;

        this.data = "";        
        for (let i = 0; i < Settings.includePluginCSS.length; i++)
        {
            if (!Settings.includePluginCSS[i] || (Settings.includePluginCSS[i] && !(/\S/.test(Settings.includePluginCSS[i])))) continue;
            
            let path = AssetHandler.vaultPluginsPath.joinString(Settings.includePluginCSS[i].replace("\n", ""), "styles.css");
            if (!path.exists) continue;
            
            let style = await path.readAsString();
            if (style)
            {
                this.data += style;
				console.log("Loaded plugin style: " + Settings.includePluginCSS[i] + " size: " + style.length);
            }
        }

        this.lastEnabledPluginStyles = Settings.includePluginCSS;
        await super.load();
    }
}
