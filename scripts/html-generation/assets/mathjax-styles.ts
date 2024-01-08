import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";

export class MathjaxStyles extends Asset
{
	private mathjaxStylesheet: CSSStyleSheet | undefined = undefined;
	private lastMathjaxChanged: number = -1;
    public content: string = "";

    constructor()
    {
        super("mathjax.css", "", AssetType.Style, InlinePolicy.AlwaysInline, true, Mutability.Dynamic);
    }
    
    override async load()
    {
        // @ts-ignore
        if (this.mathjaxStylesheet == undefined) this.mathjaxStylesheet = Array.from(document.styleSheets).find((sheet) => sheet.ownerNode.id == ("MJX-CHTML-styles"));
        if (this.mathjaxStylesheet == undefined) return;

        // @ts-ignore
        let changed = this.mathjaxStylesheet?.ownerNode.getAttribute("data-change");
        if (changed != this.lastMathjaxChanged)
        {
            this.content = "";
            for (let i = 0; i < this.mathjaxStylesheet.cssRules.length; i++)
            {
                this.content += this.mathjaxStylesheet.cssRules[i].cssText + "\n";
            }

            this.content = await Asset.minify(this.content, false);
        }
        else
        {
            return;
        }

        this.lastMathjaxChanged = changed;
        super.load();
    }
}
