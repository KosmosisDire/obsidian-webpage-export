import { writeFile } from "fs/promises";
import { Component, MarkdownRenderer, MarkdownView, Notice, TFile } from "obsidian";
import { ExportSettings } from "./export-settings";
import { Utils, Downloadable } from "./utils";
import jQuery from 'jquery';
import { GraphGenerator } from "./graph-view/graph-gen";
import { html_beautify } from "js-beautify";
const $ = jQuery;
import { LeafHandler } from './leaf-handler';

export class HTMLGenerator
{
	leafHandler: LeafHandler = new LeafHandler();

	// When this is enabled the plugin will download the extra .css and .js files from github.
	autoDownloadExtras = true;

	public static vaultPluginsPath: string = Utils.getAbsolutePath(Utils.joinPaths(Utils.getVaultPath(), app.vault.configDir, "plugins/")) as string;
	public static thisPluginPath: string;
	public static assetsPath: string;

	// this path is used to generate the relative path to the images folder, likewise for the other paths
	static mediaFolderName: string = "media";
	static jsFolderName: string = "scripts";
	static cssFolderName: string = "styles";
	static mediaPathComparison: string = Utils.joinPaths(Utils.getVaultPath(), HTMLGenerator.mediaFolderName);
	static jsPathComparison: string = Utils.joinPaths(Utils.getVaultPath(), HTMLGenerator.jsFolderName);
	static cssPathComparison: string = Utils.joinPaths(Utils.getVaultPath(), HTMLGenerator.cssFolderName);

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
	graphWASM: string = "";
	renderWorkerJS: string = "";

	// the raw github urls for the extra files
	private webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/webpage.js";
	private pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/plugin-styles.css";
	private obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/obsidian-styles.css";
	private graphViewJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph_view.js";
	private graphWASMJSURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph_wasm.js";
	private graphWASMURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph_wasm.wasm";
	private renderWorkerURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/graph-view/assets/graph-render-worker.js";
	
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
		this.graphWASM = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "graph_wasm.wasm")) ?? "";
		this.renderWorkerJS = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "graph-render-worker.js")) ?? "";
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
			let graphViewJSDownload = new Downloadable("graph_view.js", this.graphViewJS, "text/javascript", HTMLGenerator.jsFolderName);
			// wasm js is always inlined because it needs a different path per file
			let graphWASMJSDownload = new Downloadable("graph_wasm.js", this.graphWASMJS, "text/javascript", HTMLGenerator.jsFolderName);
			let graphWASMDownload = new Downloadable("graph_wasm.wasm", this.graphWASM, "text/javascript", HTMLGenerator.jsFolderName);
			let renderWorkerJSDownload = new Downloadable("graph-render-worker.js", this.renderWorkerJS, "text/javascript", HTMLGenerator.jsFolderName);

			toDownload.push(webpagejsDownload);
			toDownload.push(graphViewJSDownload);
			toDownload.push(graphWASMJSDownload);
			toDownload.push(graphWASMDownload);
			toDownload.push(renderWorkerJSDownload);
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
				let data = await Utils.getTextBase64(image.localImagePath);
				let destinationPath = Utils.parsePath(image.relativeExportImagePath);
				let imageDownload = new Downloadable(destinationPath.base, data, "image/png", destinationPath.dir, false);
				toDownload.push(imageDownload);
			}
		}

		return toDownload;
	}

	//#endregion

	//#region Main Generation Functions

	public async generateWebpage(file: TFile): Promise<{html: string, externalFiles: Downloadable[]}>
	{
		let documentData = await this.getDocumentHTML(file);
		let documentContent = documentData.htmlEl;

		let sidebars = this.generateSideBars(documentContent);
		let rightSidebar = sidebars.right;
		let leftSidebar = sidebars.left;

		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle)
		{
			let toggle = this.generateFixedToggle(documentContent, file.extension != "md");
			leftSidebar.appendChild(toggle);
		}

		// inject outline
		if (ExportSettings.settings.includeOutline)
		{
			let headers = this.getHeaderList(documentContent);
			if (headers)
			{
				var outline : HTMLElement | undefined = this.generateOutline(headers);
				rightSidebar.appendChild(outline);
			}
		}

		// inject graph view
		if (ExportSettings.settings.includeGraphView)
		{
			let graph = this.generateGraphView();

			if(outline) outline.prepend(graph);
			else        rightSidebar.appendChild(graph);
		}

		let htmlEl : HTMLHtmlElement = document.createElement("html");
		let headEl: HTMLHeadElement = await this.generateHead(file);
		let bodyEl : HTMLBodyElement = this.generateBodyElement();

		bodyEl.appendChild(sidebars.container);
		htmlEl.appendChild(headEl);
		htmlEl.appendChild(bodyEl);

		htmlEl = this.postprocessHTML(htmlEl);

		let htmlString = "<!DOCTYPE html>\n" + htmlEl.outerHTML;
		if (ExportSettings.settings.beautifyHTML) htmlString = html_beautify(htmlString, { indent_size: 2 });
		
		let externalFiles = await this.getSeperateFilesToDownload(documentData.outlinedImages);

		let parsedPath = Utils.parsePath(file.path);

		externalFiles.unshift(new Downloadable(parsedPath.name, htmlString, "text/html", parsedPath.dir, true));

		return {html : htmlString, externalFiles: externalFiles};
	}

	public async getDocumentHTML(file: TFile): Promise<{htmlEl: HTMLElement, outlinedImages: {localImagePath: string, relativeExportImagePath: string}[]}>
	{
		let contentEl = document.createElement("div");

		if(ExportSettings.settings.exportInBackground)
		{
			contentEl.addClasses(["markdown-preview-view", "markdown-rendered"]);
			let sizer = contentEl.createDiv({ cls: "markdown-preview-sizer" });
			let fileContents = await app.vault.read(file);
			await MarkdownRenderer.renderMarkdown(fileContents, sizer, file.path, new Component());
		}
		else
		{
			let fileTab = this.leafHandler.openFileInNewLeaf(file as TFile, true);
			await Utils.delay(200);
			let view = Utils.getActiveTextView();
			if (!view)
			{
				contentEl.innerHTML = 
				`<center><h1>
				Failed to render file, check obsidian log for details and report an issue on GitHub: 
				<a href="https://github.com/KosmosisDire/obsidian-webpage-export/issues">Github Issues</a>
				</h1></center>`
			}

			if (view instanceof MarkdownView)
			{
				await Utils.doFullRender(view);
			}

			let obsidianDocEl = (document.querySelector(".workspace-leaf.mod-active .markdown-reading-view") as HTMLElement);
			if (!obsidianDocEl) obsidianDocEl = (document.querySelector(".workspace-leaf.mod-active .view-content") as HTMLElement);

			let customLineWidthActive = false;
			let width = "var(--line-width)";
			if(ExportSettings.settings.customLineWidth.trim() != "")
			{
				width = ExportSettings.settings.customLineWidth;
				if (!isNaN(Number(width))) width = width + "px";
				customLineWidthActive = true;
			}

			contentEl.setAttribute("class", obsidianDocEl.getAttribute("class") ?? "");
			contentEl.innerHTML = obsidianDocEl.innerHTML;
			
			$(contentEl).css("flex-basis", `min(${width}, 100vw)`);
			$(contentEl).css("height", "100%");

			if(customLineWidthActive) $(contentEl).css("--line-width", width);
			$(contentEl).css("--line-width-adaptive", width);
			$(contentEl).css("--file-line-width", width);

			// Close the file tab after HTML is generated
			if(fileTab) fileTab.detach();
		}

		// collapse uncollapsed callouts
		let callouts = $(contentEl).find(".callout.is-collapsible:not(.is-collapsed)");
		callouts.each((index, element) =>
		{
			$(element).addClass("is-collapsed");
			$(element).find(".callout-content").css("display", "none");
		});

		this.fixLinks(contentEl); // modify links to work outside of obsidian (including relative links)
		this.repairOnClick(contentEl); // replace data-onlick with onclick

		// inline / outline images
		let outlinedImages : {localImagePath: string, relativeExportImagePath: string}[] = [];
		if (ExportSettings.settings.inlineImages)
		{
			await this.inlineMedia(contentEl);
		}
		else
		{
			outlinedImages = await this.outlineMedia(contentEl, file);
		}

		return {htmlEl: contentEl, outlinedImages: outlinedImages};
	}

	private generateSideBars(middleContent: HTMLElement): {container: HTMLElement, left: HTMLElement, right: HTMLElement}
	{
		let leftContent = document.createElement("div");
		let rightContent = document.createElement("div");

		let flexContainer = document.createElement("div");
		flexContainer.setAttribute("class", "flex-container");

		let leftBar = document.createElement("div");
		leftBar.setAttribute("id", "sidebar");
		leftBar.setAttribute("class", "sidebar-left");
		leftBar.appendChild(leftContent);

		let rightBar = document.createElement("div");
		rightBar.setAttribute("id", "sidebar");
		rightBar.setAttribute("class", "sidebar-right");
		rightBar.appendChild(rightContent);

		flexContainer.appendChild(leftBar);
		flexContainer.appendChild(middleContent);
		flexContainer.appendChild(rightBar);

		return {container: flexContainer, left: leftContent, right: rightContent};
	}

	private generateBodyElement(): HTMLBodyElement
	{
		let bodyClasses = document.body.getAttribute("class") ?? "";
		let bodyStyle = document.body.getAttribute("style") ?? "";
		bodyClasses = bodyClasses.replaceAll("\"", "'");
		bodyStyle = bodyStyle.replaceAll("\"", "'");

		let bodyEl = document.createElement("body");
		bodyEl.setAttribute("class", bodyClasses);
		bodyEl.setAttribute("style", bodyStyle);

		return bodyEl;
	}

	private getMathStyles(): string
	{
		let mathStyles = document.getElementById('MJX-CHTML-styles');
		return (mathStyles?.innerHTML ?? "").replaceAll("app://obsidian.md/", "https://publish.obsidian.md/");
	}

	private getRelativePaths(file: TFile): {mediaPath: string, jsPath: string, cssPath: string}
	{
		let imagePath = Utils.getRelativePath(HTMLGenerator.mediaPathComparison, file.path);
		let jsPath = Utils.getRelativePath(HTMLGenerator.jsPathComparison, file.path);
		let cssPath = Utils.getRelativePath(HTMLGenerator.cssPathComparison, file.path);

		return {mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath};
	}

	private async generateHead(file: TFile): Promise<HTMLHeadElement>
	{
		let meta =
		`
		<title>${file.basename}</title>

		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="mobile-web-app-capable" content="yes">
		<meta charset="UTF-8">

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">

		<script src='https://code.jquery.com/jquery-3.6.0.js'></script>
		<script src="https://code.jquery.com/ui/1.13.2/jquery-ui.js" integrity="sha256-xLD7nhI62fcsEZK2/v8LsBcb4lG7dgULkuXoXB/j91c=" crossorigin="anonymous"></script></script>
		<script src="https://code.iconify.design/iconify-icon/1.0.3/iconify-icon.min.js"></script>
		<script src="https://pixijs.download/v7.2.4/pixi.js"></script>
    	<script src="https://cdnjs.cloudflare.com/ajax/libs/tinycolor/1.6.0/tinycolor.js" integrity="sha512-4zLVma2et+Ww6WRDMUOjjETyQpMsSLhFO+2zRrH/dmBNh2RRBQzRj89Ll2d5qL4HGFaxr7g9p+ggLjIImBYf9Q==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
		`;

		let relativePaths = this.getRelativePaths(file);

		// --- JS ---
		let scripts = "";
		if (ExportSettings.settings.includeGraphView) 
		{
			// TODO: outline the nodes to a file
			scripts += `<script>${"let nodes = \n" + JSON.stringify(GraphGenerator.getGlobalGraph(3, 20))}\n</script>`;

			

			if (ExportSettings.settings.inlineJS) 
			{
				scripts += `\n<script type='module'>\n${this.graphViewJS}\n</script>\n`;
				// scripts += `\n<script>\n${this.renderWorkerJS}\n</script>\n`;

				// let graphWasmJS = this.graphWASMJS;
				// graphWasmJS = graphWasmJS.replaceAll("graph_wasm.wasm", Utils.joinPaths(relativePaths.jsPath, "graph_wasm.wasm"));
				scripts += `\n<script>${this.graphWASMJS}</script>\n`;
			}
			else 
			{
				scripts += `\n<script type='module' src='${relativePaths.jsPath}/graph_view.js'></script>\n`;
				scripts += `\n<script src='${relativePaths.jsPath}/graph_wasm.js'></script>\n`;
			}
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

		let headerEl = document.createElement("head");
		headerEl.innerHTML = header;

		return headerEl;
	}

	private postprocessHTML(html: HTMLHtmlElement) : HTMLHtmlElement
	{
		// stop sizer from setting width and margin
		let sizer = $(html).find(".markdown-preview-sizer");
		sizer.css("margin", "0");
		sizer.css("width", "100%");
		sizer.css("max-width", "100%");

		// set real margin on the .markdown-preview-view (using padding)
		let view = $(html).find(".markdown-preview-view");
		view.css("padding", "5%");

		let body = $(html).find('body');

		// set --line-width, --line-width-adaptive, and --file-line-width to the ExportSettings.settings.customLineWidth
		if(ExportSettings.settings.customLineWidth != "")
		{
			let lineWidth = ExportSettings.settings.customLineWidth;
			if (!isNaN(Number(lineWidth))) lineWidth += "px";
			body.css("--line-width", lineWidth);
			body.css("--line-width-adaptive", lineWidth);
			body.css("--file-line-width", lineWidth);
		}

		return html;
	}

	//#endregion

	//#region Links and Images

	private fixLinks(page: HTMLElement)
	{
		let query = jQuery(page);
		query.find("a.internal-link").each(function ()
		{
			$(this).attr("target", "_self");

			let finalHref = "";
			let href = $(this).attr("href");
			if (!href) return;

			if (href.startsWith("#")) // link pointing to header of this document
			{
				finalHref = "#" + href.slice(1).replaceAll(" ", "_").replaceAll("#", "");
			}
			else // if it doesn't start with #, it's a link to another document
			{
				let headers = href.split("#");

				// find the file that matches the link
				let currentFile = app.workspace.getActiveFile();
				if (!currentFile) return;

				let bestPath = app.metadataCache.getFirstLinkpathDest(headers[0], currentFile.path)?.path;
				if (!bestPath) return;
				
				let fileDepth = currentFile.path.split("/").length - 1;
				for (let i = 0; i < fileDepth; i++)
				{
					bestPath = "../" + bestPath;
				}

				if(ExportSettings.settings.makeNamesWebStyle)
					bestPath = Utils.makePathWebStyle(bestPath)

				bestPath = Utils.joinPaths(Utils.parsePath(bestPath).dir, Utils.parsePath(bestPath).name);
				
				// get the targeted header name if there is one
				headers.shift(); // remove the file name from headers list
				let header = "#" + headers.join("-").replaceAll(" ", "_");


				finalHref = bestPath + ".html" + header;
			}

			$(this).attr("href", finalHref);
		});

		query.find("a.footnote-link").each(function ()
		{
			$(this).attr("target", "_self");
		});

		query.find("h1, h2, h3, h4, h5, h6").each(function ()
		{
			// use the headers inner text as the id
			$(this).attr("id", $(this).text().replaceAll(" ", "_").replaceAll("#", ""));
		});
	}

	private async inlineMedia(page: HTMLElement)
	{
		let query = jQuery(page);
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

	private async outlineMedia(page: HTMLElement, file: TFile): Promise<{localImagePath: string, relativeExportImagePath: string}[]>
	{
		let relativePaths = this.getRelativePaths(file);
		let query = jQuery(page);
		let media = query.find("img, audio").toArray();

		let imagesToOutline: { localImagePath: string, relativeExportImagePath: string}[] = [];

		for (let i = 0; i < media.length; i++)
		{
			let mediaEl = $(media[i]);
			if (!mediaEl.attr("src")?.startsWith("app://local")) continue;
			
			let mediaPath = mediaEl.attr("src")?.replace("app://local", "").split("?")[0];

			if(!mediaPath) continue;

			mediaPath = Utils.forceAbsolutePath(mediaPath);
			let parsedMediaPath = Utils.parsePath(mediaPath);
			
			let filePath = Utils.getAbsolutePath(file.path) ?? "";
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

	private generateFixedToggle(page: HTMLElement, alwaysInject : boolean = false) : HTMLElement
	{
		if (!alwaysInject && page.querySelector(".theme-toggle-inline, .theme-toggle")) return document.createElement("div");

		if(ExportSettings.settings.addDarkModeToggle)
		{
			//insert fixed toggle in corner
			return this.generateDarkmodeToggle(false);
		}

		return document.createElement("div");
	}

	public generateDarkmodeToggle(inline : boolean = true) : HTMLElement
	{
		// programatically generates the above html snippet
		let toggle = document.createElement("div");
		let label = document.createElement("label");
		label.classList.add(inline ? "theme-toggle-inline" : "theme-toggle");
		label.setAttribute("for", "theme_toggle");
		let input = document.createElement("input");
		input.classList.add("toggle__input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");
		let div = document.createElement("div");
		div.classList.add("toggle__fill");
		label.appendChild(input);
		label.appendChild(div);
		toggle.appendChild(label);
		return toggle;
	}

	private getHeaderList(page: HTMLElement): { size: number, title: string, href: string }[] | null
	{
		let headers = [];

		let headerElements = page.querySelectorAll("h1, h2, h3, h4, h5, h6");

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

	private generateOutlineItem(header: { size: number, title: string, href: string }): HTMLDivElement
	{
		let arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path>`;

		let outlineItemEl = document.createElement('div');
		outlineItemEl.classList.add("outline-item");
		outlineItemEl.setAttribute("data-size", header.size.toString());

		let outlineItemContentsEl = document.createElement('a');
		outlineItemContentsEl.classList.add("outline-item-contents");
		outlineItemContentsEl.classList.add("internal-link");
		outlineItemContentsEl.setAttribute("href", "#" + header.href);
		
		let outlineItemIconEl = document.createElement('div');
		outlineItemIconEl.classList.add("tree-item-icon");
		outlineItemIconEl.classList.add("collapse-icon");
		
		let outlineItemIconSvgEl = document.createElement('svg');
		outlineItemIconSvgEl.innerHTML = arrowIcon;
		outlineItemIconSvgEl = outlineItemIconSvgEl.firstChild as HTMLElement;
		
		let outlineItemTitleEl = document.createElement('span');
		outlineItemTitleEl.classList.add("outline-item-title");
		outlineItemTitleEl.innerText = header.title;

		let outlineItemChildrenEl = document.createElement('div');
		outlineItemChildrenEl.classList.add("outline-item-children");

		outlineItemIconEl.appendChild(outlineItemIconSvgEl);
		outlineItemContentsEl.appendChild(outlineItemIconEl);
		outlineItemContentsEl.appendChild(outlineItemTitleEl);
		outlineItemEl.appendChild(outlineItemContentsEl);
		outlineItemEl.appendChild(outlineItemChildrenEl);

		return outlineItemEl;
	}

	private generateOutline(headers: { size: number, title: string, href: string }[]): HTMLDivElement
	{
		if(headers.length <= 1) return document.createElement("div");

		let outlineEl = document.createElement('div');
		outlineEl.classList.add("outline-container");
		outlineEl.setAttribute("data-size", "0");

		let outlineHeader = document.createElement('div');
		outlineHeader.classList.add("outline-header");

		let headerIconEl = document.createElement('svg');
		headerIconEl.setAttribute("viewBox", "0 0 100 100");
		headerIconEl.classList.add("bullet-list");
		headerIconEl.setAttribute("width", "18px");
		headerIconEl.setAttribute("height", "18px");

		let headerIconPathEl = document.createElement('path');
		let headerPathData = "M16.4,16.4c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,16.4,16.4,16.4z M16.4,19.6 c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2C13.2,21,14.6,19.6,16.4,19.6z M29.2,21.2v3.2H90v-3.2H29.2z M16.4,43.6c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,43.6,16.4,43.6z M16.4,46.8c1.8,0,3.2,1.4,3.2,3.2 s-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2S14.6,46.8,16.4,46.8z M29.2,48.4v3.2H90v-3.2H29.2z M16.4,70.8c-3.5,0-6.4,2.9-6.4,6.4 c0,3.5,2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4C22.8,73.7,19.9,70.8,16.4,70.8z M16.4,74c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2 s-3.2-1.4-3.2-3.2C13.2,75.4,14.6,74,16.4,74z M29.2,75.6v3.2H90v-3.2H29.2z";
		headerIconPathEl.setAttribute("fill", "currentColor");
		headerIconPathEl.setAttribute("stroke", "currentColor");
		headerIconPathEl.setAttribute("d", headerPathData);

		let headerLabelEl = document.createElement('h6');
		headerLabelEl.style.margin = "1em";
		headerLabelEl.innerText = "Table of Contents";

		let headerCollapseAllEl = document.createElement('button');
		headerCollapseAllEl.classList.add("clickable-icon", "collapse-all");

		let headerCollapseAllIconEl = document.createElement('iconify-icon');
		headerCollapseAllIconEl.setAttribute("icon", "ph:arrows-in-line-horizontal-bold");
		headerCollapseAllIconEl.setAttribute("width", "18px");
		headerCollapseAllIconEl.setAttribute("height", "18px");
		headerCollapseAllIconEl.setAttribute("rotate", "90deg");
		headerCollapseAllIconEl.setAttribute("color", "currentColor");
		
		

		headerCollapseAllEl.appendChild(headerCollapseAllIconEl);

		headerIconEl.appendChild(headerIconPathEl);
		outlineHeader.appendChild(headerIconEl);
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
			let listItem : HTMLDivElement = this.generateOutlineItem(header);

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

	private generateGraphView(): HTMLDivElement
	{
		let graphEl = document.createElement("div");
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

	private repairOnClick(page: HTMLElement)
	{
		page.innerHTML = page.innerHTML.replaceAll("data-onclick", "onclick");
	}

	//#endregion
}
