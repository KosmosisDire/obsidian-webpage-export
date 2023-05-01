import { Downloadable, Path } from "./UtilClasses";
import { writeFile } from "fs/promises";
import { MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { ExportSettings } from "./export-settings";
import { Utils } from "./utils";
import jQuery from 'jquery';
import { GraphGenerator } from "./graph-view/graph-gen";
import { html_beautify } from "js-beautify";
const $ = jQuery;
import { LeafHandler } from './leaf-handler';
import HTMLExportPlugin from "./main";

export class ExportFile
{
	/**
	 * The original markdown file to export.
	 */
	public markdownFile: TFile;

	/**
	 * The absolute path to the FOLDER we are exporting to
	 */
	public exportToFolder: Path;

	/**
	 * The relative path from the vault root to the FOLDER being exported
	 */
	public exportFromFolder: Path;

	/**
	 * Is this file part of a batch export, or is it being exported independently?
	 */
	public partOfBatch: boolean;

	/**
	 * The name of the file being exported, with the .html extension
	 */
	public name: string;

	/**
	 * The relative path from the export folder to the file being exported; includes the file name and extension.
	 */
	public exportPath: Path;

	/**
	 * The document to use to generate the HTML.
	 */
	public document: Document;

	/**
	 * The external files that need to be downloaded for this file to work including the file itself.
	 */
	public downloads: Downloadable[] = [];

	/**
	 * Same as downloads but does not include the file itself.
	 */
	public externalDownloads: Downloadable[] = [];


	/**
	 * @param file The original markdown file to export
	 * @param exportToFolder The absolute path to the FOLDER we are exporting to
	 * @param exportFromFolder The relative path from the vault root to the FOLDER being exported
	 * @param partOfBatch Is this file part of a batch export, or is it being exported independently?
	 * @param fileName The name of the file being exported, with the .html extension
	 * @param forceExportToRoot Force the file to be saved directly int eh export folder rather than in it's subfolder.
	 */
	constructor(file: TFile, exportToFolder: Path, exportFromFolder: Path, partOfBatch: boolean, fileName: string = "", forceExportToRoot: boolean = false)
	{
		if(exportToFolder.isFile || !exportToFolder.isAbsolute) throw new Error("rootExportFolder must be an absolute path to a folder");
		if(!fileName.endsWith(".html")) throw new Error("fileName must be a .html file");

		this.markdownFile = file;
		this.exportToFolder = exportToFolder;
		this.exportFromFolder = exportFromFolder;
		this.partOfBatch = partOfBatch;

		this.name = (fileName === "" ? (file.basename + ".html") : fileName);
		this.exportPath = Path.joinStrings(file.parent.path, this.name);
		if (forceExportToRoot) this.exportPath.reparse(this.name);
		this.exportPath.setWorkingDirectory(this.exportToFolder.asString);

		if (ExportSettings.settings.makeNamesWebStyle)
		{
			this.name = Path.toWebStyle(this.name);
			this.exportPath.makeWebStyle();
		}

		this.document = document.implementation.createHTMLDocument(this.markdownFile.basename);
	}

	/**
	 * The HTML string for the file
	 */
	get html(): string
	{
		let htmlString = "<!DOCTYPE html>\n" + this.document.documentElement.outerHTML;
		if (ExportSettings.settings.beautifyHTML) htmlString = html_beautify(htmlString, { indent_size: 2 });
		return htmlString;
	}

	/**
	 * The element that contains the content of the document, aka the markdown-preview-view
	 */
	get contentElement(): HTMLElement
	{
		return this.document.querySelector(".markdown-preview-view") as HTMLElement;
	}

	/**
	 * The absolute path that the file will be saved to
	 */
	get exportPathAbsolute(): Path
	{
		return this.exportToFolder.join(this.exportPath);
	}

	/**
	 * The relative path from exportPath to rootFolder
	 */
	get pathToRoot(): Path
	{
		return Path.getRelativePath(this.exportPath, new Path(this.exportPath.workingDirectory), true);
	}

	/**
	 * Returns a downloadable object to download the .html file to the current path with the current html contents.
	 */
	public getSelfDownloadable(): Downloadable
	{
		return new Downloadable(this.name, this.html, "text/html", this.exportPath.directory, true);
	}

	public async generateHTML(addSelfToDownloads: boolean = false): Promise<ExportFile>
	{
		await HTMLGenerator.getDocumentHTML(this, addSelfToDownloads);
		return this;
	}

	public async generateWebpage(): Promise<ExportFile>
	{
		await HTMLGenerator.generateWebpage(this);
		return this;
	}
}

export class HTMLGenerator
{
	// When this is enabled the plugin will download the extra .css and .js files from github.
	static autoDownloadExtras = false;

	private static vaultPluginsPath: Path;
	private static thisPluginPath: Path;
	static assetsPath: Path;

	// this path is used to generate the relative path to the images folder, likewise for the other paths
	private static mediaFolderName: Path = new Path("media");
	private static jsFolderName: Path = new Path("scripts");
	private static cssFolderName: Path = new Path("styles");
	
	private static generateErrorHTML(message: string): string
	{
		return `
		<div class="markdown-preview-view markdown-rendered">
			<center>
				<h1>
				Failed to render file, check obsidian log for details and report an issue on GitHub: 
				<a href="https://github.com/KosmosisDire/obsidian-webpage-export/issues">Github Issues</a>
				</h1>
			</center>
			<br>
			<br>
			<center>
				<h3>
					${message}
				</h3>
			</center>
		</div>
		`;
	}

	//#region Loading

	// this is a string containing the filtered app.css file. It is populated on load. 
	private static appStyles: string = "";
	private static mathStyles: string = "";
	private static pluginStyles: string = "";
	private static themeStyles: string = "";
	private static snippetStyles: string = "";
	private static lastEnabledSnippets: string[] = [];
	private static lastEnabledTheme: string = "";

	private static webpageJS: string = "";
	private static graphViewJS: string = "";
	private static graphWASMJS: string = "";
	private static graphWASM: Buffer;
	private static renderWorkerJS: string = "";
	private static tinyColorJS: string = "";

	// the raw github urls for the extra files
	private static webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/webpage.js";
	private static pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/plugin-styles.css";
	private static obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/obsidian-styles.css";
	private static graphViewJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph_view.js";
	private static graphWASMJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph_wasm.js";
	private static graphWASMURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph_wasm.wasm";
	private static renderWorkerURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/graph-render-worker.js";
	private static tinycolorURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/tinycolor.js";

	private static async downloadAssets()
	{
		// if there is an update then do not download the new assets since they may not be compatible
		if (HTMLExportPlugin.updateInfo.updateAvailable) return;

		await this.assetsPath.createDirectory();

		//Download webpage.js
		let webpagejs = await fetch(this.webpagejsURL);
		let webpagejsText = await webpagejs.text();
		await writeFile(this.assetsPath.joinString("webpage.js").asString, webpagejsText).catch((err) => { console.log(err); });

		//Download plugin-styles.css
		let pluginStyles = await fetch(this.pluginStylesURL);
		let pluginStylesText = await pluginStyles.text();
		await writeFile(this.assetsPath.joinString("plugin-styles.css").asString, pluginStylesText).catch((err) => { console.log(err); });

		//Download obsidian-styles.css
		let obsidianStyles = await fetch(this.obsidianStylesURL);
		let obsidianStylesText = await obsidianStyles.text();
		await writeFile(this.assetsPath.joinString("obsidian-styles.css").asString, obsidianStylesText).catch((err) => { console.log(err); });
	
		//Download graph_view.js
		let graphViewJS = await fetch(this.graphViewJSURL);
		let graphViewJSText = await graphViewJS.text();
		await writeFile(this.assetsPath.joinString("graph_view.js").asString, graphViewJSText).catch((err) => { console.log(err); });

		//Download graph_wasm.js
		let graphWASMJS = await fetch(this.graphWASMJSURL);
		let graphWASMJSText = await graphWASMJS.text();
		await writeFile(this.assetsPath.joinString("graph_wasm.js").asString, graphWASMJSText).catch((err) => { console.log(err); });

		//Download graph_wasm.wasm
		let graphWASM = await fetch(this.graphWASMURL);
		let graphWASMBuffer = await graphWASM.arrayBuffer();
		await writeFile(this.assetsPath.joinString("graph_wasm.wasm").asString, Buffer.from(graphWASMBuffer)).catch((err) => { console.log(err); });

		//Download graph-render-worker.js
		let renderWorker = await fetch(this.renderWorkerURL);
		let renderWorkerText = await renderWorker.text();
		await writeFile(this.assetsPath.joinString("graph-render-worker.js").asString, renderWorkerText).catch((err) => { console.log(err); });
		
		//Download tinycolor.js
		let tinycolor = await fetch(this.tinycolorURL);
		let tinycolorText = await tinycolor.text();
		await writeFile(this.assetsPath.joinString("tinycolor.js").asString, tinycolorText).catch((err) => { console.log(err); });
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

		this.appStyles += await Utils.getText(this.assetsPath.joinString("obsidian-styles.css"));

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

		if (this.autoDownloadExtras) await this.downloadAssets();
		await this.loadAppStyles();
		
		this.pluginStyles = await Utils.getText(this.assetsPath.joinString("plugin-styles.css")) ?? "";
		this.themeStyles = await Utils.getThemeContent(Utils.getCurrentThemeName());

		this.webpageJS = await Utils.getText(this.assetsPath.joinString("webpage.js")) ?? "";
		this.graphViewJS = await Utils.getText(this.assetsPath.joinString("graph_view.js")) ?? "";
		this.graphWASMJS = await Utils.getText(this.assetsPath.joinString("graph_wasm.js")) ?? "";
		this.graphWASM = await Utils.getFileBuffer(this.assetsPath.joinString("graph_wasm.wasm")) ?? Buffer.from([]);
		this.renderWorkerJS = await Utils.getText(this.assetsPath.joinString("graph-render-worker.js")) ?? "";
		this.tinyColorJS = await Utils.getText(this.assetsPath.joinString("tinycolor.js")) ?? "";
	}

	private static async getThirdPartyPluginCSS() : Promise<string>
	{
		// load 3rd party plugin css
		let pluginCSS = "";

		let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("\n");
		for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
		{
			if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
			
			let path = this.vaultPluginsPath.joinString(thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
			if (!path.exists) continue;
			
			let style = await Utils.getText(path);
			if (style)
			{
				pluginCSS += style;
			}
		}

		return pluginCSS;
	}

	private static async getSnippetsCSS(snippetNames: string[]) : Promise<string>
	{
		let snippetsList = await Utils.getStyleSnippetsContent();
		let snippets = "\n";

		for (let i = 0; i < snippetsList.length; i++)
		{
			snippets += `/* --- ${snippetNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
		}

		return snippets;
	}

	private static async updateCSSCache()
	{
		let snippetsNames = await Utils.getEnabledSnippets();
		let themeName = Utils.getCurrentThemeName();

		if (snippetsNames != this.lastEnabledSnippets)
		{
			this.lastEnabledSnippets = snippetsNames;
			this.snippetStyles = await this.getSnippetsCSS(snippetsNames);
		}

		if (themeName != this.lastEnabledTheme)
		{
			this.lastEnabledTheme = themeName;
			this.themeStyles = await Utils.getThemeContent(themeName);
		}
	}

	private static async getAssetDownloads() : Promise<Downloadable[]>
	{
		let toDownload: Downloadable[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			let pluginCSS = this.pluginStyles;

			let thirdPartyPluginCSS = await this.getThirdPartyPluginCSS();
			pluginCSS += "\n" + thirdPartyPluginCSS + "\n";

			let appcssDownload = new Downloadable("obsidian-styles.css", this.appStyles, "text/css", this.cssFolderName);
			let plugincssDownload = new Downloadable("plugin-styles.css", pluginCSS, "text/css", this.cssFolderName);
			let themecssDownload = new Downloadable("theme.css", this.themeStyles, "text/css", this.cssFolderName);
			let snippetsDownload = new Downloadable("snippets.css", this.snippetStyles, "text/css", this.cssFolderName);

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if (!ExportSettings.settings.inlineJS)
		{
			let webpagejsDownload = new Downloadable("webpage.js", this.webpageJS, "text/javascript", this.jsFolderName);

			toDownload.push(webpagejsDownload);
		}

		if(ExportSettings.settings.includeGraphView)
		{
			let graphWASMDownload = new Downloadable("graph_wasm.wasm", this.graphWASM, "application/wasm", this.jsFolderName, false);
			let renderWorkerJSDownload = new Downloadable("graph-render-worker.js", this.renderWorkerJS, "text/javascript", this.jsFolderName);
			let graphWASMJSDownload = new Downloadable("graph_wasm.js", this.graphWASMJS, "text/javascript", this.jsFolderName);
			let graphViewJSDownload = new Downloadable("graph_view.js", this.graphViewJS, "text/javascript", this.jsFolderName);
			let tinyColorJS = new Downloadable("tinycolor.js", this.tinyColorJS, "text/javascript", this.jsFolderName);
			
			toDownload.push(renderWorkerJSDownload);
			toDownload.push(graphWASMDownload);
			toDownload.push(graphWASMJSDownload);
			toDownload.push(graphViewJSDownload);
			toDownload.push(tinyColorJS);
		}

		return toDownload;
	}

	//#endregion

	//#region Main Generation Functions

	public static renderLeaf: WorkspaceLeaf | undefined;

	public static async beginBatch()
	{
		GraphGenerator.clearGraphCache();
		this.updateCSSCache();

		this.renderLeaf = LeafHandler.openBlankLeaf("window", "vertical");
		// @ts-ignore
		let parentFound = await Utils.waitUntil(() => this.renderLeaf && this.renderLeaf.parent, 2000, 10);
		if (!parentFound) 
		{
			try
			{
				this.renderLeaf.detach();
			}
			catch (e)
			{
				console.log(e);
			}

			throw new Error("Failed to create leaf for rendering!");
		}

		// hide the leaf so we can render without intruding on the user
		// @ts-ignore
		this.renderLeaf.parent.containerEl.style.height = "0";
		// @ts-ignore
		$(this.renderLeaf.parent.parent.containerEl).find(".clickable-icon, .workspace-tab-header-container-inner").css("display", "none");
		// @ts-ignore
		$(this.renderLeaf.parent.containerEl).css("max-height", "var(--header-height)");
		// @ts-ignore
		$(this.renderLeaf.parent.parent.containerEl).removeClass("mod-vertical");
		// @ts-ignore
		$(this.renderLeaf.parent.parent.containerEl).addClass("mod-horizontal");
		this.renderLeaf.view.containerEl.win.resizeTo(700, 270);
		this.renderLeaf.view.containerEl.win.moveTo(window.screen.width / 2 - 350, 50);

		await Utils.delay(1000);
	}

	public static reportProgress(complete: number, total:number, message: string, subMessage: string, progressColor: string)
	{
		if(!this.renderLeaf) return;
		// @ts-ignore
		let found = Utils.waitUntil(() => this.renderLeaf && this.renderLeaf.parent && this.renderLeaf.parent.parent, 2000, 10);
		if (!found) return;

		// @ts-ignore
		let loadingContainer = this.renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		if (!loadingContainer) 
		{
			loadingContainer = document.createElement("div");
			loadingContainer.className = `html-render-progress-container`;
			loadingContainer.setAttribute("style", "height: 100%; min-width: 100%; display:flex; flex-direction:column; align-content: center; justify-content: center; align-items: center;");
			loadingContainer.innerHTML = 
			`
			<h1 style="margin-block-start: auto;">Rendering HTML</h1>
			<progress class="html-render-progressbar" value="0" min="0" max="1" style="width: 300px; height: 15px"></progress>
			<span class="html-render-submessage" style="margin-block-start: 2em;">${message}</span>
			<span style="margin-block-start: auto; margin-block-end:2em;">Do not exit this window, but you may return to the main obsidian window.</span>
			`

			// @ts-ignore
			this.renderLeaf.parent.parent.containerEl.appendChild(loadingContainer);
		}

		let progress = complete / total;

		let progressBar = loadingContainer.querySelector("progress");
		if (progressBar)
		{
			progressBar.value = progress;
			progressBar.style.backgroundColor = "transparent";
			progressBar.style.color = progressColor;
		}


		let messageElement = loadingContainer.querySelector("h1");
		if (messageElement)
		{
			messageElement.innerText = message;
		}

		let subMessageElement = loadingContainer.querySelector("span.html-render-submessage") as HTMLElement;
		if (subMessageElement)
		{
			subMessageElement.innerText = subMessage;
		}
	}

	public static reportError(mainMessage: string, subMessage: string, progressColor: string)
	{
		if(!this.renderLeaf) return;
		// @ts-ignore
		let found = Utils.waitUntil(() => this.renderLeaf && this.renderLeaf.parent && this.renderLeaf.parent.parent, 2000, 10);
		if (!found) return;

		// @ts-ignore
		let loadingContainer = this.renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		if (!loadingContainer) return;

		let messageElement = loadingContainer.querySelector("h1");
		if (messageElement)
		{
			messageElement.innerText = "❌ " + mainMessage;
			messageElement.style.color = "var(--color-red)";
		}

		let subMessageElement = loadingContainer.querySelector("span.html-render-submessage");
		if (subMessageElement)
		{
			subMessageElement.innerText = subMessage;
			subMessageElement.style.color = "var(--color-red)";
			subMessageElement.style.whiteSpace = "pre-wrap";
		}

		let progressBar = loadingContainer.querySelector("progress"); 
		if (progressBar)
		{
			progressBar.style.backgroundColor = "transparent";
			progressBar.style.color = progressColor;
		}
	}

	public static endBatch()
	{
		if (this.renderLeaf)
		{
			this.renderLeaf.detach();
		}
	}

	public static async generateWebpage(file: ExportFile): Promise<ExportFile>
	{
		await this.getDocumentHTML(file);
		let usingDocument = file.document;

		let sidebars = this.generateSideBars(file.contentElement, file);
		let rightSidebar = sidebars.right;
		let leftSidebar = sidebars.left;
		usingDocument.body.appendChild(sidebars.container);

		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle && !usingDocument.querySelector(".theme-toggle-inline, .theme-toggle"))
		{
			let toggle = this.generateDarkmodeToggle(false, usingDocument);
			leftSidebar.appendChild(toggle);
		}

		// inject outline
		if (ExportSettings.settings.includeOutline)
		{
			let headers = this.getHeaderList(usingDocument);
			if (headers)
			{
				var outline : HTMLElement | undefined = this.generateOutline(headers, usingDocument);
				rightSidebar.appendChild(outline);
			}
		}

		// inject graph view
		if (ExportSettings.settings.includeGraphView)
		{
			let graph = this.generateGraphView(usingDocument);
			let graphHeader = usingDocument.createElement("h6");
			graphHeader.style.margin = "1em";
			graphHeader.style.marginLeft = "12px";
			graphHeader.innerText = "Interactive Graph";
			
			rightSidebar.prepend(graph);
			rightSidebar.prepend(graphHeader);
		}

		await this.fillInHead(file);

		file.downloads.unshift(file.getSelfDownloadable());

		return file;
	}

	private static async renderMarkdown(file: ExportFile): Promise<string>
	{
		if (!this.renderLeaf)
		{
			throw new Error("Cannot render document without a render leaf! Please call beginBatch() before calling this function, and endBatch() after you are done exporting all files.");
		}

		await this.renderLeaf.openFile(file.markdownFile, { active: false});

		if(!(this.renderLeaf.view instanceof MarkdownView))
		{
			let message = "This file was not a normal markdown file! File: " + file.markdownFile.path;
			console.warn(message);
			return this.generateErrorHTML(message);
		}

		// @ts-ignore
		let previewModeFound = await Utils.waitUntil(() => this.renderLeaf != undefined && this.renderLeaf.view.previewMode, 2000, 10);
		if (!previewModeFound)
		{
			let message = "Failed to open preview mode! File: " + file.markdownFile.path;
			console.warn(message);
			return this.generateErrorHTML(message);
		}

		let preview = this.renderLeaf.view.previewMode;



		await Utils.changeViewMode(this.renderLeaf.view, "preview");

		// @ts-ignore
		preview.renderer.showAll = true;
		// @ts-ignore
		await preview.renderer.unfoldAllHeadings();

		// @ts-ignore
		let lastRender = preview.renderer.lastRender;
		// @ts-ignore
		preview.renderer.rerender(true);

		let isRendered = false;
		// @ts-ignore
		preview.renderer.onRendered(() => 
		{
			isRendered = true;
		});

		// @ts-ignore
		let renderfinished = await Utils.waitUntil(() => preview.renderer.lastRender != lastRender && isRendered, 10000, 10);
		if (!renderfinished)
		{
			let message = "Failed to render file within 10 seconds! File: " + file.markdownFile.path;
			console.warn(message);
			return this.generateErrorHTML(message);
		}

		// If everything worked then do a bit of postprocessing
		let container = preview.containerEl;
		if (container)
		{
			// don't set width, height, margin, padding, max-width, or max-height
			$(container).find(".markdown-preview-sizer").css("width", "unset");
			$(container).find(".markdown-preview-sizer").css("height", "unset");
			$(container).find(".markdown-preview-sizer").css("margin", "unset");
			$(container).find(".markdown-preview-sizer").css("padding", "unset");
			$(container).find(".markdown-preview-sizer").css("max-width", "unset");
			$(container).find(".markdown-preview-sizer").css("min-height", "unset");

			// load stylesheet for mathjax
			let stylesheet = document.getElementById("MJX-CHTML-styles");
			if (stylesheet)
			{
				if(document.getElementById("MJX-CHTML-styles"))
				{
					document.getElementById("MJX-CHTML-styles")?.remove();
					document.head.appendChild(stylesheet);
				}
				this.mathStyles = stylesheet.innerHTML.replaceAll("app://obsidian.md/", "https://publish.obsidian.md/").trim();
			}

			return container.innerHTML;
		}

		let message = "Could not find container with rendered content! File: " + file.markdownFile.path;
		console.warn(message);
		return this.generateErrorHTML(message);
	}

	public static async getDocumentHTML(file: ExportFile, addSelfToDownloads: boolean = false): Promise<ExportFile>
	{
		// set custom line width on body
		let body = $(file.document.body);

		let bodyClasses = (document.body.getAttribute("class") ?? "").replaceAll("\"", "'");
		let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'");
		body.attr("class", bodyClasses);
		body.attr("style", bodyStyle);

		let lineWidth = ExportSettings.settings.customLineWidth || "50em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		body.css("--line-width", lineWidth);
		body.css("--line-width-adaptive", lineWidth);
		body.css("--file-line-width", lineWidth);

		// create obsidian document containers
		let markdownViewEl = file.document.body.createDiv({ cls: "markdown-preview-view markdown-rendered" });
		let content = await this.renderMarkdown(file);
		markdownViewEl.outerHTML = content;

		if(ExportSettings.settings.allowFoldingHeadings && !markdownViewEl.hasClass("allow-fold-headings")) 
		{
			markdownViewEl.addClass("allow-fold-headings");
		}
		else if (markdownViewEl.hasClass("allow-fold-headings"))
		{
			markdownViewEl.removeClass("allow-fold-headings");
		}

		if (ExportSettings.settings.addFilenameTitle)
			this.addTitle(file);

		// add heading fold arrows
		let arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";
		let headings = $(file.document).find("div h1, div h2, div h3, div h4, div h5, div h6");
		headings.each((index, element) =>
		{
			// continue if heading already has an arrow
			if ($(element).find(".heading-collapse-indicator").length > 0) return;

			let el = file.document.createElement("div");
			el.setAttribute("class", "heading-collapse-indicator collapse-indicator collapse-icon");
			el.innerHTML = arrowHTML;
			element.prepend(el);
		});

		this.fixLinks(file); // modify links to work outside of obsidian (including relative links)
		
		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (ExportSettings.settings.inlineImages)
		{
			await this.inlineMedia(file);
		}
		else
		{
			outlinedImages = await this.outlineMedia(file);
		}

		if(addSelfToDownloads) file.downloads.push(file.getSelfDownloadable());
		file.downloads.push(...outlinedImages);
		file.downloads.push(... await this.getAssetDownloads());

		if(ExportSettings.settings.makeNamesWebStyle)
		{
			file.downloads.forEach((file) =>
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDownloadPath = file.relativeDownloadPath?.makeWebStyle();
			});
		}

		return file;
	}
	
	private static addTitle(file: ExportFile)
	{
		let currentTitle = file.document.querySelector("h1, h2, h3, h4, h5, h6");
		if (!currentTitle || !["h1", "H1"].contains(currentTitle.tagName))
		{
			let divContainer = file.document.createElement("div");
			let title = divContainer.createEl("h1");
			title.innerText = file.markdownFile.basename;
			file.contentElement.prepend(divContainer);
		}
	}

	private static generateSideBars(middleContent: HTMLElement, file: ExportFile): {container: HTMLElement, left: HTMLElement, right: HTMLElement, center: HTMLElement}
	{
		let docEl = file.document;

		let leftContent = docEl.createElement("div");
		let rightContent = docEl.createElement("div");
		let centerContent = docEl.createElement("div");
		let flexContainer = docEl.createElement("div");

		flexContainer.setAttribute("class", "flex-container");
		centerContent.setAttribute("class", "center-content");
		leftContent.setAttribute("class", "sidebar-content");
		rightContent.setAttribute("class", "sidebar-content");

		let leftBar = docEl.createElement("div");
		leftBar.setAttribute("id", "sidebar");
		leftBar.setAttribute("class", "sidebar-left");
		leftBar.appendChild(leftContent);

		let rightBar = docEl.createElement("div");
		rightBar.setAttribute("id", "sidebar");
		rightBar.setAttribute("class", "sidebar-right");
		rightBar.appendChild(rightContent);

		centerContent.appendChild(middleContent);
		flexContainer.appendChild(leftBar);
		flexContainer.appendChild(centerContent);
		flexContainer.appendChild(rightBar);

		return {container: flexContainer, left: leftContent, right: rightContent, center: centerContent};
	}

	private static getRelativePaths(file: ExportFile): {mediaPath: Path, jsPath: Path, cssPath: Path, rootPath: Path}
	{
		let rootPath = file.pathToRoot;
		let imagePath = rootPath.join(this.mediaFolderName);
		let jsPath = rootPath.join(this.jsFolderName);
		let cssPath = rootPath.join(this.cssFolderName);

		return {mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath, rootPath: rootPath};
	}

	private static async fillInHead(file: ExportFile)
	{
		let relativePaths = this.getRelativePaths(file);

		let meta =
		`
		<title>${file.markdownFile.basename}</title>

		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta charset="UTF-8">

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">

		<script src='https://code.jquery.com/jquery-3.6.0.js'></script>
		<script src="https://code.jquery.com/ui/1.13.2/jquery-ui.js" integrity="sha256-xLD7nhI62fcsEZK2/v8LsBcb4lG7dgULkuXoXB/j91c=" crossorigin="anonymous"></script></script>
		<script src="https://code.iconify.design/iconify-icon/1.0.3/iconify-icon.min.js"></script>
		<script src="https://pixijs.download/v7.2.4/pixi.js"></script>
		`;

		// --- JS ---
		let scripts = "";

		scripts += 
		`
		<script id="relative-paths">
			let rootPath = "${relativePaths.rootPath}";
			let mediaPath = "${relativePaths.mediaPath}";
			let jsPath = "${relativePaths.jsPath}";
			let cssPath = "${relativePaths.cssPath}";
		</script>
		`;

		if (ExportSettings.settings.includeGraphView) 
		{
			// TODO: outline the nodes to a file
			scripts += 
			`
			<!-- Graph View Data -->
			<script>
			let nodes=\n${JSON.stringify(GraphGenerator.getGlobalGraph(ExportSettings.settings.graphMinNodeSize, ExportSettings.settings.graphMaxNodeSize))};
			let attractionForce = ${ExportSettings.settings.graphAttractionForce};
			let linkLength = ${ExportSettings.settings.graphLinkLength};
			let repulsionForce = ${ExportSettings.settings.graphRepulsionForce};
			let centralForce = ${ExportSettings.settings.graphCentralForce};
			let edgePruning = ${ExportSettings.settings.graphEdgePruning};
			</script>
			`;

			scripts += `\n<script type='module' src='${relativePaths.jsPath}/graph_view.js'></script>\n`;
			scripts += `\n<script src='${relativePaths.jsPath}/graph_wasm.js'></script>\n`;
			scripts += `\n<script src="${relativePaths.jsPath}/tinycolor.js"></script>\n`;

			// if (ExportSettings.settings.inlineJS) 
			// {
			// 	scripts += `\n<script type='module'>\n${this.graphViewJS}\n</script>\n`;
			// 	scripts += `\n<script>${this.graphWASMJS}</script>\n`;
			// 	scripts += `\n<script>${this.tinyColorJS}</script>\n`;
			// }
		}

		if (ExportSettings.settings.inlineJS)
		{
			scripts += `\n<script>\n${this.webpageJS}\n</script>\n`;
		}
		else 
		{
			scripts += `\n<script src='${relativePaths.jsPath}/webpage.js'></script>\n`;
		}


		// --- CSS ---
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		
		if (ExportSettings.settings.inlineCSS)
		{
			let pluginCSS = this.pluginStyles;
			let thirdPartyPluginStyles = await this.getThirdPartyPluginCSS();
			pluginCSS += thirdPartyPluginStyles;
			
			var header =
			`
			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${this.appStyles} </style>
			<style> ${this.mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Plugin Styles -->
			<style> ${pluginCSS} </style>

			<!-- Theme Styles ( ${Utils.getCurrentThemeName()} ) -->
			<style> ${this.themeStyles} </style>

			<!-- Snippets: ${Utils.getEnabledSnippets().join(", ")} -->
			<style> ${this.snippetStyles} </style>
		
			${scripts}
			`;
		}
		else
		{
			header =
			`
			${meta}

			<link rel="stylesheet" href="${relativePaths.cssPath}/obsidian-styles.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/plugin-styles.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/theme.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/snippets.css">

			<style> ${cssSettings} </style>
			<style> ${this.mathStyles} </style>

			${scripts}
			`;
		}

		file.document.head.innerHTML = header;
	}

	//#endregion

	//#region Links and Images

	private static fixLinks(file: ExportFile)
	{
		let htmlCompatibleExt = ["canvas", "md"];
		let query = $(file.document);

		query.find("a.internal-link").each(function ()
		{
			$(this).attr("target", "_self");

			let href = $(this).attr("href");
			if (!href) return;

			if (href.startsWith("#")) // link pointing to header of this document
			{
				$(this).attr("href", href.replaceAll(" ", "_"));
			}
			else // if it doesn't start with #, it's a link to another document
			{
				let targetHeader = href.split("#").length > 1 ? "#" + href.split("#")[1] : "";
				let target = href.split("#")[0];

				let targetFile = app.metadataCache.getFirstLinkpathDest(target, file.markdownFile.path);
				if (!targetFile) return;

				let targetPath = new Path(targetFile.path);
				let targetRelativePath = Path.getRelativePath(file.exportPath, targetPath);
				if (htmlCompatibleExt.includes(targetRelativePath.extensionName)) targetRelativePath.setExtension("html");
				if (ExportSettings.settings.makeNamesWebStyle) targetRelativePath.makeWebStyle();

				let finalHref = targetRelativePath + targetHeader.replaceAll(" ", "_");
				$(this).attr("href", finalHref);
			}
		});

		query.find("a.footnote-link").each(function ()
		{
			$(this).attr("target", "_self");
		});

		query.find("h1, h2, h3, h4, h5, h6").each(function ()
		{
			// use the headers inner text as the id
			$(this).attr("id", $(this).text().replaceAll(" ", "_"));
		});
	}

	private static async inlineMedia(file: ExportFile)
	{
		let query = $(file.document);
		let media = query.find("img, audio").toArray();

		for (let i = 0; i < media.length; i++)
		{
			let mediaEl = media[i];
			if (!$(mediaEl).attr("src")?.startsWith("app://local")) continue;
			
			let src = $(mediaEl).attr("src")?.replace("app://local", "").split("?")[0];
			if(!src) continue;

			let path = new Path(src).makeRootAbsolute();

			let base64 = await Utils.getTextBase64(path) ?? "";
			if (base64 === "") continue;

			let ext = path.extenstion.replaceAll(".", "");
			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext === "svg") ext += "+xml";

			$(mediaEl).attr("src", `data:${type}/${ext};base64,${base64}`);
		}
	}

	private static async outlineMedia(file: ExportFile): Promise<Downloadable[]>
	{
		let downloads: Downloadable[] = [];
		let query = $(file.document);
		let media = query.find("img, audio, video").toArray();

		for (let i = 0; i < media.length; i++)
		{
			let mediaEl = $(media[i]);
			let src = (mediaEl.attr("src") ?? "");
			if (!src.startsWith("app://local")) continue;
			src = src.replace("app://local", "").split("?")[0];

			let mediaPath = new Path(src).makeRootAbsolute();
			if (!mediaPath.exists)
			{
				console.log("Could not find image at " + mediaPath);
				continue;
			}

			let vaultToMedia = Path.getRelativePathFromVault(mediaPath);
			let exportLocation = vaultToMedia;

			// if the media is inside the exported folder then keep it in the same place
			let mediaPathInExport = Path.getRelativePath(file.exportFromFolder, vaultToMedia);
			if (mediaPathInExport.asString.startsWith(".."))
			{
				// if path is outside of the vault, outline it into the media folder
				exportLocation = this.mediaFolderName.joinString(vaultToMedia.fullName);
			}

			let relativeImagePath = Path.getRelativePath(file.exportPath, exportLocation)

			if(ExportSettings.settings.makeNamesWebStyle)
			{
				relativeImagePath.makeWebStyle();
				exportLocation.makeWebStyle();
			}

			mediaEl.attr("src", relativeImagePath.asString);

			let data = await Utils.getFileBuffer(mediaPath) ?? Buffer.from([]);
			let imageDownload = new Downloadable(exportLocation.fullName, data, "image/" + exportLocation.extensionName, exportLocation.directory, false);
			downloads.push(imageDownload);
		}

		return downloads;
	}

	//#endregion

	//#region Special Features

	public static generateDarkmodeToggle(inline : boolean = true, usingDocument: Document = document) : HTMLElement
	{
		// programatically generates the above html snippet
		let toggle = usingDocument.createElement("div");
		let label = usingDocument.createElement("label");
		label.classList.add(inline ? "theme-toggle-inline" : "theme-toggle");
		label.setAttribute("for", "theme_toggle");
		let input = usingDocument.createElement("input");
		input.classList.add("toggle__input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");
		let div = usingDocument.createElement("div");
		div.classList.add("toggle__fill");
		label.appendChild(input);
		label.appendChild(div);
		toggle.appendChild(label);
		return toggle;
	}

	private static getHeaderList(usingDocument: Document): { size: number, title: string, href: string }[] | null
	{
		let headers = [];

		let headerElements = usingDocument.querySelectorAll("h1, h2, h3, h4, h5, h6");

		for (let i = 0; i < headerElements.length; i++)
		{
			let header = headerElements[i];
			let size = parseInt(header.tagName[1]);
			let title = (header as HTMLElement).innerText;
			let href = (header as HTMLHeadingElement).id;
			headers.push({ size, title, href });
		}

		return headers;
	}

	private static generateOutlineItem(header: { size: number, title: string, href: string }, usingDocument: Document): HTMLDivElement
	{
		let arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path>`;

		let outlineItemEl = usingDocument.createElement('div');
		outlineItemEl.classList.add("outline-item");
		outlineItemEl.setAttribute("data-size", header.size.toString());

		let outlineItemContentsEl = usingDocument.createElement('a');
		outlineItemContentsEl.classList.add("outline-item-contents");
		outlineItemContentsEl.classList.add("internal-link");
		outlineItemContentsEl.setAttribute("href", "#" + header.href);
		
		let outlineItemIconEl = usingDocument.createElement('div');
		outlineItemIconEl.classList.add("tree-item-icon");
		outlineItemIconEl.classList.add("collapse-icon");
		
		let outlineItemIconSvgEl = usingDocument.createElement('svg');
		outlineItemIconSvgEl.innerHTML = arrowIcon;
		outlineItemIconSvgEl = outlineItemIconSvgEl.firstChild as HTMLElement;
		
		let outlineItemTitleEl = usingDocument.createElement('span');
		outlineItemTitleEl.classList.add("outline-item-title");
		outlineItemTitleEl.innerText = header.title;

		let outlineItemChildrenEl = usingDocument.createElement('div');
		outlineItemChildrenEl.classList.add("outline-item-children");

		outlineItemIconEl.appendChild(outlineItemIconSvgEl);
		outlineItemContentsEl.appendChild(outlineItemIconEl);
		outlineItemContentsEl.appendChild(outlineItemTitleEl);
		outlineItemEl.appendChild(outlineItemContentsEl);
		outlineItemEl.appendChild(outlineItemChildrenEl);

		return outlineItemEl;
	}

	private static generateOutline(headers: { size: number, title: string, href: string }[], usingDocument: Document): HTMLDivElement
	{
		// if(headers.length <= 1) return usingDocument.createElement("div");

		let outlineEl = usingDocument.createElement('div');
		outlineEl.classList.add("outline-container");
		outlineEl.setAttribute("data-size", "0");

		let outlineHeader = usingDocument.createElement('div');
		outlineHeader.classList.add("outline-header");

		// let headerIconEl = usingDocument.createElement('svg');
		// headerIconEl.setAttribute("viewBox", "0 0 100 100");
		// headerIconEl.classList.add("bullet-list");
		// headerIconEl.setAttribute("width", "18px");
		// headerIconEl.setAttribute("height", "18px");

		// let headerIconPathEl = usingDocument.createElement('path');
		// let headerPathData = "M16.4,16.4c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,16.4,16.4,16.4z M16.4,19.6 c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2C13.2,21,14.6,19.6,16.4,19.6z M29.2,21.2v3.2H90v-3.2H29.2z M16.4,43.6c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,43.6,16.4,43.6z M16.4,46.8c1.8,0,3.2,1.4,3.2,3.2 s-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2S14.6,46.8,16.4,46.8z M29.2,48.4v3.2H90v-3.2H29.2z M16.4,70.8c-3.5,0-6.4,2.9-6.4,6.4 c0,3.5,2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4C22.8,73.7,19.9,70.8,16.4,70.8z M16.4,74c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2 s-3.2-1.4-3.2-3.2C13.2,75.4,14.6,74,16.4,74z M29.2,75.6v3.2H90v-3.2H29.2z";
		// headerIconPathEl.setAttribute("fill", "currentColor");
		// headerIconPathEl.setAttribute("stroke", "currentColor");
		// headerIconPathEl.setAttribute("d", headerPathData);

		let headerLabelEl = usingDocument.createElement('h6');
		headerLabelEl.style.margin = "1em";
		headerLabelEl.style.marginLeft = "0";
		headerLabelEl.innerText = "Table of Contents";

		let headerCollapseAllEl = usingDocument.createElement('button');
		headerCollapseAllEl.classList.add("clickable-icon", "collapse-all");

		let headerCollapseAllIconEl = usingDocument.createElement('iconify-icon');
		headerCollapseAllIconEl.setAttribute("icon", "ph:arrows-in-line-horizontal-bold");
		headerCollapseAllIconEl.setAttribute("width", "18px");
		headerCollapseAllIconEl.setAttribute("height", "18px");
		headerCollapseAllIconEl.setAttribute("rotate", "90deg");
		headerCollapseAllIconEl.setAttribute("color", "currentColor");
		
		

		headerCollapseAllEl.appendChild(headerCollapseAllIconEl);

		// headerIconEl.appendChild(headerIconPathEl);
		// outlineHeader.appendChild(headerIconEl);
		outlineHeader.appendChild(headerLabelEl);
		outlineHeader.appendChild(headerCollapseAllEl);
		outlineEl.appendChild(outlineHeader);

		let listStack = [outlineEl];
		
		// function to get the data-size of the previous list item as a number
		function getLastStackSize(): number
		{
			return parseInt(listStack[listStack.length - 1].getAttribute("data-size") ?? "0");
		}

		for (let i = 0; i < headers.length; i++)
		{
			let header = headers[i];
			let listItem : HTMLDivElement = this.generateOutlineItem(header, usingDocument);

			while (getLastStackSize() >= header.size && listStack.length > 1)
			{
				listStack.pop();
			}

			let childContainer = listStack.last()?.querySelector(".outline-item-children");
			if (getLastStackSize() === 0) childContainer = listStack.last();
			if (!childContainer) continue;

			childContainer.appendChild(listItem);
			listStack.push(listItem);
		}

		return outlineEl;
	}

	private static generateGraphView(usingDocument: Document): HTMLDivElement
	{
		let graphEl = usingDocument.createElement("div");
		graphEl.className = "graph-view-placeholder";
		graphEl.innerHTML = 
		`
		<div class="graph-view-container">
			<div class="graph-icon graph-expand" role="button" aria-label="Expand" data-tooltip-position="top"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-arrow-up-right"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
			<canvas id="graph-canvas" width="512px" height="512px"></canvas>
		</div>
		`

		return graphEl;
	}

	//#endregion
}
