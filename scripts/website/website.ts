import { Downloadable } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "../component-generators/file-tree";
import { AssetHandler } from "scripts/assets-system/asset-handler";
import {  TAbstractFile, TFile, TFolder } from "obsidian";
import {  Settings } from "scripts/settings/settings";
import { GraphView } from "../component-generators/graph-view";
import { Path } from "scripts/utils/path";
import { ExportLog } from "scripts/utils/export-log";
import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/assets-system/asset";
import { WebsiteIndex } from "./website-index";
import { HTMLGeneration } from "scripts/render-api/html-generation-helpers";
import { MarkdownRendererAPI } from "scripts/render-api/render-api";
import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options";
import RSS from 'rss';

export class Website
{
	public webpages: Webpage[] = [];
	public dependencies: Downloadable[] = [];
	public downloads: Downloadable[] = [];
	public batchFiles: TFile[] = [];
	public progress: number = 0;
	public destination: Path;
	public index: WebsiteIndex;
	public rss: RSS;
	public rssPath = AssetHandler.libraryPath.joinString("rss.xml").unixify().stringify;

	public globalGraph: GraphView;
	public fileTree: FileTree;
	public fileTreeAsset: Asset;
	private graphAsset: Asset;
	
	
	public static bodyClasses: string;
	public exportOptions: MarkdownWebpageRendererAPIOptions;
	
	/**
	 * Create a new website with the given files and options.
	 * @param files The files to include in the website.
	 * @param destination The folder to export the website to.
	 * @param options The api options to use for the export.
	 * @returns The website object.
	 */
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

			if (!MarkdownRendererAPI.isConvertable(file.extension)) continue;

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

		await this.createGraphAndFileTree();

		this.dependencies.push(...AssetHandler.getDownloads(this.exportOptions));
		this.downloads.push(...AssetHandler.getDownloads(this.exportOptions));


		this.filterDownloads(true);
		this.index.build(this.exportOptions);
		this.filterDownloads();

		if (this.exportOptions.addRSS)
		{
			this.createRSS();
		}
		
		console.log("Website created: ", this);
			
		return this;
	}

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

		// warn the user if they are trying to create an rss feed without a site url
		if (this.exportOptions.addRSS && (this.exportOptions.siteURL == "" || this.exportOptions.siteURL == undefined))
		{
			ExportLog.warning("Creating an RSS feed requires a site url to be set in the export settings.");
		}

	}

	private async initExport()
	{
		this.progress = 0;
		this.index = new WebsiteIndex(this);

		await MarkdownRendererAPI.beginBatch();

		this.giveWarnings();

		// wipe all temporary assets and reload dynamic assets
		ExportLog.progress(0, 1, "Initialize Export", "loading assets", "var(--color-yellow)");
		await AssetHandler.reloadAssets();

		Website.bodyClasses = await HTMLGeneration.getValidBodyClasses(true);

		// create file tree asset as placeholder until it is loaded later
		if (this.exportOptions.addFileNavigation)
		{
			ExportLog.progress(0, 1, "Generating Assets", "Generating file tree", "var(--color-yellow)");
			this.fileTree = new FileTree(this.batchFiles, false, true);
			this.fileTree.makeLinksWebStyle = this.exportOptions.webStylePaths ?? true;
			this.fileTree.showNestingIndicator = true;
			this.fileTree.generateWithItemsClosed = true;
			this.fileTree.showFileExtentionTags = true;
			this.fileTree.hideFileExtentionTags = ["md"]
			this.fileTree.title = this.exportOptions.siteName ?? app.vault.getName();
			this.fileTree.class = "file-tree";
			let tempTreeContainer = document.body.createDiv();
			await this.fileTree.insert(tempTreeContainer);
			this.fileTreeAsset = new Asset("file-tree.html", "dummy content", AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary);
		}

		// create graph asset as placeholder until it is loaded later
		if (this.exportOptions.addGraphView)
		{
			ExportLog.progress(0, 1, "Generating Assets", "Generating graph view", "var(--color-yellow)");
			this.globalGraph = new GraphView();
			let convertableFiles = this.batchFiles.filter((file) => MarkdownRendererAPI.isConvertable(file.extension));
			await this.globalGraph.init(convertableFiles, this.exportOptions);
			this.graphAsset = new Asset("graph-data.js", "dummy content", AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Temporary);
		}

		ExportLog.progress(1, 1, "Initializing index", "...", "var(--color-yellow)");
		await this.index.init();
	}

	private async createGraphAndFileTree()
	{
		if (this.exportOptions.addGraphView)
		{
			ExportLog.progress(0, 1, "Generating Assets", "Generating graph view", "var(--color-yellow)");
			this.graphAsset.content = this.globalGraph.getExportData();
		}
		
		if (this.exportOptions.addFileNavigation)
		{
			// Since we are adding the collapse button to the search, we need to remove it from the file tree
			if (this.exportOptions.addSearch) this.fileTree.container?.querySelector(".collapse-tree-button")?.remove();
			this.fileTreeAsset.content = this.fileTree.container?.innerHTML ?? "";
			this.fileTree.container?.remove();
		}
	}

	private async createRSS()
	{
		let author = this.exportOptions.authorName ||  undefined;

		this.rss = new RSS(
		{
			title: this.exportOptions.siteName ?? app.vault.getName(),
			description: "Obsidian digital garden",
			generator: "Webpage HTML Export plugin for Obsidian",
			feed_url: Path.joinStrings(this.exportOptions.siteURL ?? "", this.rssPath).stringify,
			site_url: this.exportOptions.siteURL ?? "",
			image_url: Path.joinStrings(this.exportOptions.siteURL ?? "", AssetHandler.favicon.relativePath.stringify).stringify,
			pubDate: new Date(this.index.exportTime),
			copyright: author,
			ttl: 60,
			custom_elements:
			[
				{ "dc:creator": author },
			]
		});

		// sort pages by modified time
		this.webpages.sort((a, b) => b.source.stat.mtime - a.source.stat.mtime);

		for (let page of this.webpages)
		{
			// only include convertable pages with content
			if (!page.isConvertable || page.sizerElement.innerText.length < 5) continue;

			let title = page.title;
			let url = Path.joinStrings(this.exportOptions.siteURL ?? "", page.relativePath.stringify).stringify;
			let guid = page.source.path;
			let date = new Date(page.source.stat.mtime);
			author = page.author ?? author;
			let media = page.metadataImageURL ?? "";
			let hasMedia = media != "";
			let description = page.descriptionOrShortenedContent;

			this.rss.item(
			{ 
				title: title,
				description: description,
				url: url,
				guid: guid,
				date: date,
				enclosure: hasMedia ? { url: media } : undefined,
				author: author,
				custom_elements: 
				[
					hasMedia ? { "content:encoded": `<figure><img src="${media}"></figure>` } : undefined,
				]
			});
		}

		let result = this.rss.xml();

		let rssAbsoultePath = this.destination.joinString(this.rssPath);
		let rssFileOld = await rssAbsoultePath.readAsString();
		if (rssFileOld)
		{
			let rssDocOld = new DOMParser().parseFromString(rssFileOld, "text/xml");
			let rssDocNew = new DOMParser().parseFromString(result, "text/xml");

			// insert old items into new rss and remove duplicates
			let oldItems = Array.from(rssDocOld.querySelectorAll("item")) as HTMLElement[];
			let newItems = Array.from(rssDocNew.querySelectorAll("item")) as HTMLElement[];

			oldItems = oldItems.filter((oldItem) => !newItems.find((newItem) => newItem.querySelector("guid")?.textContent == oldItem.querySelector("guid")?.textContent));
			oldItems = oldItems.filter((oldItem) => !this.index.removedFiles.contains(oldItem.querySelector("guid")?.textContent ?? ""));
			newItems = newItems.concat(oldItems);

			// remove all items from new rss
			newItems.forEach((item) => item.remove());

			// add items back to new rss
			let channel = rssDocNew.querySelector("channel");
			newItems.forEach((item) => channel?.appendChild(item));

			result = rssDocNew.documentElement.outerHTML;
		}

		let rss = new Asset("rss.xml", result, AssetType.Other, InlinePolicy.Download, false, Mutability.Temporary);
		rss.download(this.destination);
	}

	public getWebpageFromSource(sourcePath: string): Webpage | undefined
	{
		return this.webpages.find((page) => page.source.path == sourcePath);
	}

	private filterDownloads(onlyDuplicates: boolean = false)
	{
		// remove duplicates from the dependencies and downloads
		this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativePath.stringify == file.relativePath.stringify) == index);
		this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativePath.stringify == file.relativePath.stringify) == index);
		
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
				localThis.index.hasFileByPath(file.relativePath.stringify) &&
				file.filename.endsWith(".woff") || 
				file.filename.endsWith(".woff2") ||
				file.filename.endsWith(".otf") ||
				file.filename.endsWith(".ttf")
			)
			{
				return false;
			}

			// always include files that have been modified since last export
			let metadata = localThis.index.getMetadataForPath(file.relativePath.unixified().stringify);
			if (metadata && (file.modifiedTime > metadata.modifiedTime || metadata.sourceSize != file.content.length)) 
				return true;
			
			console.log("Excluding: " + file.relativePath.stringify);
			return false;
		}

		this.dependencies = this.dependencies.filter(filterFunction);
		this.downloads = this.downloads.filter(filterFunction);
	}

	// TODO: Seperate the icon and title into seperate functions
	public static async getTitleAndIcon(file: TAbstractFile, skipIcon:boolean = false): Promise<{ title: string; icon: string; isDefaultIcon: boolean; isDefaultTitle: boolean }>
	{
		if (!file) return { title: "", icon: "", isDefaultIcon: true, isDefaultTitle: true };

		let iconOutput = "";
		let iconProperty: string | undefined = "";
		let title = file.name;
		let isDefaultTitle = true;
		let useDefaultIcon = false;
		if (file instanceof TFile)
		{
			const fileCache = app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			const titleFromFrontmatter = frontmatter?.[Settings.titleProperty] ?? frontmatter?.["banner_header"]; // banner plugin support
			title = titleFromFrontmatter ?? file.basename ?? "";
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
