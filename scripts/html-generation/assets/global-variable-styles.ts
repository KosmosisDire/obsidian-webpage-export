import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { Settings } from "scripts/settings/settings";

export class GlobalVariableStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("global-variable-styles.css", "", AssetType.Style, InlinePolicy.Auto, true, Mutability.Dynamic, LoadMethod.Async, 6);
    }
    
    override async load()
    {
        let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
		let lineWidth = Settings.settings.documentWidth || "40em";
		let contentWidth = Settings.settings.contentWidth || "500em";
		let sidebarWidth = Settings.settings.sidebarWidth || "20em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(contentWidth))) contentWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";

		let lineWidthCss = `min(${lineWidth}, calc(100vw - 2em)`;
		let contentWidthCss = `min(${contentWidth}, calc(100vw - 2em)`;
		this.content = 
        `
        html body
        {
			--line-width: ${lineWidthCss};
			--line-width-adaptive: ${lineWidthCss};
			--file-line-width: ${lineWidthCss};
			--content-width: ${contentWidthCss};
			--sidebar-width: min(${sidebarWidth}, 80vw);
        }

		body
        {
            ${bodyStyle}
        }
        `

		this.modifiedTime = Date.now();

        await super.load();
    }
}
