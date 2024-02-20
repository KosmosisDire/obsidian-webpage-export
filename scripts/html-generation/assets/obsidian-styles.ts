import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { SettingsPage } from "scripts/settings/settings";
import { ExportLog } from "../render-log";
import obsidianStyleOverrides from "assets/obsidian-styles.txt.css";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class ObsidianStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("obsidian.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Default, 10);
    }

    public static stylesFilter = 
	["workspace-", "cm-", "ghost", "leaf", "CodeMirror", 
	"@media", "pdf", "xfa", "annotation", "@keyframes", 
	"load", "@-webkit", "setting", "filter", "decorator", 
	"dictionary", "status", "windows", "titlebar", "source",
	"menu", "message", "popover", "suggestion", "prompt", 
	"tab", "HyperMD", "workspace", "publish", 
	"backlink", "sync", "vault", "mobile", "tablet", "phone", 
	"textLayer", "header", "linux", "macos", "rename", "edit",
	"progress", "native", "aria", "tooltip", 
	"drop", "sidebar", "mod-windows", "is-frameless", 
	"is-hidden-frameless", "obsidian-app", "show-view-header", 
	"is-maximized", "is-translucent", "community"];

	public static stylesKeep = ["scrollbar", "input[type", "table", "markdown-rendered", "css-settings-manager", "inline-embed", "background", "token"];
    
	removeSelectors(css: string, containing: string): string
	{
		let regex = new RegExp(`([\w :*+~\\-\\.\\>\\[\\]()"=]*${containing}[\\w\\s:*+~\\-\\.\\>\\[\\]()"=]+)(,|{)`, "gm");
		let toRemove = [...css.matchAll(regex)];
		for (let match of toRemove)
		{
			css = css.replace(match[1], "");
		}
		css = css.trim();
		return css;
	}


    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        this.content = "";

        let appSheet = document.styleSheets[1];
        let stylesheets = document.styleSheets;
        for (let i = 0; i < stylesheets.length; i++)
        {
            if (stylesheets[i].href && stylesheets[i].href?.includes("app.css"))
            {
                appSheet = stylesheets[i];
                break;
            }
        }

        this.content += obsidianStyleOverrides;

        for (let i = 0; i < appSheet.cssRules.length; i++)
        {
            let rule = appSheet.cssRules[i];
            if (rule)
            {
                let skip = false;
				let cssText = rule.cssText;
                let selector = cssText.split("{")[0];

                for (let keep of ObsidianStyles.stylesKeep) 
                {
                    if (!selector.includes(keep)) 
                    {
						// filter out certain unused styles to reduce file size
                        for (let filter of ObsidianStyles.stylesFilter) 
                        {
                            if (selector.includes(filter)) 
                            {
                                skip = true;
                                break;
                            }
                        }
                    }
                    else
                    {
                        skip = false;
                        break;
                    }
                }

                if (skip) continue;
				
				cssText = this.removeSelectors(cssText, "\\.cm-");
				if(cssText.startsWith("{")) continue; // skip empty rules

				cssText += "\n";
                
                this.content += cssText;
            }
        }

		this.modifiedTime = Date.now();
        await super.load(options);
    }
}
