import { Downloadable } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "./file-tree";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import {  TAbstractFile, TFile, TFolder } from "obsidian";
import {  Settings } from "scripts/settings/settings";
import { GraphView } from "./graph-view";
import { Path } from "scripts/utils/path";
import { ExportLog } from "scripts/html-generation/render-log";
import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import HTMLExportPlugin from "scripts/main";
import { WebsiteIndex } from "./website-index";
import { HTMLGeneration } from "scripts/html-generation/html-generation-helpers";
import { MarkdownRendererAPI } from "scripts/render-api";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class Website
{
	public webpages: Webpage[] = [];
	public dependencies: Downloadable[] = [];
	public downloads: Downloadable[] = [];
	public batchFiles: TFile[] = [];
	public progress: number = 0;
	public destination: Path;
	public index: WebsiteIndex;

	private globalGraph: GraphView;
	private fileTree: FileTree;
	private fileTreeHtml: string = "";

	public graphDataAsset: Asset;
	public fileTreeAsset: Asset;
	
	public static validBodyClasses: string;
	public exportOptions: MarkdownWebpageRendererAPIOptions;

	private giveWarnings()
	{
		// if iconize plugin is installed, warn if note icons are not enabled
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-icon-folder"))
		{
			// @ts-ignore
			let fileToIconName = app.plugins.plugins['obsidian-icon-folder'].data;
			let noteIconsEnabled = fileToIconName.settings.iconsInNotesEnabled ?? false;
			if (!noteIconsEnabled)
			{
				ExportLog.warning("For Iconize plugin support, enable \"Toggle icons while editing notes\" in the Iconize plugin settings.");
			}
		}

		// if excalidraw installed and the embed mode is not set to Native SVG, warn
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-excalidraw-plugin"))
		{
			// @ts-ignore
			let embedMode = app.plugins.plugins['obsidian-excalidraw-plugin']?.settings['previewImageType'] ?? "";		
			if (embedMode != "SVG")
			{
				ExportLog.warning("For Excalidraw embed support, set the embed mode to \"Native SVG\" in the Excalidraw plugin settings.");
			}
		}

		// the plugin only supports the banner plugin above version 2.0.5
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-banners"))
		{
			// @ts-ignore
			let bannerPlugin = app.plugins.plugins['obsidian-banners'];
			let version = bannerPlugin?.manifest?.version ?? "0.0.0";
			version = version.substring(0, 5);
			if (version < "2.0.5")
			{
				ExportLog.warning("The Banner plugin version 2.0.5 or higher is required for full support. You have version " + version + ".");
			}
		}

	}

	private async initExport()
	{
		this.progress = 0;
		this.index = new WebsiteIndex(this);

		await MarkdownRendererAPI.beginBatch();

		this.giveWarnings();

		if (this.exportOptions.addGraphView)
		{
			ExportLog.progress(0, 1, "Initialize Export", "Generating graph view", "var(--color-yellow)");
			let convertableFiles = this.batchFiles.filter((file) => MarkdownRendererAPI.isConvertable(file.extension));
			this.globalGraph = new GraphView();
			await this.globalGraph.init(convertableFiles, Settings.graphMinNodeSize, Settings.graphMaxNodeSize);
		}
		
		if (this.exportOptions.addFileNavigation)
		{
			ExportLog.progress(0, 1, "Initialize Export", "Generating file tree", "var(--color-yellow)");
			this.fileTree = new FileTree(this.batchFiles, false, true);
			this.fileTree.makeLinksWebStyle = this.exportOptions.webStylePaths ?? true;
			this.fileTree.showNestingIndicator = true;
			this.fileTree.generateWithItemsClosed = true;
			this.fileTree.showFileExtentionTags = true;
			this.fileTree.hideFileExtentionTags = ["md"]
			this.fileTree.title = this.exportOptions.vaultName ?? app.vault.getName();
			this.fileTree.class = "file-tree";

			let tempTreeContainer = document.body.createDiv();
			await this.fileTree.generateTreeWithContainer(tempTreeContainer);
			this.fileTreeHtml = tempTreeContainer.innerHTML;
			tempTreeContainer.remove();
		}

		// wipe all temporary assets and reload dynamic assets
		ExportLog.progress(0, 1, "Initialize Export", "loading assets", "var(--color-yellow)");
		await AssetHandler.reloadAssets();

		Website.validBodyClasses = await HTMLGeneration.getValidBodyClasses(true);

		if (this.exportOptions.addGraphView)
		{
			ExportLog.progress(1, 1, "Loading graph asset", "...", "var(--color-yellow)");
			this.graphDataAsset = new Asset("graph-data.js", this.globalGraph.getExportData(), AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Temporary);
			this.graphDataAsset.load(this.exportOptions);
		}

		if (this.exportOptions.addFileNavigation)
		{
			ExportLog.progress(1, 1, "Loading file tree asset", "...", "var(--color-yellow)");
			this.fileTreeAsset = new Asset("file-tree.html", this.fileTreeHtml, AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary);
			this.fileTreeAsset.load(this.exportOptions);
		}

		ExportLog.progress(1, 1, "Initializing index", "...", "var(--color-yellow)");
		await this.index.init();
	}

	public async createWithFiles(files: TFile[], destination: Path, options?: MarkdownWebpageRendererAPIOptions): Promise<Website | undefined>
	{
		this.exportOptions = Object.assign(new MarkdownWebpageRendererAPIOptions(), options);
		this.batchFiles = files;
		this.destination = destination;
		await this.initExport();

		console.log("Creating website with files: ", files);

		let useIncrementalExport = this.index.shouldApplyIncrementalExport();

		for (let file of files)
		{
			if(MarkdownRendererAPI.checkCancelled()) return;
			ExportLog.progress(this.progress, this.batchFiles.length, "Generating HTML", "Exporting: " + file.path, "var(--interactive-accent)");
			this.progress++;
			
			let filename = new Path(file.path).basename;
			let webpage = new Webpage(file, destination, filename, this, this.exportOptions);
			let shouldExportPage = (useIncrementalExport && this.index.isFileChanged(file)) || !useIncrementalExport;
			if (!shouldExportPage) continue;
			
			let createdPage = await webpage.create();
			if(!createdPage) continue;

			this.webpages.push(webpage);
			this.downloads.push(webpage);
			this.downloads.push(...webpage.dependencies);
			this.dependencies.push(...webpage.dependencies);
		}

		this.dependencies.push(...AssetHandler.getDownloads(this.exportOptions));
		this.downloads.push(...AssetHandler.getDownloads(this.exportOptions));

		this.filterDownloads(true);
		this.index.build(this.exportOptions);
		this.filterDownloads();
		
		console.log("Website created: ", this);
		 
		return this;
	}
	
	private filterDownloads(onlyDuplicates: boolean = false)
	{
		// remove duplicates from the dependencies and downloads
		this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativePath.asString == file.relativePath.asString) == index);
		this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativePath.asString == file.relativePath.asString) == index);
		
		// remove files that have not been modified since last export
		if (!this.index.shouldApplyIncrementalExport() || onlyDuplicates) return;
		
		let localThis = this;
		function filterFunction(file: Downloadable)
		{
			// always include .html files
			if (file.filename.endsWith(".html")) return true; 

			// always exclude fonts if they exist
			if 
			(
				localThis.index.hasFileByPath(file.relativePath.asString) &&
				file.filename.endsWith(".woff") || 
				file.filename.endsWith(".woff2") ||
				file.filename.endsWith(".otf") ||
				file.filename.endsWith(".ttf")
			)
			{
				return false;
			}

			// always include files that have been modified since last export
			let metadata = localThis.index.getMetadataForPath(file.relativePath.copy.makeUnixStyle().asString);
			if (metadata && (file.modifiedTime > metadata.modifiedTime || metadata.sourceSize != file.content.length)) 
				return true;
			
			return false;
		}

		this.dependencies = this.dependencies.filter(filterFunction);
		this.downloads = this.downloads.filter(filterFunction);
	}

	// Seperate the icon and title into seperate functions
	public static async getTitleAndIcon(file: TAbstractFile, skipIcon:boolean = false): Promise<{ title: string; icon: string; isDefaultIcon: boolean; isDefaultTitle: boolean }>
	{
		const { app } = HTMLExportPlugin.plugin;
		const { titleProperty } = Settings;

		let iconOutput = "";
		let iconProperty: string | undefined = "";
		let title = file.name;
		let isDefaultTitle = true;
		let useDefaultIcon = false;
		if (file instanceof TFile)
		{
			const fileCache = app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			const titleFromFrontmatter = frontmatter?.[titleProperty] ?? frontmatter?.banner_header; // banner plugin support
			title = titleFromFrontmatter ?? file.basename;
			if (title != file.basename) isDefaultTitle = false;
			if (title.endsWith(".excalidraw")) title = title.substring(0, title.length - 11);
			
			iconProperty = frontmatter?.icon ?? frontmatter?.sticker ?? frontmatter?.banner_icon; // banner plugin support
			if (!iconProperty && Settings.showDefaultTreeIcons) 
			{
				useDefaultIcon = true;
				let isMedia = Asset.extentionToType(file.extension) == AssetType.Media;
				iconProperty = isMedia ? Settings.defaultMediaIcon : Settings.defaultFileIcon;
				if (file.extension == "canvas") iconProperty = "lucide//layout-dashboard";
			}
		}

		if (skipIcon) return { title: title, icon: "", isDefaultIcon: true, isDefaultTitle: isDefaultTitle };

		if (file instanceof TFolder && Settings.showDefaultTreeIcons)
		{
			iconProperty = Settings.defaultFolderIcon;
			useDefaultIcon = true;
		}

		iconOutput = await HTMLGeneration.getIcon(iconProperty ?? "");

		// add iconize icon as frontmatter if iconize exists
		let isUnchangedNotEmojiNotHTML = (iconProperty == iconOutput && iconOutput.length < 40) && !/\p{Emoji}/u.test(iconOutput) && !iconOutput.includes("<") && !iconOutput.includes(">");
		let parsedAsIconize = false;

		//@ts-ignore
		if ((useDefaultIcon || !iconProperty || isUnchangedNotEmojiNotHTML) && app.plugins.enabledPlugins.has("obsidian-icon-folder"))
		{
			//@ts-ignore
			let fileToIconName = app.plugins.plugins['obsidian-icon-folder'].data;
			let noteIconsEnabled = fileToIconName.settings.iconsInNotesEnabled ?? false;
			
			// only add icon if rendering note icons is enabled
			// because that is what we rely on to get the icon
			if (noteIconsEnabled)
			{
				let iconIdentifier = fileToIconName.settings.iconIdentifier ?? ":";
				let iconProperty = fileToIconName[file.path];

				if (iconProperty && typeof iconProperty != "string")
				{
					iconProperty = iconProperty.iconName ?? "";
				}

				if (iconProperty && typeof iconProperty == "string" && iconProperty.trim() != "")
				{
					if (file instanceof TFile)
						app.fileManager.processFrontMatter(file, (frontmatter) =>
						{
							frontmatter.icon = iconProperty;
						});

					iconOutput = iconIdentifier + iconProperty + iconIdentifier;
					parsedAsIconize = true;
				}
			}
		}

		if (!parsedAsIconize && isUnchangedNotEmojiNotHTML) iconOutput = "";

		return { title: title, icon: iconOutput, isDefaultIcon: useDefaultIcon, isDefaultTitle: isDefaultTitle };
	}
}
