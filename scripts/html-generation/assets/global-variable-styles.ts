import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Settings } from "scripts/settings/settings";

export class GlobalVariableStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("global-variable-styles.css", "", AssetType.Style, InlinePolicy.Auto, true, Mutability.Dynamic);
    }
    
    override async load()
    {
        let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
		let lineWidth = Settings.settings.documentWidth || "50em";
		let contentWidth = Settings.settings.contentWidth || "500em";
		let sidebarWidth = Settings.settings.sidebarWidth || "25em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(contentWidth))) contentWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";
		this.content = 
        `
        body
        {
			--line-width: ${lineWidth};
			--line-width-adaptive: ${lineWidth};
			--file-line-width: ${lineWidth};
			--content-width: ${contentWidth};
			--sidebar-width: calc(min(${sidebarWidth}, 80vw));
			--collapse-arrow-size: 11px;
			--tree-horizontal-spacing: 0.6em;
			--tree-vertical-spacing: 0.6em;
			--sidebar-margin: 12px;
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
