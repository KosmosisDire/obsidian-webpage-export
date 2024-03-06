import obsidianStyleOverrides from "assets/obsidian-styles.txt.css";
import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset.js";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options.js";

export class ObsidianStyles extends Asset
{
	public content: string = "";
    constructor()
    {
        super("obsidian.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Default, 10);
    }

    public static readonly stylesFilter =
	["workspace-", "cm-", "cm6", "ghost", "leaf", "CodeMirror", 
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
	"is-maximized", "is-translucent", "community", "Layer"];

	public static readonly stylesKeep = ["tree", "scrollbar", "input[type", "table", "markdown-rendered", "css-settings-manager", "inline-embed", "background", "token"];

    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        this.content = "";

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

		let cssRules = Array.from(appSheet.cssRules);
		for (const element of cssRules)
		{
			let rule = element;
			let selectors = rule.cssText.split("{")[0].split(",");
			let declarations = rule.cssText.split("{")[1].split("}")[0].split(";");

			selectors = selectors.map((selector) => selector.trim());
			selectors = selectors.filter((selector) => ObsidianStyles.stylesKeep.some((keep) => selector.includes(keep)) || !ObsidianStyles.stylesFilter.some((filter) => selector.includes(filter)));

			if (selectors.length == 0)
				continue;

			let newRule = selectors.join(", ") + " { " + declarations.join("; ") + " }";
			this.content += newRule + "\n";
		}

        this.content += obsidianStyleOverrides;
        await super.load(options);
    }
}
