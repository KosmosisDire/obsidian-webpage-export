import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { MainSettings } from "scripts/settings/main-settings";
import { RenderLog } from "../render-log";
import obsidianStyleOverrides from "assets/obsidian-styles.txt.css";
import { AssetHandler } from "../asset-handler";
import { FetchBuffer } from "./local-fetch-buffer";


export class ObsidianStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("obsidian.css", "", AssetType.Style, InlinePolicy.Auto, true, Mutability.Dynamic, 2);
    }

    private static obsidianStylesFilter = 
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
	"is-maximized"];

	private static obsidianStylesKeep = ["scrollbar", "input[type"];
    
    override async load()
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
                let selector = rule.cssText.split("{")[0];

                for (let keep of ObsidianStyles.obsidianStylesKeep) 
                {
                    if (!selector.includes(keep)) 
                    {
                        for (let filter of ObsidianStyles.obsidianStylesFilter) 
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
                
                let cssText = rule.cssText + "\n";

                
                
                this.content += cssText;
            }
        }

        for(let i = 1; i < stylesheets.length; i++) 
        {
            // @ts-ignore
            let styleID = stylesheets[i].ownerNode?.id;
            if ((styleID.startsWith("svelte") && MainSettings.settings.includeSvelteCSS) || styleID == "ADMONITIONS_CUSTOM_STYLE_SHEET")
            {
                RenderLog.log("Including stylesheet: " + styleID);
                let style = stylesheets[i].cssRules;

                for(let item in style) 
                {
                    if(style[item].cssText != undefined)
                    {
                        
                        this.content += "\n" + style[item].cssText;
                    }
                }
            }
        }

        this.content = Asset.filterBodyClasses(this.content);

        this.content = await Asset.minify(this.content, false);
        super.load();
    }
}
