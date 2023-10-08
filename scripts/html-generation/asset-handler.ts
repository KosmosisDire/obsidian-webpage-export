import graphViewJS from "assets/graph_view.txt.js";
import graphWASMJS from "assets/graph_wasm.txt.js";
import renderWorkerJS from "assets/graph-render-worker.txt.js";
import graphWASM from "assets/graph_wasm.wasm";
import tinyColorJS from "assets/tinycolor.txt.js";
import webpageJS from "assets/webpage.txt.js";
import appStyles from "assets/obsidian-styles.txt.css";
import webpageStyles from "assets/plugin-styles.txt.css";

import { Path } from "scripts/utils/path.js";
import { Downloadable } from "scripts/utils/downloadable.js";
import { RenderLog } from "./render-log.js";
import { MainSettings } from "scripts/settings/main-settings.js";
import { Website } from "scripts/objects/website.js";
const { minify } = require('html-minifier-terser');


export class AssetHandler
{
	private static vaultPluginsPath: Path;

	private static obsidianStylesFilter = 
	["workspace-", "cm-", "ghost", "leaf", "CodeMirror", 
	"@media", "pdf", "xfa", "annotation", "@keyframes", 
	"load", "@-webkit", "setting", "filter", "decorator", 
	"dictionary", "status", "windows", "titlebar", "source",
	"menu", "message", "popover", "suggestion", "prompt", 
	"tab", "HyperMD", "workspace", "publish", 
	"backlink", "sync", "vault", "mobile", "tablet", "phone", 
	"textLayer", "header", "linux", "macos", "rename", "edit",
	"progress", "native", "aria", "tooltip", 
	"drop", "sidebar", "mod-windows", "is-frameless", 
	"is-hidden-frameless", "obsidian-app", "show-view-header", 
	"is-maximized"];

	private static obsidianStylesKeep = 
	["scrollbar", "input[type"];

	// this path is used to generate the relative path to the images folder, likewise for the other paths
	public static readonly mediaFolderName: Path = new Path("lib/media");
	public static readonly jsFolderName: Path = new Path("lib/scripts");
	public static readonly cssFolderName: Path = new Path("lib/styles");

	public static appStyles: string = "";
	public static mathStyles: string = "";
	public static webpageStyles: string = "";
	public static themeStyles: string = "";
	public static snippetStyles: string = "";
	public static pluginStyles: string = "";
	public static generatedStyles: string = "";

	private static lastEnabledPluginStyles: string = "";
	private static lastEnabledSnippets: string[] = [];
	private static lastEnabledTheme: string = "";
	private static lastMathjaxChanged: number = -1;
	private static mathjaxStylesheet: CSSStyleSheet | undefined = undefined;

	public static webpageJS: string = "";
	public static graphViewJS: string = "";
	public static graphWASMJS: string = "";
	public static graphWASM: Buffer;
	public static renderWorkerJS: string = "";
	public static tinyColorJS: string = "";
	public static generatedJS: string = "";

	public static customHeadContent: string = "";

	public static async initialize(pluginID: string)
	{
		this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").makeAbsolute();

		await this.loadAppStyles();
		this.webpageStyles = await AssetHandler.minifyJSorCSS(webpageStyles, false);
		this.webpageJS = await AssetHandler.minifyJSorCSS(webpageJS, true);
		this.graphViewJS = await AssetHandler.minifyJSorCSS(graphViewJS, true);
		this.graphWASMJS = await AssetHandler.minifyJSorCSS(graphWASMJS, true);
		this.renderWorkerJS = await AssetHandler.minifyJSorCSS(renderWorkerJS, true);
		// @ts-ignore
		this.tinyColorJS = await AssetHandler.minifyJSorCSS(tinyColorJS, true);
		this.graphWASM = Buffer.from(graphWASM);

		this.updateAssetCache();
	}

	static async minifyJSorCSS(content: string, isJSNotCSS: boolean) : Promise<string>
	{
		// for now this is disabled because I don't have time to make it clean
		// return content;

		let tempContent = content;

		try
		{
			// add script or style tags so that minifier can minify it as html
			if (isJSNotCSS)
			{
				content = `
				<script>
				${content}
				</script>`;
			}
			else
			{
				content = `
				<style>
				${content}
				</style>`;
			}

			content = await minify(content, { collapseBooleanAttributes: true, collapseWhitespace: true, minifyCSS: true, minifyJS: true, removeComments: true, removeEmptyAttributes: true, removeRedundantAttributes: true, removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true});

			// remove the <script> or <style> tags
			content = content.replace("<script>", "").replace("</script>", "").replace("<style>", "").replace("</style>", "");
		}
		catch (e)
		{
			RenderLog.error(e.stack, "Error while minifying " + (isJSNotCSS ? "JS" : "CSS") + " file.");
			content = tempContent;
		}

		if (content == "") content = " ";

		return content;
	}

	public static async getDownloads() : Promise<Downloadable[]>
	{
		let toDownload: Downloadable[] = [];
		if (!MainSettings.settings.inlineCSS)
		{
			let pluginCSS = this.webpageStyles;
			let thirdPartyPluginCSS = await this.minifyJSorCSS(await this.getPluginStyles(), false);
			pluginCSS += "\n" + thirdPartyPluginCSS + "\n";
			let appcssDownload = new Downloadable("obsidian-styles.css", this.appStyles, this.cssFolderName);
			let plugincssDownload = new Downloadable("plugin-styles.css", pluginCSS, this.cssFolderName);
			let themecssDownload = new Downloadable("theme.css", this.themeStyles, this.cssFolderName);
			let snippetsDownload = new Downloadable("snippets.css", this.snippetStyles, this.cssFolderName);
			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
			toDownload.push(new Downloadable("generated-styles.css", this.generatedStyles, this.cssFolderName));
		}
		if (!MainSettings.settings.inlineJS)
		{
			let webpagejsDownload = new Downloadable("webpage.js", this.webpageJS, this.jsFolderName);
			toDownload.push(webpagejsDownload);
			if (this.generatedJS != "")
			{
				let generatedjsDownload = new Downloadable("generated.js", this.generatedJS, this.jsFolderName);
				toDownload.push(generatedjsDownload);
			}
		}
		if(MainSettings.settings.includeGraphView)
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

	public static async updateAssetCache()
	{
		let snippetsNames = this.getEnabledSnippets();
		let themeName = this.getCurrentThemeName();
		let enabledPluginStyles = MainSettings.settings.includePluginCSS;
		if (snippetsNames != this.lastEnabledSnippets)
		{
			this.lastEnabledSnippets = snippetsNames;
			this.snippetStyles = await this.minifyJSorCSS(await this.getSnippetsCSS(snippetsNames), false);
		}
		if (themeName != this.lastEnabledTheme)
		{
			this.lastEnabledTheme = themeName;
			this.themeStyles = await this.minifyJSorCSS(await this.getThemeContent(themeName), false);
		}
		if (enabledPluginStyles != this.lastEnabledPluginStyles)
		{
			this.lastEnabledPluginStyles = enabledPluginStyles;
			this.pluginStyles = await this.minifyJSorCSS(await this.getPluginStyles(), false);
		}
		
		let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
		let lineWidth = MainSettings.settings.customLineWidth || "50em";
		let contentWidth = MainSettings.settings.contentWidth || "500em";
		let sidebarWidth = MainSettings.settings.sidebarWidth || "25em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(contentWidth))) contentWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";

		let customHeadPath = new Path(MainSettings.settings.customHeadContentPath);
		this.customHeadContent = await customHeadPath.readFileString() ?? "";

		this.generatedStyles = 
`
body
{
	--line-width: ${lineWidth};
	--line-width-adaptive: ${lineWidth};
	--file-line-width: ${lineWidth};
	--content-width: ${contentWidth};
	--sidebar-width: calc(min(${sidebarWidth}, 80vw));
	--collapse-arrow-size: 0.35em;
	--tree-horizontal-spacing: 0.6em;
	--tree-vertical-spacing: 0.6em;
	--sidebar-margin: 24px;
}

body
{
	${bodyStyle}
}
`

		this.generatedJS = "";
		if (MainSettings.settings.includeGraphView)
		{
			this.generatedJS += 
			`
			let nodes=\n${JSON.stringify(Website.globalGraph)};
			let attractionForce = ${MainSettings.settings.graphAttractionForce};
			let linkLength = ${MainSettings.settings.graphLinkLength};
			let repulsionForce = ${MainSettings.settings.graphRepulsionForce};
			let centralForce = ${MainSettings.settings.graphCentralForce};
			let edgePruning = ${MainSettings.settings.graphEdgePruning};
			`
		}

		this.generatedJS = await this.minifyJSorCSS(this.generatedJS, true);
		this.generatedStyles = await this.minifyJSorCSS(this.generatedStyles, false);

		this.lastMathjaxChanged = -1;
	}

	public static async loadMathjaxStyles()
	{
		// @ts-ignore
		if (this.mathjaxStylesheet == undefined) this.mathjaxStylesheet = Array.from(document.styleSheets).find((sheet) => sheet.ownerNode.id == ("MJX-CHTML-styles"));
		if (this.mathjaxStylesheet == undefined) return;

		// @ts-ignore
		let changed = this.mathjaxStylesheet?.ownerNode.getAttribute("data-change");
		if (changed != this.lastMathjaxChanged)
		{
			AssetHandler.mathStyles = "";
			for (let i = 0; i < this.mathjaxStylesheet.cssRules.length; i++)
			{
				AssetHandler.mathStyles += this.mathjaxStylesheet.cssRules[i].cssText + "\n";
			}


			AssetHandler.mathStyles = await this.minifyJSorCSS(AssetHandler.mathStyles.replaceAll("app://obsidian.md/", "https://publish.obsidian.md/"), false);
		}
		else
		{
			return;
		}

		this.lastMathjaxChanged = changed;
	}

	private static filterBodyClasses(inputCSS: string): string
	{
		// replace all selectors that change based on the body's class to always be applied
		let matchCount = 1;
		while (matchCount != 0)
		{
			let matches = Array.from(inputCSS.matchAll(/body\.(?!theme-dark|theme-light)[\w-]+/g));
			
			matchCount = 0;
			matches.forEach((match) =>
			{
				let selector = match[0];
				let classes = selector.split(".")[1];
				if (selector && classes && document.body.classList.contains(classes))
				{
					inputCSS = inputCSS.replace(match[0].toString(), "body");
					RenderLog.log(classes);
					matchCount++;
				}
			});
		}

		return inputCSS;
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

		this.appStyles += appStyles;

		for (let i = 0; i < appSheet.cssRules.length; i++)
		{
			let rule = appSheet.cssRules[i];
			if (rule)
			{
				let skip = false;
				let selector = rule.cssText.split("{")[0];

				for (let keep of this.obsidianStylesKeep) 
				{
					if (!selector.includes(keep)) 
					{
						for (let filter of this.obsidianStylesFilter) 
						{
							if (selector.includes(filter)) 
							{
								skip = true;
								break;
							}
						}
					}
					else
					{
						skip = false;
						break;
					}
				}

				if (skip) continue;

				
				
				let cssText = rule.cssText + "\n";
				cssText = cssText.replaceAll("public/", "https://publish.obsidian.md/public/");
				cssText = cssText.replaceAll("lib/", "https://publish.obsidian.md/lib/");
				
				this.appStyles += cssText;
			}
		}

		for(let i = 1; i < stylesheets.length; i++) 
		{
			// @ts-ignore
			let styleID = stylesheets[i].ownerNode?.id;
			if ((styleID.startsWith("svelte") && MainSettings.settings.includeSvelteCSS) || styleID == "ADMONITIONS_CUSTOM_STYLE_SHEET")
			{
				RenderLog.log("Including stylesheet: " + styleID);
				let style = stylesheets[i].cssRules;

				for(let item in style) 
				{
					if(style[item].cssText != undefined)
					{
						
						this.appStyles += "\n" + style[item].cssText;
					}
				}
			}
		}

		this.appStyles = this.filterBodyClasses(this.appStyles);

		this.appStyles = await this.minifyJSorCSS(this.appStyles, false);
	}

	private static async getPluginStyles() : Promise<string>
	{
		// load 3rd party plugin css
		let pluginCSS = "";
		let thirdPartyPluginStyleNames = MainSettings.settings.includePluginCSS.split("\n");
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

		pluginCSS = this.filterBodyClasses(pluginCSS);

		return pluginCSS;
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
