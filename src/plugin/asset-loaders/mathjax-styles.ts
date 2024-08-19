import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, Mutability } from "./asset-types.js";

export class MathjaxStyles extends AssetLoader
{
	private mathjaxStylesheet: CSSStyleSheet | undefined = undefined;
	private lastMathjaxChanged: number = -1;

    constructor()
    {
        super("mathjax.css", "", null, AssetType.Style, InlinePolicy.Inline, true, Mutability.Dynamic);
    }
    
    override async load()
    {
        // @ts-ignore
        if (this.mathjaxStylesheet == undefined) this.mathjaxStylesheet = Array.from(document.styleSheets).find((sheet) => sheet.ownerNode.id == ("MJX-CHTML-styles"));
        if (this.mathjaxStylesheet == undefined) 
		{
			return;
		}

        // @ts-ignore
        const changed = this.mathjaxStylesheet?.ownerNode.getAttribute("data-change");
        if (changed != this.lastMathjaxChanged)
        {
            this.data = "";
            for (let i = 0; i < this.mathjaxStylesheet.cssRules.length; i++)
            {
                this.data += this.mathjaxStylesheet.cssRules[i].cssText + "\n";
            }
        }
        else
        {
            return;
        }

        this.lastMathjaxChanged = changed;
        await super.load();
    }
}
