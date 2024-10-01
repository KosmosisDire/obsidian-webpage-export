import { Settings } from "src/plugin/settings/settings";
import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { AssetHandler } from "./asset-handler.js";
import { ObsidianStyles } from "./obsidian-styles.js";

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
        if(this.lastEnabledPluginStyles == Settings.exportOptions.includePluginCss) return;

        this.data = "";        
        for (let i = 0; i < Settings.exportOptions.includePluginCss.length; i++)
        {
            if (!Settings.exportOptions.includePluginCss[i] || (Settings.exportOptions.includePluginCss[i] && !(/\S/.test(Settings.exportOptions.includePluginCss[i])))) continue;
			let pluginName = Settings.exportOptions.includePluginCss[i];
			const style = await OtherPluginStyles.getStyleForPlugin(pluginName);
           
            if (style)
            {
                this.data += await AssetHandler.filterStyleRules(style, ObsidianStyles.obsidianStyleAlwaysFilter, ObsidianStyles.obsidianStylesFilter, ObsidianStyles.stylesKeep);
				console.log("Loaded plugin style: " + Settings.exportOptions.includePluginCss[i] + " size: " + style.length);
            }
        }

        this.lastEnabledPluginStyles = Settings.exportOptions.includePluginCss;
        await super.load();
    }
}
