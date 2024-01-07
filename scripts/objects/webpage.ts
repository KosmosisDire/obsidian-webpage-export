import { MarkdownPreviewView, TFile } from "obsidian";
import { Path } from "scripts/utils/path";
import { Downloadable } from "scripts/utils/downloadable";
import { MainSettings } from "scripts/settings/main-settings";
import { OutlineTree } from "./outline-tree";
import { GraphView } from "./graph-view";
import { Website } from "./website";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { HTMLGeneration } from "scripts/html-generation/html-generator";
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
	 * The external files that need to be downloaded for this file to work including the file itself.
	 */
	public downloads: Downloadable[] = [];

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

		let parentPath = file.parent.path;
		if (parentPath.trim() == "/" || parentPath.trim() == "\\") parentPath = "";
		this.exportPath = Path.joinStrings(parentPath, this.name);
		if (forceExportToRoot) this.exportPath.reparse(this.name);
		this.exportPath.setWorkingDirectory(this.destinationFolder.asString);

		if (MainSettings.settings.makeNamesWebStyle)
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

		if (MainSettings.settings.minifyHTML) 
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

	get isFileModified(): boolean
	{
		return this.source.stat.mtime > (this.exportPathAbsolute.stat?.mtime.getTime() ?? Number.NEGATIVE_INFINITY);
	}

	/**
	 * Returns a downloadable object to download the .html file to the current path with the current html contents.
	 */
	public async getSelfDownloadable(): Promise<Downloadable>
	{
		let content = (this.isConvertable ? await this.getHTML() : await new Path(this.source.path).readFileBuffer()) ?? "";
		return new Downloadable(this.name, content, this.exportPath.directory.makeForceFolder());
	}



	public async create(): Promise<Webpage | undefined>
	{
		if (!this.isConvertable || !this.document) return this;

		if(!(await this.getDocumentHTML())) return;

		let layout = this.generateWebpageLayout(this.contentElement);

		this.document.body.appendChild(layout.container);
		layout.center.classList.add("show");


		if (MainSettings.settings.exportPreset != "raw-documents")
		{
			let rightSidebar = layout.right;
			let leftSidebar = layout.left;

			// inject graph view
			if (MainSettings.settings.includeGraphView)
			{
				GraphView.generateGraphEl(rightSidebar);
			}

			// inject outline
			if (MainSettings.settings.includeOutline)
			{
				let headerTree = new OutlineTree(this.source, 1);
				headerTree.class = "outline-tree";
				headerTree.title = "Table Of Contents";
				headerTree.showNestingIndicator = false;
				headerTree.generateWithItemsClosed = MainSettings.settings.startOutlineCollapsed;
				await headerTree.generateTreeWithContainer(rightSidebar);
			}

			// inject darkmode toggle
			if (MainSettings.settings.addDarkModeToggle)
			{
				HTMLGeneration.createThemeToggle(leftSidebar);
			}

			// inject file tree
			if (MainSettings.settings.includeFileTree)
			{
				leftSidebar.createDiv().outerHTML = this.website.fileTreeHtml;
			}
		}
		else
		{
			layout.container.querySelectorAll(".sidebar").forEach((el) => el.remove());
		}

		await this.addMetadata();

		// if (MainSettings.settings.addFilenameTitle) commented if you want to add setting back
		this.addTitle();

		this.downloads.unshift(await this.getSelfDownloadable());

		return this;
	}

	private async getDocumentHTML(): Promise<Webpage | undefined>
	{
		if (!this.isConvertable || !this.document) return this;

		// set custom line width on body
		let body = this.document.body;
		body.setAttribute("class", Website.getValidBodyClasses());

		// create obsidian document containers
		let renderInfo = await MarkdownRenderer.renderFile(this.source, body);
		let contentEl = renderInfo?.contentEl;
		this.viewType = renderInfo?.viewType ?? "markdown";

		if (!contentEl) return undefined;
		if (MarkdownRenderer.checkCancelled()) return undefined;

		if (this.viewType == "markdown")
		{ 
			contentEl.classList.toggle("allow-fold-headings", MainSettings.settings.allowFoldingHeadings);

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
		
		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (MainSettings.settings.inlineImages) await this.inlineMedia();
		else outlinedImages = await this.exportMedia();
		

		// add math styles to the document. They are here and not in <head> because they are unique to each document
		let mathStyleEl = document.createElement("style");
		mathStyleEl.id = "MJX-CHTML-styles";
		mathStyleEl.innerHTML = AssetHandler.mathStyles;
		this.contentElement.prepend(mathStyleEl);

		let dependencies_temp = await AssetHandler.getDownloads();
		dependencies_temp.push(...outlinedImages);

		this.downloads.push(...dependencies_temp);

		if(MainSettings.settings.makeNamesWebStyle)
		{
			this.downloads.forEach((file) =>
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDownloadPath = file.relativeDownloadPath?.makeWebStyle();
			});
		}

		this.dependencies.push(...this.downloads);

		return this;
	}
	
	private generateWebpageLayout(middleContent: HTMLElement): {container: HTMLElement, left: HTMLElement, right: HTMLElement, center: HTMLElement}
	{
		if (!this.document) return {container: middleContent, left: middleContent, right: middleContent, center: middleContent};

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
		
		let pageContainer = this.document.createElement("div");
		let leftSidebar = this.document.createElement("div");
		let leftSidebarContainer = this.document.createElement("div");
		let leftSidebarSizer = this.document.createElement("div");
		let leftSidebarContentPositioner = this.document.createElement("div");
		let leftContent = this.document.createElement("div");
		let leftGutter = this.document.createElement("div");
		let leftGutterIcon = this.document.createElement("div");
		let documentContainer = this.document.createElement("div");
		let rightSidebar = this.document.createElement("div");
		let rightSidebarContainer = this.document.createElement("div");
		let rightSidebarSizer = this.document.createElement("div");
		let rightSidebarContentPositioner = this.document.createElement("div");
		let rightContent = this.document.createElement("div");
		let rightGutter = this.document.createElement("div");
		let rightGutterIcon = this.document.createElement("div");

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

	private addTitle() {
		if (!this.document) return;
	
		let inlineTitle = this.document.querySelector(".inline-title");
		let title = Website.getTitle(this.source).title;
		let emoji = Website.getTitle(this.source).emoji;
		inlineTitle?.remove();
	
		// Create a div with emoji
		let stickerLogoDiv = this.document.createElement("div");
		stickerLogoDiv.id = "stickerlogo";
		stickerLogoDiv.textContent = emoji;
		
		// Create h1 with title
		let titleEl = this.document.createElement("h1");
		titleEl.textContent = title;
		titleEl.id = "grabbed-title";  // Set the id to "grabbed-title"

		//Bundle them to only insert once
		let bundle = this.document.createDocumentFragment();
    	bundle.appendChild(stickerLogoDiv);
    	bundle.appendChild(titleEl);
	
		// Find the document container
		let documentContainer = this.document.querySelector(".markdown-preview-section");
	
		if (documentContainer) {
			// Find the element with class "mod-header" within the document container
			let modHeader = documentContainer.querySelector(".mod-header");
	
			if (modHeader) {
				// Append the title element as the last child of the document container
				documentContainer.insertBefore(bundle, modHeader.nextSibling);
			} else {
				console.error("mod-header not found within markdown-preview-section. Unable to append title.");
			}
		} else {
			console.error("markdown-preview-section not found. Unable to append title.");
		}
	}
	

	private async addMetadata()
	{
		if (!this.document) return;

		let relativePaths = this.getRelativePaths();
		let titleInfo = Website.getTitle(this.source);
		let domtitle =`${titleInfo.emoji} ${titleInfo.title}`
		let meta =
		`
		<title>${domtitle}</title>
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

		header += "\n<!-- Custom Head Content -->\n" + AssetHandler.customHeadContent + "\n";

		this.document.head.innerHTML = header;
	}

	private getRelativePaths(): {mediaPath: Path, jsPath: Path, cssPath: Path, rootPath: Path}
	{
		let rootPath = this.pathToRoot;
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
				if (MainSettings.settings.makeNamesWebStyle) targetPath.makeWebStyle();

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
			if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute) continue;

			let exportLocation = filePath.copy;

			// if the media is inside the exported folder then keep it in the same place
			let mediaPathInExport = Path.getRelativePath(this.sourceFolder, filePath);
			if (mediaPathInExport.asString.startsWith(".."))
			{
				// if path is outside of the vault, outline it into the media folder
				exportLocation = AssetHandler.mediaFolderName.joinString(filePath.fullName);
			}

			// let relativeImagePath = Path.getRelativePath(this.exportPath, exportLocation)

			if(MainSettings.settings.makeNamesWebStyle)
			{
				// relativeImagePath.makeWebStyle();
				exportLocation.makeWebStyle();
			}

			mediaEl.setAttribute("src", exportLocation.asString);

			let data = await filePath.readFileBuffer() ?? Buffer.from([]);
			let imageDownload = new Downloadable(exportLocation.fullName, data, exportLocation.directory.makeForceFolder());
			if (data.length == 0) console.log(filePath);
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
				console.log("fallback: ", pathString);
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
