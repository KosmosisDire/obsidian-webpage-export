import { Path } from "../utils/path";
import { ExportSettings } from "../export-settings";
import { GraphGenerator } from "./graph-gen";
import jQuery from 'jquery';
const $ = jQuery;
import { MarkdownRenderer } from "./markdown-renderer";
import { AssetHandler } from "./asset-handler";
import { ExportFile } from "./export-file";
import { Downloadable } from "scripts/utils/downloadable";
import { RenderLog } from "./render-log";

export class HTMLGenerator
{

	//#region Main Generation Functions
	
	public static async beginBatch()
	{
		await AssetHandler.updateAssetCache();
		await MarkdownRenderer.beginBatch();
	}

	public static endBatch()
	{
		MarkdownRenderer.endBatch();
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
		let content = await MarkdownRenderer.renderMarkdown(file);
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
		file.downloads.push(...await AssetHandler.getDownloads());

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
		let imagePath = rootPath.join(AssetHandler.mediaFolderName).makeUnixStyle();
		let jsPath = rootPath.join(AssetHandler.jsFolderName).makeUnixStyle();
		let cssPath = rootPath.join(AssetHandler.cssFolderName).makeUnixStyle();

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
			scripts += `\n<script>\n${AssetHandler.webpageJS}\n</script>\n`;
		}
		else 
		{
			scripts += `\n<script src='${relativePaths.jsPath}/webpage.js'></script>\n`;
		}


		// --- CSS ---
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		
		if (ExportSettings.settings.inlineCSS)
		{
			let pluginCSS = AssetHandler.webpageStyles;
			let thirdPartyPluginStyles = await AssetHandler.getPluginStyles();
			pluginCSS += thirdPartyPluginStyles;
			
			var header =
			`
			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${AssetHandler.appStyles} </style>
			<style> ${AssetHandler.mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Plugin Styles -->
			<style> ${pluginCSS} </style>

			<!-- Theme Styles -->
			<style> ${AssetHandler.themeStyles} </style>

			<!-- Snippets -->
			<style> ${AssetHandler.snippetStyles} </style>
		
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
			<style> ${AssetHandler.mathStyles} </style>

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

				let finalHref = targetRelativePath.makeUnixStyle() + targetHeader.replaceAll(" ", "_");
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
			let rawSrc = $(mediaEl).attr("src") ?? "";
			if (rawSrc.startsWith("http:") || rawSrc.startsWith("https:")) continue;
			
			// @ts-ignore
			let filePath = new Path(app.vault.resolveFileUrl(rawSrc)?.path ?? "");

			let base64 = await filePath.readFileString("base64") ?? "";
			if (base64 === "") continue;

			let ext = filePath.extensionName;
			if(ext === "svg") ext += "+xml";

			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

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
				exportLocation = AssetHandler.mediaFolderName.joinString(vaultToMedia.fullName);
			}

			let relativeImagePath = Path.getRelativePath(file.exportPath, exportLocation)

			if(ExportSettings.settings.makeNamesWebStyle)
			{
				relativeImagePath.makeWebStyle();
				exportLocation.makeWebStyle();
			}

			mediaEl.attr("src", relativeImagePath.asString);

			let data = await mediaPath.readFileBuffer() ?? Buffer.from([]);
			let imageDownload = new Downloadable(exportLocation.fullName, data, exportLocation.directory);
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
