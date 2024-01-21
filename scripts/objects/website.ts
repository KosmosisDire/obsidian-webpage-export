import { Downloadable } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "./file-tree";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { TFile, getIcon } from "obsidian";
import { ExportPreset, MainSettings } from "scripts/settings/main-settings";
import { GraphView } from "./graph-view";
import { Path } from "scripts/utils/path";
import { RenderLog } from "scripts/html-generation/render-log";
import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import Minisearch from 'minisearch';
import HTMLExportPlugin from "scripts/main";

export class Website
{
	public webpages: Webpage[] = [];
	public dependencies: Downloadable[] = [];
	public downloads: Downloadable[] = [];
	public batchFiles: TFile[] = [];
	public progress: number = 0;
	public destination: Path;

	private globalGraph: GraphView;
	private fileTree: FileTree;
	private fileTreeHtml: string = "";

	public graphDataAsset: Asset;
	public fileTreeAsset: Asset;

	public exportTime: number = Date.now();
	public previousExportMetadata: any = undefined;
	
	public oldFilesSource: string[] = []; // old files that are no longer being exported. These have the format of the source in obsidian
	public oldFilesWeb: string[] = []; // old files that are no longer being exported. These have the format of the export in the website

	private static _validBodyClasses: string | undefined = undefined;
	public static getValidBodyClasses(): string
	{
		if (this._validBodyClasses) return this._validBodyClasses;

		let bodyClasses = document.body.classList;
		let validClasses = "";

		if (MainSettings.settings.sidebarsAlwaysCollapsible) validClasses += " sidebars-always-collapsible ";
		if (MainSettings.settings.inlineAssets) validClasses += " inlined-assets ";
		validClasses += " loading ";
		
		// keep body classes that are referenced in the styles
		for (var style of AssetHandler.getAssetsOfType(AssetType.Style))
		{
			if (typeof(style.content) != "string") continue;
			
			// this matches every class name with the dot
			let matches = style.content.matchAll(/(?![0-9].*$)\.(?!cm.*$)(?![0-9].*$)[^ ͼ\>\+\{\(\,\.\[\)\:\;\/]{1,}/gm);
			for (var match of matches)
			{
				let className = match[0].replace(".", "").trim();
				if (bodyClasses.contains(className)) validClasses += " " + className + " ";
			}
		}

		this._validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates\
		this._validBodyClasses = this._validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ");

		RenderLog.log("Body classes: " + this._validBodyClasses);
		
		return this._validBodyClasses;
	}

	private checkIncrementalExport(webpage: Webpage): boolean
	{		
		if (!this.previousExportMetadata || !MainSettings.settings.incrementalExport || MainSettings.settings.exportPreset != ExportPreset.Website) 
			return true;

		if (this.previousExportMetadata.pluginVersion != HTMLExportPlugin.plugin.manifest.version)
		{
			return true;
		}

		let webpagePath = webpage.exportPath.copy.makeUnixStyle().asString;
		let previousMetadata: {modifiedTime: number, sourceSize: number} 
							= this.previousExportMetadata.files[webpagePath];

		if (!previousMetadata) 
			return true;

		let currentMetadata = {modifiedTime: webpage.source.stat.mtime, sourceSize: webpage.source.stat.size};
		
		if (currentMetadata.modifiedTime > previousMetadata.modifiedTime ||
		    currentMetadata.sourceSize != previousMetadata.sourceSize)
		{
			return true;
		}

		return false;
	}

	private async getExportMetadata(): Promise<any>
	{
		let metadataPath = this.destination.join(Asset.libraryPath).joinString("metadata.json");
		let metadata = await metadataPath.readFileString();
		if (metadata) return JSON.parse(metadata);
		return undefined;
	}

	public async createWithFiles(files: TFile[], destination: Path): Promise<Website | undefined>
	{
		this.batchFiles = files;
		this.destination = destination;
		this.exportTime = Date.now();
		this.previousExportMetadata = await this.getExportMetadata();

		Website._validBodyClasses = undefined;

		await MarkdownRenderer.beginBatch();

		if (MainSettings.settings.includeGraphView)
		{
			let convertableFiles = this.batchFiles.filter((file) => MarkdownRenderer.isConvertable(file.extension));
			this.globalGraph = new GraphView(convertableFiles, MainSettings.settings.graphMinNodeSize, MainSettings.settings.graphMaxNodeSize);
		}
		
		if (MainSettings.settings.includeFileTree)
		{
			this.fileTree = new FileTree(this.batchFiles, false, true);
			this.fileTree.makeLinksWebStyle = MainSettings.settings.makeNamesWebStyle;
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

		if (MainSettings.settings.includeGraphView)
		{
			this.graphDataAsset = new Asset("graph-data.js", this.globalGraph.getExportData(), AssetType.Script, InlinePolicy.Auto, true, Mutability.Temporary, 0);
			this.graphDataAsset.load();
		}

		if (MainSettings.settings.includeFileTree)
		{
			this.fileTreeAsset = new Asset("file-tree.html", this.fileTreeHtml, AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary, 0);
			this.fileTreeAsset.load();
		}

		// find files to remove
		var filePaths = files.map((file) => new Path(file.path).makeUnixStyle().asString);
		var filesToRemove = this.previousExportMetadata?.files ? Object.keys(this.previousExportMetadata.files) : [];
		this.oldFilesSource = filesToRemove.filter((path) => !filePaths.includes(path) && !path.startsWith("lib/"));
		this.oldFilesWeb = this.oldFilesSource;
		this.oldFilesWeb = this.oldFilesSource.map((path) => new Path(path).makeWebStyle(MainSettings.settings.makeNamesWebStyle).replaceExtension(".md", ".html").replaceExtension(".canvas", ".html").makeUnixStyle().asString);
		
		console.log(filePaths);
		console.log(this.oldFilesSource);

		RenderLog.progress(0, files.length, "Generating HTML", "...", "var(--color-accent)");

		this.progress = 0;

		// if the plugin version changed notify the user that all files will be exported
		if (!this.previousExportMetadata || this.previousExportMetadata.pluginVersion != HTMLExportPlugin.plugin.manifest.version)
		{
			RenderLog.warning("New export or plugin version changed, exporting all files");
		}

		for (let file of files)
		{			
			if(MarkdownRenderer.checkCancelled()) return undefined;

			this.progress++;

			try
			{
				let filename = new Path(file.path).basename;
				let webpage = new Webpage(file, this, destination, this.batchFiles.length > 1, filename, MainSettings.settings.inlineAssets && this.batchFiles.length == 1);

				if (this.checkIncrementalExport(webpage)) // Skip creating the webpage if it's unchanged since last export
				{
					RenderLog.progress(this.progress, this.batchFiles.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");
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
			}
			catch (e)
			{
				RenderLog.error(e, "Could not export file: " + file.name);
				continue;
			}

			if(MarkdownRenderer.checkCancelled()) return undefined;
		}

		// if there are no webpages then just export dependencies in case they changed
		if (this.webpages.length == 0)
		{
			let assetDownloads = AssetHandler.getAssetDownloads();
			this.dependencies.push(...assetDownloads);
			this.downloads.push(...assetDownloads);
			console.log(this.downloads);
		}

		// create website metadata and index
		let metadataAsset = await this.createMetadata();
		this.dependencies.push(metadataAsset);
		this.downloads.push(metadataAsset);

		if (MainSettings.settings.includeSearchBar) // only create index if search bar is enabled
		{
			let index = await this.createIndex();
			this.dependencies.push(index);
			this.downloads.push(index);
		}

		this.filterDownloads();

		console.log(this.downloads);

		
		return this;
	}

	private filterDownloads()
	{
		// remove duplicates from the dependencies and downloads
		this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath) == index);
		this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath) == index);

		// remove files that have not been modified since last export
		if (this.previousExportMetadata && MainSettings.settings.incrementalExport &&
			this.previousExportMetadata.pluginVersion == HTMLExportPlugin.plugin.manifest.version)
		{
			let localThis = this;
			function filterFunction(file: Downloadable)
			{
				// always include .html files
				if (file.filename.endsWith(".html")) return true;

				let filePath = file.relativeDownloadPath.copy.makeUnixStyle().asString
				let fileMetadata = localThis.previousExportMetadata.files[filePath];

				// always exclude fonts if they exist
				if (fileMetadata &&
					(file.filename.endsWith(".woff") || 
				    file.filename.endsWith(".woff2") ||
					file.filename.endsWith(".otf") ||
					file.filename.endsWith(".ttf"))) return false;

				if (!fileMetadata) return true; // if the file doesn't exist in the metadata it's new
				if (fileMetadata.modifiedTime < file.modifiedTime) // if the file has been modified since last export
				{
					return true;
				}
				
				console.log("Skipping file: " + file.filename);
				return false;
			}

			this.dependencies = this.dependencies.filter(filterFunction);
			this.downloads = this.downloads.filter(filterFunction);
		}
	}

	public async createIndex(): Promise<Asset>
	{
		const stopWords = ["a", "about", "actually", "almost", "also", "although", "always", "am", "an", "and", "any", "are", "as", "at", "be", "became", "become", "but", "by", "can", "could", "did", "do", "does", "each", "either", "else", "for", "from", "had", "has", "have", "hence", "how", "i", "if", "in", "is", "it", "its", "just", "may", "maybe", "me", "might", "mine", "must", "my", "mine", "must", "my", "neither", "nor", "not", "of", "oh", "ok", "when", "where", "whereas", "wherever", "whenever", "whether", "which", "while", "who", "whom", "whoever", "whose", "why", "will", "with", "within", "without", "would", "yes", "yet", "you", "your"];
		const indexOptions = 
		{
			idField: 'path',
			fields: ['path', 'title', 'content', 'tags', 'headers'],
			storeFields: ['path', 'title', 'tags', 'headers'],
			processTerm: (term:any, _fieldName:any) =>
    			stopWords.includes(term) ? null : term.toLowerCase()
		}

		// load current index or create a new one if it doesn't exist
		let indexPath = this.destination.join(Asset.libraryPath).joinString("search-index.json");
		let indexJson = await indexPath.readFileString();
		let index: Minisearch<any>;
		if (indexJson)
		{
			index = Minisearch.loadJSON(indexJson, indexOptions);
		}
		else
		{
			index = new Minisearch(indexOptions);
		}

		function preprocessContent(contentElement: HTMLElement): string 
		{
			function getTextNodes(element: HTMLElement): Node[]
			{
				const textNodes = [];
				const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
		
				let node;
				while (node = walker.nextNode()) {
					textNodes.push(node);
				}
		
				return textNodes;
			}

			contentElement.querySelectorAll(".math, svg, img, .frontmatter, .metadata-container, .heading-after, style, script").forEach((el) => el.remove());

			const textNodes = getTextNodes(contentElement);

			let content = '';
			for (const node of textNodes) 
			{
				content += ' ' + node.textContent + ' ';
			}

			content = content.trim().replace(/\s+/g, ' ');

			return content;
		}

		const htmlWebpages = this.webpages.filter(webpage => webpage.document && webpage.contentElement);

		// progress counters
		let progressCount = 0;
		let totalCount = htmlWebpages.length + this.batchFiles.length + this.oldFilesWeb.length;


		for (const webpage of htmlWebpages) 
		{
			RenderLog.progress(progressCount, totalCount, "Indexing", "Adding: " + webpage.exportPath.asString, "var(--color-blue)");

			const content = preprocessContent(webpage.contentElement);

			if (content) 
			{
				const webpagePath = webpage.exportPath.copy.makeUnixStyle().asString;
				if (index.has(webpagePath)) 
				{
					index.discard(webpagePath);
				}

				index.add({
					path: webpagePath,
					title: Website.getTitle(webpage.source).title,
					content: content,
					tags: webpage.getTags(),
					headers: webpage.getHeaders(),
				});
			}
			else
			{
				console.warn(`No indexable content found for ${webpage.source.basename}`);
			}
			progressCount++;
		}

		// add other files to search
		for (const file of this.batchFiles)
		{
			RenderLog.progress(progressCount, totalCount, "Indexing", "Adding: " + file.path, "var(--color-blue)");
			if (MarkdownRenderer.isConvertable(file.extension)) continue;

			const filePath = new Path(file.path).makeUnixStyle().makeWebStyle(MainSettings.settings.makeNamesWebStyle).asString;
			if (index.has(filePath)) 
			{
				index.discard(filePath);
			}

			index.add({
				path: filePath,
				title: file.name,
				content: "",
				tags: [],
				headers: [],
			});
			progressCount++;
		}

		// remove old files
		for (const oldFile of this.oldFilesWeb)
		{
			RenderLog.progress(progressCount, totalCount, "Indexing", "Removing: " + oldFile, "var(--color-blue)");

			if (index.has(oldFile))
				index.discard(oldFile);

			progressCount++;
		}

		index.vacuum();

		return new Asset("search-index.json", JSON.stringify(index), AssetType.Other, InlinePolicy.NeverInline, false, Mutability.Temporary, 0);
	}

	public async createMetadata(): Promise<Asset>
	{
		// metadata stores a list of files in the export, their relative paths, and modification times. 
		// is also stores the vault name, the export time, and the plugin version
		let metadata: any = this.previousExportMetadata ?? {};
		metadata.vaultName = app.vault.getName();
		metadata.lastExport = this.exportTime;
		metadata.pluginVersion = HTMLExportPlugin.plugin.manifest.version;
		metadata.files = this.previousExportMetadata?.files ?? {};

		// progress counters
		let progressCount = 0;
		let totalCount = this.webpages.length + this.dependencies.length + this.oldFilesWeb.length;

		
		for (const page of this.webpages)
		{
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + page.exportPath.asString, "var(--color-cyan)");

			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = page.source.stat.size;
			
			let exportPath = new Path(page.source.path).makeUnixStyle().asString;
			metadata.files[exportPath] = fileInfo;
			progressCount++;
		}

		for (const file of this.dependencies)
		{
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + file.relativeDownloadPath.asString, "var(--color-cyan)");
			
			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = file.content.length;
			
			let exportPath = file.relativeDownloadPath.copy.makeUnixStyle().asString;
			metadata.files[exportPath] = fileInfo;
			progressCount++;
		}

		// remove old files
		for (const oldFile of this.oldFilesSource)
		{
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Removing: " + oldFile, "var(--color-cyan)");
			delete metadata.files[oldFile];
			progressCount++;
		}

		return new Asset("metadata.json", JSON.stringify(metadata, null, 2), AssetType.Other, InlinePolicy.NeverInline, false, Mutability.Temporary, 0);
	}

	public async deleteOldFiles()
	{
		for (let i = 0; i < this.oldFilesWeb.length; i++)
		{
			let file = this.oldFilesWeb[i];
			let path = this.destination.joinString(file);
			if (path.exists) 
			{
				await path.delete(true);
				RenderLog.progress(i, this.oldFilesWeb.length, "Deleting Old Files", "Deleting: " + path.asString, "var(--color-orange)");
			}
		}

		let folders = (await Path.getAllEmptyFoldersRecursive(this.destination));
		// sort by depth so that the deepest folders are deleted first
		folders.sort((a, b) => a.depth - b.depth);
		for	(let i = 0; i < folders.length; i++)
		{
			let folder = folders[i];
			RenderLog.progress(i, folders.length, "Deleting Empty Folders", "Deleting: " + folder.asString, "var(--color-orange)");
			await folder.directory.delete(true);
		}
	}

	public static getTitle(file: TFile): { title: string, icon: string, isDefaultIcon: boolean }
	{
		const { app } = HTMLExportPlugin.plugin;
		const { titleProperty } = MainSettings.settings;
		const fileCache = app.metadataCache.getFileCache(file);
		const frontmatter = fileCache?.frontmatter;
		const titleFromFrontmatter = frontmatter?.[titleProperty];
		const title = titleFromFrontmatter ?? file.basename;

		let iconProperty = frontmatter?.icon ?? frontmatter?.sticker;
		let isDefaultIcon = false;
		if (!iconProperty && MainSettings.settings.showDefaultTreeIcons) 
		{
			let isMedia = Asset.extentionToType(file.extension) == AssetType.Media;
			iconProperty = isMedia ? MainSettings.settings.defaultMediaIcon : MainSettings.settings.defaultFileIcon;
			if (file.extension == "canvas") iconProperty = "lucide//layout-dashboard";
			isDefaultIcon = true;
		}

		let iconOutput = Website.getIcon(iconProperty ?? "");
		return { title: title, icon: iconOutput, isDefaultIcon: isDefaultIcon };
	}

	public static getLucideIcon(iconName: string): string
	{
		const iconEl = getIcon(iconName);
		if (iconEl)
		{
			let svg = iconEl.outerHTML;
			iconEl.remove();
			return svg;
		}
		else 
		{
			console.error(`Invalid lucide icon name: ${iconName}`);
			return "�";
		}
	}

	public static getEmojiIcon(iconCode: string): string
	{
		let iconCodeInt = parseInt(iconCode, 16);
		if (!isNaN(iconCodeInt)) 
		{
			return String.fromCodePoint(iconCodeInt);
		} 
		else 
		{
			console.error(`Invalid sticker number in frontmatter: ${iconCode}`);
			return '�';
		}
	}

	public static getIcon(iconName: string): string
	{
		if (iconName.startsWith('emoji//'))
		{
			const iconCode = iconName.replace(/^emoji\/\//, '');
			return Website.getEmojiIcon(iconCode);
		}
		else if (iconName.startsWith('lucide//'))
		{
			const lucideIconName = iconName.replace(/^lucide\/\//, '');
			return Website.getLucideIcon(lucideIconName);
		}

		return iconName;
	}
	
}
