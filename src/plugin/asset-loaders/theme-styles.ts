import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { ExportLog } from "src/plugin/render-api/render-api.js";
import { AssetHandler } from "./asset-handler.js";
import { Path } from "../utils/path.js";

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
		
		// @ts-ignore
        const themePath = new Path(app.customCss.themes[themeName].dir).joinString("theme.css").absolute();
		console.log("Loading theme from path: " + themePath.path);
        if (!themePath.exists)
        {
            ExportLog.warning("Cannot find theme at path: \n\n" + themePath.path);
            return "";
        }
        const themeContent = await themePath.readAsString() ?? "";

        return themeContent;
    }
    
    override async load()
    {
        let themeName = this.exportOptions.themeName;
		if (!themeName || themeName == "" || themeName == "obsidian-current-theme")
			// @ts-ignore
			themeName = app?.vault?.config?.cssTheme;

		if (!themeName || themeName == "")
			themeName = "Default";
		
        if (themeName == this.lastThemeName && this.data != "") 
		{
			console.log("Theme styles already loaded.", themeName);
			return;
		}

        const themeCSS = await ThemeStyles.getThemeContent(themeName);
		this.data = await AssetHandler.filterStyleRules(themeCSS, ThemeStyles.obsidianStylesFilter, [], ThemeStyles.stylesKeep);
        this.lastThemeName = themeName;

		console.log("Theme styles loaded " + themeName);
        await super.load();
    }
}
