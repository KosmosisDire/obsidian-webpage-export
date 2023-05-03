import { Path } from "scripts/utils/path";
import { ExportSettings } from "scripts/export-settings";
import HTMLExportPlugin from "scripts/main";
import { RenderLog } from "./render-log";
import { Downloadable } from "scripts/utils/downloadable";


export class AssetHandler
{
    private static autoDownloadExtras = true;

	private static vaultPluginsPath: Path;
	private static thisPluginPath: Path;
	static assetsPath: Path;

	// this path is used to generate the relative path to the images folder, likewise for the other paths
	public static readonly mediaFolderName: Path = new Path("media");
	public static readonly jsFolderName: Path = new Path("scripts");
	public static readonly cssFolderName: Path = new Path("styles");

	//#region Loading

	// this is a string containing the filtered app.css file. It is populated on load. 
	public static appStyles: string = "";
	public static mathStyles: string = "";
	public static webpageStyles: string = "";
	public static themeStyles: string = "";
	public static snippetStyles: string = "";
	private static lastEnabledSnippets: string[] = [];
	private static lastEnabledTheme: string = "";

	public static webpageJS: string = "";
	public static graphViewJS: string = "";
	public static graphWASMJS: string = "";
	public static graphWASM: Buffer;
	public static renderWorkerJS: string = "";
	public static tinyColorJS: string = "";

	// the raw github urls for the extra files
	private static webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/webpage.js";
	private static pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/plugin-styles.css";
	private static obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/obsidian-styles.css";
	private static graphViewJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph_view.js";
	private static graphWASMJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph_wasm.js";
	private static graphWASMURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph_wasm.wasm";
	private static renderWorkerURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph-render-worker.js";
	private static tinycolorURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/tinycolor.js";

	private static async updateAssets()
	{
		// if there is an update then do not download the new assets since they may not be compatible
		if (HTMLExportPlugin.updateInfo.updateAvailable) return;

		await this.assetsPath.createDirectory();

		//Download webpage.js
		let webpagejs = await fetch(this.webpagejsURL);
		let webpagejsText = await webpagejs.text();
		await this.assetsPath.joinString("webpage.js").writeFile(webpagejsText);

		//Download plugin-styles.css
		let pluginStyles = await fetch(this.pluginStylesURL);
		let pluginStylesText = await pluginStyles.text();
		this.assetsPath.joinString("plugin-styles.css").writeFile(pluginStylesText);

		//Download obsidian-styles.css
		let obsidianStyles = await fetch(this.obsidianStylesURL);
		let obsidianStylesText = await obsidianStyles.text();
		this.assetsPath.joinString("obsidian-styles.css").writeFile(obsidianStylesText);
	
		//Download graph_view.js
		let graphViewJS = await fetch(this.graphViewJSURL);
		let graphViewJSText = await graphViewJS.text();
		this.assetsPath.joinString("graph_view.js").writeFile(graphViewJSText);

		//Download graph_wasm.js
		let graphWASMJS = await fetch(this.graphWASMJSURL);
		let graphWASMJSText = await graphWASMJS.text();
		this.assetsPath.joinString("graph_wasm.js").writeFile(graphWASMJSText);

		//Download graph_wasm.wasm
		let graphWASM = await fetch(this.graphWASMURL);
		let graphWASMBuffer = await graphWASM.arrayBuffer();
		this.assetsPath.joinString("graph_wasm.wasm").writeFile(Buffer.from(graphWASMBuffer));

		//Download graph-render-worker.js
		let renderWorker = await fetch(this.renderWorkerURL);
		let renderWorkerText = await renderWorker.text();
		this.assetsPath.joinString("graph-render-worker.js").writeFile(renderWorkerText);
		
		//Download tinycolor.js
		let tinycolor = await fetch(this.tinycolorURL);
		let tinycolorText = await tinycolor.text();
		this.assetsPath.joinString("tinycolor.js").writeFile(tinycolorText);
	}

	private static async loadAppStyles()
	{
		let appSheet = document.styleSheets[1];
		let stylesheets = document.styleSheets;
		for (let i = 0; i < stylesheets.length; i++)
		{
			if (stylesheets[i].href && stylesheets[i].href?.includes("app.css"))
			{
				appSheet = stylesheets[i];
				break;
			}
		}

		this.appStyles += await this.assetsPath.joinString("obsidian-styles.css").readFileString() ?? "";

		for (let i = 0; i < appSheet.cssRules.length; i++)
		{
			let rule = appSheet.cssRules[i];
			if (rule)
			{
				if (rule.cssText.startsWith("@font-face")) continue;
				if (rule.cssText.startsWith(".CodeMirror")) continue;
				if (rule.cssText.startsWith(".cm-")) continue;
				
				let cssText = rule.cssText + "\n";
				cssText = cssText.replaceAll("public/", "https://publish.obsidian.md/public/");
				cssText = cssText.replaceAll("lib/", "https://publish.obsidian.md/lib/")
				
				this.appStyles += cssText;
			}
		}
	}

    public static async initialize(pluginID: string)
	{
		this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").makeAbsolute();
		this.thisPluginPath = this.vaultPluginsPath.joinString(pluginID + "/").makeAbsolute();
		this.assetsPath = this.thisPluginPath.joinString("assets/").makeAbsolute();
		await this.assetsPath.createDirectory();

		if (this.autoDownloadExtras) await this.updateAssets();
		await this.loadAppStyles();
		
		this.webpageStyles = await this.assetsPath.joinString("plugin-styles.css").readFileString() ?? "";
		this.themeStyles = await this.getThemeContent(this.getCurrentThemeName());

		this.webpageJS = await this.assetsPath.joinString("webpage.js").readFileString() ?? "";
		this.graphViewJS = await this.assetsPath.joinString("graph_view.js").readFileString() ?? "";
		this.graphWASMJS = await this.assetsPath.joinString("graph_wasm.js").readFileString() ?? "";
		this.graphWASM = await this.assetsPath.joinString("graph_wasm.wasm").readFileBuffer() ?? Buffer.from([]);
		this.renderWorkerJS = await this.assetsPath.joinString("graph-render-worker.js").readFileString() ?? "";
		this.tinyColorJS = await this.assetsPath.joinString("tinycolor.js").readFileString() ?? "";
	}

	public static async getPluginStyles() : Promise<string>
	{
		// load 3rd party plugin css
		let pluginCSS = "";

		let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("\n");
		for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
		{
			if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
			
			let path = this.vaultPluginsPath.joinString(thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
			if (!path.exists) continue;
			
			let style = await path.readFileString();
			if (style)
			{
				pluginCSS += style;
			}
		}

		return pluginCSS;
	}

	private static async getSnippetsCSS(snippetNames: string[]) : Promise<string>
	{
		let snippetsList = await this.getStyleSnippetsContent();
		let snippets = "\n";

		for (let i = 0; i < snippetsList.length; i++)
		{
			snippets += `/* --- ${snippetNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
		}

		return snippets;
	}

	public static async updateAssetCache()
	{
		let snippetsNames = await this.getEnabledSnippets();
		let themeName = this.getCurrentThemeName();

		if (snippetsNames != this.lastEnabledSnippets)
		{
			this.lastEnabledSnippets = snippetsNames;
			this.snippetStyles = await this.getSnippetsCSS(snippetsNames);
		}

		if (themeName != this.lastEnabledTheme)
		{
			this.lastEnabledTheme = themeName;
			this.themeStyles = await this.getThemeContent(themeName);
		}
	}

	public static async getDownloads() : Promise<Downloadable[]>
	{
		let toDownload: Downloadable[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			let pluginCSS = this.webpageStyles;

			let thirdPartyPluginCSS = await this.getPluginStyles();
			pluginCSS += "\n" + thirdPartyPluginCSS + "\n";

			let appcssDownload = new Downloadable("obsidian-styles.css", this.appStyles, this.cssFolderName);
			let plugincssDownload = new Downloadable("plugin-styles.css", pluginCSS, this.cssFolderName);
			let themecssDownload = new Downloadable("theme.css", this.themeStyles, this.cssFolderName);
			let snippetsDownload = new Downloadable("snippets.css", this.snippetStyles, this.cssFolderName);

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if (!ExportSettings.settings.inlineJS)
		{
			let webpagejsDownload = new Downloadable("webpage.js", this.webpageJS, this.jsFolderName);

			toDownload.push(webpagejsDownload);
		}

		if(ExportSettings.settings.includeGraphView)
		{
			let graphWASMDownload = new Downloadable("graph_wasm.wasm", this.graphWASM, this.jsFolderName); // MIGHT NEED TO SPECIFY ENCODING
			let renderWorkerJSDownload = new Downloadable("graph-render-worker.js", this.renderWorkerJS, this.jsFolderName);
			let graphWASMJSDownload = new Downloadable("graph_wasm.js", this.graphWASMJS, this.jsFolderName);
			let graphViewJSDownload = new Downloadable("graph_view.js", this.graphViewJS, this.jsFolderName);
			let tinyColorJS = new Downloadable("tinycolor.js", this.tinyColorJS, this.jsFolderName);
			
			toDownload.push(renderWorkerJSDownload);
			toDownload.push(graphWASMDownload);
			toDownload.push(graphWASMJSDownload);
			toDownload.push(graphViewJSDownload);
			toDownload.push(tinyColorJS);
		}

		return toDownload;
	}

    private static async getThemeContent(themeName: string): Promise<string>
	{
		if (themeName == "Default") return "/* Using default theme. */";

		// MIGHT NEED TO FORCE A RELATIVE PATH HERE IDKK
		let themePath = new Path(`.obsidian/themes/${themeName}/theme.css`).absolute();
		if (!themePath.exists)
		{
			RenderLog.warning("Warning: could not load theme.", "Cannot find theme at path: \n\n" + themePath);
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

}