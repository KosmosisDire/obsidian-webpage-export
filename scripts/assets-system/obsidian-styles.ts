import obsidianStyleOverrides from "assets/obsidian-styles.txt.css";
import { WebAsset } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { AssetHandler } from "./asset-handler.js";

export class ObsidianStyles extends WebAsset
{
    constructor()
    {
        super("obsidian.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Default, 10);
    }

	static readonly obsidianStylesFilter =
	["workspace-", "cm-", "cm6", "ghost", "leaf", "CodeMirror", 
	"@media", "pdf", "xfa", "annotation",
	"load", "@-webkit", "setting", "filter", "decorator", 
	"dictionary", "status", "windows", "titlebar", "source",
	"menu", "message", "popover", "suggestion", "prompt", 
	"tab", "HyperMD", "workspace", "publish", 
	"backlink", "sync", "vault", "mobile", "tablet", "phone", 
	"textLayer", "header", "linux", "macos", "rename", "edit",
	"progress", "native", "aria", "tooltip", 
	"drop", "sidebar", "mod-windows", "is-frameless", 
	"is-hidden-frameless", "obsidian-app", "show-view-header", 
	"is-maximized", "is-translucent", "community", "Layer"];
	static readonly stylesKeep = ["@media", "tree", "scrollbar", "input[type", "table", "markdown-rendered", "css-settings-manager", "inline-embed", "background", "token"];
    
    override async load()
    {
        this.data = "";

        let appSheet = document.styleSheets[1];
        let stylesheets = Array.from(document.styleSheets);
        for (const element of stylesheets)
        {
            if (element.href && element.href?.includes("app.css"))
            {
                appSheet = element;
                break;
            }
        }

		this.data = AssetHandler.filterStyleRules(appSheet, ObsidianStyles.obsidianStylesFilter, ObsidianStyles.stylesKeep);
        this.data += obsidianStyleOverrides;
        await super.load();
    }
}
