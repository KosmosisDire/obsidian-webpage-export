import { FrontMatterCache, TFile } from "obsidian";
import { Path } from "scripts/utils/path";
import { Attachment } from "scripts/utils/downloadable";
import { OutlineTree } from "../component-generators/outline-tree";
import { Website } from "./website";
import { AssetHandler } from "scripts/assets-system/asset-handler";
import { HTMLGeneration } from "scripts/render-api/html-generation-helpers";
import { Utils } from "scripts/utils/utils";
import { ExportLog } from "scripts/render-api/render-api";
import { MarkdownRendererAPI } from "scripts/render-api/render-api";
import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options";
import { SearchInput } from "scripts/component-generators/search-input";

export class Webpage extends Attachment
{
	public get source(): TFile
	{
		return super.source as TFile;
	}

	public set source(file: TFile)
	{
		super.source = file;
	}

	public website: Website;
	public document: Document | undefined = undefined;
	public attachments: Attachment[] = [];
	public viewType: string = "markdown";
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
	constructor(file: TFile, filename: string, website: Website, options?: MarkdownWebpageRendererAPIOptions)
	{
		if (!MarkdownRendererAPI.isConvertable(file.extension)) throw new Error("File type not supported: " + file.extension);

		let targetPath = website.getTargetPathForFile(file, filename);
		options = Object.assign(new MarkdownWebpageRendererAPIOptions(), options);

		super("", targetPath, file, options);
		this.targetPath.setExtension("html");
		this.exportOptions = options;
		this.source = file;
		this.website = website;

		if (this.exportOptions.flattenExportPaths) 
			this.targetPath.parent = Path.emptyPath;
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
	get viewElement(): HTMLElement | undefined
	{
		if (!this.document)
		{
			return undefined;
		}

		let viewContent = this.document.querySelector(".view-content") as HTMLElement;
		let markdownPreview = this.document.querySelector(".markdown-preview-view") as HTMLElement;

		if (this.viewType != "markdown") 
			return viewContent ?? markdownPreview;

		return markdownPreview ?? viewContent;
	}

	/**
	 * The element that determines the size of the document, aka the markdown-preview-sizer
	 */
	get sizerElement(): HTMLElement | undefined
	{
		if (this.viewType != "markdown") return this.document?.querySelector(".view-content")?.firstChild as HTMLElement;
		return this.document?.querySelector(".markdown-preview-sizer") as HTMLElement;
	}

	/**
	 * The relative path from exportPath to rootFolder
	 */
	get pathToRoot(): Path
	{
		let ptr = Path.getRelativePath(this.targetPath, new Path(this.targetPath.workingDirectory), true);
		return ptr;
	}

	get tags(): string[]
	{
		let tagCaches = app.metadataCache.getFileCache(this.source)?.tags?.values();
		let tags = [];
		if (tagCaches)
		{
			tags.push(...Array.from(tagCaches).map((tag) => tag.tag));
		}

		let frontmatterTags = this.frontmatter?.tags ?? [];
		tags.push(...frontmatterTags);

		return tags;
	}

	get headings(): {heading: string, level: number, id: string, headingEl: HTMLElement}[]
	{
		let headers: {heading: string, level: number, id: string, headingEl: HTMLElement}[] = [];
		if (this.document)
		{
			this.document.querySelectorAll(".heading").forEach((headerEl: HTMLElement) =>
			{
				let level = parseInt(headerEl.tagName[1]);
				if (headerEl.closest("[class^='block-language-']") || headerEl.closest(".markdown-embed.inline-embed")) level += 6;
				let heading = headerEl.getAttribute("data-heading") ?? headerEl.innerText ?? "";
				headers.push({heading, level, id: headerEl.id, headingEl: headerEl});
			});
		}

		return headers;
	}

	public async getStrippedHeadings(): Promise<{ heading: string; level: number; id: string; }[]>
	{
		let headings = this.headings.map((header) => {return {heading: header.heading, level: header.level, id: header.id}});
		
		for (let header of headings)
		{
			let tempContainer = document.body.createDiv();
			await MarkdownRendererAPI.renderMarkdownSimpleEl(header.heading, tempContainer);
			// @ts-ignore
			let h = tempContainer.innerText ?? header.heading;
			header.heading = h;
			tempContainer.remove();
		}

		return headings;
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

	get descriptionOrShortenedContent(): string
	{
		let description = this.description;

		if (!description)
		{
			if(!this.viewElement) return "";
			let content = this.viewElement.cloneNode(true) as HTMLElement;
			content.querySelectorAll(`h1, h2, h3, h4, h5, h6, .mermaid, table, mjx-container, style, script, 
.mod-header, .mod-footer, .metadata-container, .frontmatter, img[src^="data:"]`).forEach((heading) => heading.remove());

			// update image links
			content.querySelectorAll("[src]").forEach((el: HTMLImageElement) => 
			{
				let src = el.src;
				if (!src) return;
				if (src.startsWith("http") || src.startsWith("data:")) return;
				src = src.replace("app://obsidian", "");
				src = src.replace(".md", "");
				let path = Path.joinStrings(this.exportOptions.siteURL ?? "", src);
				el.src = path.path;
			});

			// update normal links
			content.querySelectorAll("[href]").forEach((el: HTMLAnchorElement) => 
			{
				let href = el.href;
				if (!href) return; 
				if (href.startsWith("http") || href.startsWith("data:")) return;
				href = href.replace("app://obsidian", "");
				href = href.replace(".md", "");
				let path = Path.joinStrings(this.exportOptions.siteURL ?? "", href);
				el.href = path.path;
			});

			function keepTextLinksImages(element: HTMLElement) 
			{
				let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
				let node;
				let nodes = [];
				while (node = walker.nextNode()) 
				{
					if (node.nodeType == Node.ELEMENT_NODE)
					{
						let element = node as HTMLElement;
						if (element.tagName == "A" || element.tagName == "IMG" || element.tagName == "BR")
						{
							nodes.push(element);
						}

						if (element.tagName == "DIV")
						{
							let classes = element.parentElement?.classList;
							if (classes?.contains("heading-children") || classes?.contains("markdown-preview-sizer"))
							{
								nodes.push(document.createElement("br"));
							}
						}

						if (element.tagName == "LI") 
						{
							nodes.push(document.createElement("br"));
						}
					}
					else
					{
						if (node.parentElement?.tagName != "A" && node.parentElement?.tagName != "IMG")
							nodes.push(node);
					}
				}

				element.innerHTML = "";
				element.append(...nodes);
			}

			keepTextLinksImages(content);
			description = content.innerHTML;
			content.remove();
		}
		
		// add tags to top of description
		let tags = this.tags.map((tag) => `<a class="tag" href="${this.exportOptions.siteURL}?query=tag:${tag.replace("#", "")}">${tag.startsWith("#") ? tag : "#" + tag}</a>`).join(" ");
		if (tags.length > 0)
		{
			let tagContainer = document.body.createDiv();
			tagContainer.innerHTML = tags;
			tagContainer.style.display = "flex";
			tagContainer.style.gap = "0.4em";

			tagContainer.querySelectorAll("a.tag").forEach((tag: HTMLElement) => 
			{
				tag.style.backgroundColor = "#046c74";
				tag.style.color = "white";
				tag.style.fontWeight = "700";
				tag.style.border = "none";
				tag.style.borderRadius = "1em";
				tag.style.padding = "0.2em 0.5em";
			});

			description = description.replaceAll(/(<br>\s*?){2,}/gi, "<br>").trim();
			if(description.startsWith("<br>")) description = description.substring(4);

			description = tagContainer.innerHTML + " <br> " + description;
			tagContainer.remove();
		}

		// remove multiple whitespace characters in a row
		description = description.replace(/\s{2,}/g, " ");

		return description ?? "";
	}

	get author(): string
	{
		return this.frontmatter["author"] || this.exportOptions.authorName || "";
	}

	get fullURL(): string
	{
		let url = Path.joinStrings(this.exportOptions.siteURL ?? "", this.targetPath.path).path;
		return url;
	}

	get backlinks(): Webpage[]
	{
		// @ts-ignore
		let backlinks = Object.keys(app.metadataCache.getBacklinksForFile(this.source)?.data) ?? [];
		let linkedWebpages = backlinks.map((path) => this.website.index.getWebpage(path)) as Webpage[];
		linkedWebpages = linkedWebpages.filter((page) => page != undefined);
		return linkedWebpages;
	}

	get coverImageURL(): string | undefined
	{
		if (!this.viewElement) return undefined;
		let mediaPathStr = this.viewElement.querySelector("img")?.getAttribute("src") ?? "";
		if (mediaPathStr.startsWith("data:")) return undefined;
		let hasMedia = mediaPathStr.length > 0;
		if (!hasMedia) return undefined;

		if (!mediaPathStr.startsWith("http") && !mediaPathStr.startsWith("data:"))
		{
			let mediaPath = Path.joinStrings(this.exportOptions.siteURL ?? "", mediaPathStr);
			mediaPathStr = mediaPath.path;
		}

		return mediaPathStr;
	}

	get frontmatter(): FrontMatterCache
	{
		let frontmatter = app.metadataCache.getFileCache(this.source)?.frontmatter ?? {};
		return frontmatter;
	}

	get srcLinks(): string[]
	{
		if (!this.document) return [];
		let srcEls = this.srcLinkElements.map((item) => item.getAttribute("src")) as string[];
		return srcEls;
	}
	get hrefLinks(): string[]
	{
		if (!this.document) return [];
		let hrefEls = this.hrefLinkElements.map((item) => item.getAttribute("href")) as string[];
		return hrefEls;
	}
	get srcLinkElements(): HTMLImageElement[]
	{
		if (!this.document) return [];
		let srcEls = (Array.from(this.document.querySelectorAll("[src]:not(head *):not(span, div)")) as HTMLImageElement[]);
		return srcEls;
	}
	get hrefLinkElements(): HTMLAnchorElement[]
	{
		if (!this.document) return [];
		let hrefEls = (Array.from(this.document.querySelectorAll("[href]:not(head *):not(span, div)")) as HTMLAnchorElement[]);
		return hrefEls;
	}

	public async build(): Promise<Webpage | undefined>
	{
		if (!this.document) throw new Error("Must populate the document before building the webpage");

		// get title and icon
		this.titleInfo = await Website.getTitleAndIcon(this.source);
		this.title = this.titleInfo.title;
		this.icon = this.titleInfo.icon;
		let iconRenderContainer = document.body.createDiv();
		await MarkdownRendererAPI.renderMarkdownSimpleEl(this.icon, iconRenderContainer);
		this.icon = iconRenderContainer.innerHTML;
		iconRenderContainer.remove();

		if (this.exportOptions.fixLinks)
		{
			this.remapLinks();
			this.remapEmbedLinks();
		}

		if (this.exportOptions.inlineMedia) 
			await this.inlineMedia();

		if (this.exportOptions.addHeadTag) 
			await this.addHead();
		
		if (this.exportOptions.addTitle)
			await this.addTitle();

		// add math styles to the document. They are here and not in <head> because they are unique to each document
		if (this.exportOptions.addMathjaxStyles)
		{
			let mathStyleEl = document.createElement("style");
			mathStyleEl.id = "MJX-CHTML-styles";
			await AssetHandler.mathjaxStyles.load();
			mathStyleEl.innerHTML = AssetHandler.mathjaxStyles.data as string;
			this.viewElement?.prepend(mathStyleEl);
		}

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
				this.website.globalGraph.insert(rightSidebar);
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
				await headerTree.insert(rightSidebar);
			}

			// inject darkmode toggle
			if (this.exportOptions.addThemeToggle)
			{
				HTMLGeneration.createThemeToggle(layout.leftBar);
			}

			// inject search bar
			if (this.exportOptions.addSearch)
			{
				new SearchInput().insert(leftSidebar);
			}

			// inject file tree
			if (this.website && this.exportOptions.addFileNavigation)
			{
				leftSidebar.createDiv().outerHTML = this.website.fileTreeAsset.getHTML(this.exportOptions);
				
				// if the file will be opened locally, un-collapse the tree containing this file
				if (this.exportOptions.openNavFileLocation)
				{
					let sidebar = leftSidebar.querySelector(".nav-files-container");
					let unixPath = this.targetPath.path;
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
			bodyScript.innerText = AssetHandler.themeLoadJS.data.toString();
			this.document.body.prepend(bodyScript);
		}

		this.data = this.html;

		return this;
	}

	public async populateDocument(): Promise<Webpage | undefined>
	{
		this.document = document.implementation.createHTMLDocument(this.title);
		if (!this.document)
		{
			ExportLog.error("Failed to create HTML document");
			return undefined;
		}
		
		let body = this.document.body;
		if (this.exportOptions.addBodyClasses)
			body.setAttribute("class", this.website.bodyClasses || await HTMLGeneration.getValidBodyClasses(false));
		
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

			let cssclasses = this.frontmatter['cssclasses'];
			if (cssclasses && cssclasses.length > 0) contentEl.classList.add(...cssclasses);
		}

		if(this.sizerElement) this.sizerElement.style.paddingBottom = "";

		this.document.body.innerHTML = this.document.body.innerHTML;

		return this;
	}

	public async getAttachments(): Promise<Attachment[]>
	{
		if (!this.document) return [];

		let sources = this.srcLinks;
		for (let src of sources)
		{
			if ((!src.startsWith("app://") && /\w+:(\/\/|\\\\)/.exec(src)) || // link is a URL except for app://
				src.startsWith("data:")) // link is a data URL
			continue;

			let sourcePath = this.website.getFilePathFromSrc(src, this.source.path).pathname;
			let attachment = this.attachments.find((attachment) => attachment.sourcePath == sourcePath);
			attachment ??= this.website.index.getFile(sourcePath);
			attachment ??= await this.website.createAttachmentFromSrc(src, this.source);
			
			if (!sourcePath || !attachment)
			{
				ExportLog.warning("Attachment source not found: " + src);
				continue;
			}

			if (!this.attachments.includes(attachment)) 
				this.attachments.push(attachment);
		}

		return this.attachments;
	}

	private headingTextToID(heading: string | null): string
	{
		return heading?.replaceAll(" ", "_").replaceAll(":", "") ?? "";
	}

	public resolveLink(link: string | null): string | undefined
	{
		if (!link) return "";
		if ((!link.startsWith("app://") && /\w+:(\/\/|\\\\)/.exec(link)))
			return;
		if (link.startsWith("data:"))
			return;
		if (link?.startsWith("?")) 
			return;

		if (link.startsWith("#"))
		{
			let hrefValue = this.headingTextToID(link);
			if (!this.exportOptions.relativeHeaderLinks)
				hrefValue = this.targetPath + hrefValue;
			
			return hrefValue;
		}

		let linkSplit = link.split("#")[0].split("?")[0];
		let attachmentPath = this.website.getFilePathFromSrc(linkSplit, this.source.path).pathname;
		let attachment = this.website.index.getFile(attachmentPath);
		if (!attachment)
		{
			return;
		}

		let hash = link.split("#")[1] ?? "";
		if (hash != "") hash = "#" + hash;
		if (attachment.targetPath.extensionName == "html") hash = this.headingTextToID(hash);
		return attachment.targetPath.path + hash;
	}

	private remapLinks()
	{
		if (!this.document) return;

		this.document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((headerEl) =>
		{
			// convert the data-heading to the id
			headerEl.setAttribute("id", this.headingTextToID(headerEl.getAttribute("data-heading") ?? headerEl.textContent));
		});

		let links = this.hrefLinkElements;
		for (let link of links)
		{
			let href = link.getAttribute("href");
			let newHref = this.resolveLink(href);
			link.setAttribute("href", newHref ?? href ?? "");
			link.setAttribute("target", "_self");
			link.classList.toggle("is-unresolved", !newHref);
		}
	}

	private remapEmbedLinks()
	{
		if (!this.document) return;

		let links = this.srcLinkElements;
		for (let link of links)
		{
			let src = link.getAttribute("src");
			let newSrc = this.resolveLink(src);
			link.setAttribute("src", newSrc ?? src ?? "");
			link.setAttribute("target", "_self");
			link.classList.toggle("is-unresolved", !newSrc);
		}
	}

	private generateWebpageLayout(middleContent: HTMLElement | Node | string): {container: HTMLElement, left: HTMLElement, leftBar: HTMLElement, right: HTMLElement, rightBar: HTMLElement, center: HTMLElement}
	{
		if (!this.document) throw new Error("Document is not defined");

		/*
		- div.website-container

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

		pageContainer.setAttribute("class", "website-container workspace");

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
			pageIcon.innerHTML = this.icon;
		}
		
		// Insert title into the title element
		MarkdownRendererAPI.renderMarkdownSimpleEl(this.title, titleEl);
		if (pageIcon) 
		{
			titleEl.prepend(pageIcon);
		}

		// Insert title into the document
		this.sizerElement.prepend(titleEl);
	}

	private async addHead()
	{
		if (!this.document) return;

		let rootPath = this.pathToRoot.slugified(this.exportOptions.slugifyPaths).path;
		if (rootPath == "") rootPath = "./";
		let description = this.description || (this.exportOptions.siteName + " - " + this.titleInfo.title);
		let head =
`
<title>${this.titleInfo.title}</title>
<base href="${rootPath}">
<meta id="root-path" root-path="${rootPath}">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">
<meta charset="UTF-8">
<meta name="description" content="${description}">
<meta property="og:title" content="${this.titleInfo.title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${this.fullURL}">
<meta property="og:image" content="${this.coverImageURL}">
<meta property="og:site_name" content="${this.exportOptions.siteName}">
`;

		if (this.author && this.author != "")
		{
			head += `<meta name="author" content="${this.author}">`;
		}

		if (this.exportOptions.addRSS)
		{
			let rssURL = this.website.index.rssURL ?? "";
			head += `<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${rssURL}">`;
		}

		head += AssetHandler.getHeadReferences(this.exportOptions);

		this.document.head.innerHTML = head;
	}

	private async inlineMedia()
	{
		if (!this.document) return;

		let elements = Array.from(this.document.querySelectorAll("[src]:not(head [src])"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			let filePath = this.website.getFilePathFromSrc(rawSrc, this.source.path);
			if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute) continue;

			let base64 = await filePath.readAsString("base64");
			if (!base64) return;

			let ext = filePath.extensionName;

			//@ts-ignore
			let type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext === "svg") ext += "+xml";
			
			mediaEl.setAttribute("src", `data:${type}/${ext};base64,${base64}`);
		};
	}

}
