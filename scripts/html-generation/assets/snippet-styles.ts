import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { ExportLog } from "../render-log";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class SnippetStyles extends Asset
{
    public content: string = "";

    constructor()
    {
        super("snippets.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 2);
    }

    private static getEnabledSnippets(): string[]
    {
        /*@ts-ignore*/
        return app.vault.config?.enabledCssSnippets ?? [];
    }

    private static async getStyleSnippetsContent(): Promise<string[]>
    {
        let snippetContents : string[] = [];
        let enabledSnippets = this.getEnabledSnippets();
        for (let i = 0; i < enabledSnippets.length; i++)
        {
            let path = new Path(`.obsidian/snippets/${enabledSnippets[i]}.css`).absolute();
            if (path.exists) snippetContents.push(await path.readFileString() ?? "\n");
        }
        return snippetContents;
    }

    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        let snippetsList = await SnippetStyles.getStyleSnippetsContent();
        let snippets = "\n";
        for (let i = 0; i < snippetsList.length; i++)
        {
            snippets += snippetsList[i] + "\n";
        }

		// replace "publish" styles with a high specificity prefix
		snippets = snippets.replaceAll(/^publish /gm, "html body[class].publish ");
		
        this.content = snippets;
		this.modifiedTime = Date.now();

        await super.load(options);
    }
}
