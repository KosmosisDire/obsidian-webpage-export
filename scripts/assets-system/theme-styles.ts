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
        this.data = await ThemeStyles.getThemeContent(themeName);
        this.lastThemeName = themeName;
        await super.load();
    }
}
