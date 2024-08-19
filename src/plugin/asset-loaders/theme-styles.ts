import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { ExportLog } from "plugin/render-api/render-api";
import { AssetHandler } from "./asset-handler.js";

export class ThemeStyles extends AssetLoader
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
		
        const themePath = AssetHandler.vaultPluginsPath.joinString(`../themes/${themeName}/theme.css`).absoluted();
        if (!themePath.exists)
        {
            ExportLog.warning("Cannot find theme at path: \n\n" + themePath);
            return "";
        }
        const themeContent = await themePath.readAsString() ?? "";

        return themeContent;
    }
    
    override async load()
    {
        let themeName = this.exportOptions.themeName;
		if (!themeName || themeName == "")
			// @ts-ignore
			themeName = app?.vault?.config?.cssTheme;

		if (!themeName || themeName == "")
			themeName = "Default";
		
        if (themeName == this.lastThemeName && this.data != "") 
		{
			console.log("Theme styles already loaded.");
			return;
		}

        const themeCSS = await ThemeStyles.getThemeContent(themeName);
		const themeStylesheet = new CSSStyleSheet();
		// @ts-ignore
		await themeStylesheet.replace(themeCSS);
		this.data = AssetHandler.filterStyleRules(themeStylesheet, ThemeStyles.obsidianStylesFilter, ThemeStyles.stylesKeep);
        this.lastThemeName = themeName;

		console.log("Theme styles loaded " + themeName);
        await super.load();
    }
}
