import { writeFile } from "fs/promises";
import { MarkdownView, Notice, TextFileView, TFile } from "obsidian";
import { ExportSettings } from "./export-settings";
import { Utils } from "./utils";
import { existsSync, mkdirSync } from "fs";
import jQuery from 'jquery';
import { GraphGenerator } from "./graph-view/graph-gen";
import { html_beautify } from "js-beautify";
const $ = jQuery;

export class HTMLGenerator
{
	// When this is enabled the plugin will download the extra .css and .js files from github.
	autoDownloadExtras = true;

	public static vaultPluginsPath: string = Utils.getAbsolutePath(Utils.joinPaths(Utils.getVaultPath(), app.vault.configDir, "plugins/")) as string;
	public static thisPluginPath: string;
	public static assetsPath: string;

	constructor(pluginID: string)
	{
		HTMLGenerator.thisPluginPath = Utils.getAbsolutePath(Utils.joinPaths(HTMLGenerator.vaultPluginsPath, pluginID, "/")) as string;
		HTMLGenerator.assetsPath = Utils.getAbsolutePath(Utils.joinPaths(HTMLGenerator.thisPluginPath, "assets/"), false) as string;
		Utils.createDirectory(HTMLGenerator.assetsPath);
	}

	// this is a list of images that is populated during generation and then downloaded upon export
	// I am sure there is a better way to handle this data flow but I am not sure what to do.
	private outlinedImages: { localImagePath: string, relativeExportImagePath: string }[] = [];

	// this is a string containing the filtered app.css file. It is populated on load. 
	// The math styles are attempted to load on every export until they are succesfully loaded. 
	// This is because they only load when a file containing latex is opened.
	appStyles: string = "";

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

	// public generateLocalGraphView(file: TFile, minRadius:number, maxRadius:number) : HTMLElement
	// {
	// 	let graphViewRoot = document.createElement("div");
	// 	graphViewRoot.id = "graph-view-root";

	// 	graphViewRoot.setAttr("graph-data", GraphGenerator.getLocalGraph(file, minRadius, maxRadius));

	// 	return graphViewRoot;
	// }

	// the raw github urls for the extra files
	private webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/webpage.js";
	private pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/plugin-styles.css";
	private obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/obsidian-styles.css";

	private async downloadExtras()
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
		if (this.autoDownloadExtras) await this.downloadExtras();
		await this.loadAppStyles();
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

	async getSeperateFilesToDownload() : Promise<{filename: string, data: string, type: string, relativePath?: string, unicode?: boolean}[]>
	{
		let toDownload: {filename: string, data: string, type: string, relativePath?: string, unicode?: boolean}[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			let appcss = this.appStyles;
			let plugincss = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "plugin-styles.css")) ?? "";
			let themecss = await Utils.getThemeContent(Utils.getCurrentTheme());

			let snippetsList = await Utils.getStyleSnippetsContent();
			let snippetsNames = await Utils.getEnabledSnippets();
			let snippets = "";

			for (let i = 0; i < snippetsList.length; i++)
			{
				snippets += `/* --- ${snippetsNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
			}

			let thirdPartyPluginCSS = await this.getThirdPartyPluginCSS();
			plugincss += "\n" + thirdPartyPluginCSS + "\n";

			let appcssDownload = { filename: "obsidian-styles.css", data: appcss, type: "text/css" };
			let plugincssDownload = { filename: "plugin-styles.css", data: plugincss, type: "text/css" };
			let themecssDownload = { filename: "theme.css", data: themecss, type: "text/css" };
			let snippetsDownload = { filename: "snippets.css", data: snippets, type: "text/css" };

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if (!ExportSettings.settings.inlineJS)
		{
			let webpagejs = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "webpage.js")) ?? "";
			let webpagejsDownload = { filename: "webpage.js", data: webpagejs, type: "text/javascript" };
			toDownload.push(webpagejsDownload);
		}

		if (!ExportSettings.settings.inlineImages)
		{
			for (let i = 0; i < this.outlinedImages.length; i++)
			{
				let image = this.outlinedImages[i];
				if (!Utils.pathExists(Utils.parseFullPath(image.localImagePath), false))
				{
					console.log("Could not find image at " + image.localImagePath);
					continue;
				}
				let data = await Utils.getTextBase64(image.localImagePath);
				let destinationPath = Utils.parsePath(image.relativeExportImagePath);
				let imageDownload =
				{
					filename: destinationPath.base,
					data: data,
					type: "image/png",
					relativePath: destinationPath.dir,
					unicode: false
				};
				toDownload.push(imageDownload);
			}
		}

		return toDownload;
	}

	//#region General HTML

	postprocessHTML(html: HTMLHtmlElement) : HTMLHtmlElement
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

		// change the class on body to theme-dark or theme-light depending on the ExportSettings.settings.themeChoice enum

		// if (ExportSettings.settings.themeChoice == ThemeOptions.Dark)
		// {
		// 	if (body.hasClass("theme-light"))
		// 		body.removeClass("theme-light");
		// 		body.addClass("theme-dark");
		// }

		// if (ExportSettings.settings.themeChoice == ThemeOptions.Light)
		// {
		// 	if (body.hasClass("theme-dark"))
		// 		body.removeClass("theme-dark");
		// 		body.addClass("theme-light");
		// }

		// uncollapse collapsed callouts
		let callouts = $(html).find(".callout.is-collapsible.is-collapsed");
		callouts.each((index, element) =>
		{
			$(element).removeClass("is-collapsed");
			$(element).find(".callout-content").css("display", "block");
		});

		return html;
	}

	public async getCurrentFileHTML(returnEl : boolean = false): Promise<string | HTMLHtmlElement | null>
	{
		await Utils.delay(200);

		let view = Utils.getActiveTextView();
		if (!view) return null;

		if (view instanceof MarkdownView)
		{
			await Utils.doFullRender(view);
		}

		let contentEl : HTMLElement = this.generateBodyContents();

		this.fixLinks(contentEl); // modify links to work outside of obsidian (including relative links)
		this.repairOnClick(contentEl); // replace data-onlick with onclick

		// inline / outline images
		if (ExportSettings.settings.inlineImages)
		{
			await this.inlineMedia(contentEl);
		}
		else
		{
			await this.outlineImages(contentEl, view);
		}

		// inject darkmode toggle
		let toggle : HTMLElement | null = null;
		if (ExportSettings.settings.addDarkModeToggle)
		{
			toggle = this.generateFixedToggle(contentEl, view.file.extension != "md");
		}

		// inject outline
		let outline : HTMLElement | null = null;
		if (ExportSettings.settings.includeOutline)
		{
			let headers = this.getHeaderList(contentEl);
			if (headers)
			{
				outline = this.generateOutline(headers);
			}
		}

		// inject graph view
		let graph : HTMLElement | null = null;
		if (ExportSettings.settings.includeGraphView)
		{
			// graph = this.generateLocalGraphView(view.file, 10, 30);
			graph = document.createDiv({ cls: "graph-view-placeholder"});
			graph.innerHTML = 
			`
			<div class="graph-view-container">
				<div class="graph-icon graph-expand" role="button" aria-label="Expand" data-tooltip-position="top"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-arrow-up-right"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
				<canvas id="graph-canvas" width="512px" height="512px"></canvas>
			</div>
			`
		}

		let htmlEl : HTMLHtmlElement = document.createElement("html");
		let headEl: HTMLHeadElement = await this.generateHead(view);
		let bodyRootEl : HTMLBodyElement = this.generateBodyRoot();

		let rightSidebarContent = document.createElement("div");
		rightSidebarContent.classList.add("sidebar-content");
		if (graph != null && outline != null) outline.appendChild(graph);
		if (graph != null && outline == null) rightSidebarContent.appendChild(graph);
		if (outline != null) rightSidebarContent.appendChild(outline);

		let leftSidebarContent = document.createElement("div");
		leftSidebarContent.classList.add("sidebar-content");
		if (toggle != null) leftSidebarContent.appendChild(toggle);

		let sidebars = this.generateSideBars(contentEl, leftSidebarContent, rightSidebarContent);
		
		let finalContent : HTMLElement = sidebars;
		if(toggle == null && outline == null) finalContent = contentEl;

		bodyRootEl.appendChild(finalContent);
		htmlEl.appendChild(headEl);
		htmlEl.appendChild(bodyRootEl);

		htmlEl = this.postprocessHTML(htmlEl);

		if (returnEl == true)
		{
			return htmlEl;
		}
		else
			return html_beautify("<!DOCTYPE html>\n" + htmlEl.outerHTML);
	}

	private generateSideBars(middleContent: HTMLElement, leftContent: HTMLElement, rightContent: HTMLElement): HTMLDivElement
	{
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

		return flexContainer;
	}

	private generateBodyContents(): HTMLElement
	{
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

		let contentEl = document.createElement("div");
		contentEl.setAttribute("class", obsidianDocEl.getAttribute("class") ?? "");
		contentEl.innerHTML = obsidianDocEl.innerHTML;
		
		$(contentEl).css("flex-basis", `min(${width}, 100vw)`);
		$(contentEl).css("height", "100%");

		if(customLineWidthActive) $(contentEl).css("--line-width", width);
		$(contentEl).css("--line-width-adaptive", width);
		$(contentEl).css("--file-line-width", width);

		return contentEl;
	}

	private generateBodyRoot(): HTMLBodyElement
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
		console.log(mathStyles);
		return mathStyles?.innerHTML ?? "";
	}

	private async generateHead(view: TextFileView): Promise<HTMLHeadElement>
	{
		let meta =
		`
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="mobile-web-app-capable" content="yes">
		<meta charset="UTF-8">
		<title>${view.file.basename}</title>

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		<script src='https://code.jquery.com/jquery-3.6.0.js'></script>
		<script src="https://code.jquery.com/ui/1.13.2/jquery-ui.js" integrity="sha256-xLD7nhI62fcsEZK2/v8LsBcb4lG7dgULkuXoXB/j91c=" crossorigin="anonymous"></script>
		</script>

		<script src="https://code.iconify.design/iconify-icon/1.0.3/iconify-icon.min.js"></script>

		<script src="https://pixijs.download/v7.2.4/pixi.js"></script>
    	<script src="https://cdnjs.cloudflare.com/ajax/libs/tinycolor/1.6.0/tinycolor.js" integrity="sha512-4zLVma2et+Ww6WRDMUOjjETyQpMsSLhFO+2zRrH/dmBNh2RRBQzRj89Ll2d5qL4HGFaxr7g9p+ggLjIImBYf9Q==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
		`

		if (view instanceof MarkdownView)
			await Utils.doFullRender(view);

		let mathStyles = this.getMathStyles();
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		let scripts = `\n<script type='module'>\n ${await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "webpage.js"))} \n</script>\n`;
		if (!ExportSettings.settings.inlineJS) scripts = "<script type='module' src='webpage.js'></script>\n";

		if (ExportSettings.settings.inlineCSS)
		{
			let pluginStyles = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "plugin-styles.css"));
			let snippets = await Utils.getStyleSnippetsContent();
			let snippetNames = Utils.getEnabledSnippets();
			let theme = await Utils.getThemeContent(Utils.getCurrentTheme());

			let thirdPartyPluginStyles = await this.getThirdPartyPluginCSS();
			pluginStyles += thirdPartyPluginStyles;
			
			var header =
			`
			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${this.appStyles} </style>
			<style> ${mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Plugin Styles -->
			<style> ${pluginStyles} </style>

			<!-- Theme Styles ( ${Utils.getCurrentTheme()} ) -->
			<style> ${theme} </style>

			<!-- Snippets: ${snippetNames.join(", ")} -->
			<style> ${snippets.join("</style><style>")} </style>
		
			${scripts}
			`;
		}
		else
		{
			header =
			`
			${meta}

			<link rel="stylesheet" href="obsidian-styles.css">
			<link rel="stylesheet" href="plugin-styles.css">
			<link rel="stylesheet" href="theme.css">
			<link rel="stylesheet" href="snippets.css">

			<style> ${cssSettings} </style>
			<style> ${mathStyles} </style>

			${scripts}
			`;
		}

		let headerEl = document.createElement("head");
		headerEl.innerHTML = header;

		return headerEl;
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

	private async outlineImages(page: HTMLElement, view: TextFileView)
	{
		let query = jQuery(page);

		this.outlinedImages = [];

		let imagesToOutline: { localImagePath: string, relativeExportImagePath: string }[] = [];

		query.find("img").each(function ()
		{
			let imagePath = $(this).attr("src") ?? "";
			if (imagePath == "") return;

			if (!imagePath.startsWith("app://local") || imagePath.contains("data:")) return;

			imagePath = Utils.trimStart(imagePath, "app://local").split("?")[0];
			imagePath = Utils.forceAbsolutePath(imagePath);
			
			let filePath = Utils.getAbsolutePath(view.file.path) ?? "";
			
			let imageBase = Utils.parsePath(imagePath).base;
			let relativeImagePath = Utils.joinPaths(Utils.getRelativePath(imagePath, filePath), imageBase);

			// we won't save images at a relative path lower than or equal to the document, so we just group them all in an "images" folder
			if (relativeImagePath.startsWith("..") || relativeImagePath == "/" || relativeImagePath == "")
			{
				relativeImagePath = Utils.joinPaths("images", imageBase);
			}
			
			relativeImagePath = Utils.forceRelativePath(relativeImagePath, true);

			if(ExportSettings.settings.makeNamesWebStyle)
			{
				relativeImagePath = Utils.makePathWebStyle(relativeImagePath);
			}

			$(this).attr("src", relativeImagePath);

			imagesToOutline.push({ localImagePath: imagePath, relativeExportImagePath: relativeImagePath });
		});

		this.outlinedImages = imagesToOutline;
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

	private repairOnClick(page: HTMLElement)
	{
		page.innerHTML = page.innerHTML.replaceAll("data-onclick", "onclick");
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

	//#endregion
}
