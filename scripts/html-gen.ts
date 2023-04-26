import { writeFile } from "fs/promises";
import { MarkdownRenderer, MarkdownView, Notice, TFile } from "obsidian";
import { ExportSettings } from "./export-settings";
import { Utils, Downloadable } from "./utils";
import jQuery from 'jquery';
import { GraphGenerator } from "./graph-view/graph-gen";
import { html_beautify } from "js-beautify";
const $ = jQuery;
import { LeafHandler } from './leaf-handler';
import HTMLExportPlugin from "./main";

export class ExportFile
{
	/**
	 * The original markdown file to export
	 */
	public markdownFile: TFile;

	/**
	 * The document to use to generate the HTML
	 */
	public document: Document;

	/**
	 * The absolute path we are exporting to, this is the root of the vault
	 */
	public rootFolder: string;

	/**
	 * The path to export the file to, relative to rootFolder
	 */
	public exportPath: string;

	/**
	 * The name of the file, with the .html extension
	 */
	public name: string;

	/**
	 * The external files that need to be downloaded for this file to work including the file itself
	 */
	public downloads: Downloadable[] = [];

	/**
	 * @param file The original markdown file to export
	 * @param rootExportFolder The absolute path we are exporting to, this is the root of the vault
	 * @param forceExportToRoot Force the file to be saved at the root of the vault even if it's in a subfolder
	 */
	constructor(file: TFile, rootExportFolder: string, forceExportToRoot: boolean = false)
	{
		this.markdownFile = file;
		this.name = file.basename + ".html";
		this.rootFolder = rootExportFolder;
		this.exportPath = Utils.joinPaths(file.parent.path, this.name);
		if (forceExportToRoot) this.exportPath = this.name;

		if (ExportSettings.settings.makeNamesWebStyle)
		{
			this.name = Utils.makePathWebStyle(this.name);
			this.exportPath = Utils.makePathWebStyle(this.exportPath);
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
	get exportPathAbsolute(): string
	{
		return Utils.joinPaths(this.rootFolder, this.exportPath);
	}

	/**
	 * The relative path from exportPath to rootFolder
	 */
	get pathToRoot(): string
	{
		return Utils.getRelativePath("/", "/" + this.exportPath);
	}

	/**
	 * Returns a downloadable object to download the .html file to the current path with the current html contents.
	 */
	public getSelfDownloadable(): Downloadable
	{
		return new Downloadable(this.name, this.html, "text/html", Utils.parsePath(this.exportPath).dir, true);
	}
}

export class HTMLGenerator
{
	leafHandler: LeafHandler = new LeafHandler();

	// When this is enabled the plugin will download the extra .css and .js files from github.
	autoDownloadExtras = false;

	public static vaultPluginsPath: string = Utils.getAbsolutePath(Utils.joinPaths(Utils.getVaultPath(), app.vault.configDir, "plugins/")) as string;
	public static thisPluginPath: string;
	public static assetsPath: string;

	// this path is used to generate the relative path to the images folder, likewise for the other paths
	static mediaFolderName: string = "media";
	static jsFolderName: string = "scripts";
	static cssFolderName: string = "styles";

	errorHTML: string = 
	`<center>
		<h1>
		Failed to render file, check obsidian log for details and report an issue on GitHub: 
		<a href="https://github.com/KosmosisDire/obsidian-webpage-export/issues">Github Issues</a>
		</h1>
	</center>`

	//#region Loading

	constructor(pluginID: string)
	{
		HTMLGenerator.thisPluginPath = Utils.getAbsolutePath(Utils.joinPaths(HTMLGenerator.vaultPluginsPath, pluginID, "/")) as string;
		HTMLGenerator.assetsPath = Utils.getAbsolutePath(Utils.joinPaths(HTMLGenerator.thisPluginPath, "assets/"), false) as string;
		Utils.createDirectory(HTMLGenerator.assetsPath);
	}

	// this is a string containing the filtered app.css file. It is populated on load. 
	appStyles: string = "";
	pluginStyles: string = "";
	themeStyles: string = "";
	snippetStyles: string[] = [];
	lastEnabledSnippets: string[] = [];
	lastEnabledTheme: string = "";

	webpageJS: string = "";
	graphViewJS: string = "";
	graphWASMJS: string = "";
	graphWASM: Buffer;
	renderWorkerJS: string = "";
	tinyColorJS: string = "";

	// the raw github urls for the extra files
	private webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/webpage.js";
	private pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/plugin-styles.css";
	private obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/obsidian-styles.css";
	private graphViewJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph_view.js";
	private graphWASMJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph_wasm.js";
	private graphWASMURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph_wasm.wasm";
	private renderWorkerURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph-render-worker.js";
	private tinycolorURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/tinycolor.js";

	private async downloadAssets()
	{
		Utils.createDirectory(HTMLGenerator.assetsPath);

		//Download webpage.js
		let webpagejs = await fetch(this.webpagejsURL);
		let webpagejsText = await webpagejs.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "webpage.js"), webpagejsText).catch((err) => { console.log(err); });

		//Download plugin-styles.css
		let pluginStyles = await fetch(this.pluginStylesURL);
		let pluginStylesText = await pluginStyles.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "plugin-styles.css"), pluginStylesText).catch((err) => { console.log(err); });

		//Download obsidian-styles.css
		let obsidianStyles = await fetch(this.obsidianStylesURL);
		let obsidianStylesText = await obsidianStyles.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "obsidian-styles.css"), obsidianStylesText).catch((err) => { console.log(err); });
	
		//Download graph_view.js
		let graphViewJS = await fetch(this.graphViewJSURL);
		let graphViewJSText = await graphViewJS.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_view.js"), graphViewJSText).catch((err) => { console.log(err); });

		//Download graph_wasm.js
		let graphWASMJS = await fetch(this.graphWASMJSURL);
		let graphWASMJSText = await graphWASMJS.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_wasm.js"), graphWASMJSText).catch((err) => { console.log(err); });

		//Download graph_wasm.wasm
		let graphWASM = await fetch(this.graphWASMURL);
		let graphWASMBuffer = await graphWASM.arrayBuffer();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_wasm.wasm"), Buffer.from(graphWASMBuffer)).catch((err) => { console.log(err); });

		//Download graph-render-worker.js
		let renderWorker = await fetch(this.renderWorkerURL);
		let renderWorkerText = await renderWorker.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "graph-render-worker.js"), renderWorkerText).catch((err) => { console.log(err); });
		
		//Download tinycolor.js
		let tinycolor = await fetch(this.tinycolorURL);
		let tinycolorText = await tinycolor.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "tinycolor.js"), tinycolorText).catch((err) => { console.log(err); });
	}

	private async loadAppStyles()
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

		this.appStyles += await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "obsidian-styles.css"));

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

	public async initialize()
	{
		if (this.autoDownloadExtras) await this.downloadAssets();
		await this.loadAppStyles();

		this.pluginStyles = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "plugin-styles.css")) ?? "";
		this.themeStyles = await Utils.getThemeContent(Utils.getCurrentThemeName());

		this.webpageJS = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "webpage.js")) ?? "";
		this.graphViewJS = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_view.js")) ?? "";
		this.graphWASMJS = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_wasm.js")) ?? "";
		this.graphWASM = await Utils.getFileBuffer(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_wasm.wasm")) ?? Buffer.from([]);
		this.renderWorkerJS = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "graph-render-worker.js")) ?? "";
		this.tinyColorJS = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "tinycolor.js")) ?? "";
	}

	private async getThirdPartyPluginCSS() : Promise<string>
	{
		// load 3rd party plugin css
		let pluginCSS = "";

		let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("\n");
		for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
		{
			if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
			
			let path = Utils.joinPaths(HTMLGenerator.vaultPluginsPath, thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
			
			if (!Utils.pathExists(path, true)) continue;
			
			
			let style = await Utils.getText(path);
			if (style)
			{
				pluginCSS += style;
			}
		}

		return pluginCSS;
	}

	private async getSnippetsCSS(snippetNames: string[]) : Promise<string>
	{
		let snippetsList = await Utils.getStyleSnippetsContent();
		let snippets = "";

		for (let i = 0; i < snippetsList.length; i++)
		{
			snippets += `/* --- ${snippetNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
		}

		return snippets;
	}

	private async updateCSSCache()
	{
		let snippetsNames = await Utils.getEnabledSnippets();
		let themeName = Utils.getCurrentThemeName();

		if (snippetsNames != this.lastEnabledSnippets)
		{
			this.lastEnabledSnippets = snippetsNames;
			this.snippetStyles = await Utils.getStyleSnippetsContent();
		}

		if (themeName != this.lastEnabledTheme)
		{
			this.lastEnabledTheme = themeName;
			this.themeStyles = await Utils.getThemeContent(themeName);
		}	
	}

	private async getSeperateFilesToDownload(outlinedImages: {localImagePath: string, relativeExportImagePath: string}[]) : Promise<Downloadable[]>
	{
		let toDownload: Downloadable[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			this.updateCSSCache();

			let pluginCSS = this.pluginStyles;

			let thirdPartyPluginCSS = await this.getThirdPartyPluginCSS();
			pluginCSS += "\n" + thirdPartyPluginCSS + "\n";

			let appcssDownload = new Downloadable("obsidian-styles.css", this.appStyles, "text/css", HTMLGenerator.cssFolderName);
			let plugincssDownload = new Downloadable("plugin-styles.css", pluginCSS, "text/css", HTMLGenerator.cssFolderName);
			let themecssDownload = new Downloadable("theme.css", this.themeStyles, "text/css", HTMLGenerator.cssFolderName);
			let snippetsDownload = new Downloadable("snippets.css", this.snippetStyles.join("\n\n"), "text/css", HTMLGenerator.cssFolderName);

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if (!ExportSettings.settings.inlineJS)
		{
			let webpagejsDownload = new Downloadable("webpage.js", this.webpageJS, "text/javascript", HTMLGenerator.jsFolderName);

			toDownload.push(webpagejsDownload);
		}

		if(ExportSettings.settings.includeGraphView)
		{
			let graphWASMDownload = new Downloadable("graph_wasm.wasm", this.graphWASM, "application/wasm", HTMLGenerator.jsFolderName, false);
			let renderWorkerJSDownload = new Downloadable("graph-render-worker.js", this.renderWorkerJS, "text/javascript", HTMLGenerator.jsFolderName);
			let graphWASMJSDownload = new Downloadable("graph_wasm.js", this.graphWASMJS, "text/javascript", HTMLGenerator.jsFolderName);
			let graphViewJSDownload = new Downloadable("graph_view.js", this.graphViewJS, "text/javascript", HTMLGenerator.jsFolderName);
			let tinyColorJS = new Downloadable("tinycolor.js", this.tinyColorJS, "text/javascript", HTMLGenerator.jsFolderName);
			
			toDownload.push(renderWorkerJSDownload);
			toDownload.push(graphWASMDownload);
			toDownload.push(graphWASMJSDownload);
			toDownload.push(graphViewJSDownload);
			toDownload.push(tinyColorJS);
		}

		if (!ExportSettings.settings.inlineImages)
		{
			for (let i = 0; i < outlinedImages.length; i++)
			{
				let image = outlinedImages[i];
				if (!Utils.pathExists(Utils.parseFullPath(image.localImagePath), false))
				{
					console.log("Could not find image at " + image.localImagePath);
					continue;
				}
				let data = await Utils.getFileBuffer(image.localImagePath) ?? Buffer.from([]);
				let destinationPath = Utils.parsePath(image.relativeExportImagePath);
				let imageDownload = new Downloadable(destinationPath.base, data, "image/" + destinationPath.ext, destinationPath.dir, false);
				toDownload.push(imageDownload);
			}
		}

		return toDownload;
	}

	//#endregion

	//#region Main Generation Functions

	public async generateWebpage(file: ExportFile): Promise<ExportFile>
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

	public async getDocumentHTML(file: ExportFile, addSelfToDownloads: boolean = false): Promise<ExportFile>
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
				markdownViewEl.innerHTML = this.errorHTML;
				renderEl.remove();
				return file;
			}

			markdownViewEl.innerHTML = renderEl.innerHTML;

			this.renderMissingFromBackgroundExport(file);

			renderEl.remove();
		}
		else
		{
			let fileTab = this.leafHandler.openFileInNewLeaf(file.markdownFile, true);

			await Utils.delay(200);

			let view = Utils.getActiveTextView();
			if (!view)
			{
				markdownViewEl.innerHTML = this.errorHTML;
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

		this.fixLinks(file); // modify links to work outside of obsidian (including relative links)

		// inline / outline images
		let outlinedImages : {localImagePath: string, relativeExportImagePath: string}[] = [];
		if (ExportSettings.settings.inlineImages)
		{
			await this.inlineMedia(file);
		}
		else
		{
			outlinedImages = await this.outlineMedia(file);
		}

		if(addSelfToDownloads) file.downloads.push(file.getSelfDownloadable());
		file.downloads.push(... await this.getSeperateFilesToDownload(outlinedImages));

		if(ExportSettings.settings.makeNamesWebStyle)
		{
			file.downloads.forEach((file) =>
			{
				file.filename = Utils.makePathWebStyle(file.filename);
				file.relativePath = Utils.makePathWebStyle(file.relativePath ?? "");
			});
		}

		return file;
	}
	
	private renderMissingFromBackgroundExport(file: ExportFile)
	{
		// we need this function because obsidian's markdown renderer doesn't render any media elements
		// it just exports the span elements that wouldusually surround the media elements

		let imageFormats = ["png", "webp", "jpg", "jpeg", "gif", "bmp", "svg"];
		let audioFormats = ["mp3", "wav", "m4a", "ogg", "3gp", "flac"];
		let videoFormats = ["mp4", "webm", "ogv", "mov", "mkv"];

		let missingMedia = $(file.document).find(".internal-embed");
		missingMedia.each((index, element) =>
		{
			let el = $(element);

			let source = $(element).attr("src") ?? "";
			let parsedSource = Utils.parsePath(source);
			let ext = parsedSource.ext.split("#")[0].trim().replaceAll(".", "");
			let isImage = imageFormats.includes(ext);
			let isAudio = audioFormats.includes(ext);
			let isVideo = videoFormats.includes(ext);


			if (isImage || isVideo || isAudio)
			{
				let bestPath = app.metadataCache.getFirstLinkpathDest(Utils.joinPaths(parsedSource.dir, parsedSource.name + "." + ext), file.markdownFile.path);

				if (bestPath)
				{
					let path = "app://local/" + Utils.getAbsolutePath(bestPath.path);

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
	}

	private generateSideBars(middleContent: HTMLElement, file: ExportFile): {container: HTMLElement, left: HTMLElement, right: HTMLElement, center: HTMLElement}
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

	private getMathStyles(): string
	{
		let mathStyles = document.getElementById('MJX-CHTML-styles');
		return (mathStyles?.innerHTML ?? "").replaceAll("app://obsidian.md/", "https://publish.obsidian.md/");
	}

	private getRelativePaths(file: ExportFile): {mediaPath: string, jsPath: string, cssPath: string, rootPath: string}
	{
		let rootPath = file.pathToRoot;
		let imagePath = Utils.joinPaths(rootPath, HTMLGenerator.mediaFolderName);
		let jsPath = Utils.joinPaths(rootPath, HTMLGenerator.jsFolderName);
		let cssPath = Utils.joinPaths(rootPath, HTMLGenerator.cssFolderName);

		return {mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath, rootPath: rootPath};
	}

	private async fillInHead(file: ExportFile)
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
		<script>
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
			scripts += `\n<script type='module'>\n${this.webpageJS}\n</script>\n`;
		}
		else 
		{
			scripts += `\n<script src='${relativePaths.jsPath}/webpage.js'></script>\n`;
		}


		// --- CSS ---
		let mathStyles = this.getMathStyles();
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";

		this.updateCSSCache();

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
			<style> ${mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Plugin Styles -->
			<style> ${pluginCSS} </style>

			<!-- Theme Styles ( ${Utils.getCurrentThemeName()} ) -->
			<style> ${this.themeStyles} </style>

			<!-- Snippets: ${Utils.getEnabledSnippets().join(", ")} -->
			<style> ${this.snippetStyles.join("</style><style>")} </style>
		
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
			<style> ${mathStyles} </style>

			${scripts}
			`;
		}

		file.document.head.innerHTML = header;
	}

	//#endregion

	//#region Links and Images

	private fixLinks(file: ExportFile)
	{
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

				let targetPath = targetFile.path;
				let targetRelativePath = Utils.joinPaths(Utils.getRelativePath(targetPath, file.exportPath), targetFile.basename + ".html");
				if (ExportSettings.settings.makeNamesWebStyle) targetRelativePath = Utils.makePathWebStyle(targetRelativePath);

				let finalHref = (targetRelativePath + targetHeader).replaceAll(" ", "_");
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

	private async inlineMedia(file: ExportFile)
	{
		let query = $(file.document);
		let media = query.find("img, audio").toArray();

		for (let i = 0; i < media.length; i++)
		{
			let mediaEl = media[i];
			if (!$(mediaEl).attr("src")?.startsWith("app://local")) continue;
			
			let path = $(mediaEl).attr("src")?.replace("app://local", "").split("?")[0];
			if(!path) continue;

			path = Utils.forceAbsolutePath(path);

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

			let pathInfo = Utils.parsePath(path);


			let ext = pathInfo.ext.replace("\.", "");
			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext == "svg") ext += "+xml";
			

			$(mediaEl).attr("src", `data:${type}/${ext};base64,${base64}`);
		}
	}

	private async outlineMedia(file: ExportFile): Promise<{localImagePath: string, relativeExportImagePath: string}[]>
	{
		let relativePaths = this.getRelativePaths(file);
		let query = $(file.document);
		let media = query.find("img, audio, video").toArray();

		let imagesToOutline: { localImagePath: string, relativeExportImagePath: string}[] = [];

		for (let i = 0; i < media.length; i++)
		{
			let mediaEl = $(media[i]);
			if (!mediaEl.attr("src")?.startsWith("app://local")) continue;
			
			let mediaPath = mediaEl.attr("src")?.replace("app://local", "").split("?")[0];

			if(!mediaPath) continue;

			mediaPath = Utils.forceAbsolutePath(mediaPath);
			let parsedMediaPath = Utils.parsePath(mediaPath);
			
			let filePath = Utils.getAbsolutePath(file.markdownFile.path) ?? "";
			let parsedFilePath = Utils.parsePath(filePath);
			let relativeImagePath = Utils.joinPaths(Utils.getRelativePath(parsedMediaPath.dir, parsedFilePath.dir), parsedMediaPath.base);

			// console.log(relativeImagePath);

			// if path is outside of the vault, outline it into the media folder
			if (!parsedMediaPath.dir.startsWith(Utils.getVaultPath()))
			{
				console.log(parsedMediaPath.dir);
				relativeImagePath = Utils.joinPaths(relativePaths.mediaPath, parsedMediaPath.base);
			}
			
			relativeImagePath = Utils.forceRelativePath(relativeImagePath, true);

			if(ExportSettings.settings.makeNamesWebStyle)
			{
				relativeImagePath = Utils.makePathWebStyle(relativeImagePath);
			}

			mediaEl.attr("src", relativeImagePath);

			let imagePathFromVault = Utils.joinPaths(Utils.getRelativePath(mediaPath, Utils.getVaultPath()), parsedMediaPath.base);

			imagesToOutline.push({localImagePath: mediaPath, relativeExportImagePath: imagePathFromVault});
		}

		return imagesToOutline;
	}

	//#endregion

	//#region Special Features

	public generateDarkmodeToggle(inline : boolean = true, usingDocument: Document = document) : HTMLElement
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

	private getHeaderList(usingDocument: Document): { size: number, title: string, href: string }[] | null
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

	private generateOutlineItem(header: { size: number, title: string, href: string }, usingDocument: Document): HTMLDivElement
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

	private generateOutline(headers: { size: number, title: string, href: string }[], usingDocument: Document): HTMLDivElement
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
			if (getLastStackSize() == 0) childContainer = listStack.last();
			if (!childContainer) continue;

			childContainer.appendChild(listItem);
			listStack.push(listItem);
		}

		return outlineEl;
	}

	private generateGraphView(usingDocument: Document): HTMLDivElement
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
