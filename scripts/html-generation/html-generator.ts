import { Path } from "../utils/path";
import { ExportSettings } from "../export-settings";
import { GlobalDataGenerator, LinkTree, TreeItemType } from "./global-gen";
import jQuery from 'jquery';
const $ = jQuery;
import { MarkdownRenderer } from "./markdown-renderer";
import { AssetHandler } from "./asset-handler";
import { ExportFile } from "./export-file";
import { Downloadable } from "scripts/utils/downloadable";
import { TFile } from "obsidian";

export class HTMLGenerator
{

	//#region Main Generation Functions
	
	public static async beginBatch(exportingFiles: TFile[])
	{
		GlobalDataGenerator.clearGraphCache();
		GlobalDataGenerator.clearFileTreeCache();
		GlobalDataGenerator.getFileTree(exportingFiles);
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

		// inject graph view
		if (ExportSettings.settings.includeGraphView)
		{
			let graph = this.generateGraphView(usingDocument);
			let graphHeader = usingDocument.createElement("span");
			graphHeader.addClass("sidebar-section-header");
			graphHeader.innerText = "Interactive Graph";
			
			rightSidebar.appendChild(graphHeader);
			rightSidebar.appendChild(graph);
		}

		// inject outline
		if (ExportSettings.settings.includeOutline)
		{
			let headerTree = LinkTree.headersFromFile(file.markdownFile, 1);
			let outline : HTMLElement | undefined = this.generateHTMLTree(headerTree, usingDocument, "Table Of Contents", "outline-tree", 1, false);
			rightSidebar.appendChild(outline);
		}

		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle && !usingDocument.querySelector(".theme-toggle-inline, .theme-toggle"))
		{
			let toggle = this.generateDarkmodeToggle(false, usingDocument);
			leftSidebar.appendChild(toggle);
		}

		//inject file tree
		if (ExportSettings.settings.includeFileTree)
		{
			let tree = GlobalDataGenerator.getFileTree();
			if (ExportSettings.settings.makeNamesWebStyle) tree.makeLinksWebStyle();

			if (tree.children.length >= 1)
			{
				let fileTree: HTMLDivElement = this.generateHTMLTree(tree, usingDocument, app.vault.getName(), "file-tree", 2, true);
				leftSidebar.appendChild(fileTree);
			}
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
		let contentWidth = ExportSettings.settings.contentWidth || "50em";
		let sidebarWidth = ExportSettings.settings.sidebarWidth || "20em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(contentWidth))) contentWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";
		body.css("--line-width", lineWidth);
		body.css("--line-width-adaptive", lineWidth);
		body.css("--file-line-width", lineWidth);
		body.css("--content-width", contentWidth);
		body.css("--sidebar-width", sidebarWidth);

		// create obsidian document containers
		let markdownViewEl = file.document.body.createDiv();
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
		let headings = $(file.document).find("div h2, div h3, div h4, div h5, div h6");
		headings.each((index, element) =>
		{
			$(element).css("display", "flex");
			
			// continue if heading already has an arrow
			if ($(element).find(".heading-collapse-indicator").length > 0) return;

			let el = file.document.createElement("div");
			el.setAttribute("class", "heading-collapse-indicator collapse-indicator collapse-icon");
			el.innerHTML = arrowHTML;
			element.prepend(el);
		});
		
		// remove collapsible arrows from h1 and inline titles
		$(file.document).find("div h1, div .inline-title").each((index, element) =>
		{
			$(element).find(".heading-collapse-indicator").remove();
		});

		// set dataview lists to not have a static width
		$(file.document).find(".dataview.list-view-ul").each((index, element) =>
		{
			$(element).css("width", "auto");
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
		let hasTitle = file.document.body.querySelector("h1, .inline-title") != null;
		let currentTitle = file.document.body.querySelector("h1, h2, .inline-title")?.textContent ?? "";
		if (currentTitle != file.markdownFile.basename && !hasTitle)
		{
			console.log("Adding title to document: " + file.markdownFile.basename);
			let divContainer = file.document.querySelector("div.mod-header");
			if (!divContainer) 
			{
				divContainer = file.document.createElement("div");
				divContainer.setAttribute("class", "mod-header");
				file.contentElement.querySelector(".markdown-preview-sizer")?.prepend(divContainer);
			}

			let title = divContainer.createEl("h1");
			title.innerText = file.markdownFile.basename;
			title.setAttribute("class", "inline-title");
			title.setAttribute("data-heading", title.innerText);
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
			let nodes=\n${JSON.stringify(GlobalDataGenerator.getGlobalGraph(ExportSettings.settings.graphMinNodeSize, ExportSettings.settings.graphMaxNodeSize))};
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
			let thirdPartyPluginStyles = AssetHandler.pluginStyles;
			pluginCSS += thirdPartyPluginStyles;
			
			var header =
			`
			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${AssetHandler.appStyles} </style>
			<style> ${AssetHandler.mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Theme Styles -->
			<style> ${AssetHandler.themeStyles} </style>

			<!-- Plugin Styles -->
			<style> ${pluginCSS} </style>

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
			<link rel="stylesheet" href="${relativePaths.cssPath}/theme.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/plugin-styles.css">
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

	private static generateTreeItem(item: LinkTree, usingDocument: Document): HTMLDivElement
	{
		let arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;

		/*
		- div.tree-item
			- div.tree-item-contents
				- div.tree-item-icon
					- svg
				- a.internal-link
					- span.tree-item-title
			- div.tree-item-children
		*/

		let treeItemEl = usingDocument.createElement('div');
		treeItemEl.classList.add("tree-item");
		treeItemEl.classList.add(item.type == "folder" ? "mod-tree-folder" : (item.type == "file" ? "mod-tree-file" : (item.type == "heading" ? "mod-tree-heading" : "mod-tree-none")));
		treeItemEl.setAttribute("data-depth", item.depth.toString());

		let itemContentsEl = treeItemEl.createDiv("tree-item-contents");

		if (item.children.length != 0)
		{
			let itemIconEl = itemContentsEl.createDiv("tree-item-icon collapse-icon");
			let svgEl = usingDocument.createElement("svg");
			itemIconEl.appendChild(svgEl).outerHTML = arrowIcon;
		}

		let itemLinkEl = itemContentsEl.createEl("a", { cls: "tree-item-link" });
		if (item.href) itemLinkEl.setAttribute("href", item.href);
		itemLinkEl.createEl("span", { cls: "tree-item-title", text: item.title });
		treeItemEl.createDiv("tree-item-children");

		return treeItemEl;

		// let outlineItemEl = usingDocument.createElement('div');
		// outlineItemEl.classList.add("tree-item");
		// outlineItemEl.setAttribute("data-depth", item.depth.toString());

		// let outlineItemContentsEl = usingDocument.createElement('div');
		// outlineItemContentsEl.classList.add("tree-item-contents");

		// let outlineItemLinkEl = usingDocument.createElement('a');
		// outlineItemLinkEl.classList.add("internal-link");
		// if(item.href) outlineItemLinkEl.setAttribute("href", item.href);
		
		// let outlineItemIconEl = usingDocument.createElement('div');
		// outlineItemIconEl.classList.add("tree-item-icon");
		// outlineItemIconEl.classList.add("collapse-icon");
		
		// let outlineItemIconSvgEl = usingDocument.createElement('svg');
		// outlineItemIconSvgEl.innerHTML = arrowIcon;
		// outlineItemIconSvgEl = outlineItemIconSvgEl.firstChild as HTMLElement;
		
		// let outlineItemTitleEl = usingDocument.createElement('span');
		// outlineItemTitleEl.classList.add("tree-item-title");
		// outlineItemTitleEl.innerText = item.title;

		// if (item.type == TreeItemType.Folder)
		// {
		// 	outlineItemIconEl.style.width = "100%";
		// 	outlineItemIconEl.style.height = "100%";
		// 	outlineItemIconEl.style.position = "absolute";
		// 	outlineItemContentsEl.style.position = "relative";
		// 	outlineItemTitleEl.style.marginLeft = "calc(16px + 0.5em)";
		// }

		// let outlineItemChildrenEl = usingDocument.createElement('div');
		// outlineItemChildrenEl.classList.add("tree-item-children");

		// outlineItemIconEl.appendChild(outlineItemIconSvgEl);
		// outlineItemContentsEl.appendChild(outlineItemIconEl);
		// outlineItemContentsEl.appendChild(outlineItemTitleEl);
		// outlineItemEl.appendChild(outlineItemContentsEl);
		// outlineItemEl.appendChild(outlineItemChildrenEl);

		// return outlineItemEl;
	}

	private static generateHTMLTree(tree: LinkTree, usingDocument: Document, treeTitle: string, className: string, minDepth: number = 1, closeAllItems: boolean = false): HTMLDivElement
	{
		let outlineEl = usingDocument.createElement('div');
		outlineEl.classList.add('tree-container', className);
		outlineEl.setAttribute("data-depth", "0");

		let outlineHeader = usingDocument.createElement('div');
		outlineHeader.classList.add("tree-header");

		let headerLabelEl = usingDocument.createElement('span');
		headerLabelEl.style.margin = "1em";
		headerLabelEl.style.marginLeft = "0";
		headerLabelEl.addClass("sidebar-section-header");
		headerLabelEl.innerText = treeTitle;

		let headerCollapseAllEl = usingDocument.createElement('button');
		headerCollapseAllEl.classList.add("clickable-icon", "collapse-tree-button");
		if (closeAllItems) headerCollapseAllEl.classList.add("is-collapsed");

		let headerCollapseAllIconEl = usingDocument.createElement('iconify-icon');
		headerCollapseAllIconEl.setAttribute("icon", "ph:arrows-in-line-horizontal-bold");
		headerCollapseAllIconEl.setAttribute("width", "18px");
		headerCollapseAllIconEl.setAttribute("height", "18px");
		headerCollapseAllIconEl.setAttribute("rotate", "90deg");
		headerCollapseAllIconEl.setAttribute("color", "currentColor");

		headerCollapseAllEl.appendChild(headerCollapseAllIconEl);
		outlineHeader.appendChild(headerLabelEl);
		outlineHeader.appendChild(headerCollapseAllEl);
		outlineEl.appendChild(outlineHeader);

		let listStack = [outlineEl];
		
		// function to get the data-depth of the previous list item as a number
		function getLastStackSize(): number
		{
			return parseInt(listStack[listStack.length - 1].getAttribute("data-depth") ?? "0");
		}

		let items = tree.flatten();

		for (let i = 0; i < items.length; i++)
		{
			let item = items[i];

			if (item.depth < minDepth) continue;

			let listItem : HTMLDivElement = this.generateTreeItem(item, usingDocument);

			while (getLastStackSize() >= item.depth && listStack.length > 1)
			{
				listStack.pop();
			}

			let childContainer = listStack.last()?.querySelector(".tree-item-children");
			if (getLastStackSize() === 0) childContainer = listStack.last();
			if (!childContainer) continue;

			if (closeAllItems) listItem.classList.add("is-collapsed");

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
