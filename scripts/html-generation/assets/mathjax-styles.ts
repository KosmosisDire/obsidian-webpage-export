import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";
import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";

export class MathjaxStyles extends Asset
{
	private mathjaxStylesheet: CSSStyleSheet | undefined = undefined;
	private lastMathjaxChanged: number = -1;
    public content: string = "";

    constructor()
    {
        super("mathjax.css", "", AssetType.Style, InlinePolicy.Inline, true, Mutability.Dynamic);
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        // @ts-ignore
        if (this.mathjaxStylesheet == undefined) this.mathjaxStylesheet = Array.from(document.styleSheets).find((sheet) => sheet.ownerNode.id == ("MJX-CHTML-styles"));
        if (this.mathjaxStylesheet == undefined) 
		{
			return;
		}
		
		this.modifiedTime = Date.now();

        // @ts-ignore
        let changed = this.mathjaxStylesheet?.ownerNode.getAttribute("data-change");
        if (changed != this.lastMathjaxChanged)
        {
            this.content = "";
            for (let i = 0; i < this.mathjaxStylesheet.cssRules.length; i++)
            {
                this.content += this.mathjaxStylesheet.cssRules[i].cssText + "\n";
            }
        }
        else
        {
            return;
        }

        this.lastMathjaxChanged = changed;
        await super.load(options);
    }
}
