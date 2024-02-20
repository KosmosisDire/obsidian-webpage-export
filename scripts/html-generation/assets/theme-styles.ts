import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { ExportLog } from "../render-log";
import { AssetHandler } from "../asset-handler";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class ThemeStyles extends Asset
{
    public content: string = "";
    private lastThemeName: string = "";

    constructor()
    {
        super("theme.css", "", AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Default, 8);
    }

    private static async getThemeContent(themeName: string): Promise<string>
    {
        if (themeName == "Default") return "/* Using default theme. */";
		
        let themePath = AssetHandler.vaultPluginsPath.joinString(`../themes/${themeName}/theme.css`).absolute();
        if (!themePath.exists)
        {
            ExportLog.warning("Cannot find theme at path: \n\n" + themePath);
            return "";
        }
        let themeContent = await themePath.readFileString() ?? "";

        return themeContent;
    }

    private static getCurrentThemeName(): string
    {
        /*@ts-ignore*/
        let themeName = app.vault.config?.cssTheme;
        return (themeName ?? "") == "" ? "Default" : themeName;
    }
    
    override async load(options: MarkdownWebpageRendererAPIOptions)
    {
        let themeName = ThemeStyles.getCurrentThemeName();
        if (themeName == this.lastThemeName) 
		{
			this.modifiedTime = 0;
			return;
		}
        this.content = await ThemeStyles.getThemeContent(themeName);
		this.modifiedTime = Date.now();
        this.lastThemeName = themeName;

        await super.load(options);
    }
}
