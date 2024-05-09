import { FrontMatterCache, TFile } from "obsidian";
import { Path } from "plugin/utils/path";
import { Attachment } from "plugin/utils/downloadable";
import { OutlineTree } from "plugin/component-generators/outline-tree";
import { Website } from "./website";
import { AssetHandler } from "plugin/asset-loaders/asset-handler";
import { HTMLGeneration } from "plugin/render-api/html-generation-helpers";
import { Utils } from "plugin/utils/utils";
import { ExportLog } from "plugin/render-api/render-api";
import { MarkdownRendererAPI } from "plugin/render-api/render-api";
import { MarkdownWebpageRendererAPIOptions } from "plugin/render-api/api-options";
import { SearchInput } from "plugin/component-generators/search-input";
import { DocumentType } from "shared/website-data";

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
	public type: DocumentType = DocumentType.Markdown;
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

		const targetPath = website.getTargetPathForFile(file, filename);
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
		const htmlString = "<!DOCTYPE html> " + this.document?.documentElement.outerHTML;
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

		return this.document.querySelector(".document") as HTMLElement;
	}

	/**
	 * The element that determines the size of the document, aka the markdown-preview-sizer
	 */
	get sizerElement(): HTMLElement | undefined
	{
		return (this.document?.querySelector(".sizer") ?? this.document?.querySelector(".document")) as HTMLElement | undefined;
	}

	/**
	 * The relative path from exportPath to rootFolder
	 */
	get pathToRoot(): Path
	{
		const ptr = Path.getRelativePath(this.targetPath, new Path(this.targetPath.workingDirectory), true);
		return ptr;
	}

	get tags(): string[]
	{
		const tagCaches = app.metadataCache.getFileCache(this.source)?.tags?.values();
		const tags = [];
		if (tagCaches)
		{
			tags.push(...Array.from(tagCaches).map((tag) => tag.tag));
		}

		const frontmatterTags = this.frontmatter?.tags ?? [];
		tags.push(...frontmatterTags);

		return tags;
	}

	get headings(): {heading: string, level: number, id: string, headingEl: HTMLElement}[]
	{
		const headers: {heading: string, level: number, id: string, headingEl: HTMLElement}[] = [];
		if (this.document)
		{
			this.document.querySelectorAll(".heading").forEach((headerEl: HTMLElement) =>
			{
				let level = parseInt(headerEl.tagName[1]);
				if (headerEl.closest("[class^='block-language-']") || headerEl.closest(".markdown-embed.inline-embed")) level += 6;
				const heading = headerEl.getAttribute("data-heading") ?? headerEl.innerText ?? "";
				headers.push({heading, level, id: headerEl.id, headingEl: headerEl});
			});
		}

		return headers;
	}

	public async getStrippedHeadings(): Promise<{ heading: string; level: number; id: string; }[]>
	{
		const headings = this.headings.map((header) => {return {heading: header.heading, level: header.level, id: header.id}});
		
		for (const header of headings)
		{
			const tempContainer = document.body.createDiv();
			await MarkdownRendererAPI.renderMarkdownSimpleEl(header.heading, tempContainer);
			// @ts-ignore
			const h = tempContainer.innerText ?? header.heading;
			header.heading = h;
			tempContainer.remove();
		}

		return headings;
	}

	get aliases(): string[]
	{
		const aliases = this.frontmatter?.aliases ?? [];
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
			const content = this.viewElement.cloneNode(true) as HTMLElement;
			content.querySelectorAll(`h1, h2, h3, h4, h5, h6, .mermaid, table, mjx-container, style, script, 
.mod-header, .mod-footer, .metadata-container, .frontmatter, img[src^="data:"]`).forEach((heading) => heading.remove());

			// update image links
			content.querySelectorAll("[src]").forEach((el: HTMLImageElement) => 
			{
				let src = el.src;
				if (!src) return;
				if (src.startsWith("http") || src.startsWith("data:")) return;
				if (src.startsWith("data:")) 
				{
					el.remove();
					return;
				}
				src = src.replace("app://obsidian", "");
				src = src.replace(".md", "");
				const path = Path.joinStrings(this.exportOptions.siteURL ?? "", src);
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
				const path = Path.joinStrings(this.exportOptions.siteURL ?? "", href);
				el.href = path.path;
			});

			function keepTextLinksImages(element: HTMLElement) 
			{
				const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
				let node;
				const nodes = [];
				while (node = walker.nextNode()) 
				{
					if (node.nodeType == Node.ELEMENT_NODE)
					{
						const element = node as HTMLElement;
						if (element.tagName == "A" || element.tagName == "IMG" || element.tagName == "BR")
						{
							nodes.push(element);
						}

						if (element.tagName == "DIV")
						{
							const classes = element.parentElement?.classList;
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

			//remove subsequent br tags
			content.querySelectorAll("br").forEach((br: HTMLElement) => 
			{
				const next = br.nextElementSibling;
				if (next?.tagName == "BR") br.remove();
			});

			// remove br tags at the start and end of the content
			const first = content.firstElementChild;
			if (first?.tagName == "BR") first.remove();
			const last = content.lastElementChild;
			if (last?.tagName == "BR") last.remove();

			description = content.innerHTML;
			content.remove();
		}

		// remove multiple whitespace characters in a row
		description = description.replace(/\s{2,}/g, " ");

		return description ?? "";
	}

	get tagsPreviewHTML(): string
	{
		let tagsHTML = "";

		const tags = this.tags.map((tag) => `<a class="tag" href="${this.exportOptions.siteURL}?query=tag:${tag.replace("#", "")}">${tag.startsWith("#") ? tag : "#" + tag}</a>`).join(" ");
		if (tags.length > 0)
		{
			const tagContainer = document.body.createDiv();
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

			tagsHTML = tagContainer.innerHTML + " <br> ";
			tagContainer.remove();
		}

		return tagsHTML;
	}

	get author(): string
	{
		return this.frontmatter["author"] || this.exportOptions.authorName || "";
	}

	get fullURL(): string
	{
		const url = Path.joinStrings(this.exportOptions.siteURL ?? "", this.targetPath.path).path;
		return url;
	}

	get backlinks(): Webpage[]
	{
		// @ts-ignore
		const backlinks = Object.keys(app.metadataCache.getBacklinksForFile(this.source)?.data) ?? [];
		let linkedWebpages = backlinks.map((path) => this.website.index.getWebpage(path)) as Webpage[];
		linkedWebpages = linkedWebpages.filter((page) => page != undefined);
		return linkedWebpages;
	}

	get coverImageURL(): string | undefined
	{
		if (!this.viewElement) return undefined;
		let mediaPathStr = this.viewElement.querySelector("img")?.getAttribute("src") ?? "";
		if (mediaPathStr.startsWith("data:")) return undefined;
		const hasMedia = mediaPathStr.length > 0;
		if (!hasMedia) return undefined;

		if (!mediaPathStr.startsWith("http") && !mediaPathStr.startsWith("data:"))
		{
			const mediaPath = Path.joinStrings(this.exportOptions.siteURL ?? "", mediaPathStr);
			mediaPathStr = mediaPath.path;
		}

		return mediaPathStr;
	}

	get frontmatter(): FrontMatterCache
	{
		const frontmatter = app.metadataCache.getFileCache(this.source)?.frontmatter ?? {};
		return frontmatter;
	}

	get srcLinks(): string[]
	{
		if (!this.document) return [];
		const srcEls = this.srcLinkElements.map((item) => item.getAttribute("src")) as string[];
		return srcEls;
	}
	get hrefLinks(): string[]
	{
		if (!this.document) return [];
		const hrefEls = this.hrefLinkElements.map((item) => item.getAttribute("href")) as string[];
		return hrefEls;
	}
	get srcLinkElements(): HTMLImageElement[]
	{
		if (!this.document) return [];
		const srcEls = (Array.from(this.document.querySelectorAll("[src]:not(head *)")) as HTMLImageElement[]);
		return srcEls;
	}
	get hrefLinkElements(): HTMLAnchorElement[]
	{
		if (!this.document) return [];
		const hrefEls = (Array.from(this.document.querySelectorAll("[href]:not(head *)")) as HTMLAnchorElement[]);
		return hrefEls;
	}
	get linksToOtherFiles(): string[]
	{
		const links = this.hrefLinks;
		const otherFiles = links.filter((link) => !link.startsWith("#") && !link.startsWith("lib/") && !link.startsWith("http") && !link.startsWith("data:"));
		return otherFiles;
	}

	public async build(): Promise<Webpage | undefined>
	{
		if (!this.document) throw new Error("Must populate the document before building the webpage");

		// get title and icon
		this.titleInfo = await Website.getTitleAndIcon(this.source);
		this.title = this.titleInfo.title;
		this.icon = this.titleInfo.icon;
		const iconRenderContainer = document.body.createDiv();
		await MarkdownRendererAPI.renderMarkdownSimpleEl(this.icon, iconRenderContainer);
		this.icon = iconRenderContainer.innerHTML;
		iconRenderContainer.remove();

		this.viewElement?.setAttribute("data-type", this.type);

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
			const mathStyleEl = document.createElement("style");
			mathStyleEl.id = "MJX-CHTML-styles";
			await AssetHandler.mathjaxStyles.load();
			mathStyleEl.innerHTML = AssetHandler.mathjaxStyles.data as string;
			this.viewElement?.prepend(mathStyleEl);
		}

		if (this.exportOptions.addSidebars)
		{
			const innerContent = this.document.body.innerHTML;
			this.document.body.innerHTML = "";
			const layout = this.generateWebpageLayout(innerContent);
			this.document.body.appendChild(layout.container);
			const rightSidebar = layout.right;
			const leftSidebar = layout.left;

			// inject graph view
			if (this.exportOptions.addGraphView)
			{
				this.website.globalGraph.insert(rightSidebar);
			}

			// inject outline
			if (this.exportOptions.addOutline)
			{
				const headerTree = new OutlineTree(this, 1);
				headerTree.id = "outline";
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
					const sidebar = leftSidebar.querySelector("#file-explorer");
					const unixPath = this.targetPath.path;
					let fileElement: HTMLElement = sidebar?.querySelector(`[href="${unixPath}"]`) as HTMLElement;
					fileElement = fileElement?.closest(".tree-item") as HTMLElement;
					while (fileElement)
					{
						fileElement?.classList.remove("is-collapsed");
						const children = fileElement?.querySelector(".tree-item-children") as HTMLElement;
						if(children) children.style.display = "block";
						fileElement = fileElement?.parentElement?.closest(".tree-item") as HTMLElement;
					}
				}
			}
		}

		if (this.exportOptions.includeJS)
		{
			const bodyScript = this.document.body.createEl("script");
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
		
		const body = this.document.body;
		if (this.exportOptions.addBodyClasses)
			body.setAttribute("class", this.website.bodyClasses || await HTMLGeneration.getValidBodyClasses(false));
		
		// render the file
		const options = {...this.exportOptions, container: body};
		const renderInfo = await MarkdownRendererAPI.renderFile(this.source, options);
		const contentEl = renderInfo?.contentEl;

		// set the document's type
		this.type = (renderInfo?.viewType as DocumentType) ?? DocumentType.Markdown;

		// if the render was cancelled, return undefined
		if (!contentEl) return undefined;
		if (MarkdownRendererAPI.checkCancelled()) return undefined;

		if (this.type == "markdown")
		{
			contentEl.classList.toggle("allow-fold-headings", this.exportOptions.allowFoldingHeadings);
			contentEl.classList.toggle("allow-fold-lists", this.exportOptions.allowFoldingLists);
			contentEl.classList.add("is-readable-line-width");

			const cssclasses = this.frontmatter['cssclasses'];
			if (cssclasses && cssclasses.length > 0) contentEl.classList.add(...cssclasses);
		}

		if(this.sizerElement) this.sizerElement.style.paddingBottom = "";

		this.document.body.innerHTML = this.document.body.innerHTML;

		return this;
	}

	public async getAttachments(): Promise<Attachment[]>
	{
		if (!this.document) return [];

		const sources = this.srcLinks;
		for (const src of sources)
		{
			if ((!src.startsWith("app://") && /\w+:(\/\/|\\\\)/.exec(src)) || // link is a URL except for app://
				src.startsWith("data:")) // link is a data URL
			continue;

			const sourcePath = this.website.getFilePathFromSrc(src, this.source.path).pathname;
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

		const linkSplit = link.split("#")[0].split("?")[0];
		const attachmentPath = this.website.getFilePathFromSrc(linkSplit, this.source.path).pathname;
		const attachment = this.website.index.getFile(attachmentPath);
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

		const links = this.hrefLinkElements;
		for (const link of links)
		{
			const href = link.getAttribute("href");
			const newHref = this.resolveLink(href);
			link.setAttribute("href", newHref ?? href ?? "");
			link.setAttribute("target", "_self");
			link.classList.toggle("is-unresolved", !newHref);
		}
	}

	private remapEmbedLinks()
	{
		if (!this.document) return;

		const links = this.srcLinkElements;
		for (const link of links)
		{
			const src = link.getAttribute("src");
			const newSrc = this.resolveLink(src);
			link.setAttribute("src", newSrc ?? src ?? "");
			link.setAttribute("target", "_self");
			link.classList.toggle("is-unresolved", !newSrc);
		}
	}

	private generateWebpageLayout(middleContent: HTMLElement | Node | string): {container: HTMLElement, left: HTMLElement, leftBar: HTMLElement, right: HTMLElement, rightBar: HTMLElement, center: HTMLElement}
	{
		if (!this.document) throw new Error("Document is not defined");
		const collapseSidebarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`;

		/*
		div#layout
			div#left-content.leaf
				div#left-sidebar.sidebar
					div.sidebar-handle
					div.sidebar-topbar
						div.topbar-content
						div.sidebar-collapse-icon
					div.sidebar-content-wrapper
						div#left-sidebar-content.leaf-content
						
			div#center-content.leaf
				
			div#right-content.leaf
				div#right-sidebar.sidebar
					div.sidebar-handle
					div.sidebar-topbar
						div.topbar-content
						div.sidebar-collapse-icon
					div.sidebar-content-wrapper
						div#right-sidebar-content.leaf-content
		*/

		const layout = this.document.body.createDiv({attr: {id: "layout"}});
			const leftContent = layout.createDiv({attr: {id: "left-content", class: "leaf"}});
				const leftSidebar = leftContent.createDiv({attr: {id: "left-sidebar", class: "sidebar"}});
					const leftSidebarHandle = leftSidebar.createDiv({attr: {class: "sidebar-handle"}});
					const leftTopbar = leftSidebar.createDiv({attr: {class: "sidebar-topbar"}});
						const leftTopbarContent = leftTopbar.createDiv({attr: {class: "topbar-content"}});
						const leftCollapseIcon = leftTopbar.createDiv({attr: {class: "clickable-icon sidebar-collapse-icon"}});
							leftCollapseIcon.innerHTML = collapseSidebarIcon;
					const leftSidebarContentWrapper = leftSidebar.createDiv({attr: {class: "sidebar-content-wrapper"}});
						const leftSidebarContent = leftSidebarContentWrapper.createDiv({attr: {id: "left-sidebar-content", class: "leaf-content"}});
			const centerContent = layout.createDiv({attr: {id: "center-content", class: "leaf"}});
			const rightContent = layout.createDiv({attr: {id: "right-content", class: "leaf"}});
				const rightSidebar = rightContent.createDiv({attr: {id: "right-sidebar", class: "sidebar"}});
					const rightSidebarHandle = rightSidebar.createDiv({attr: {class: "sidebar-handle"}});
					const rightTopbar = rightSidebar.createDiv({attr: {class: "sidebar-topbar"}});
						const rightTopbarContent = rightTopbar.createDiv({attr: {class: "topbar-content"}});
						const rightCollapseIcon = rightTopbar.createDiv({attr: {class: "clickable-icon sidebar-collapse-icon"}});
							rightCollapseIcon.innerHTML = collapseSidebarIcon;
					const rightSidebarContentWrapper = rightSidebar.createDiv({attr: {class: "sidebar-content-wrapper"}});
						const rightSidebarContent = rightSidebarContentWrapper.createDiv({attr: {id: "right-sidebar-content", class: "leaf-content"}});

		if (middleContent instanceof HTMLElement || middleContent instanceof Node)
		{
			centerContent.appendChild(middleContent);
		}
		else
		{
			centerContent.innerHTML = middleContent;
		}

		return {container: layout, left: leftSidebarContent, leftBar: leftTopbarContent, right: rightSidebarContent, rightBar: rightTopbarContent, center: centerContent};
	}

	private async addTitle() 
	{
		if (!this.document || !this.sizerElement || this.type != "markdown") return;
		
		// remove inline title
		const inlineTitle = this.document.querySelector(".inline-title");
		inlineTitle?.remove();

		// remove make.md title
		const makeTitle = this.document.querySelector(".mk-inline-context");
		makeTitle?.remove();

		// remove mod-header
		const modHeader = this.document.querySelector(".mod-header");
		modHeader?.remove();

		// if the first header element is basically the same as the title, use it's text and remove it
		const firstHeader = this.document.querySelector(":is(h1, h2, h3, h4, h5, h6):not(.markdown-embed-content *)");
		if (firstHeader)
		{
			const firstHeaderText = (firstHeader.getAttribute("data-heading") ?? firstHeader.textContent)?.toLowerCase() ?? "";
			const lowerTitle = this.title.toLowerCase();
			const titleDiff = Utils.levenshteinDistance(firstHeaderText, lowerTitle) / lowerTitle.length;
			const basenameDiff = Utils.levenshteinDistance(firstHeaderText, this.source.basename.toLowerCase()) / this.source.basename.length;
			const difference = Math.min(titleDiff, basenameDiff);

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
			else if (firstHeader.tagName == "H1" && !this.document.body.classList.contains("show-inline-title"))
			{
				// if the difference is too large but the first header is an h1 and it's the first element in the body and there is no inline title, use it as the title
				const headerEl = firstHeader.closest(".heading-wrapper") ?? firstHeader;
				const headerParent = headerEl.parentElement;
				if (headerParent && headerParent.classList.contains("markdown-preview-sizer"))
				{
					const childPosition = Array.from(headerParent.children).indexOf(headerEl);
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
		const titleEl = this.document.createElement("h1");
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
		const description = this.description || (this.exportOptions.siteName + " - " + this.titleInfo.title);
		let head =
`
<title>${this.titleInfo.title}</title>
<base href="${rootPath}">
<meta name="pathname" content="${this.targetPath}">
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
			const rssURL = this.website.index.rssURL ?? "";
			head += `<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${rssURL}">`;
		}

		head += AssetHandler.getHeadReferences(this.exportOptions);

		this.document.head.innerHTML = head;
	}

	private async inlineMedia()
	{
		if (!this.document) return;

		const elements = Array.from(this.document.querySelectorAll("[src]:not(head [src])"))
		for (const mediaEl of elements)
		{
			const rawSrc = mediaEl.getAttribute("src") ?? "";
			const filePath = this.website.getFilePathFromSrc(rawSrc, this.source.path);
			if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute) continue;

			const base64 = await filePath.readAsString("base64");
			if (!base64) return;

			let ext = filePath.extensionName;

			//@ts-ignore
			const type = app.viewRegistry.typeByExtension[ext] ?? "audio";

			if(ext === "svg") ext += "+xml";
			
			mediaEl.setAttribute("src", `data:${type}/${ext};base64,${base64}`);
		};
	}

}
