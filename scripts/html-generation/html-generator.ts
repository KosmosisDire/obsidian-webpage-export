import { Component, MarkdownPreviewView, MarkdownRenderer as ObsidianRenderer, setIcon } from "obsidian";
import { Path } from "../utils/path";
import { MarkdownRenderer } from "./markdown-renderer";
import { AssetHandler } from "./asset-handler";
import { Webpage } from "../objects/webpage";
import { Downloadable } from "scripts/utils/downloadable";
import { TFile } from "obsidian";
import { MainSettings } from "scripts/settings/main-settings";

export class GenHelper
{
	//#region Main Generation Functions
	

	public static async getViewHTML(view: MarkdownPreviewView, filePath: Path | string, addSelfToDownloads: boolean = false): Promise<{html: string, downloads: Downloadable[]}>
	{
		if (typeof filePath == "string") filePath = new Path(filePath);

		filePath.makeUnixStyle();

		let tFile = app.vault.getAbstractFileByPath(filePath.asString) as TFile;
		if (!tFile) throw new Error("File not found: " + filePath.asString);
		// @ts-ignore
		let tempFile = new Webpage(tFile, null, Path.vaultPath, true, filePath.basename + ".html", false);

		if (!tempFile.document) return {html: "", downloads: []};

		let content = await MarkdownRenderer.renderMarkdownView(view);
		tempFile.document.body.appendChild(content);
		let container = tempFile.document.body;

		// add heading fold arrows
		let arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";
		let headings = container.querySelectorAll("div h2, div h3, div h4, div h5, div h6");
		headings.forEach((element) =>
		{
			if(!(element instanceof HTMLElement)) return;
			if(!element.hasAttribute("data-heading")) return;
			
			// continue if heading already has an arrow
			if (element.querySelector(".heading-collapse-indicator") != null) return;

			if (!tempFile.document) return {html: "", downloads: []};


			let el = tempFile.document.createElement("div");
			el.setAttribute("class", "heading-collapse-indicator collapse-indicator collapse-icon");
			el.innerHTML = arrowHTML;
			element.prepend(el);
		});

		// remove collapsible arrows from h1 and inline titles
		container.querySelectorAll("div h1, div .inline-title").forEach((element) =>
		{
			element.querySelector(".heading-collapse-indicator")?.remove();
		});

		// remove all new lines from header elements which cause spacing issues
		document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", "")); 


		// modify links to work outside of obsidian (including relative links)
		this.fixLinks(tempFile); 
		
		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (MainSettings.settings.inlineImages)
		{
			await this.inlineMedia(tempFile);
		}
		else
		{
			outlinedImages = await this.externalizeMedia(tempFile);
		}

		if(addSelfToDownloads) tempFile.downloads.push(await tempFile.getSelfDownloadable());
		tempFile.downloads.push(...outlinedImages);
		tempFile.downloads.push(...await AssetHandler.getDownloads());

		if(MainSettings.settings.makeNamesWebStyle)
		{
			tempFile.downloads.forEach((file) =>
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDownloadPath = file.relativeDownloadPath?.makeWebStyle();
			});
		}

		return {html: container.innerHTML, downloads: tempFile.downloads};
	}
	
	public static addTitle(file: Webpage)
	{
		if (!file.document) return;

		let currentTitleEl = file.document.querySelector("h1, h2, body.show-inline-title .inline-title");
		let hasTitle = currentTitleEl != null;
		let currentTitle = currentTitleEl?.textContent ?? "";

		if (!hasTitle || (currentTitleEl?.tagName == "H2" && currentTitle != file.source.basename))
		{
			let divContainer = file.document.querySelector("div.mod-header");
			if (!divContainer) 
			{
				divContainer = file.document.createElement("div");
				divContainer.setAttribute("class", "mod-header");
				file.contentElement.querySelector(".markdown-preview-sizer")?.prepend(divContainer);
			}

			let title = divContainer.createEl("div");
			title.innerText = file.source.basename;
			title.setAttribute("class", "inline-title");
			title.setAttribute("data-heading", title.innerText);
			title.style.display = "block";
			title.id = file.source.basename.replaceAll(" ", "_");
		}
	}

	public static generateSideBarLayout(middleContent: HTMLElement, file: Webpage): {container: HTMLElement, left: HTMLElement, right: HTMLElement, center: HTMLElement}
	{
		if (!file.document) return {container: middleContent, left: middleContent, right: middleContent, center: middleContent};

		let docEl = file.document;

		/*
		- div.webpage-container

			- div.sidebar.sidebar-left
				- div.sidebar-container
					- div.sidebar-sizer
						- div.sidebar-content-positioner
							- div.sidebar-content
				- div.sidebar-gutter
					- div.clickable-icon.sidebar-collapse-icon
						- svg

			- div.document-container

			- div.sidebar.sidebar-right
				- div.sidebar-gutter
						- div.clickable-icon.sidebar-collapse-icon
							- svg
				- div.sidebar-container
					- div.sidebar-sizer
						- div.sidebar-content-positioner
							- div.sidebar-content
		*/

		let iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`

		let pageContainer = docEl.createElement("div");
		let leftSidebar = docEl.createElement("div");
		let leftSidebarContainer = docEl.createElement("div");
		let leftSidebarSizer = docEl.createElement("div");
		let leftSidebarContentPositioner = docEl.createElement("div");
		let leftContent = docEl.createElement("div");
		let leftGutter = docEl.createElement("div");
		let leftGutterIcon = docEl.createElement("div");
		let documentContainer = docEl.createElement("div");
		let rightSidebar = docEl.createElement("div");
		let rightSidebarContainer = docEl.createElement("div");
		let rightSidebarSizer = docEl.createElement("div");
		let rightSidebarContentPositioner = docEl.createElement("div");
		let rightContent = docEl.createElement("div");
		let rightGutter = docEl.createElement("div");
		let rightGutterIcon = docEl.createElement("div");

		pageContainer.setAttribute("class", "webpage-container");

		leftSidebar.setAttribute("class", "sidebar-left sidebar");
		leftSidebarContainer.setAttribute("class", "sidebar-container");
		leftSidebarSizer.setAttribute("class", "sidebar-sizer");
		leftSidebarContentPositioner.setAttribute("class", "sidebar-content-positioner");
		leftContent.setAttribute("class", "sidebar-content");
		leftGutter.setAttribute("class", "sidebar-gutter");
		leftGutterIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");

		documentContainer.setAttribute("class", "document-container");

		rightSidebar.setAttribute("class", "sidebar-right sidebar");
		rightSidebarContainer.setAttribute("class", "sidebar-container");
		rightSidebarSizer.setAttribute("class", "sidebar-sizer");
		rightSidebarContentPositioner.setAttribute("class", "sidebar-content-positioner");
		rightContent.setAttribute("class", "sidebar-content");
		rightGutter.setAttribute("class", "sidebar-gutter");
		rightGutterIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");

		pageContainer.appendChild(leftSidebar);
		pageContainer.appendChild(documentContainer);
		pageContainer.appendChild(rightSidebar);

		leftSidebar.appendChild(leftSidebarContainer);
		leftSidebarContainer.appendChild(leftSidebarSizer);
		leftSidebarSizer.appendChild(leftSidebarContentPositioner);
		leftSidebarContentPositioner.appendChild(leftContent);
		leftSidebar.appendChild(leftGutter);
		leftGutter.appendChild(leftGutterIcon);
		leftGutterIcon.innerHTML = iconSVG;

		documentContainer.appendChild(middleContent);

		rightSidebar.appendChild(rightGutter);
		rightGutter.appendChild(rightGutterIcon);
		rightGutterIcon.innerHTML = iconSVG;
		rightSidebar.appendChild(rightSidebarContainer);
		rightSidebarContainer.appendChild(rightSidebarSizer);
		rightSidebarSizer.appendChild(rightSidebarContentPositioner);
		rightSidebarContentPositioner.appendChild(rightContent);
		

		return {container: pageContainer, left: leftContent, right: rightContent, center: documentContainer};
	}

	public static getRelativePaths(file: Webpage): {mediaPath: Path, jsPath: Path, cssPath: Path, rootPath: Path}
	{
		let rootPath = file.pathToRoot;
		let imagePath = AssetHandler.mediaFolderName.makeUnixStyle();
		let jsPath = AssetHandler.jsFolderName.makeUnixStyle();
		let cssPath = AssetHandler.cssFolderName.makeUnixStyle();

		if (MainSettings.settings.makeNamesWebStyle)
		{
			imagePath = imagePath.makeWebStyle();
			jsPath = jsPath.makeWebStyle();
			cssPath = cssPath.makeWebStyle();
			rootPath = rootPath.makeWebStyle();
		}

		return {mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath, rootPath: rootPath};
	}

	public static async fillInHead(file: Webpage)
	{
		if (!file.document) return;

		let relativePaths = this.getRelativePaths(file);

		let meta =
		`
		<title>${file.source.basename}</title>
		<base href="${relativePaths.rootPath}/">
		<meta id="root-path" root-path="${relativePaths.rootPath}/">

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">
		<meta charset="UTF-8">
		`;

		// --- JS ---
		let scripts = "";

		if (MainSettings.settings.includeGraphView) 
		{
			scripts += `\n<script type='module' src='${relativePaths.jsPath}/graph_view.js'></script>\n`;
			scripts += `\n<script src='${relativePaths.jsPath}/graph_wasm.js'></script>\n`;
			scripts += `\n<script src="${relativePaths.jsPath}/tinycolor.js"></script>\n`;
			scripts += `\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js" integrity="sha512-Ch/O6kL8BqUwAfCF7Ie5SX1Hin+BJgYH4pNjRqXdTEqMsis1TUYg+j6nnI9uduPjGaj7DN4UKCZgpvoExt6dkw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>\n`;
		}

		if (MainSettings.settings.inlineJS)
		{
			scripts += `\n<script>\n${AssetHandler.webpageJS}\n</script>\n`;
			scripts += `\n<script>\n${AssetHandler.generatedJS}\n</script>\n`;
		}
		else 
		{
			scripts += `\n<script src='${relativePaths.jsPath}/webpage.js'></script>\n`;
			scripts += `\n<script src='${relativePaths.jsPath}/generated.js'></script>\n`;
		}


		// --- CSS ---
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		
		if (MainSettings.settings.inlineCSS)
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

			<!-- Generated Styles -->
			<style> ${AssetHandler.generatedStyles} </style>
		
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
			<link rel="stylesheet" href="${relativePaths.cssPath}/generated-styles.css">
			<style> ${cssSettings} </style>

			${scripts}
			`;
		}

		file.document.head.innerHTML = header;
	}

	//#endregion

	//#region Links and Images

	public static fixLinks(file: Webpage)
	{
		if (!file.document) return;

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

				let targetFile = app.metadataCache.getFirstLinkpathDest(target, file.source.path);
				if (!targetFile) return;

				let targetPath = new Path(targetFile.path);
				if (MarkdownRenderer.isConvertable(targetPath.extensionName)) targetPath.setExtension("html");
				if (MainSettings.settings.makeNamesWebStyle) targetPath.makeWebStyle();

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
			// convert the data-heading to the id
			headerEl.setAttribute("id", (headerEl.getAttribute("data-heading") ?? headerEl.textContent)?.replaceAll(" ", "_") ?? "");
		});
	}

	public static getMediaPath(src: string, exportingFilePath: string): Path
	{
		// @ts-ignore
		let pathString = "";
		if (src.startsWith("app://"))
		{
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
		}
		else
		{
			pathString = app.metadataCache.getFirstLinkpathDest(src, exportingFilePath)?.path ?? "";
		}

		pathString = pathString ?? "";

		return new Path(pathString);
	}

	public static async inlineMedia(file: Webpage)
	{
		if (!file.document) return;

		let elements = Array.from(file.document.querySelectorAll("[src]:not(head [src])"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			let filePath = this.getMediaPath(rawSrc, file.source.path);
			if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute) continue;

			let base64 = await filePath.readFileString("base64") ?? "";
			if (base64 === "") return;

			let ext = filePath.extensionName;

			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext === "svg") ext += "+xml";
			
			mediaEl.setAttribute("src", `data:${type}/${ext};base64,${base64}`);
		};
	}

	public static async externalizeMedia(file: Webpage): Promise<Downloadable[]>
	{
		if (!file.document) return [];

		let downloads: Downloadable[] = [];

		let elements = Array.from(file.document.querySelectorAll("[src]:not(head [src])"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			let filePath = this.getMediaPath(rawSrc, file.source.path);
			if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute) continue;

			let exportLocation = filePath.copy;

			// if the media is inside the exported folder then keep it in the same place
			let mediaPathInExport = Path.getRelativePath(file.sourceFolder, filePath);
			if (mediaPathInExport.asString.startsWith(".."))
			{
				// if path is outside of the vault, outline it into the media folder
				exportLocation = AssetHandler.mediaFolderName.joinString(filePath.fullName);
			}

			// let relativeImagePath = Path.getRelativePath(file.exportPath, exportLocation)

			if(MainSettings.settings.makeNamesWebStyle)
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

	// public static async generateTreeItem(item: LinkTreeItem, usingDocument: Document, minCollapsableDepth = 1, startClosed: boolean = true): Promise<HTMLDivElement>
	// {
	// 	let arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;

	// 	/*
	// 	- div.tree-item
	// 		- div.tree-item-contents
	// 			- a.internal-link.tree-item-link
	// 				- div.tree-item-icon
	// 					- svg
	// 				- span.tree-item-title
	// 		- div.tree-item-children
	// 	*/

	// 	let treeItemEl = usingDocument.createElement('div');
	// 	treeItemEl.classList.add("tree-item");
	// 	treeItemEl.classList.add(item.type == "folder" ? "mod-tree-folder" : (item.type == "file" ? "mod-tree-file" : (item.type == "heading" ? "mod-tree-heading" : "mod-tree-none")));
	// 	treeItemEl.setAttribute("data-depth", item.depth.toString());

	// 	let itemContentsEl = treeItemEl.createDiv("tree-item-contents");

	// 	let itemLinkEl = itemContentsEl.createEl("div", { cls: "tree-item-link" });
	// 	if (item.href) itemLinkEl.setAttribute("href", item.href);

	// 	if (item.children.length != 0 && item.depth >= minCollapsableDepth)
	// 	{
	// 		let itemIconEl = itemLinkEl.createDiv("tree-item-icon collapse-icon");
	// 		let svgEl = usingDocument.createElement("svg");
	// 		itemIconEl.appendChild(svgEl).outerHTML = arrowIcon;

	// 		treeItemEl.classList.add("mod-collapsible");
	// 		if (startClosed) treeItemEl.classList.add("is-collapsed");
	// 	}

	// 	let renderComp = new Component();
	// 	renderComp.load();
	// 	let titleEl = itemLinkEl.createEl("span", { cls: "tree-item-title" });
	// 	treeItemEl.createDiv("tree-item-children");
	// 	await ObsidianRenderer.renderMarkdown(item.title, titleEl, "/", renderComp);
	// 	renderComp.unload();
	// 	//remove lists and replace them with plain text
	// 	titleEl.querySelectorAll("ol").forEach((el) =>
	// 	{
	// 		if(el.parentElement)
	// 		{
	// 			let start = el.getAttribute("start") ?? "1";
	// 			el.parentElement.createSpan().innerHTML = start + ". " + el.innerHTML;
	// 			el.remove();
	// 		}
	// 	});
	// 	titleEl.querySelectorAll("ul").forEach((el) =>
	// 	{
	// 		if(el.parentElement)
	// 		{
	// 			el.parentElement.createSpan().innerHTML = "- " + el.innerHTML;
	// 			el.remove();
	// 		}
	// 	});
	// 	titleEl.querySelectorAll("li").forEach((el) =>
	// 	{
	// 		if(el.parentElement)
	// 		{
	// 			el.parentElement.createSpan().innerHTML = el.innerHTML;
	// 			el.remove();
	// 		}
	// 	});

	// 	return treeItemEl;
	// }

	// public static async buildTreeRecursive(tree: LinkTreeItem, usingDocument: Document, minDepth:number = 1, minCollapsableDepth:number = 1, closeAllItems: boolean = false): Promise<HTMLDivElement[]>
	// {
	// 	let treeItems: HTMLDivElement[] = [];

	// 	for (let item of tree.children)
	// 	{
	// 		let children = await this.buildTreeRecursive(item, usingDocument, minDepth, minCollapsableDepth, closeAllItems);

	// 		if(item.depth >= minDepth)
	// 		{
	// 			let treeItem = await this.generateTreeItem(item, usingDocument, minCollapsableDepth, closeAllItems);
	// 			treeItems.push(treeItem);
	// 			treeItem.querySelector(".tree-item-children")?.append(...children);
	// 		}
	// 		else
	// 		{
	// 			treeItems.push(...children);
	// 		}
	// 	}

	// 	return treeItems;
	// }

	// public static async generateHTMLTree(tree: LinkTreeItem, usingDocument: Document, treeTitle: string, className: string, showNestingIndicator = true, minDepth: number = 1, minCollapsableDepth = 1, closeAllItems: boolean = false): Promise<HTMLDivElement>
	// {
	// 	/*
	// 	- div.tree-container
	// 		- div.tree-header
	// 			- span.sidebar-section-header
	// 			- button.collapse-tree-button
	// 				- svg
	// 		- div.tree-scroll-area
	// 			- div.tree-item
	// 				- div.tree-item-contents
	// 					- div.tree-item-icon
	// 						- svg
	// 					- a.internal-link
	// 						- span.tree-item-title
	// 				- div.tree-item-children
	// 	*/

	// 	let treeContainerEl = usingDocument.createElement('div');
	// 	let treeHeaderEl = usingDocument.createElement('div');
	// 	let sectionHeaderEl = usingDocument.createElement('span');
	// 	let collapseAllEl = usingDocument.createElement('button');
	// 	let treeScrollAreaEl = usingDocument.createElement('div');

	// 	treeContainerEl.classList.add('tree-container', className);
	// 	treeHeaderEl.classList.add("tree-header");
	// 	sectionHeaderEl.classList.add("sidebar-section-header");
	// 	collapseAllEl.classList.add("clickable-icon", "collapse-tree-button");
	// 	collapseAllEl.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></svg>";
	// 	treeScrollAreaEl.classList.add("tree-scroll-area");

	// 	if (closeAllItems) collapseAllEl.classList.add("is-collapsed");
	// 	if (showNestingIndicator) treeContainerEl.classList.add("mod-nav-indicator");

	// 	treeContainerEl.setAttribute("data-depth", "0");
	// 	sectionHeaderEl.innerText = treeTitle;

	// 	treeContainerEl.appendChild(treeHeaderEl);
	// 	treeContainerEl.appendChild(treeScrollAreaEl);
	// 	treeHeaderEl.appendChild(sectionHeaderEl);
	// 	treeHeaderEl.appendChild(collapseAllEl);

	// 	let treeItems = await this.buildTreeRecursive(tree, usingDocument, minDepth, minCollapsableDepth, closeAllItems);

	// 	for (let item of treeItems)
	// 	{
	// 		treeScrollAreaEl.appendChild(item);
	// 	}

	// 	return treeContainerEl;
	// }

	// private static generateGraphView(usingDocument: Document): HTMLDivElement
	// {
	// 	let graphEl = usingDocument.createElement("div");
	// 	graphEl.className = "graph-view-placeholder";
	// 	graphEl.innerHTML = 
	// 	`
	// 	<div class="graph-view-container">
	// 		<div class="graph-icon graph-expand" role="button" aria-label="Expand" data-tooltip-position="top"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-arrow-up-right"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
	// 		<canvas id="graph-canvas" width="512px" height="512px"></canvas>
	// 	</div>
	// 	`

	// 	return graphEl;
	// }

	//#endregion
}
