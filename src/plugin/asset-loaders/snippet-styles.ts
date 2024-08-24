import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Path } from "src/plugin/utils/path";

export class SnippetStyles extends AssetLoader
{
    constructor()
    {
        super("snippets.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 20);
    }

    private static getEnabledSnippets(): string[]
    {
        /*@ts-ignore*/
        return app.vault.config?.enabledCssSnippets ?? [];
    }

    private static async getStyleSnippetsContent(): Promise<string[]>
    {
        const snippetContents : string[] = [];
        const enabledSnippets = this.getEnabledSnippets();
        for (let i = 0; i < enabledSnippets.length; i++)
        {
            const path = new Path(`.obsidian/snippets/${enabledSnippets[i]}.css`).absoluted();
            if (path.exists) snippetContents.push(await path.readAsString() ?? "\n");
        }
        return snippetContents;
    }

    
    override async load()
    {
        const snippetsList = await SnippetStyles.getStyleSnippetsContent();
        let snippets = "\n";
        for (let i = 0; i < snippetsList.length; i++)
        {
            snippets += snippetsList[i] + "\n";
        }

		// replace "publish" styles with a high specificity prefix
		snippets = snippets.replaceAll(/^publish /gm, "html body[class].publish ");
		
        this.data = snippets;
        await super.load();
    }
}
