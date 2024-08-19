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

	public static async getStyleForPlugin(pluginName: string): Promise<string>
	{
		const path = AssetHandler.vaultPluginsPath.joinString(pluginName.replace("\n", ""), "styles.css");
		if (!path.exists) return "";
		
		return await path.readAsString() ?? "";
	}

    
    override async load()
    {
        if(this.lastEnabledPluginStyles == Settings.exportOptions.includePluginCSS) return;

        this.data = "";        
        for (let i = 0; i < Settings.exportOptions.includePluginCSS.length; i++)
        {
            if (!Settings.exportOptions.includePluginCSS[i] || (Settings.exportOptions.includePluginCSS[i] && !(/\S/.test(Settings.exportOptions.includePluginCSS[i])))) continue;
			let pluginName = Settings.exportOptions.includePluginCSS[i];
			const style = await OtherPluginStyles.getStyleForPlugin(pluginName);
           
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
