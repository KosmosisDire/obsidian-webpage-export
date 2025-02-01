import obsidianStyleOverrides from "src/assets/obsidian-styles.txt.css";
import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { AssetHandler } from "./asset-handler.js";

export class ObsidianStyles extends AssetLoader
{
    constructor()
    {
        super("obsidian.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Default, 10);
    }

	static readonly obsidianStyleAlwaysFilter =
	[
		"cm-", "cm6", "workspace-", ":root", "CodeMirror", "xfa", "modal", "@-webkit", "leaf", "plugins", "-split", "empty-state", "search-result-", "mobile", "tablet", "phone", "linux", "macos", "mod-windows", "is-frameless", 
	]
	static readonly obsidianStylesFilter =
	["ghost", "pdf", "annotation", "data-main-rotation", "spread",
	"load",  "setting", "filter", "decorator", "node-insert", "app-container",
	"dictionary", "status", "windows", "titlebar", "source", "#main-horizontal",
	"menu", "message", "suggestion", "prompt", 
	"tab", "HyperMD", "workspace", "publish", 
	"backlink", "sync", "vault",  
	"textLayer", "header",  "rename", "edit",
	"progress", "native", "aria", "tooltip", 
	"drop", "sidebar", 
	"is-hidden-frameless", "obsidian-app", "show-view-header",
	"is-maximized", "is-translucent", "community", "Layer"];
	static readonly stylesKeep = ["tree", "scrollbar", "input[type", "table", "markdown-rendered", "css-settings-manager", "inline-embed", "background", "token", "-plugin-"];
    
    override async load()
    {
        this.data = "";

        let appSheet = document.styleSheets[1];
        const stylesheets = Array.from(document.styleSheets);
        for (const element of stylesheets)
        {
            if (element.href && element.href?.includes("app.css"))
            {
                appSheet = element;
                break;
            }
        }

		this.data = await AssetHandler.filterStyleRules(appSheet, ObsidianStyles.obsidianStyleAlwaysFilter, ObsidianStyles.obsidianStylesFilter, ObsidianStyles.stylesKeep);
        this.data += obsidianStyleOverrides;
        await super.load();
    }
}
