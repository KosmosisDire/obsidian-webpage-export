import { WebAsset } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { ExportLog } from "scripts/render-api/render-api";
import { AssetHandler } from "./asset-handler";

export class ThemeStyles extends WebAsset
{
    private lastThemeName: string = "";

    constructor()
    {
        super("theme.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Default, 8);
    }

	static readonly obsidianStylesFilter =
	["cm-", "cm6", "CodeMirror", "pdf"];
	static readonly stylesKeep = ["@media", "tree", "scrollbar", "input[type", "table", "markdown-rendered", "inline-embed"];
    

    private static async getThemeContent(themeName: string): Promise<string>
    {
        if (themeName == "Default") return "/* Using default theme. */";
		
        let themePath = AssetHandler.vaultPluginsPath.joinString(`../themes/${themeName}/theme.css`).absoluted();
        if (!themePath.exists)
        {
            ExportLog.warning("Cannot find theme at path: \n\n" + themePath);
            return "";
        }
        let themeContent = await themePath.readAsString() ?? "";

        return themeContent;
    }

    private static getCurrentThemeName(): string
    {
        /*@ts-ignore*/
        let themeName = app.vault.config?.cssTheme;
        return (themeName ?? "") == "" ? "Default" : themeName;
    }
    
    override async load()
    {
        let themeName = ThemeStyles.getCurrentThemeName();
        if (themeName == this.lastThemeName && this.data != "") 
		{
			return;
		}
        let themeCSS = await ThemeStyles.getThemeContent(themeName);
		const themeStylesheet = new CSSStyleSheet();
		// @ts-ignore
		await themeStylesheet.replace(themeCSS);
		this.data = AssetHandler.filterStyleRules(themeStylesheet, ThemeStyles.obsidianStylesFilter, ThemeStyles.stylesKeep);
        this.lastThemeName = themeName;
        await super.load();
    }
}
