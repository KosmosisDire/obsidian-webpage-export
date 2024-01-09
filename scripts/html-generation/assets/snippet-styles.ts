import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { RenderLog } from "../render-log";

export class SnippetStyles extends Asset
{
    public content: string = "";
    private lastEnabledSnippets: string[] = [];

    constructor()
    {
        super("snippets.css", "", AssetType.Style, InlinePolicy.Auto, true, Mutability.Dynamic, 8);
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

    
    override async load()
    {
        let enabledSnippets = SnippetStyles.getEnabledSnippets();
        if (enabledSnippets == this.lastEnabledSnippets) return;

        let snippetsList = await SnippetStyles.getStyleSnippetsContent();
        let snippets = "\n";
        for (let i = 0; i < snippetsList.length; i++)
        {
            snippets += snippetsList[i] + "\n";
        }
		
        this.content = snippets;
        this.lastEnabledSnippets = enabledSnippets;
		this.modifiedTime = Date.now();

        await super.load();
    }
}
