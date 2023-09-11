import { TFile } from "obsidian";
import { Path } from "scripts/utils/path";
import { GenHelper } from "../html-generation/html-generator";
import { Downloadable } from "scripts/utils/downloadable";
import { MainSettings } from "scripts/settings/main-settings";
import { OutlineTree } from "./outline-tree";
import { GraphView } from "./graph-view";
import { Website } from "./website";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { AssetHandler } from "scripts/html-generation/asset-handler";
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


	public isCustomView: boolean = false;

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
		if (this.isCustomView) return this.document?.querySelector(".view-content") as HTMLDivElement;
		return this.document?.querySelector(".markdown-preview-view") as HTMLDivElement ?? this.document?.querySelector(".view-content") as HTMLDivElement;
	}

	/**
	 * The element that determines the size of the document, aka the markdown-preview-sizer
	 */
	get sizerElement(): HTMLDivElement
	{
		if (this.isCustomView) return this.document?.querySelector(".view-content")?.firstChild as HTMLDivElement;
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

	private async getDocumentHTML(): Promise<Webpage>
	{
		if (!this.isConvertable || !this.document) return this;

		// set custom line width on body
		let body = this.document.body;
		body.setAttribute("class", Website.getValidBodyClasses());

		// create obsidian document containers
		let contentEl = await MarkdownRenderer.renderFile(this);
		if (!contentEl) throw new Error("Could not render file: " + this.source.path);
		MarkdownRenderer.checkCancelled();

		body.appendChild(contentEl);

		if (!this.isCustomView)
		{ 
			contentEl.classList.toggle("allow-fold-headings", MainSettings.settings.allowFoldingHeadings);

			if (MainSettings.settings.addFilenameTitle) GenHelper.addTitle(this);
		}

		if(this.sizerElement) this.sizerElement.style.paddingBottom = "";


		// modify links to work outside of obsidian (including relative links)
		GenHelper.fixLinks(this); 
		
		// inline / outline images
		let outlinedImages : Downloadable[] = [];
		if (MainSettings.settings.inlineImages)
		{
			await GenHelper.inlineMedia(this);
		}
		else
		{
			outlinedImages = await GenHelper.externalizeMedia(this);
		}

		// add math styles to the document. They are here and not in head because they are unique to each document
		let mathStyleEl = document.createElement("style");
		mathStyleEl.id = "MJX-CHTML-styles";
		mathStyleEl.innerHTML = AssetHandler.mathStyles;
		this.contentElement.prepend(mathStyleEl);

		this.downloads.push(...outlinedImages);
		this.downloads.push(...await AssetHandler.getDownloads());

		if(MainSettings.settings.makeNamesWebStyle)
		{
			this.downloads.forEach((file) =>
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDownloadPath = file.relativeDownloadPath?.makeWebStyle();
			});
		}

		return this;
	}


	public async create(): Promise<Webpage>
	{
		if (!this.isConvertable || !this.document) return this;

		await this.getDocumentHTML();

		let sidebars = GenHelper.generateSideBarLayout(this.contentElement, this);
		let rightSidebar = sidebars.right;
		let leftSidebar = sidebars.left;
		this.document.body.appendChild(sidebars.container);

		sidebars.center.classList.add("show");

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
		if (MainSettings.settings.addDarkModeToggle && !this.document.querySelector(".theme-toggle-container-inline, .theme-toggle-container"))
		{
			let toggle = GenHelper.generateDarkmodeToggle(false, this.document);
			leftSidebar.appendChild(toggle);
		}

		// inject file tree
		if (MainSettings.settings.includeFileTree)
		{
			leftSidebar.createDiv().outerHTML = this.website.fileTreeHtml;
		}

		await GenHelper.fillInHead(this);

		this.downloads.unshift(await this.getSelfDownloadable());

		return this;
	}
}
