import { Downloadable } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "./file-tree";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { FileManager, TAbstractFile, TFile, TFolder, getIcon } from "obsidian";
import { ExportPreset, Settings } from "scripts/settings/settings";
import { GraphView } from "./graph-view";
import { Path } from "scripts/utils/path";
import { RenderLog } from "scripts/html-generation/render-log";
import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import HTMLExportPlugin from "scripts/main";
import { WebsiteIndex } from "./website-index";
import { HTMLGeneration } from "scripts/html-generation/html-generation-helpers";

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

	private giveWarnings()
	{
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-icon-folder"))
		{
			// @ts-ignore
			let fileToIconName = app.plugins.plugins['obsidian-icon-folder'].data;
			let noteIconsEnabled = fileToIconName.settings.iconsInNotesEnabled ?? false;
			if (!noteIconsEnabled)
			{
				RenderLog.warning("For Iconize plugin support, enable \"Toggle icons while editing notes\" in the Iconize plugin's settings.");
			}
		}
	}

	private async initExport()
	{
		this.progress = 0;
		this.index = new WebsiteIndex(this);

		await MarkdownRenderer.beginBatch();

		this.giveWarnings();
		Website.validBodyClasses = await HTMLGeneration.getValidBodyClasses(true);

		if (Settings.settings.includeGraphView)
		{
			let convertableFiles = this.batchFiles.filter((file) => MarkdownRenderer.isConvertable(file.extension));
			this.globalGraph = new GraphView(convertableFiles, Settings.settings.graphMinNodeSize, Settings.settings.graphMaxNodeSize);
		}
		
		if (Settings.settings.includeFileTree)
		{
			this.fileTree = new FileTree(this.batchFiles, false, true);
			this.fileTree.makeLinksWebStyle = Settings.settings.makeNamesWebStyle;
			this.fileTree.showNestingIndicator = true;
			this.fileTree.generateWithItemsClosed = true;
			this.fileTree.showFileExtentionTags = true;
			this.fileTree.hideFileExtentionTags = ["md"]
			this.fileTree.title = app.vault.getName();
			this.fileTree.class = "file-tree";

			let tempTreeContainer = document.body.createDiv();
			await this.fileTree.generateTreeWithContainer(tempTreeContainer);
			this.fileTreeHtml = tempTreeContainer.innerHTML;
			tempTreeContainer.remove();
		}

		// wipe all temporary assets and reload dynamic assets
		await AssetHandler.reloadAssets();

		if (Settings.settings.includeGraphView)
		{
			this.graphDataAsset = new Asset("graph-data.js", this.globalGraph.getExportData(), AssetType.Script, InlinePolicy.Auto, true, Mutability.Temporary);
			this.graphDataAsset.load();
		}

		if (Settings.settings.includeFileTree)
		{
			this.fileTreeAsset = new Asset("file-tree.html", this.fileTreeHtml, AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary);
			this.fileTreeAsset.load();
		}

		// add body classes as an html asset
		new Asset("body-classes.html", Website.validBodyClasses, AssetType.HTML, InlinePolicy.None, true, Mutability.Temporary);

		await this.index.init();
	}

	public async createWithFiles(files: TFile[], destination: Path): Promise<Website | undefined>
	{
		console.log("Creating website with files: ", files);
		this.batchFiles = files;
		this.destination = destination;
		await this.initExport();

		let useIncrementalExport = this.index.shouldApplyIncrementalExport();

		for (let file of files)
		{			
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(this.progress, this.batchFiles.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");
			this.progress++;
			
			let filename = new Path(file.path).basename;
			let webpage = new Webpage(file, this, destination, this.batchFiles.length > 1, filename, Settings.settings.inlineAssets && this.batchFiles.length == 1);
			let shouldExportPage = (useIncrementalExport && this.index.isFileChanged(file)) || !useIncrementalExport;
			if (!shouldExportPage) continue;
			
			let createdPage = await webpage.create();
			if(!createdPage) continue;

			this.webpages.push(webpage);
			this.downloads.push(...webpage.dependencies);
			this.downloads.push(await webpage.getSelfDownloadable());
			this.dependencies.push(...webpage.dependencies);
		}

		this.dependencies.push(...AssetHandler.getAssetDownloads());
		this.downloads.push(...AssetHandler.getAssetDownloads());

		this.filterDownloads(true);
		this.index.build();
		this.filterDownloads();
		
		return this;
	}
	
	private filterDownloads(onlyDuplicates: boolean = false)
	{
		// remove duplicates from the dependencies and downloads
		this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath) == index);
		this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath) == index);
		
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
				localThis.index.hasFileByPath(file.relativeDownloadPath.asString) &&
				file.filename.endsWith(".woff") || 
				file.filename.endsWith(".woff2") ||
				file.filename.endsWith(".otf") ||
				file.filename.endsWith(".ttf")
			)
			{
				return false;
			}

			// always include files that have been modified since last export
			let metadata = localThis.index.getMetadataForPath(file.relativeDownloadPath.copy.makeUnixStyle().asString);
			if (metadata && (file.modifiedTime > metadata.modifiedTime || metadata.sourceSize != file.content.length)) 
				return true;
			
			console.log("Filtering file: ", file);
			return false;
		}

		this.dependencies = this.dependencies.filter(filterFunction);
		this.downloads = this.downloads.filter(filterFunction);
	}

	public static async getTitleAndIcon(file: TAbstractFile): Promise<{ title: string; icon: string; isDefaultIcon: boolean; }>
	{
		const { app } = HTMLExportPlugin.plugin;
		const { titleProperty } = Settings.settings;

		let iconOutput = "";
		let iconProperty: string | undefined = "";
		let title = file.name;
		let useDefaultIcon = false;
		if (file instanceof TFile)
		{
			const fileCache = app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			const titleFromFrontmatter = frontmatter?.[titleProperty] ?? frontmatter?.banner_header; // banner plugin support
			title = titleFromFrontmatter ?? file.basename;

			iconProperty = frontmatter?.icon ?? frontmatter?.sticker ?? frontmatter?.banner_icon; // banner plugin support
			if (!iconProperty && Settings.settings.showDefaultTreeIcons) 
			{
				useDefaultIcon = true;
				let isMedia = Asset.extentionToType(file.extension) == AssetType.Media;
				iconProperty = isMedia ? Settings.settings.defaultMediaIcon : Settings.settings.defaultFileIcon;
				if (file.extension == "canvas") iconProperty = "lucide//layout-dashboard";
			}
		}

		if (file instanceof TFolder && Settings.settings.showDefaultTreeIcons)
		{
			iconProperty = Settings.settings.defaultFolderIcon;
			useDefaultIcon = true;
		}

		iconOutput = HTMLGeneration.getIcon(iconProperty ?? "");

		// add iconize icon as frontmatter if iconize exists
		let isUnchangedNotEmojiNotHTML = (iconProperty == iconOutput && iconOutput.length < 40) && !/\p{Emoji}/u.test(iconOutput) && !iconOutput.includes("<") && !iconOutput.includes(">");
		let parsedAsIconize = false;
		if (file instanceof TFolder) console.log(useDefaultIcon, iconProperty, isUnchangedNotEmojiNotHTML);
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

					console.log("Added iconize icon: ", file.path);
				}
			}
		}

		if (!parsedAsIconize && isUnchangedNotEmojiNotHTML) iconOutput = "";

		return { title: title, icon: iconOutput, isDefaultIcon: useDefaultIcon };
	}
}
