import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Settings } from "src/plugin/settings/settings";

export class GlobalVariableStyles extends AssetLoader
{
    constructor()
    {
        super("global-variable-styles.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 6);
    }
    
    override async load()
    {
        let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
		let lineWidth = Settings.documentWidth || "40em";
		let sidebarWidth = Settings.sidebarWidth || "20em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";

		let lineWidthCss = `min(${lineWidth}, calc(100vw - 2em))`;
		this.data = 
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

        await super.load();
    }
}
