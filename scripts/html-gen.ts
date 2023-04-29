import { writeFile } from "fs/promises";
import { MarkdownRenderer, MarkdownView, Notice, TFile, TFolder, loadMathJax, loadMermaid } from "obsidian";
import { ExportSettings } from "./export-settings";
import { Utils, Downloadable, Path } from "./utils";
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
		HTMLGenerator.getDocumentHTML(this, addSelfToDownloads);
		return this;
	}

	public async generateWebpage(): Promise<ExportFile>
	{
		HTMLGenerator.generateWebpage(this);
		return this;
	}
}

export class HTMLGenerator
{
	static leafHandler: LeafHandler = new LeafHandler();

	// When this is enabled the plugin will download the extra .css and .js files from github.
	static autoDownloadExtras = true;

	private static vaultPluginsPath: Path = Path.vaultPath.joinString(app.vault.configDir, "plugins/").makeAbsolute();
	private static thisPluginPath: Path;
	static assetsPath: Path;

	// this path is used to generate the relative path to the images folder, likewise for the other paths
	private static mediaFolderName: Path = new Path("media");
	private static jsFolderName: Path = new Path("scripts");
	private static cssFolderName: Path = new Path("styles");

	private static errorHTML: string = 
	`<center>
		<h1>
		Failed to render file, check obsidian log for details and report an issue on GitHub: 
		<a href="https://github.com/KosmosisDire/obsidian-webpage-export/issues">Github Issues</a>
		</h1>
	</center>`

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

		HTMLGenerator.assetsPath.createDirectory();

		//Download webpage.js
		let webpagejs = await fetch(HTMLGenerator.webpagejsURL);
		let webpagejsText = await webpagejs.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("webpage.js").asString, webpagejsText).catch((err) => { console.log(err); });

		//Download plugin-styles.css
		let pluginStyles = await fetch(HTMLGenerator.pluginStylesURL);
		let pluginStylesText = await pluginStyles.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("plugin-styles.css").asString, pluginStylesText).catch((err) => { console.log(err); });

		//Download obsidian-styles.css
		let obsidianStyles = await fetch(HTMLGenerator.obsidianStylesURL);
		let obsidianStylesText = await obsidianStyles.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("obsidian-styles.css").asString, obsidianStylesText).catch((err) => { console.log(err); });
	
		//Download graph_view.js
		let graphViewJS = await fetch(HTMLGenerator.graphViewJSURL);
		let graphViewJSText = await graphViewJS.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("graph_view.js").asString, graphViewJSText).catch((err) => { console.log(err); });

		//Download graph_wasm.js
		let graphWASMJS = await fetch(HTMLGenerator.graphWASMJSURL);
		let graphWASMJSText = await graphWASMJS.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("graph_wasm.js").asString, graphWASMJSText).catch((err) => { console.log(err); });

		//Download graph_wasm.wasm
		let graphWASM = await fetch(HTMLGenerator.graphWASMURL);
		let graphWASMBuffer = await graphWASM.arrayBuffer();
		await writeFile(HTMLGenerator.assetsPath.joinString("graph_wasm.wasm").asString, Buffer.from(graphWASMBuffer)).catch((err) => { console.log(err); });

		//Download graph-render-worker.js
		let renderWorker = await fetch(HTMLGenerator.renderWorkerURL);
		let renderWorkerText = await renderWorker.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("graph-render-worker.js").asString, renderWorkerText).catch((err) => { console.log(err); });
		
		//Download tinycolor.js
		let tinycolor = await fetch(HTMLGenerator.tinycolorURL);
		let tinycolorText = await tinycolor.text();
		await writeFile(HTMLGenerator.assetsPath.joinString("tinycolor.js").asString, tinycolorText).catch((err) => { console.log(err); });
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

		HTMLGenerator.appStyles += await Utils.getText(HTMLGenerator.assetsPath.joinString("obsidian-styles.css"));

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
				
				HTMLGenerator.appStyles += cssText;
			}
		}
	}

	public static async initialize(pluginID: string)
	{
		HTMLGenerator.thisPluginPath = HTMLGenerator.vaultPluginsPath.joinString(pluginID + "/").makeAbsolute();
		HTMLGenerator.assetsPath = HTMLGenerator.thisPluginPath.joinString("assets/").makeAbsolute();
		HTMLGenerator.assetsPath.createDirectory();

		if (HTMLGenerator.autoDownloadExtras) await HTMLGenerator.downloadAssets();
		await HTMLGenerator.loadAppStyles();
		
		HTMLGenerator.pluginStyles = await Utils.getText(HTMLGenerator.assetsPath.joinString("plugin-styles.css")) ?? "";
		HTMLGenerator.themeStyles = await Utils.getThemeContent(Utils.getCurrentThemeName());

		HTMLGenerator.webpageJS = await Utils.getText(HTMLGenerator.assetsPath.joinString("webpage.js")) ?? "";
		HTMLGenerator.graphViewJS = await Utils.getText(HTMLGenerator.assetsPath.joinString("graph_view.js")) ?? "";
		HTMLGenerator.graphWASMJS = await Utils.getText(HTMLGenerator.assetsPath.joinString("graph_wasm.js")) ?? "";
		HTMLGenerator.graphWASM = await Utils.getFileBuffer(HTMLGenerator.assetsPath.joinString("graph_wasm.wasm")) ?? Buffer.from([]);
		HTMLGenerator.renderWorkerJS = await Utils.getText(HTMLGenerator.assetsPath.joinString("graph-render-worker.js")) ?? "";
		HTMLGenerator.tinyColorJS = await Utils.getText(HTMLGenerator.assetsPath.joinString("tinycolor.js")) ?? "";
	}

	private static async getThirdPartyPluginCSS() : Promise<string>
	{
		// load 3rd party plugin css
		let pluginCSS = "";

		let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("\n");
		for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
		{
			if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
			
			let path = HTMLGenerator.vaultPluginsPath.joinString(thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
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

		if (snippetsNames != HTMLGenerator.lastEnabledSnippets)
		{
			HTMLGenerator.lastEnabledSnippets = snippetsNames;
			HTMLGenerator.snippetStyles = await HTMLGenerator.getSnippetsCSS(snippetsNames);
		}

		if (themeName != HTMLGenerator.lastEnabledTheme)
		{
			HTMLGenerator.lastEnabledTheme = themeName;
			HTMLGenerator.themeStyles = await Utils.getThemeContent(themeName);
		}

		// @ts-ignore
		HTMLGenerator.mathStyles = window.MathJax.chtmlStylesheet().innerHTML.replaceAll("app://obsidian.md/", "https://publish.obsidian.md/");
	}

	private static async getAssetDownloads() : Promise<Downloadable[]>
	{
		let toDownload: Downloadable[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			HTMLGenerator.updateCSSCache();

			let pluginCSS = HTMLGenerator.pluginStyles;

			let thirdPartyPluginCSS = await HTMLGenerator.getThirdPartyPluginCSS();
			pluginCSS += "\n" + thirdPartyPluginCSS + "\n";

			let appcssDownload = new Downloadable("obsidian-styles.css", HTMLGenerator.appStyles, "text/css", HTMLGenerator.cssFolderName);
			let plugincssDownload = new Downloadable("plugin-styles.css", pluginCSS, "text/css", HTMLGenerator.cssFolderName);
			let themecssDownload = new Downloadable("theme.css", HTMLGenerator.themeStyles, "text/css", HTMLGenerator.cssFolderName);
			let snippetsDownload = new Downloadable("snippets.css", HTMLGenerator.snippetStyles, "text/css", HTMLGenerator.cssFolderName);

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if (!ExportSettings.settings.inlineJS)
		{
			let webpagejsDownload = new Downloadable("webpage.js", HTMLGenerator.webpageJS, "text/javascript", HTMLGenerator.jsFolderName);

			toDownload.push(webpagejsDownload);
		}

		if(ExportSettings.settings.includeGraphView)
		{
			let graphWASMDownload = new Downloadable("graph_wasm.wasm", HTMLGenerator.graphWASM, "application/wasm", HTMLGenerator.jsFolderName, false);
			let renderWorkerJSDownload = new Downloadable("graph-render-worker.js", HTMLGenerator.renderWorkerJS, "text/javascript", HTMLGenerator.jsFolderName);
			let graphWASMJSDownload = new Downloadable("graph_wasm.js", HTMLGenerator.graphWASMJS, "text/javascript", HTMLGenerator.jsFolderName);
			let graphViewJSDownload = new Downloadable("graph_view.js", HTMLGenerator.graphViewJS, "text/javascript", HTMLGenerator.jsFolderName);
			let tinyColorJS = new Downloadable("tinycolor.js", HTMLGenerator.tinyColorJS, "text/javascript", HTMLGenerator.jsFolderName);
			
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

	public static async generateWebpage(file: ExportFile): Promise<ExportFile>
	{
		await HTMLGenerator.getDocumentHTML(file);
		let usingDocument = file.document;

		let sidebars = HTMLGenerator.generateSideBars(file.contentElement, file);
		let rightSidebar = sidebars.right;
		let leftSidebar = sidebars.left;
		usingDocument.body.appendChild(sidebars.container);

		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle && !usingDocument.querySelector(".theme-toggle-inline, .theme-toggle"))
		{
			let toggle = HTMLGenerator.generateDarkmodeToggle(false, usingDocument);
			leftSidebar.appendChild(toggle);
		}

		// inject outline
		if (ExportSettings.settings.includeOutline)
		{
			let headers = HTMLGenerator.getHeaderList(usingDocument);
			if (headers)
			{
				var outline : HTMLElement | undefined = HTMLGenerator.generateOutline(headers, usingDocument);
				rightSidebar.appendChild(outline);
			}
		}

		// inject graph view
		if (ExportSettings.settings.includeGraphView)
		{
			let graph = HTMLGenerator.generateGraphView(usingDocument);
			let graphHeader = usingDocument.createElement("h6");
			graphHeader.style.margin = "1em";
			graphHeader.style.marginLeft = "12px";
			graphHeader.innerText = "Interactive Graph";
			
			rightSidebar.prepend(graph);
			rightSidebar.prepend(graphHeader);
		}

		await HTMLGenerator.fillInHead(file);

		file.downloads.unshift(file.getSelfDownloadable());

		return file;
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
		if(ExportSettings.settings.allowFoldingHeadings) markdownViewEl.addClass("allow-fold-headings");

		if(ExportSettings.settings.exportInBackground)
		{
			let renderEl = document.createElement('div');

			let fileContents = await app.vault.read(file.markdownFile);

			try
			{
				await MarkdownRenderer.renderMarkdown(fileContents, renderEl, file.markdownFile.path, HTMLExportPlugin.plugin);
			}
			catch (e)
			{
				markdownViewEl.innerHTML = HTMLGenerator.errorHTML;
				renderEl.remove();
				return file;
			}

			markdownViewEl.innerHTML = renderEl.innerHTML;

			await HTMLGenerator.renderMissingFromBackgroundExport(file);

			renderEl.remove();
		}
		else
		{
			let fileTab = HTMLGenerator.leafHandler.openFileInNewLeaf(file.markdownFile, true);

			await Utils.delay(200);

			let view = Utils.getActiveTextView();
			if (!view)
			{
				markdownViewEl.innerHTML = HTMLGenerator.errorHTML;
			}

			if (view instanceof MarkdownView)
			{
				await Utils.doFullRender(view);
			}

			let obsidianDocEl = (document.querySelector(".workspace-leaf.mod-active .markdown-preview-sizer") as HTMLElement);
			if (!obsidianDocEl) obsidianDocEl = (document.querySelector(".workspace-leaf.mod-active .view-content") as HTMLElement);

			markdownViewEl.innerHTML = obsidianDocEl.innerHTML;

			// collapse uncollapsed callouts
			let callouts = $(markdownViewEl).find(".callout.is-collapsible:not(.is-collapsed)");
			callouts.each((index, element) =>
			{
				$(element).addClass("is-collapsed");
				$(element).find(".callout-content").css("display", "none");
			});

			// Close the file tab after HTML is generated
			if(fileTab) fileTab.detach();
		}

		if (ExportSettings.settings.addFilenameTitle)
			HTMLGenerator.addTitle(file);

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

		HTMLGenerator.fixLinks(file); // modify links to work outside of obsidian (including relative links)
		
		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (ExportSettings.settings.inlineImages)
		{
			await HTMLGenerator.inlineMedia(file);
		}
		else
		{
			outlinedImages = await HTMLGenerator.outlineMedia(file);
		}

		if(addSelfToDownloads) file.downloads.push(file.getSelfDownloadable());
		file.downloads.push(...outlinedImages);
		file.downloads.push(... await HTMLGenerator.getAssetDownloads());

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
	
	private static async renderMissingFromBackgroundExport(file: ExportFile)
	{
		// we need this function because obsidian's markdown renderer doesn't render any media elements
		// it just exports the span elements that would usually surround the media elements

		let imageFormats = ["png", "webp", "jpg", "jpeg", "gif", "bmp", "svg"];
		let audioFormats = ["mp3", "wav", "m4a", "ogg", "3gp", "flac"];
		let videoFormats = ["mp4", "webm", "ogv", "mov", "mkv"];

		let missingMedia = $(file.document).find(".internal-embed");
		missingMedia.each((index, element) =>
		{
			let el = $(element);

			let source = $(element).attr("src") ?? "";
			let parsedSource = new Path(source);
			let ext = parsedSource.extenstion.split("#")[0].trim().replaceAll(".", "");
			let isImage = imageFormats.includes(ext);
			let isAudio = audioFormats.includes(ext);
			let isVideo = videoFormats.includes(ext);


			if (isImage || isVideo || isAudio)
			{
				let bestPath = app.metadataCache.getFirstLinkpathDest(parsedSource.directory.joinString(parsedSource.basename + "." + ext).asString, file.markdownFile.path);

				if (bestPath)
				{
					let path = "app://local/" + new Path(bestPath.path).absolute().asString;

					el.empty();

					let mediaEl = file.document.body.createEl(isImage ? "img" : isAudio ? "audio" : "video");
					mediaEl.setAttribute("src", path);
					mediaEl.setAttribute("alt", bestPath.basename);
					mediaEl.setAttribute("controls", "");
					if(el.attr("width")) mediaEl.setAttribute("width", el.attr("width") ?? "");
					if(el.attr("height")) mediaEl.setAttribute("height", el.attr("height") ?? "");
					
					el.append(mediaEl);
					el.addClass("media-embed");
					el.addClass("is-loaded");
					el.addClass(isImage ? "image-embed" : isAudio ? "audio-embed" : "video-embed");
				}
			}
		});

		// assemble and rander mermaid diagrams
		let mermaidDiagrams = $(file.document).find("pre.language-mermaid code");
		mermaidDiagrams.each((index, element) =>
		{
			let el = $(element);
			let diagram = el.text();
			let diagramEl = file.document.createElement("div");
			diagramEl.setAttribute("class", "mermaid");

			let className = `mermaid-${file.exportPath.copy.makeWebStyle().basename}-${index}`
			//@ts-ignore
			let result = window.mermaid.render(className, diagram);
			el.parent().replaceWith(diagramEl);
			diagramEl.innerHTML = result;
		});

		// put every direct child of the markdown-preview-view into a div
		let children = $(file.document).find(".markdown-preview-view > *");
		children.each((index, element) =>
		{
			let el = $(element);
			let div = file.document.createElement("div");
			el.replaceWith(div);
			div.appendChild(el[0]);
		});

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
		let imagePath = rootPath.join(HTMLGenerator.mediaFolderName);
		let jsPath = rootPath.join(HTMLGenerator.jsFolderName);
		let cssPath = rootPath.join(HTMLGenerator.cssFolderName);

		return {mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath, rootPath: rootPath};
	}

	private static async fillInHead(file: ExportFile)
	{
		let relativePaths = HTMLGenerator.getRelativePaths(file);

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
			// 	scripts += `\n<script type='module'>\n${HTMLGenerator.graphViewJS}\n</script>\n`;
			// 	scripts += `\n<script>${HTMLGenerator.graphWASMJS}</script>\n`;
			// 	scripts += `\n<script>${HTMLGenerator.tinyColorJS}</script>\n`;
			// }
		}

		if (ExportSettings.settings.inlineJS)
		{
			scripts += `\n<script>\n${HTMLGenerator.webpageJS}\n</script>\n`;
		}
		else 
		{
			scripts += `\n<script src='${relativePaths.jsPath}/webpage.js'></script>\n`;
		}


		// --- CSS ---
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";

		HTMLGenerator.updateCSSCache();

		if (ExportSettings.settings.inlineCSS)
		{
			let pluginCSS = HTMLGenerator.pluginStyles;
			let thirdPartyPluginStyles = await HTMLGenerator.getThirdPartyPluginCSS();
			pluginCSS += thirdPartyPluginStyles;
			
			var header =
			`
			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${HTMLGenerator.appStyles} </style>
			<style> ${HTMLGenerator.mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Plugin Styles -->
			<style> ${pluginCSS} </style>

			<!-- Theme Styles ( ${Utils.getCurrentThemeName()} ) -->
			<style> ${HTMLGenerator.themeStyles} </style>

			<!-- Snippets: ${Utils.getEnabledSnippets().join(", ")} -->
			<style> ${HTMLGenerator.snippetStyles} </style>
		
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
			<style> ${HTMLGenerator.mathStyles} </style>

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

			let base64 = "";
			try
			{
				base64 = await Utils.getTextBase64(path);
			}
			catch (e)
			{
				console.error(e);
				console.warn("Failed to inline media: " + path);
				new Notice("Failed to inline media: " + path, 5000);
				continue;
			}

			let ext = path.extenstion.replaceAll(".", "");
			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext == "svg") ext += "+xml";

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
				exportLocation = HTMLGenerator.mediaFolderName.joinString(vaultToMedia.fullName);
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
			let listItem : HTMLDivElement = HTMLGenerator.generateOutlineItem(header, usingDocument);

			while (getLastStackSize() >= header.size && listStack.length > 1)
			{
				listStack.pop();
			}

			let childContainer = listStack.last()?.querySelector(".outline-item-children");
			if (getLastStackSize() == 0) childContainer = listStack.last();
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
