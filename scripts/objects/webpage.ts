import { FrontMatterCache, TFile } from "obsidian";
import { Path } from "scripts/utils/path";
import { Downloadable } from "scripts/utils/downloadable";
import { OutlineTree } from "./outline-tree";
import { GraphView } from "./graph-view";
import { Website } from "./website";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { HTMLGeneration } from "scripts/html-generation/html-generation-helpers";
import { Utils } from "scripts/utils/utils";
import { ExportLog } from "scripts/html-generation/render-log";
import { MarkdownRendererAPI } from "scripts/render-api";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";
const { minify } = require('html-minifier-terser');

export class Webpage extends Downloadable
{
	/**
	 * The original file this webpage was exported from
	 */
	public source: TFile;
	public website: Website | undefined;

	/**
	 * The document containing this webpage's HTML
	 */
	public document?: Document;

	/**
	 * The absolute path to the ROOT FOLDER of the export
	 */
	public destinationFolder: Path;

	/**
	 * The external files that need to be downloaded for this file to work NOT including the file itself.
	 */
	public dependencies: Downloadable[] = [];

	public viewType: string = "markdown";

	public isConvertable: boolean = false;

	public exportOptions: MarkdownWebpageRendererAPIOptions;

	public title: string = "";
	public icon: string = "";
	public titleInfo: {title: string, icon: string, isDefaultTitle: boolean, isDefaultIcon: boolean} = {title: "", icon: "", isDefaultTitle: true, isDefaultIcon: true};

	/**
	 * @param file The original markdown file to export
	 * @param destination The absolute path to the FOLDER we are exporting to
	 * @param name The name of the file being exported without the extension
	 * @param website The website this file is part of
	 * @param options The options for exporting this file
	 */
	constructor(file: TFile, destination?: Path, name?: string, website?: Website, options?: MarkdownWebpageRendererAPIOptions)
	{
		if(destination && (!destination.isAbsolute || !destination.isDirectory)) throw new Error("destination must be an absolute directory path: " + destination?.asString);

		super(file.basename, "", Path.emptyPath);
		 
		options = Object.assign(new MarkdownWebpageRendererAPIOptions(), options);

		let isConvertable = MarkdownRendererAPI.isConvertable(file.extension);
		this.filename = name ?? file.basename;
		this.filename += isConvertable ? ".html" : "." + file.extension;
		this.isConvertable = isConvertable;
		this.exportOptions = options;
		this.source = file;
		this.website = website ?? undefined;
		this.destinationFolder = destination ?? Path.vaultPath.joinString("Export");

		if (this.isConvertable) this.document = document.implementation.createHTMLDocument(this.source.basename);

		let sourcePath = new Path(file.path);
		this.relativeDirectory = sourcePath.directory;

		if (this.exportOptions.flattenExportPaths) 
			this.relativeDirectory = Path.emptyPath;

		if (this.exportOptions.webStylePaths)
		{
			this.filename = Path.toWebStyle(this.filename);
			this.relativeDirectory.makeWebStyle();
		}
	}

	/**
	 * The HTML string for the file
	 */
	get html(): string
	{
		let htmlString = "<!DOCTYPE html> " + this.document?.documentElement.outerHTML;
		return htmlString;
	}

	/**
	 * The element that contains the content of the document, aka the markdown-preview-view or view-content
	 */
	get viewElement(): HTMLElement
	{
		if (!this.document) throw new Error("Document is not defined");


		let viewContent = this.document.querySelector(".view-content") as HTMLElement;
		let markdownPreview = this.document.querySelector(".markdown-preview-view") as HTMLElement;

		if (!viewContent && !markdownPreview)
		{
			throw new Error("No content element found");
		}

		if (this.viewType != "markdown") 
			return viewContent ?? markdownPreview;	

		return markdownPreview ?? viewContent;
	}

	/**
	 * The element that determines the size of the document, aka the markdown-preview-sizer
	 */
	get sizerElement(): HTMLDivElement
	{
		if (this.viewType != "markdown") return this.document?.querySelector(".view-content")?.firstChild as HTMLDivElement;

		return this.document?.querySelector(".markdown-preview-sizer") as HTMLDivElement;
	}

	/**
	 * The absolute path that the file will be saved to
	 */
	get exportPath(): Path
	{
		return this.destinationFolder?.join(this.relativePath) ?? Path.vaultPath.join(this.relativePath);
	}

	/**
	 * The relative path from exportPath to rootFolder
	 */
	get pathToRoot(): Path
	{
		return Path.getRelativePath(this.relativePath, new Path(this.relativePath.workingDirectory), true).makeUnixStyle();
	}

	get tags(): string[]
	{
		let tagCaches = app.metadataCache.getFileCache(this.source)?.tags?.values();
		if (tagCaches)
		{
			let tags = Array.from(tagCaches).map((tag) => tag.tag);
			return tags;
		}

		return [];
	}

	get headings(): {heading: string, level: number, headingEl: HTMLElement}[]
	{
		let headers: {heading: string, level: number, headingEl: HTMLElement}[] = [];
		if (this.document)
		{
			this.document.querySelectorAll(".heading").forEach((headerEl: HTMLElement) =>
			{
				let level = parseInt(headerEl.tagName[1]);
				if (headerEl.closest("[class^='block-language-']") || headerEl.closest(".markdown-embed.inline-embed")) level += 6;
				let heading = headerEl.getAttribute("data-heading") ?? headerEl.innerText ?? "";
				headers.push({heading, level, headingEl: headerEl});
			});
		}

		return headers;
	}

	get aliases(): string[]
	{
		let aliases = this.frontmatter?.aliases ?? [];
		return aliases;
	}

	get description(): string
	{
		return this.frontmatter["description"] || this.frontmatter["summary"] || "";
	}

	get author(): string
	{
		return this.frontmatter["author"] || this.exportOptions.authorName || "";
	}

	get fullURL(): string
	{
		let url = Path.joinStrings(this.exportOptions.siteURL ?? "", this.relativePath.asString).makeUnixStyle().asString;
		return url;
	}

	get metadataImageURL(): string | undefined
	{
		let mediaPathStr = this.viewElement.querySelector("img")?.getAttribute("src") ?? "";
		let hasMedia = mediaPathStr.length > 0;
		if (!hasMedia) return undefined;

		if (!mediaPathStr.startsWith("http") && !mediaPathStr.startsWith("data:"))
		{
			let mediaPath = Path.joinStrings(this.exportOptions.siteURL ?? "", mediaPathStr);
			mediaPathStr = mediaPath.asString;
		}

		return mediaPathStr;
	}

	get frontmatter(): FrontMatterCache
	{
		let frontmatter = app.metadataCache.getFileCache(this.source)?.frontmatter ?? {};
		return frontmatter;
	}

	public getCompatibilityContent(): string
	{
		let oldContent = this.sizerElement.outerHTML;
		let compatContent = this.sizerElement;

		compatContent.querySelectorAll("script, style, .collapse-indicator, .callout-icon, .icon, a.tag").forEach((script) => script.remove());
		
		function moveChildrenOut(element: HTMLElement)
		{
			let children = Array.from(element.children);
			element.parentElement?.append(...children);
			element.remove();
		}

		let headingTreeElements = Array.from(compatContent.querySelectorAll(".heading-wrapper"));
		headingTreeElements.forEach(moveChildrenOut);
		headingTreeElements = Array.from(compatContent.querySelectorAll(".heading-children"));
		headingTreeElements.forEach(moveChildrenOut);
		let lowDivs = Array.from(compatContent.children).filter((el) => el.tagName == "DIV" && el.childElementCount == 1);
		lowDivs.forEach(moveChildrenOut);

		let all = Array.from(compatContent.querySelectorAll("*"));
		all.forEach((el: HTMLElement) => 
		{
			// give default var values
			let fillDefault = el.tagName == "text" ? "#181818" : "white";
			el.style.fill = el.style.fill.replace(/var\(([\w -]+)\)/g, `var($1, ${fillDefault})`);
			el.style.stroke = el.style.stroke.replace(/var\(([\w -]+)\)/g, "var($1, #181818)");
			el.style.backgroundColor = el.style.backgroundColor.replace(/var\(([\w -]+)\)/g, "var($1, white)");
			el.style.color = el.style.color.replace(/var\(([\w -]+)\)/g, "var($1, #181818)");

			el.removeAttribute("id");
			el.removeAttribute("class");
			el.removeAttribute("font-family");
		});

		let result = compatContent.innerHTML;
		compatContent.innerHTML = oldContent;

		result = result.replaceAll("<", " <");

		return result;
	}

	public async create(): Promise<Webpage | undefined>
	{
		this.titleInfo = await Website.getTitleAndIcon(this.source);
		this.title = this.titleInfo.title;
		this.icon = this.titleInfo.icon;


		if (!this.isConvertable)
		{
			this.content = await new Path(this.source.path).readFileBuffer() ?? "";
			this.modifiedTime = this.source.stat.mtime;
			return this;
		}

		if (!this.document) return this;

		let webpageWithContent = await this.populateDocument();
		if(!webpageWithContent)
		{
			if (!MarkdownRendererAPI.checkCancelled()) ExportLog.error(this.source, "Failed to create webpage");
			return;
		}

		if (this.exportOptions.addHeadTag) 
			await this.addHead();
		
		if (this.exportOptions.addTitle)
			await this.addTitle();

		if (this.exportOptions.addSidebars)
		{
			let innerContent = this.document.body.innerHTML;
			this.document.body.innerHTML = "";
			let layout = this.generateWebpageLayout(innerContent);
			this.document.body.appendChild(layout.container);
			let rightSidebar = layout.right;
			let leftSidebar = layout.left;

			// inject graph view
			if (this.exportOptions.addGraphView)
			{
				GraphView.generateGraphEl(rightSidebar);
			}

			// inject outline
			if (this.exportOptions.addOutline)
			{
				let headerTree = new OutlineTree(this, 1);
				headerTree.class = "outline-tree";
				headerTree.title = "Table Of Contents";
				headerTree.showNestingIndicator = false;
				headerTree.generateWithItemsClosed = this.exportOptions.startOutlineCollapsed === true;
				headerTree.minCollapsableDepth = this.exportOptions.minOutlineCollapsibleLevel ?? 2;
				await headerTree.generateTreeWithContainer(rightSidebar);
			}

			// inject darkmode toggle
			if (this.exportOptions.addThemeToggle)
			{
				HTMLGeneration.createThemeToggle(layout.leftBar);
			}

			// inject search bar
			// TODO: don't hardcode searchbar html
			if (this.exportOptions.addSearch)
			{
				let searchbarHTML = `<div class="search-input-container"><input enterkeyhint="search" type="search" spellcheck="false" placeholder="Search..."><div class="search-input-clear-button" aria-label="Clear search"></div></div>`;
				leftSidebar.createDiv().outerHTML = searchbarHTML;
			}

			// inject file tree
			if (this.website && this.exportOptions.addFileNavigation)
			{
				leftSidebar.createDiv().outerHTML = this.website.fileTreeAsset.getHTML(this.exportOptions);
				
				// if the file will be opened locally, un-collapse the tree containing this file
				if (this.exportOptions.openNavFileLocation)
				{
					let sidebar = leftSidebar.querySelector(".file-tree");
					let unixPath = this.relativePath.copy.makeUnixStyle().asString;
					let fileElement: HTMLElement = sidebar?.querySelector(`[href="${unixPath}"]`) as HTMLElement;
					fileElement = fileElement?.closest(".tree-item") as HTMLElement;
					while (fileElement)
					{
						fileElement?.classList.remove("is-collapsed");
						let children = fileElement?.querySelector(".tree-item-children") as HTMLElement;
						if(children) children.style.display = "block";
						fileElement = fileElement?.parentElement?.closest(".tree-item") as HTMLElement;
					}
				}
			}
		}

		if (this.exportOptions.includeJS)
		{
			let bodyScript = this.document.body.createEl("script");
			bodyScript.setAttribute("defer", "");
			bodyScript.innerText = AssetHandler.themeLoadJS.content.toString();
			this.document.body.prepend(bodyScript);
		}

		this.content = this.html;

		return this;
	}

	private async populateDocument(): Promise<Webpage | undefined>
	{
		if (!this.isConvertable || !this.document) return this;

		let body = this.document.body;
		if (this.exportOptions.addBodyClasses)
			body.setAttribute("class", Website.validBodyClasses || await HTMLGeneration.getValidBodyClasses(false));
		
		let options = {...this.exportOptions, container: body};
		let renderInfo = await MarkdownRendererAPI.renderFile(this.source, options);
		let contentEl = renderInfo?.contentEl;
		this.viewType = renderInfo?.viewType ?? "markdown";

		if (!contentEl) return undefined;
		if (MarkdownRendererAPI.checkCancelled()) return undefined;

		if (this.viewType == "markdown")
		{ 
			contentEl.classList.toggle("allow-fold-headings", this.exportOptions.allowFoldingHeadings);
			contentEl.classList.toggle("allow-fold-lists", this.exportOptions.allowFoldingLists);
			contentEl.classList.add("is-readable-line-width");
		}

		if(this.sizerElement) this.sizerElement.style.paddingBottom = "";

		// modify links to work outside of obsidian (including relative links)
		if (this.exportOptions.fixLinks)
			this.convertLinks();
		
		// add math styles to the document. They are here and not in <head> because they are unique to each document
		if (this.exportOptions.addMathjaxStyles)
		{
			let mathStyleEl = document.createElement("style");
			mathStyleEl.id = "MJX-CHTML-styles";
			await AssetHandler.mathjaxStyles.load(this.exportOptions);
			mathStyleEl.innerHTML = AssetHandler.mathjaxStyles.content;
			this.viewElement.prepend(mathStyleEl);
		}

		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (this.exportOptions.inlineMedia) 
			await this.inlineMedia();
		else 
			outlinedImages = await this.exportMedia();

		this.dependencies.push(...outlinedImages);

		if(this.exportOptions.webStylePaths)
		{
			this.dependencies.forEach((file) =>
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDirectory = file.relativeDirectory?.makeWebStyle();
			});
		}

		return this;
	}
	
	private generateWebpageLayout(middleContent: HTMLElement | Node | string): {container: HTMLElement, left: HTMLElement, leftBar: HTMLElement, right: HTMLElement, rightBar: HTMLElement, center: HTMLElement}
	{
		if (!this.document) throw new Error("Document is not defined");

		/*
		- div.webpage-container

			- div.sidebar.sidebar-left
				- div.sidebar-content
				- div.sidebar-topbar
					- div.clickable-icon.sidebar-collapse-icon
						- svg

			- div.document-container

			- div.sidebar.sidebar-right
				- div.sidebar-content
				- div.sidebar-topbar
						- div.clickable-icon.sidebar-collapse-icon
							- svg
				
		*/

		let collapseSidebarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`

		let pageContainer = this.document.createElement("div");
		let leftSidebar = this.document.createElement("div");
		let leftSidebarHandle = this.document.createElement("div");
		let leftContent = this.document.createElement("div");
		let leftTopbar = this.document.createElement("div");
		let leftTopbarContent = this.document.createElement("div");
		let leftCollapseIcon = this.document.createElement("div");
		let documentContainer = this.document.createElement("div");
		let rightSidebar = this.document.createElement("div");
		let rightSidebarHandle = this.document.createElement("div");
		let rightContent = this.document.createElement("div");
		let rightTopbar = this.document.createElement("div");
		let rightTopbarContent = this.document.createElement("div");
		let rightCollapseIcon = this.document.createElement("div");

		pageContainer.setAttribute("class", "webpage-container workspace");

		leftSidebar.setAttribute("class", "sidebar-left sidebar");
		leftSidebarHandle.setAttribute("class", "sidebar-handle");
		leftContent.setAttribute("class", "sidebar-content");
		leftTopbar.setAttribute("class", "sidebar-topbar");
		leftTopbarContent.setAttribute("class", "topbar-content");
		leftCollapseIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");

		documentContainer.setAttribute("class", "document-container markdown-reading-view");
		if (this.exportOptions.includeJS) documentContainer.classList.add("hide"); // if js included, hide the content until the js is loaded

		rightSidebar.setAttribute("class", "sidebar-right sidebar");
		rightSidebarHandle.setAttribute("class", "sidebar-handle");
		rightContent.setAttribute("class", "sidebar-content");
		rightTopbar.setAttribute("class", "sidebar-topbar");
		rightTopbarContent.setAttribute("class", "topbar-content");
		rightCollapseIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");

		pageContainer.appendChild(leftSidebar);
		pageContainer.appendChild(documentContainer);
		pageContainer.appendChild(rightSidebar);

		if (this.exportOptions.allowResizeSidebars && this.exportOptions.includeJS) leftSidebar.appendChild(leftSidebarHandle);
		leftSidebar.appendChild(leftTopbar);
		leftSidebar.appendChild(leftContent);
		leftTopbar.appendChild(leftTopbarContent);
		leftTopbar.appendChild(leftCollapseIcon);
		leftCollapseIcon.innerHTML = collapseSidebarIcon;

		documentContainer.innerHTML += middleContent instanceof HTMLElement ? middleContent.outerHTML : middleContent.toString();

		if (this.exportOptions.allowResizeSidebars && this.exportOptions.includeJS) rightSidebar.appendChild(rightSidebarHandle);
		rightSidebar.appendChild(rightTopbar);
		rightSidebar.appendChild(rightContent);
		rightTopbar.appendChild(rightTopbarContent);
		rightTopbar.appendChild(rightCollapseIcon);
		rightCollapseIcon.innerHTML = collapseSidebarIcon;

		let leftSidebarScript = leftSidebar.createEl("script");
		let rightSidebarScript = rightSidebar.createEl("script");
		leftSidebarScript.setAttribute("defer", "");
		rightSidebarScript.setAttribute("defer", "");
		leftSidebarScript.innerHTML = `let ls = document.querySelector(".sidebar-left"); ls.classList.add("is-collapsed"); if (window.innerWidth > 768) ls.classList.remove("is-collapsed"); ls.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-left-width"));`;
		rightSidebarScript.innerHTML = `let rs = document.querySelector(".sidebar-right"); rs.classList.add("is-collapsed"); if (window.innerWidth > 768) rs.classList.remove("is-collapsed"); rs.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-right-width"));`;

		return {container: pageContainer, left: leftContent, leftBar: leftTopbarContent, right: rightContent, rightBar: rightTopbarContent, center: documentContainer};
	}

	private async addTitle() 
	{
		if (!this.document || !this.sizerElement || this.viewType != "markdown") return;
		
		// remove inline title
		let inlineTitle = this.document.querySelector(".inline-title");
		inlineTitle?.remove();

		// remove make.md title
		let makeTitle = this.document.querySelector(".mk-inline-context");
		makeTitle?.remove();

		// remove mod-header
		let modHeader = this.document.querySelector(".mod-header");
		modHeader?.remove();

		// if the first header element is basically the same as the title, use it's text and remove it
		let firstHeader = this.document.querySelector(":is(h1, h2, h3, h4, h5, h6):not(.markdown-embed-content *)");
		if (firstHeader)
		{
			let firstHeaderText = (firstHeader.getAttribute("data-heading") ?? firstHeader.textContent)?.toLowerCase() ?? "";
			let lowerTitle = this.title.toLowerCase();
			let titleDiff = Utils.levenshteinDistance(firstHeaderText, lowerTitle) / lowerTitle.length;
			let basenameDiff = Utils.levenshteinDistance(firstHeaderText, this.source.basename.toLowerCase()) / this.source.basename.length;
			let difference = Math.min(titleDiff, basenameDiff);

			if ((firstHeader.tagName == "H1" && difference < 0.2) || (firstHeader.tagName == "H2" && difference < 0.1))
			{
				if(this.titleInfo.isDefaultTitle) 
				{
					firstHeader.querySelector(".heading-collapse-indicator")?.remove();
					this.title = firstHeader.innerHTML;
					ExportLog.log(`Using "${firstHeaderText}" header because it was very similar to the file's title.`);
				}
				else
				{
					ExportLog.log(`Replacing "${firstHeaderText}" header because it was very similar to the file's title.`);
				}
				firstHeader.remove();
			}
			else if (firstHeader.tagName == "H1")
			{
				// if the difference is too large but the first header is an h1 and it's the first element in the body, use it as the title
				let headerEl = firstHeader.closest(".heading-wrapper") ?? firstHeader;
				let headerParent = headerEl.parentElement;
				if (headerParent && headerParent.classList.contains("markdown-preview-sizer"))
				{
					let childPosition = Array.from(headerParent.children).indexOf(headerEl);
					if (childPosition <= 2)
					{
						if(this.titleInfo.isDefaultTitle) 
						{
							firstHeader.querySelector(".heading-collapse-indicator")?.remove();
							this.title = firstHeader.innerHTML;
							ExportLog.log(`Using "${firstHeaderText}" header as title because it was H1 at the top of the page`);
						}
						else
						{
							ExportLog.log(`Replacing "${firstHeaderText}" header because it was H1 at the top of the page`);
						}

						firstHeader.remove();
					}
				}
			}
		}

		// remove banner header
		this.document.querySelector(".banner-header")?.remove();

		// Create h1 inline title
		let titleEl = this.document.createElement("h1");
		titleEl.classList.add("page-title", "heading");
		if (this.document?.body.classList.contains("show-inline-title")) titleEl.classList.add("inline-title");
		titleEl.id = this.title;

		let pageIcon = undefined;
		// Create a div with icon
		if ((this.icon != "" && !this.titleInfo.isDefaultIcon))
		{
			pageIcon = this.document.createElement("div");
			pageIcon.id = "webpage-icon";
		}
		
		// Insert title into the title element
		MarkdownRendererAPI.renderMarkdownSimpleEl(this.title, titleEl);
		if (pageIcon) 
		{
			MarkdownRendererAPI.renderMarkdownSimpleEl(this.icon, pageIcon);
			titleEl.prepend(pageIcon);
		}

		// Insert title into the document
		this.sizerElement.prepend(titleEl);
	}

	private async addHead()
	{
		if (!this.document) return;

		let rootPath = this.pathToRoot.copy.makeWebStyle(this.exportOptions.webStylePaths).asString;
		let description = this.description || (this.exportOptions.siteName + " - " + this.titleInfo.title);
		let head =
		`
		<title>${this.titleInfo.title}</title>
		<base href="${rootPath}/">
		<meta id="root-path" root-path="${rootPath}/">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">
		<meta charset="UTF-8">
		<meta name="description" content="${description}">
		<meta property="og:title" content="${this.titleInfo.title}">
		<meta property="og:description" content="${description}">
		<meta property="og:type" content="website">
		<meta property="og:url" content="${this.fullURL}">
		<meta property="og:image" content="${this.metadataImageURL}">
		<meta property="og:site_name" content="${this.exportOptions.siteName}">
		`;

		if (this.author && this.author != "")
		{
			head += `<meta name="author" content="${this.author}">`;
		}

		if (this.exportOptions.addRSS)
		{
			let rssURL = Path.joinStrings(this.exportOptions.siteURL ?? "", this.website?.rssPath ?? "").makeUnixStyle().asString;
			head += `<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${rssURL}">`;
		}

		head += AssetHandler.getHeadReferences(this.exportOptions);

		this.document.head.innerHTML = head;
	}

	private convertLinks()
	{
		if (!this.document) return;

		this.document.querySelectorAll("a.internal-link").forEach((linkEl) =>
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

				let targetFile = app.metadataCache.getFirstLinkpathDest(target, this.source.path);
				if (!targetFile) return;

				let targetPath = new Path(targetFile.path);
				if (MarkdownRendererAPI.isConvertable(targetPath.extensionName)) targetPath.setExtension("html");
				targetPath.makeWebStyle(this.exportOptions.webStylePaths);

				let finalHref = targetPath.makeUnixStyle() + targetHeader.replaceAll(" ", "_");
				linkEl.setAttribute("href", finalHref);
			}
		});

		this.document.querySelectorAll("a.footnote-link").forEach((linkEl) =>
		{
			linkEl.setAttribute("target", "_self");
		});

		this.document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((headerEl) =>
		{
			// convert the data-heading to the id
			headerEl.setAttribute("id", (headerEl.getAttribute("data-heading") ?? headerEl.textContent)?.replaceAll(" ", "_") ?? "");
		});
	}

	private async inlineMedia()
	{
		if (!this.document) return;

		let elements = Array.from(this.document.querySelectorAll("[src]:not(head [src])"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			let filePath = Webpage.getMediaPath(rawSrc, this.source.path);
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

	private async exportMedia(): Promise<Downloadable[]>
	{
		if (!this.document) return [];

		let downloads: Downloadable[] = [];

		let elements = Array.from(this.document.querySelectorAll("[src]:not(head [src]):not(span)"));

		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			let filePath = Webpage.getMediaPath(rawSrc, this.source.path);
			if (filePath.isEmpty || filePath.isDirectory || 
				filePath.isAbsolute || MarkdownRendererAPI.isConvertable(filePath.extension)) 
				continue;

			let exportLocation = filePath.copy;


			// if the media is inside the exported folder then keep it in the same place
			let sourceFolder = new Path(this.source.path).directory;
			let mediaPathInExport = Path.getRelativePath(sourceFolder, filePath);
			if (mediaPathInExport.asString.startsWith(".."))
			{
				// if path is outside of the vault, outline it into the media folder
				exportLocation = AssetHandler.mediaPath.joinString(filePath.fullName);
			}

			exportLocation = exportLocation.makeWebStyle(this.exportOptions.webStylePaths).makeUnixStyle();
			mediaEl.setAttribute("src", exportLocation.asString);

			let data = await filePath.readFileBuffer();
			if (data)
			{
				let imageDownload = new Downloadable(exportLocation.fullName, data, exportLocation.directory.makeForceFolder());
				let imageStat = filePath.stat;
				if (imageStat) imageDownload.modifiedTime = imageStat.mtimeMs;
				downloads.push(imageDownload);
			}
		};

		return downloads;
	}

	private static getMediaPath(src: string, exportingFilePath: string): Path
	{
		// @ts-ignore
		let pathString = "";
		if (src.startsWith("app://"))
		{
			let fail = false;
			try
			{
				// @ts-ignore
				pathString = app.vault.resolveFileUrl(src)?.path ?? "";
				if (pathString == "") fail = true;
			}
			catch
			{
				fail = true;
			}

			if(fail)
			{
				pathString = src.replaceAll("app://", "").replaceAll("\\", "/");
				pathString = pathString.replaceAll(pathString.split("/")[0] + "/", "");
				pathString = Path.getRelativePathFromVault(new Path(pathString), true).asString;
				ExportLog.log(pathString, "Fallback path parsing:");
			}
		}
		else
		{
			pathString = app.metadataCache.getFirstLinkpathDest(src, exportingFilePath)?.path ?? "";
		}

		pathString = pathString ?? "";

		return new Path(pathString);
	}
}
