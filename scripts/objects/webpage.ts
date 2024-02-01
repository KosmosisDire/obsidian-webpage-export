import { TFile } from "obsidian";
import { Path } from "scripts/utils/path";
import { Downloadable } from "scripts/utils/downloadable";
import { ExportPreset, Settings } from "scripts/settings/settings";
import { OutlineTree } from "./outline-tree";
import { GraphView } from "./graph-view";
import { Website } from "./website";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { HTMLGeneration } from "scripts/html-generation/html-generation-helpers";
import { Utils } from "scripts/utils/utils";
import { RenderLog } from "scripts/html-generation/render-log";
import { Asset, InlinePolicy } from "scripts/html-generation/assets/asset";
const { minify } = require('html-minifier-terser');

export class Webpage
{
	public website: Website;
	
	/**
	 * The original file this webpage was exported from
	 */
	public source: TFile;

	/**
	 * The absolute path to the FOLDER we are exporting to
	 */
	public destinationFolder: Path;

	/**
	 * The relative path from the vault root to the FOLDER this website's source file was in
	 */
	public sourceFolder: Path;

	/**
	 * Is this file part of a batch export, or is it being exported independently?
	 */
	public partOfBatch: boolean;

	/**
	 * The name of the source file, with the extension
	 */
	public name: string;

	/**
	 * The relative path from the destination folder to the exported file; includes the file name and extension.
	 */
	public exportPath: Path;

	/**
	 * The document containing this webpage's HTML
	 */
	public document?: Document;

	/**
	 * The external files that need to be downloaded for this file to work NOT including the file itself.
	 */
	public dependencies: Downloadable[] = [];

	public viewType: string = "markdown";

	public isConvertable: boolean = false;

	/**
	 * @param file The original markdown file to export
	 * @param destination The absolute path to the FOLDER we are exporting to
	 * @param source The relative path from the vault root to the FOLDER being exported
	 * @param partOfBatch Is this file part of a batch export, or is it being exported independently?
	 * @param fileName The name of the file being exported without the extension
	 * @param forceExportToRoot Force the file to be saved directly int eh export folder rather than in it's subfolder.
	 */
	constructor(file: TFile, website: Website, destination: Path, partOfBatch: boolean, fileName: string, forceExportToRoot: boolean = false)
	{
		if(!destination.isAbsolute) throw new Error("exportToFolder must be an absolute path" + destination.asString);
		
		this.source = file;
		this.website = website;
		this.destinationFolder = destination.directory;
		this.sourceFolder = new Path(file.path).directory;
		this.partOfBatch = partOfBatch;
		this.name = fileName;

		this.isConvertable = MarkdownRenderer.isConvertable(file.extension);
		this.name += this.isConvertable ? ".html" : "." + file.extension;
		if (this.isConvertable) this.document = document.implementation.createHTMLDocument(this.source.basename);

		let parentPath = file.parent?.path ?? "/";
		if (parentPath.trim() == "/" || parentPath.trim() == "\\") parentPath = "";
		this.exportPath = Path.joinStrings(parentPath, this.name);
		if (forceExportToRoot) this.exportPath.reparse(this.name);
		this.exportPath.setWorkingDirectory(this.destinationFolder.asString);

		if (Settings.settings.makeNamesWebStyle)
		{
			this.name = Path.toWebStyle(this.name);
			this.exportPath.makeWebStyle();
		}
	}

	/**
	 * The HTML string for the file
	 */
	public async getHTML(): Promise<string>
	{
		let htmlString = "<!DOCTYPE html>\n" + this.document?.documentElement.outerHTML;

		if (Settings.settings.minifyHTML) 
			htmlString = await minify(htmlString, { collapseBooleanAttributes: true, collapseWhitespace: true, minifyCSS: true, minifyJS: true, removeComments: true, removeEmptyAttributes: true, removeRedundantAttributes: true, removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true });

		return htmlString;
	}

	/**
	 * The element that contains the content of the document, aka the markdown-preview-view
	 */
	get contentElement(): HTMLDivElement
	{
		if (this.viewType != "markdown") return this.document?.querySelector(".view-content") as HTMLDivElement;
		
		return this.document?.querySelector(".markdown-preview-view") as HTMLDivElement ?? this.document?.querySelector(".view-content") as HTMLDivElement;
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
	get exportPathAbsolute(): Path
	{
		return this.destinationFolder.join(this.exportPath);
	}

	/**
	 * The relative path from exportPath to rootFolder
	 */
	get pathToRoot(): Path
	{
		return Path.getRelativePath(this.exportPath, new Path(this.exportPath.workingDirectory), true).makeUnixStyle();
	}

	/**
	 * Returns a downloadable object to download the .html file to the current path with the current html contents.
	 */
	public async getSelfDownloadable(): Promise<Downloadable>
	{
		let content = (this.isConvertable ? await this.getHTML() : await new Path(this.source.path).readFileBuffer()) ?? "";
		let downloadable = new Downloadable(this.name, content, this.exportPath.directory.makeForceFolder());
		downloadable.modifiedTime = this.source.stat.mtime;
		return downloadable;
	}

	public async create(): Promise<Webpage | undefined>
	{
		if (!this.isConvertable || !this.document) return this;

		if(!(await this.getDocumentHTML())) return;

		let layout = this.generateWebpageLayout(this.contentElement);

		this.document.body.appendChild(layout.container);

		if (Settings.settings.exportPreset != ExportPreset.RawDocuments)
		{
			let rightSidebar = layout.right;
			let leftSidebar = layout.left;

			// inject graph view
			if (Settings.settings.includeGraphView)
			{
				GraphView.generateGraphEl(rightSidebar);
			}

			// inject outline
			if (Settings.settings.includeOutline)
			{
				let headerTree = new OutlineTree(this, 1);
				headerTree.class = "outline-tree";
				headerTree.title = "Table Of Contents";
				headerTree.showNestingIndicator = false;
				headerTree.generateWithItemsClosed = Settings.settings.startOutlineCollapsed;
				headerTree.minCollapsableDepth = Settings.settings.minOutlineCollapse;
				await headerTree.generateTreeWithContainer(rightSidebar);
			}

			// inject darkmode toggle
			if (Settings.settings.includeThemeToggle)
			{
				HTMLGeneration.createThemeToggle(layout.leftBar);
			}

			// inject search bar
			// TODO: don't hardcode searchbar html
			if (Settings.settings.includeSearchBar)
			{
				let searchbarHTML = `<div class="search-input-container"><input enterkeyhint="search" type="search" spellcheck="false" placeholder="Search..."><div class="search-input-clear-button" aria-label="Clear search"></div></div>`;
				leftSidebar.createDiv().outerHTML = searchbarHTML;
			}

			// inject file tree
			if (Settings.settings.includeFileTree)
			{
				leftSidebar.createDiv().outerHTML = this.website.fileTreeAsset.getHTMLInclude();
			}
		}
		else
		{
			layout.container.querySelectorAll(".sidebar").forEach((el) => el.remove());
		}

		await this.addMetadata();
		await this.addTitle();

		return this;
	}

	public getTags(): string[]
	{
		let tagCaches = app.metadataCache.getFileCache(this.source)?.tags?.values();
		if (tagCaches)
		{
			let tags = Array.from(tagCaches).map((tag) => tag.tag);
			return tags;
		}

		return [];
	}

	public getHeadings(): {heading: string, level: number, headingEl: HTMLElement}[]
	{
		let headers: {heading: string, level: number, headingEl: HTMLElement}[] = [];
		if (this.document)
		{
			this.document.querySelectorAll(".heading").forEach((headerEl: HTMLElement) =>
			{
				let level = parseInt(headerEl.tagName[1]);
				let heading = headerEl.innerText ?? "";
				headers.push({heading, level, headingEl: headerEl});
			});
		}

		return headers;
	}

	private async getDocumentHTML(): Promise<Webpage | undefined>
	{
		if (!this.isConvertable || !this.document) return this;

		let body = this.document.body;
		body.setAttribute("class", Website.validBodyClasses);

		// create obsidian document containers
		let renderInfo = await MarkdownRenderer.renderFile(this.source, body);
		let contentEl = renderInfo?.contentEl;
		this.viewType = renderInfo?.viewType ?? "markdown";

		if (!contentEl) return undefined;
		if (MarkdownRenderer.checkCancelled()) return undefined;

		if (this.viewType == "markdown")
		{ 
			contentEl.classList.toggle("allow-fold-headings", Settings.settings.allowFoldingHeadings);
			contentEl.classList.toggle("allow-fold-lists", Settings.settings.allowFoldingLists);
			contentEl.classList.add("is-readable-line-width");
		}

		if(this.sizerElement) this.sizerElement.style.paddingBottom = "";

		// move banner plugin's wrapper above the sizer
		let bannerWrapper = this.document.querySelector(".obsidian-banner-wrapper");  

		let sizerParent = bannerWrapper?.closest(".markdown-preview-sizer");
		let contentParent = bannerWrapper?.closest(".markdown-preview-view");
		if(sizerParent && contentParent && bannerWrapper) 
		{
			if(bannerWrapper) contentParent.appendChild(bannerWrapper);
			if (sizerParent) contentParent.appendChild(sizerParent);
		}

		// convert headings from linear to trees
		HTMLGeneration.makeHeadingsTrees(contentEl);

		// modify links to work outside of obsidian (including relative links)
		this.convertLinks();
		
		// add math styles to the document. They are here and not in <head> because they are unique to each document
		let mathStyleEl = document.createElement("style");
		mathStyleEl.id = "MJX-CHTML-styles";
		await AssetHandler.mathjaxStyles.load();
		mathStyleEl.innerHTML = AssetHandler.mathjaxStyles.content;
		this.contentElement.prepend(mathStyleEl);

		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (Settings.settings.inlineAssets) await this.inlineMedia();
		else outlinedImages = await this.exportMedia();
		
		this.dependencies.push(...outlinedImages);

		if(Settings.settings.makeNamesWebStyle)
		{
			this.dependencies.forEach((file) =>
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDownloadDirectory = file.relativeDownloadDirectory?.makeWebStyle();
			});
		}

		return this;
	}
	
	private generateWebpageLayout(middleContent: HTMLElement): {container: HTMLElement, left: HTMLElement, leftBar: HTMLElement, right: HTMLElement, rightBar: HTMLElement, center: HTMLElement}
	{
		if (!this.document) return {container: middleContent, left: middleContent, leftBar: middleContent, right: middleContent, rightBar: middleContent, center: middleContent};

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

		pageContainer.setAttribute("class", "webpage-container");

		leftSidebar.setAttribute("class", "sidebar-left sidebar is-collapsed");
		leftSidebarHandle.setAttribute("class", "sidebar-handle");
		leftContent.setAttribute("class", "sidebar-content");
		leftTopbar.setAttribute("class", "sidebar-topbar");
		leftTopbarContent.setAttribute("class", "topbar-content");
		leftCollapseIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");

		documentContainer.setAttribute("class", "document-container markdown-reading-view hide");

		rightSidebar.setAttribute("class", "sidebar-right sidebar is-collapsed");
		rightSidebarHandle.setAttribute("class", "sidebar-handle");
		rightContent.setAttribute("class", "sidebar-content");
		rightTopbar.setAttribute("class", "sidebar-topbar");
		rightTopbarContent.setAttribute("class", "topbar-content");
		rightCollapseIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");

		pageContainer.appendChild(leftSidebar);
		pageContainer.appendChild(documentContainer);
		pageContainer.appendChild(rightSidebar);

		leftSidebar.appendChild(leftSidebarHandle);
		leftSidebar.appendChild(leftTopbar);
		leftSidebar.appendChild(leftContent);
		leftTopbar.appendChild(leftTopbarContent);
		leftTopbar.appendChild(leftCollapseIcon);
		leftCollapseIcon.innerHTML = collapseSidebarIcon;

		documentContainer.appendChild(middleContent);

		rightSidebar.appendChild(rightSidebarHandle);
		rightSidebar.appendChild(rightTopbar);
		rightSidebar.appendChild(rightContent);
		rightTopbar.appendChild(rightTopbarContent);
		rightTopbar.appendChild(rightCollapseIcon);
		rightCollapseIcon.innerHTML = collapseSidebarIcon;

		return {container: pageContainer, left: leftContent, leftBar: leftTopbarContent, right: rightContent, rightBar: rightTopbarContent, center: documentContainer};
	}

	private async addTitle() 
	{
		if (!this.document) return;
		
		// remove inline title
		let inlineTitle = this.document.querySelector(".inline-title");
		inlineTitle?.remove();

		// remove make.md title
		let makeTitle = this.document.querySelector(".mk-inline-context");
		makeTitle?.remove();

		let titleInfo = await Website.getTitleAndIcon(this.source);
		let title = titleInfo.title;
		let icon = titleInfo.icon;

		// if the first header element is basically the same as the title, use it's text and remove it
		let firstHeader = this.document.querySelector(":is(h1, h2, h3, h4, h5, h6):not(.markdown-embed-content *)");
		if (firstHeader)
		{
			let headerChildren = Array.from(firstHeader.childNodes);
			let firstHeaderTextNode = headerChildren.find((el) => el.nodeType == Node.TEXT_NODE);
			if (firstHeaderTextNode)
			{
				let firstHeaderTitle = firstHeaderTextNode.textContent?.toLowerCase() ?? "";
				let lowerTitle = title.toLowerCase();
				let titleDiff = Utils.levenshteinDistance(firstHeaderTitle, lowerTitle) / lowerTitle.length;
				let basenameDiff = Utils.levenshteinDistance(firstHeaderTitle, this.source.basename.toLowerCase()) / this.source.basename.length;
				let difference = Math.min(titleDiff, basenameDiff);

				if ((firstHeader.tagName == "H1" && difference < 0.2) || (firstHeader.tagName == "H2" && difference < 0.1))
				{
					if(titleInfo.isDefaultTitle) title = firstHeader.innerHTML;
					firstHeader.remove();
					RenderLog.log(`Removing "${firstHeaderTextNode.textContent ?? ""}" header because it was very similar to the file's title.`);
				}
				else if (firstHeader.tagName == "H1")
				{
					// if the difference is too large but the first header is an h1 and it's the first element in the body, use it as the title
					let headerEl = firstHeader.closest(".header-wrapper") ?? firstHeader;
					let headerParent = headerEl.parentElement;
					console.log("Header parent", headerParent);
					if (headerParent && headerParent.tagName == "BODY")
					{
						let childPosition = Array.from(headerParent.children).indexOf(headerEl);
						if (childPosition <= 3)
						{
							console.log("Header position", childPosition);
							if(titleInfo.isDefaultTitle) title = firstHeader.innerHTML;
							firstHeader.remove();
							RenderLog.log(`Removing "${firstHeaderTextNode.textContent ?? ""}" header because it was H1 at the top of the page`);
						}
					}
				}
			}
			else
			{
				RenderLog.warning(`First header in ${this.source.basename} has no text node.`);
			}
		}

		// remove banner header
		this.document.querySelector(".banner-header")?.remove();

		// Create h1 with title
		let titleEl = this.document.createElement("h1");
		titleEl.id = "inline-title";

		let pageIcon = undefined;
		// Create a div with icon
		if ((icon != "" && !titleInfo.isDefaultIcon))
		{
			pageIcon = this.document.createElement("div");
			pageIcon.id = "webpage-icon";
		}
		
		// Insert title into the title element
		MarkdownRenderer.renderSingleLineMarkdown(title, titleEl);
		if (pageIcon) MarkdownRenderer.renderSingleLineMarkdown(icon, pageIcon);
	
		if (this.contentElement)
		{
			// Find the element with class "mod-header" within the document container
			let modHeader = this.contentElement.querySelector(".mod-header:not(.markdown-embed-content *)");
	
			if (modHeader) 
			{
				// Append the title element as the last child of the document container
				if (pageIcon) modHeader.appendChild(pageIcon);
				modHeader.appendChild(titleEl);
			} else {
				console.error("mod-header not found within markdown-preview-section. Unable to append title.");
			}
		} 
		else
		{
			console.error("markdown-preview-section not found. Unable to append title.");
		}
	}

	private async addMetadata()
	{
		if (!this.document) return;

		let rootPath = this.pathToRoot.copy.makeWebStyle(Settings.settings.makeNamesWebStyle).asString;

		let titleInfo = await Website.getTitleAndIcon(this.source);

		let head =
		`
		<title>${titleInfo.title}</title>
		<base href="${rootPath}/">
		<meta id="root-path" root-path="${rootPath}/">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">
		<meta charset="UTF-8">
		`;

		head += `\n${AssetHandler.deferredCSS.getHTMLInclude()}\n`;
		head += `\n${AssetHandler.deferredJS.getHTMLInclude()}\n`;

		let downloads = AssetHandler.getAssetDownloads(true);
		for (let i = 0; i < downloads.length; i++)
		{
			let download = downloads[i];
			head += download.getHTMLInclude(true);
		}

		head += `\n${AssetHandler.customHeadContent.getHTMLInclude()}\n`;

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
				if (MarkdownRenderer.isConvertable(targetPath.extensionName)) targetPath.setExtension("html");
				targetPath.makeWebStyle(Settings.settings.makeNamesWebStyle);

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

		let elements = Array.from(this.document.querySelectorAll("[src]:not(head [src])"))
		for (let mediaEl of elements)
		{
			let rawSrc = mediaEl.getAttribute("src") ?? "";
			let filePath = Webpage.getMediaPath(rawSrc, this.source.path);
			if (filePath.isEmpty || filePath.isDirectory || 
				filePath.isAbsolute || MarkdownRenderer.isConvertable(filePath.extension)) 
				continue;

			let exportLocation = filePath.copy;

			// if the media is inside the exported folder then keep it in the same place
			let mediaPathInExport = Path.getRelativePath(this.sourceFolder, filePath);
			if (mediaPathInExport.asString.startsWith(".."))
			{
				// if path is outside of the vault, outline it into the media folder
				exportLocation = Asset.mediaPath.joinString(filePath.fullName);
			}

			exportLocation.makeWebStyle(Settings.settings.makeNamesWebStyle);
			
			mediaEl.setAttribute("src", exportLocation.asString);

			let data = await filePath.readFileBuffer() ?? Buffer.from([]);
			let imageDownload = new Downloadable(exportLocation.fullName, data, exportLocation.directory.makeForceFolder());
			let imageStat = await filePath.stat;
			if (imageStat) imageDownload.modifiedTime = imageStat.mtimeMs;
			if (data.length == 0) RenderLog.log(filePath, "No data for file: ");
			downloads.push(imageDownload);
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
				RenderLog.log(pathString, "Fallback path parsing:");
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
