import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Path } from "src/plugin/utils/path";
import { ExportLog } from "src/plugin/render-api/render-api";
import postcss from "postcss";

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

    private async getStyleSnippetsContent(): Promise<string[]>
    {
        const snippetContents : string[] = [];
        const includedSnippets = this.exportOptions.includeCssSnippets ?? [];
        const enabledSnippets = SnippetStyles.getEnabledSnippets().filter((snippet) => includedSnippets.contains(snippet));
        for (let i = 0; i < enabledSnippets.length; i++)
        {
            const path = new Path(`.obsidian/snippets/${enabledSnippets[i]}.css`).absoluted();
            if (!path.exists) continue;

            const content = await path.readAsString() ?? "\n";
            try
            {
                postcss.parse(content);
            }
            catch (error)
            {
                ExportLog.error(error, `Invalid CSS snippet: ${enabledSnippets[i]}`);
                continue;
            }

            snippetContents.push(content);
        }
        return snippetContents;
    }

    
    override async load()
    {
        const snippetsList = await this.getStyleSnippetsContent();
        let snippets = "\n";
        for (let i = 0; i < snippetsList.length; i++)
        {
            snippets += snippetsList[i] + "\n";
        }

		// replace "publish" styles with a high specificity prefix
		snippets = snippets.replaceAll(/^publish /gm, "html body[class].publish ");
        snippets = snippets.replaceAll(/\.markdown-preview-view|\.markdown-source-view/g, ".obsidian-document");
		
        this.data = snippets;
        await super.load();
    }
}
