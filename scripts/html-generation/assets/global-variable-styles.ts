import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";
import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { Settings, SettingsPage } from "scripts/settings/settings";

export class GlobalVariableStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("global-variable-styles.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 6);
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
		let lineWidth = Settings.documentWidth || "40em";
		let sidebarWidth = Settings.sidebarWidth || "20em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";

		let lineWidthCss = `min(${lineWidth}, calc(100vw - 2em))`;
		this.content = 
        `
        :root body
        {
			--line-width: ${lineWidthCss};
			--line-width-adaptive: ${lineWidthCss};
			--file-line-width: ${lineWidthCss};
			--sidebar-width: min(${sidebarWidth}, 80vw);
        }

		body
        {
            ${bodyStyle}
        }
        `

		this.modifiedTime = Date.now();

        await super.load(options);
    }
}
