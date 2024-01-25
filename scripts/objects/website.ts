import { Downloadable } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "./file-tree";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { TFile, getIcon } from "obsidian";
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

	private async initExport()
	{
		this.progress = 0;
		this.index = new WebsiteIndex(this);

		Website.validBodyClasses = HTMLGeneration.getValidBodyClasses(true);

		await MarkdownRenderer.beginBatch();

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

		await AssetHandler.reloadAssets();

		if (Settings.settings.includeGraphView)
		{
			this.graphDataAsset = new Asset("graph-data.js", this.globalGraph.getExportData(), AssetType.Script, InlinePolicy.Auto, true, Mutability.Temporary, 0);
			this.graphDataAsset.load();
		}

		if (Settings.settings.includeFileTree)
		{
			this.fileTreeAsset = new Asset("file-tree.html", this.fileTreeHtml, AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary, 0);
			this.fileTreeAsset.load();
		}

		await this.index.init();
	}

	public async createWithFiles(files: TFile[], destination: Path): Promise<Website | undefined>
	{
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
			
			if (!webpage.isConvertable) webpage.downloads.push(await webpage.getSelfDownloadable());
			let createdPage = await webpage.create();
			if(!createdPage) 
			{
				if (MarkdownRenderer.cancelled) return undefined;
				
				continue;
			}

			this.webpages.push(webpage);
			this.downloads.push(...webpage.downloads);
			this.dependencies.push(...webpage.dependencies);
		}

		// if there are no webpages then just export dependencies in case they changed
		if (this.webpages.length == 0)
		{
			let assetDownloads = AssetHandler.getAssetDownloads();
			this.dependencies.push(...assetDownloads);
			this.downloads.push(...assetDownloads);
		}

		this.index.build();
		
		this.filterDownloads();

		return this;
	}

	private filterDownloads()
	{
		// remove duplicates from the dependencies and downloads
		this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath) == index);
		this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath) == index);

		// remove files that have not been modified since last export
		if (!this.index.shouldApplyIncrementalExport()) return;
		
		let localThis = this;
		function filterFunction(file: Downloadable)
		{
			// always include .html files
			if (file.filename.endsWith(".html")) return true;

			// always exclude fonts if they exist
			if (localThis.index.hasFileByPath(file.relativeDownloadPath.asString) &&
				file.filename.endsWith(".woff") || 
				file.filename.endsWith(".woff2") ||
				file.filename.endsWith(".otf") ||
				file.filename.endsWith(".ttf"))
				{
					console.log("Skipping font: " + file.filename);
					return false;
				}
			
			console.log("Skipping file: " + file.filename);
			return false;
		}

		this.dependencies = this.dependencies.filter(filterFunction);
		this.downloads = this.downloads.filter(filterFunction);
		
	}

	public static getTitle(file: TFile): { title: string, icon: string, isDefaultIcon: boolean }
	{
		const { app } = HTMLExportPlugin.plugin;
		const { titleProperty } = Settings.settings;
		const fileCache = app.metadataCache.getFileCache(file);
		const frontmatter = fileCache?.frontmatter;
		const titleFromFrontmatter = frontmatter?.[titleProperty];
		const title = titleFromFrontmatter ?? file.basename;

		let iconProperty = frontmatter?.icon ?? frontmatter?.sticker;
		let isDefaultIcon = false;
		if (!iconProperty && Settings.settings.showDefaultTreeIcons) 
		{
			let isMedia = Asset.extentionToType(file.extension) == AssetType.Media;
			iconProperty = isMedia ? Settings.settings.defaultMediaIcon : Settings.settings.defaultFileIcon;
			if (file.extension == "canvas") iconProperty = "lucide//layout-dashboard";
			isDefaultIcon = true;
		}

		let iconOutput = HTMLGeneration.getIcon(iconProperty ?? "");
		return { title: title, icon: iconOutput, isDefaultIcon: isDefaultIcon };
	}
}
