import { setIcon } from "obsidian";
import { Path } from "../utils/path";
import { ExportSettings } from "../export-settings";
import { GlobalDataGenerator, LinkTree } from "./global-gen";
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
		this.generateSideBarBtns(file, sidebars);
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
			let outline : HTMLElement | undefined = this.generateHTMLTree(headerTree, usingDocument, "Table Of Contents", "outline-tree", false, 1, 2, ExportSettings.settings.startOutlineCollapsed);
			rightSidebar.appendChild(outline);
		}

		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle && !usingDocument.querySelector(".theme-toggle-container-inline, .theme-toggle-container"))
		{
			let toggle = this.generateDarkmodeToggle(false, usingDocument);
			leftSidebar.appendChild(toggle);
		}

		// inject file tree
		if (ExportSettings.settings.includeFileTree)
		{
			let tree = GlobalDataGenerator.getFileTree();
			if (ExportSettings.settings.makeNamesWebStyle) tree.makeLinksWebStyle();
			let fileTree: HTMLDivElement = this.generateHTMLTree(tree, usingDocument, app.vault.getName(), "file-tree", true, 1, 1, true);
			leftSidebar.appendChild(fileTree);
		}

		await this.fillInHead(file);

		file.downloads.unshift(file.getSelfDownloadable());

		return file;
	}

	public static async getDocumentHTML(file: ExportFile, addSelfToDownloads: boolean = false): Promise<ExportFile>
	{
		// set custom line width on body
		let body = file.document.body;

		let bodyClasses = (document.body.getAttribute("class") ?? "").replaceAll("\"", "'");
		let bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'");
		body.setAttribute("class", bodyClasses);
		body.setAttribute("style", bodyStyle);

		let lineWidth = ExportSettings.settings.customLineWidth || "50em";
		let contentWidth = ExportSettings.settings.contentWidth || "500em";
		let sidebarWidth = ExportSettings.settings.sidebarWidth || "25em";
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(contentWidth))) contentWidth += "px";
		if (!isNaN(Number(sidebarWidth))) sidebarWidth += "px";
		body.style.setProperty("--line-width", lineWidth);
		body.style.setProperty("--line-width-adaptive", lineWidth);
		body.style.setProperty("--file-line-width", lineWidth);
		body.style.setProperty("--content-width", contentWidth);
		body.style.setProperty("--sidebar-width", sidebarWidth);
		body.style.setProperty("--collapse-arrow-size", "0.4em");
		body.style.setProperty("--tree-horizontal-spacing", "1em");
		body.style.setProperty("--tree-vertical-spacing", "0.5em");
		body.style.setProperty("--sidebar-margin", "12px");

		// create obsidian document containers
		let markdownViewEl = file.document.body.createDiv();
		let content = await MarkdownRenderer.renderMarkdown(file);
		if (MarkdownRenderer.cancelled) throw new Error("Markdown rendering cancelled");
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
		let headings = file.document.querySelectorAll("div h2, div h3, div h4, div h5, div h6");
		headings.forEach((element) =>
		{
			if(!(element instanceof HTMLElement)) return;
			if(!element.hasAttribute("data-heading")) return;

			element.style.display = "flex";
			
			// continue if heading already has an arrow
			if (element.querySelector(".heading-collapse-indicator") != null) return;

			let el = file.document.createElement("div");
			el.setAttribute("class", "heading-collapse-indicator collapse-indicator collapse-icon");
			el.innerHTML = arrowHTML;
			element.prepend(el);
		});
		
		// remove collapsible arrows from h1 and inline titles
		file.document.querySelectorAll("div h1, div .inline-title").forEach((element) =>
		{
			element.querySelector(".heading-collapse-indicator")?.remove();
		});

		// make sure the page scales correctly at different widths
		file.sizerElement.style.paddingBottom = "";
		file.sizerElement.style.paddingTop = "var(--file-margins)";
		file.sizerElement.style.paddingLeft = "var(--file-margins)";
		file.sizerElement.style.paddingRight = "var(--file-margins)";
		file.sizerElement.style.paddingBottom = "50vh";
		file.sizerElement.style.width = "100%";
		file.sizerElement.style.position = "absolute";

		// modify links to work outside of obsidian (including relative links)
		this.fixLinks(file); 
		
		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (ExportSettings.settings.inlineImages)
		{
			await this.inlineMedia(file);
		}
		else
		{
			outlinedImages = await this.externalizeMedia(file);
		}

		// add math styles to the document. They are here and not in head because they are unique to each document
		let mathStyleEl = document.createElement("style");
		mathStyleEl.id = "MJX-CHTML-styles";
		mathStyleEl.innerHTML = AssetHandler.mathStyles;
		file.contentElement.prepend(mathStyleEl);

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
		let currentTitleEl = file.document.querySelector("h1, h2, body.show-inline-title .inline-title");
		let hasTitle = currentTitleEl != null;
		let currentTitle = currentTitleEl?.textContent ?? "";

		if (!hasTitle || (currentTitleEl?.tagName == "H2" && currentTitle != file.markdownFile.basename))
		{
			let divContainer = file.document.querySelector("div.mod-header");
			if (!divContainer) 
			{
				divContainer = file.document.createElement("div");
				divContainer.setAttribute("class", "mod-header");
				file.contentElement.querySelector(".markdown-preview-sizer")?.prepend(divContainer);
			}

			let title = divContainer.createEl("div");
			title.innerText = file.markdownFile.basename;
			title.setAttribute("class", "inline-title");
			title.setAttribute("data-heading", title.innerText);
			title.style.display = "block";
			title.id = file.markdownFile.basename.replaceAll(" ", "_");
		}
	}

	private static generateSideBars(middleContent: HTMLElement, file: ExportFile): {container: HTMLElement, left: HTMLElement, leftScroll: HTMLElement, right: HTMLElement, rightScroll: HTMLElement, center: HTMLElement}
	{
		let docEl = file.document;

		/*
		- div.webpage-container
			- div.sidebar-mobile-btns

			- div.sidebar-left
				- div.sidebar-content
					- div.sidebar-scroll-area

			- div.document-container

			- div.sidebar-right
				- div.sidebar-content
					- div.sidebar-scroll-area
		*/

		let pageContainer = docEl.createElement("div");
		let leftSidebar = docEl.createElement("div");
		let leftContent = docEl.createElement("div");
		let leftSidebarScroll = docEl.createElement("div");
		let documentContainer = docEl.createElement("div");
		let rightSidebar = docEl.createElement("div");
		let rightContent = docEl.createElement("div");
		let rightSidebarScroll = docEl.createElement("div");

		pageContainer.setAttribute("class", "webpage-container");
		leftSidebar.setAttribute("class", "sidebar-left");
		leftContent.setAttribute("class", "sidebar-content");
		leftSidebarScroll.setAttribute("class", "sidebar-scroll-area");
		documentContainer.setAttribute("class", "document-container");
		rightContent.setAttribute("class", "sidebar-content");
		rightSidebar.setAttribute("class", "sidebar-right");
		rightSidebarScroll.setAttribute("class", "sidebar-scroll-area");

		leftSidebar.classList.add("sidebar");
		leftSidebar.appendChild(leftContent);
		// leftContent.appendChild(leftSidebarScroll);

		documentContainer.appendChild(middleContent);

		rightSidebar.classList.add("sidebar");
		rightSidebar.appendChild(rightContent);
		// rightContent.appendChild(rightSidebarScroll);

		pageContainer.appendChild(leftSidebar);
		pageContainer.appendChild(documentContainer);
		pageContainer.appendChild(rightSidebar);


		return {container: pageContainer, left: leftContent, leftScroll: leftSidebarScroll, right: rightContent, rightScroll: rightSidebarScroll, center: documentContainer};
	}

	private static generateSideBarBtns(file: ExportFile, {left, right, container}: {left: HTMLElement, right: HTMLElement, container: HTMLElement}): {leftBtn: HTMLElement, rightBtn: HTMLElement, mobileSideBarBtns: HTMLElement}
	{
		const docEl = file.document;
		/*
		- div.sidebar-mobile-btns
			- a.sidebar-mobile-btn--left
			- a.sidebar-mobile-btn--right
		*/

		let mobileSideBarBtns = docEl.createElement("div");
		const leftBtn = docEl.createElement("a");
		const rightBtn = docEl.createElement("a");

		mobileSideBarBtns.setAttribute("class", "sidebar-mobile-btns");
		leftBtn.setAttribute("class", "sidebar-mobile-btn--left");
		rightBtn.setAttribute("class", "sidebar-mobile-btn--right");

		setIcon(leftBtn, "sidebar-left");
		setIcon(rightBtn, "sidebar-right");

		mobileSideBarBtns.appendChild(leftBtn);
		mobileSideBarBtns.appendChild(rightBtn);
		container.appendChild(mobileSideBarBtns);

		return {leftBtn, rightBtn, mobileSideBarBtns};
	}

	private static getRelativePaths(file: ExportFile): {mediaPath: Path, jsPath: Path, cssPath: Path, rootPath: Path}
	{
		let rootPath = file.pathToRoot;
		let imagePath = AssetHandler.mediaFolderName.makeUnixStyle();
		let jsPath = AssetHandler.jsFolderName.makeUnixStyle();
		let cssPath = AssetHandler.cssFolderName.makeUnixStyle();

		if (ExportSettings.settings.makeNamesWebStyle)
		{
			imagePath = imagePath.makeWebStyle();
			jsPath = jsPath.makeWebStyle();
			cssPath = cssPath.makeWebStyle();
			rootPath = rootPath.makeWebStyle();
		}

		return {mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath, rootPath: rootPath};
	}

	private static async fillInHead(file: ExportFile)
	{
		let relativePaths = this.getRelativePaths(file);

		let meta =
		`
		<title>${file.markdownFile.basename}</title>
		<base href="${relativePaths.rootPath}/">
		<meta id="root-path" root-path="${relativePaths.rootPath}/">

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">
		<meta charset="UTF-8">
		`;

		if (ExportSettings.settings.includeOutline)
		{
			meta += `<script src="https://code.iconify.design/iconify-icon/1.0.3/iconify-icon.min.js"></script>`;
		}

		// --- JS ---
		let scripts = "";

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
			scripts += `\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js" integrity="sha512-Ch/O6kL8BqUwAfCF7Ie5SX1Hin+BJgYH4pNjRqXdTEqMsis1TUYg+j6nnI9uduPjGaj7DN4UKCZgpvoExt6dkw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>\n`;
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

		file.document.querySelectorAll("a.internal-link").forEach((linkEl) =>
		{
			linkEl.setAttribute("target", "_self");

			let href = linkEl.getAttribute("href");
			if (!href) return;

			if (href.startsWith("#")) // link pointing to header of this document
			{
				linkEl.setAttribute("href", href.replaceAll(" ", "_"));
			}
			else // if it doesn't start with #, it's a link to another document
			{
				let targetHeader = href.split("#").length > 1 ? "#" + href.split("#")[1] : "";
				let target = href.split("#")[0];

				let targetFile = app.metadataCache.getFirstLinkpathDest(target, file.markdownFile.path);
				if (!targetFile) return;

				let targetPath = new Path(targetFile.path);
				// let targetRelativePath = Path.getRelativePath(file.exportPath, targetPath);
				if (htmlCompatibleExt.includes(targetPath.extensionName)) targetPath.setExtension("html");
				if (ExportSettings.settings.makeNamesWebStyle) targetPath.makeWebStyle();

				let finalHref = targetPath.makeUnixStyle() + targetHeader.replaceAll(" ", "_");
				linkEl.setAttribute("href", finalHref);
			}
		});

		file.document.querySelectorAll("a.footnote-link").forEach((linkEl) =>
		{
			linkEl.setAttribute("target", "_self");
		});

		file.document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((headerEl) =>
		{
			// use the headers inner text as the id
			headerEl.setAttribute("id", headerEl.textContent?.replaceAll(" ", "_") ?? "");
		});
	}

	private static getMediaPath(src: string): Path
	{
		// @ts-ignore
		let pathString = "";
		try
		{
			// @ts-ignore
			pathString = app.vault.resolveFileUrl(src)?.path ?? "";
		}
		catch
		{
			pathString = src.replaceAll("app://", "").replaceAll("\\", "/");
			pathString = pathString.replaceAll(pathString.split("/")[0] + "/", "");
			pathString = Path.getRelativePathFromVault(new Path(pathString), true).asString;
		}

		pathString = pathString ?? "";

		return new Path(pathString);
	}

	private static async inlineMedia(file: ExportFile)
	{
		let elements = Array.from(file.document.querySelectorAll("img, audio, video"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			if (!rawSrc.startsWith("app:")) continue;
			
			let filePath = this.getMediaPath(rawSrc);

			let base64 = await filePath.readFileString("base64") ?? "";
			if (base64 === "") return;

			let ext = filePath.extensionName;

			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext === "svg") ext += "+xml";
			
			mediaEl.setAttribute("src", `data:${type}/${ext};base64,${base64}`);
		};
	}

	private static async externalizeMedia(file: ExportFile): Promise<Downloadable[]>
	{
		let downloads: Downloadable[] = [];

		let elements = Array.from(file.document.querySelectorAll("img, audio, video"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			if (!rawSrc.startsWith("app:")) continue;
			
			let filePath = this.getMediaPath(rawSrc);

			let exportLocation = filePath.copy;

			// if the media is inside the exported folder then keep it in the same place
			let mediaPathInExport = Path.getRelativePath(file.exportedFolder, filePath);
			if (mediaPathInExport.asString.startsWith(".."))
			{
				// if path is outside of the vault, outline it into the media folder
				exportLocation = AssetHandler.mediaFolderName.joinString(filePath.fullName);
			}

			// let relativeImagePath = Path.getRelativePath(file.exportPath, exportLocation)

			if(ExportSettings.settings.makeNamesWebStyle)
			{
				// relativeImagePath.makeWebStyle();
				exportLocation.makeWebStyle();
			}

			mediaEl.setAttribute("src", exportLocation.asString);

			let data = await filePath.readFileBuffer() ?? Buffer.from([]);
			let imageDownload = new Downloadable(exportLocation.fullName, data, exportLocation.directory.makeForceFolder());
			downloads.push(imageDownload);
		};

		return downloads;
	}

	//#endregion

	//#region Special Features

	public static generateDarkmodeToggle(inline : boolean = true, usingDocument: Document = document) : HTMLElement
	{
		// programatically generates the above html snippet
		let toggle = usingDocument.createElement("div");
		let label = usingDocument.createElement("label");
		label.classList.add(inline ? "theme-toggle-container-inline" : "theme-toggle-container");
		label.setAttribute("for", "theme_toggle");
		let input = usingDocument.createElement("input");
		input.classList.add("theme-toggle-input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");
		let div = usingDocument.createElement("div");
		div.classList.add("toggle-background");
		label.appendChild(input);
		label.appendChild(div);
		toggle.appendChild(label);

		return toggle;
	}

	private static generateTreeItem(item: LinkTree, usingDocument: Document, minCollapsableDepth = 1, startClosed: boolean = true): HTMLDivElement
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

		if (item.children.length != 0 && item.depth >= minCollapsableDepth)
		{
			let itemIconEl = itemContentsEl.createDiv("tree-item-icon collapse-icon");
			let svgEl = usingDocument.createElement("svg");
			itemIconEl.appendChild(svgEl).outerHTML = arrowIcon;

			treeItemEl.classList.add("mod-collapsible");
			if (startClosed) treeItemEl.classList.add("is-collapsed");
		}

		let itemLinkEl = itemContentsEl.createEl("a", { cls: "tree-item-link" });
		if (item.href) itemLinkEl.setAttribute("href", item.href);
		itemLinkEl.createEl("span", { cls: "tree-item-title", text: item.title });
		treeItemEl.createDiv("tree-item-children");

		return treeItemEl;
	}

	private static buildTreeRecursive(tree: LinkTree, usingDocument: Document, minDepth:number = 1, minCollapsableDepth:number = 1, closeAllItems: boolean = false): HTMLDivElement[]
	{
		let treeItems: HTMLDivElement[] = [];

		for (let item of tree.children)
		{
			let children = this.buildTreeRecursive(item, usingDocument, minDepth, minCollapsableDepth, closeAllItems);

			if(item.depth >= minDepth)
			{
				let treeItem = this.generateTreeItem(item, usingDocument, minCollapsableDepth, closeAllItems);
				treeItems.push(treeItem);
				treeItem.querySelector(".tree-item-children")?.append(...children);
			}
			else
			{
				treeItems.push(...children);
			}
		}

		return treeItems;
	}

	private static generateHTMLTree(tree: LinkTree, usingDocument: Document, treeTitle: string, className: string, showNestingIndicator = true, minDepth: number = 1, minCollapsableDepth = 1, closeAllItems: boolean = false): HTMLDivElement
	{
		/*
		- div.tree-container
			- div.tree-header
				- span.sidebar-section-header
				- button.collapse-tree-button
					- iconify-icon
			- div.tree-scroll-area
				- div.tree-item
					- div.tree-item-contents
						- div.tree-item-icon
							- svg
						- a.internal-link
							- span.tree-item-title
					- div.tree-item-children
		*/

		let treeContainerEl = usingDocument.createElement('div');
		let treeHeaderEl = usingDocument.createElement('div');
		let sectionHeaderEl = usingDocument.createElement('span');
		let collapseAllEl = usingDocument.createElement('button');
		let collapseAllIconEl = usingDocument.createElement('iconify-icon');
		let treeScrollAreaEl = usingDocument.createElement('div');

		treeContainerEl.classList.add('tree-container', className);
		if (showNestingIndicator) treeContainerEl.classList.add("mod-nav-indicator");
		treeHeaderEl.classList.add("tree-header");
		sectionHeaderEl.classList.add("sidebar-section-header");
		collapseAllEl.classList.add("clickable-icon", "collapse-tree-button");
		if (closeAllItems) collapseAllEl.classList.add("is-collapsed");
		treeScrollAreaEl.classList.add("tree-scroll-area");

		treeContainerEl.setAttribute("data-depth", "0");
		sectionHeaderEl.innerText = treeTitle;
		collapseAllIconEl.setAttribute("icon", "ph:arrows-in-line-horizontal-bold");
		collapseAllIconEl.setAttribute("width", "18px");
		collapseAllIconEl.setAttribute("height", "18px");
		collapseAllIconEl.setAttribute("rotate", "90deg");
		collapseAllIconEl.setAttribute("color", "currentColor");

		treeContainerEl.appendChild(treeHeaderEl);
		treeContainerEl.appendChild(treeScrollAreaEl);
		treeHeaderEl.appendChild(sectionHeaderEl);
		treeHeaderEl.appendChild(collapseAllEl);
		collapseAllEl.appendChild(collapseAllIconEl);

		let treeItems = this.buildTreeRecursive(tree, usingDocument, minDepth, minCollapsableDepth, closeAllItems);

		for (let item of treeItems)
		{
			treeScrollAreaEl.appendChild(item);
		}

		return treeContainerEl;
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
