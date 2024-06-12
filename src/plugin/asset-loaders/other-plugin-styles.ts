import { Settings } from "plugin/settings/settings";
import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { AssetHandler } from "./asset-handler.js";

export class OtherPluginStyles extends AssetLoader
{
    private lastEnabledPluginStyles: string[] = [];

    constructor()
    {
        super("other-plugins.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 9);
    }
    
    override async load()
    {
        if(this.lastEnabledPluginStyles == Settings.exportOptions.includePluginCSS) return;

        this.data = "";        
        for (let i = 0; i < Settings.exportOptions.includePluginCSS.length; i++)
        {
            if (!Settings.exportOptions.includePluginCSS[i] || (Settings.exportOptions.includePluginCSS[i] && !(/\S/.test(Settings.exportOptions.includePluginCSS[i])))) continue;
            
            const path = AssetHandler.vaultPluginsPath.joinString(Settings.exportOptions.includePluginCSS[i].replace("\n", ""), "styles.css");
            if (!path.exists) continue;
            
            const style = await path.readAsString();
            if (style)
            {
                this.data += style;
				console.log("Loaded plugin style: " + Settings.exportOptions.includePluginCSS[i] + " size: " + style.length);
            }
        }

        this.lastEnabledPluginStyles = Settings.exportOptions.includePluginCSS;
        await super.load();
    }
}
