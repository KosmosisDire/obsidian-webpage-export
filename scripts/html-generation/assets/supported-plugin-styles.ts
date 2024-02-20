import { Settings, SettingsPage } from "scripts/settings/settings";
import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { ExportLog } from "../render-log";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class SupportedPluginStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("supported-plugins.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 5);
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        this.content = "";
        let stylesheets = document.styleSheets;

		for(let i = 1; i < stylesheets.length; i++) 
        {
            // @ts-ignore
            let styleID = stylesheets[i].ownerNode?.id;

            if 
			(
				styleID == "ADMONITIONS_CUSTOM_STYLE_SHEET" || 
				styleID == "css-settings-manager" ||
				(Settings.includeSvelteCSS && this.isSvelteStylesheet(stylesheets[i]))
			)
            {
                ExportLog.log("Including stylesheet: " + styleID);
                let style = stylesheets[i].cssRules;

                for(let item in style) 
                {
                    if(style[item].cssText != undefined)
                    {
                        
                        this.content += "\n" + style[item].cssText;
                    }
                }
            }

			this.content += "\n\n /* ---- */\n\n";
        }

		this.modifiedTime = Date.now();
        await super.load(options);
    }

	getStylesheetContent(stylesheet: CSSStyleSheet): string
	{
		let content = "";
		let style = stylesheet.cssRules;

		for(let item in style) 
		{
			if(style[item].cssText != undefined)
			{
				content += "\n" + style[item].cssText;
			}
		}

		return content;
	}

	isSvelteStylesheet(stylesheet: CSSStyleSheet): boolean
	{
		if(stylesheet.ownerNode == undefined) return false;
		// @ts-ignore
		let styleID = stylesheet.ownerNode.id;

		if (styleID.contains("svelte")) return true;

		let sheetContent = this.getStylesheetContent(stylesheet);
		let first1000 = sheetContent.substring(0, 1000);
		if (first1000.contains(".svelte-")) 
		{
			return true;
		}

		return false;
	}
}
