import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Path } from "scripts/utils/path";
import { RenderLog } from "../render-log";

export class ThemeStyles extends Asset
{
    public content: string = "";
    private lastThemeName: string = "";

    constructor()
    {
        super("theme.css", "", AssetType.Style, InlinePolicy.Auto, true, Mutability.Dynamic, 4);
    }

    private static async getThemeContent(themeName: string): Promise<string>
    {
        if (themeName == "Default") return "/* Using default theme. */";
        // MIGHT NEED TO FORCE A RELATIVE PATH HERE IDKK
        let themePath = new Path(`.obsidian/themes/${themeName}/theme.css`).absolute();
        if (!themePath.exists)
        {
            RenderLog.warning("Cannot find theme at path: \n\n" + themePath);
            return "";
        }
        let themeContent = await themePath.readFileString() ?? "";

        themeContent = this.filterBodyClasses(themeContent);

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
        if (themeName == this.lastThemeName) return;
        this.content = await ThemeStyles.getThemeContent(themeName);
        this.lastThemeName = themeName;
		this.modifiedTime = Date.now();
        await super.load();
    }
}
