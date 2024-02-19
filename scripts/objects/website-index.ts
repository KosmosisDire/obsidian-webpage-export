import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import { Website } from "./website";
import Minisearch from 'minisearch';
import { ExportLog } from "scripts/html-generation/render-log";
import { Path } from "scripts/utils/path";
import { ExportPreset, Settings, SettingsPage } from "scripts/settings/settings";
import HTMLExportPlugin from "scripts/main";
import { TFile } from "obsidian";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { MarkdownRendererAPI } from "scripts/render-api";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options";

export class WebsiteIndex
{
	private web: Website;

	public exportTime: number = Date.now();
	public previousMetadata: 
	{
		vaultName: string,
		lastExport: number,
		pluginVersion: string,
		validBodyClasses: string,
		useCustomHeadContent: boolean,
		useCustomFavicon: boolean,
		mainDependencies: string[],
		files: string[],
		fileInfo: 
		{
			[path: string]: 
			{
				modifiedTime: number,
				sourceSize: number,
				exportedPath: string,
				dependencies: string[]
			}
		}
	} | undefined = undefined;
	public index: Minisearch<any> | undefined = undefined;
	private stopWords = ["a", "about", "actually", "almost", "also", "although", "always", "am", "an", "and", "any", "are", "as", "at", "be", "became", "become", "but", "by", "can", "could", "did", "do", "does", "each", "either", "else", "for", "from", "had", "has", "have", "hence", "how", "i", "if", "in", "is", "it", "its", "just", "may", "maybe", "me", "might", "mine", "must", "my", "mine", "must", "my", "neither", "nor", "not", "of", "oh", "ok", "when", "where", "whereas", "wherever", "whenever", "whether", "which", "while", "who", "whom", "whoever", "whose", "why", "will", "with", "within", "without", "would", "yes", "yet", "you", "your"];
	private indexOptions = 
	{
		idField: 'path',
		fields: ['path', 'title', 'content', 'tags', 'headers'],
		storeFields: ['path', 'title', 'tags', 'headers'],
		processTerm: (term:any, _fieldName:any) =>
			this.stopWords.includes(term) ? null : term.toLowerCase()
	}
	// public exportOptions: MarkdownWebpageRendererAPIOptions = new MarkdownWebpageRendererAPIOptions();
	
	private allFiles: string[] = []; // all files that are being exported
	public removedFiles: string[] = []; // old files that are no longer being exported
	public addedFiles: string[] = []; // new files that are being exported
	private keptDependencies: string[] = []; // dependencies that are being kept

	constructor(website: Website)
	{
		this.web = website;
	}

	public async init(): Promise<boolean>
	{
		this.exportTime = Date.now();
		this.previousMetadata = await this.getExportMetadata();
		this.index = await this.getExportIndex();

		// Notify the user if all files will be exported
		this.shouldApplyIncrementalExport(true);

		if (!this.previousMetadata) return false;
		return true;
	}

	public shouldApplyIncrementalExport(printWarning: boolean = false): boolean
	{
		let result = true;

		if (!Settings.onlyExportModified) result = false;
		if (Settings.exportPreset != ExportPreset.Website) result = false;

		if (this.isVersionChanged() && this.previousMetadata)
		{
			if (printWarning) ExportLog.warning("Plugin version changed. All files will be re-exported.");
			result = false;
		}
		
		if (this.previousMetadata == undefined)
		{
			if (printWarning) ExportLog.warning("No existing export metadata found. All files will be exported.");
			result = false;
		}
		
		if (this.index == undefined)
		{
			if (printWarning) ExportLog.warning("No existing search index found. All files will be exported.");
			result = false;
		}

		let rssAbsoultePath = this.web.destination.joinString(this.web.rssPath);
		if (!rssAbsoultePath.exists && this.web.exportOptions.addRSS)
		{
			if (printWarning) ExportLog.warning("No existing RSS feed found. All files will be exported.");
			result = false;
		}

		let customHeadChanged = this.previousMetadata && (this.previousMetadata?.useCustomHeadContent != (Settings.customHeadContentPath != ""));
		if (customHeadChanged)
		{
			if (printWarning) ExportLog.warning(`${Settings.customHeadContentPath != "" ? "Added" : "Removed"} custom head content. All files will be re-exported.`);
			result = false;
		}

		let customFaviconChanged = this.previousMetadata && (this.previousMetadata?.useCustomFavicon != (Settings.faviconPath != ""));
		if (customFaviconChanged)
		{
			if (printWarning) ExportLog.warning(`${Settings.faviconPath != "" ? "Added" : "Removed"} custom favicon. All files will be re-exported.`);
			result = false;
		}

		return result;
	}

	private async getExportMetadata(): Promise<any>
	{
		try
		{
			let metadataPath = this.web.destination.join(AssetHandler.libraryPath).joinString("metadata.json");
			let metadata = await metadataPath.readFileString();
			if (metadata) return JSON.parse(metadata);
		}
		catch (e)
		{
			ExportLog.warning(e, "Failed to parse metadata.json. Recreating metadata.");
		}

		return undefined;
	}

	private async getExportIndex(): Promise<Minisearch<any> | undefined>
	{
		let index: Minisearch<any> | undefined = undefined;

		try
		{
			// load current index or create a new one if it doesn't exist
			let indexPath = this.web.destination.join(AssetHandler.libraryPath).joinString("search-index.json");
			let indexJson = await indexPath.readFileString();
			if (indexJson)
			{
				index = Minisearch.loadJSON(indexJson, this.indexOptions);
			}
		}
		catch (e)
		{
			ExportLog.warning(e, "Failed to load search-index.json. Creating new index.");
			index = undefined;
		}

		return index;
	}

	public async createIndex(): Promise<Asset | undefined>
	{
		if (!this.index)
		{
			this.index = new Minisearch(this.indexOptions);
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

		const htmlWebpages = this.web.webpages.filter(webpage => webpage.document && webpage.viewElement);

		// progress counters
		let progressCount = 0;
		let totalCount = htmlWebpages.length + this.web.dependencies.length + this.removedFiles.length;


		for (const webpage of htmlWebpages) 
		{
			if(MarkdownRendererAPI.checkCancelled()) return undefined;
			ExportLog.progress(progressCount, totalCount, "Indexing", "Adding: " + webpage.relativePath.asString, "var(--color-blue)");

			const content = preprocessContent(webpage.viewElement);

			if (content) 
			{
				const webpagePath = webpage.relativePath.copy.makeUnixStyle().asString;
				if (this.index.has(webpagePath)) 
				{
					this.index.discard(webpagePath);
				}

				this.index.add({
					path: webpagePath,
					title: webpage.title,
					content: content,
					tags: webpage.tags,
					headers: webpage.headings.map((header) => header.heading),
				});
			}
			else
			{
				console.warn(`No indexable content found for ${webpage.source.basename}`);
			}
			progressCount++;
		}

		// add other files to search
		for (const file of this.web.dependencies)
		{
			if(MarkdownRendererAPI.checkCancelled()) return undefined;
			
			const filePath = file.relativePath.asString;
			if (this.index.has(filePath)) 
			{
				continue;
			}

			ExportLog.progress(progressCount, totalCount, "Indexing", "Adding: " + file.filename, "var(--color-blue)");
			
			this.index.add({
				path: filePath,
				title: file.relativePath.basename,
				content: "",
				tags: [],
				headers: [],
			});

			progressCount++;
		}

		// remove old files
		for (const oldFile of this.removedFiles)
		{
			if(MarkdownRendererAPI.checkCancelled()) return undefined;
			ExportLog.progress(progressCount, totalCount, "Indexing", "Removing: " + oldFile, "var(--color-blue)");

			if (this.index.has(oldFile))
			this.index.discard(oldFile);

			progressCount++;
		}

		ExportLog.progress(totalCount, totalCount, "Indexing", "Cleanup index", "var(--color-blue)");
		this.index.vacuum();

		return new Asset("search-index.json", JSON.stringify(this.index), AssetType.Other, InlinePolicy.Download, false, Mutability.Temporary);
	}

	public async createMetadata(options: MarkdownWebpageRendererAPIOptions): Promise<Asset | undefined>
	{
		// metadata stores a list of files in the export, their relative paths, and modification times. 
		// is also stores the vault name, the export time, and the plugin version
		let metadata: any = this.previousMetadata ? JSON.parse(JSON.stringify(this.previousMetadata)) : {};
		metadata.vaultName = this.web.exportOptions.siteName;
		metadata.lastExport = this.exportTime;
		metadata.pluginVersion = HTMLExportPlugin.plugin.manifest.version;
		metadata.validBodyClasses = Website.validBodyClasses;
		metadata.useCustomHeadContent = Settings.customHeadContentPath != "";
		metadata.useCustomFavicon = Settings.faviconPath != "";
		metadata.files = this.allFiles;
		metadata.mainDependencies = AssetHandler.getDownloads(options).map((asset) => asset.relativePath.copy.makeUnixStyle().asString);
		if (!metadata.fileInfo) metadata.fileInfo = {};

		// progress counters
		let progressCount = 0;
		let totalCount = this.web.webpages.length + this.web.dependencies.length + this.removedFiles.length;
		
		for (const page of this.web.webpages)
		{
			if(MarkdownRendererAPI.checkCancelled()) return undefined;
			ExportLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + page.relativePath.asString, "var(--color-cyan)");

			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = page.source.stat.size;
			fileInfo.exportedPath = page.relativePath.copy.makeUnixStyle().asString;
			fileInfo.dependencies = page.dependencies.map((asset) => asset.relativePath.copy.makeUnixStyle().asString);
			
			let exportPath = new Path(page.source.path).makeUnixStyle().asString;
			metadata.fileInfo[exportPath] = fileInfo;
			progressCount++;
		}

		for (const file of this.web.dependencies)
		{
			if(MarkdownRendererAPI.checkCancelled()) return undefined;
			ExportLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + file.relativePath.asString, "var(--color-cyan)");

			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = file.content.length;
			fileInfo.exportedPath = file.relativePath.copy.makeUnixStyle().asString;
			fileInfo.dependencies = [];

			let exportPath = file.relativePath.copy.makeUnixStyle().asString;
			metadata.fileInfo[exportPath] = fileInfo;
			progressCount++;
		}

		// remove old files
		for (const oldFile of this.removedFiles)
		{
			if(MarkdownRendererAPI.checkCancelled()) return undefined;
			ExportLog.progress(progressCount, totalCount, "Creating Metadata", "Removing: " + oldFile, "var(--color-cyan)");
			delete metadata.fileInfo[oldFile];
			progressCount++;
		}

		return new Asset("metadata.json", JSON.stringify(metadata, null, 2), AssetType.Other, InlinePolicy.Download, false, Mutability.Temporary);
	}

	public async deleteOldFiles(options?: MarkdownWebpageRendererAPIOptions)
	{
		options = Object.assign(new MarkdownWebpageRendererAPIOptions(), options);
		if (!this.previousMetadata) return;
		if (this.removedFiles.length == 0)
		{
			ExportLog.log("No old files to delete");
			return;
		}

		for (let i = 0; i < this.removedFiles.length; i++)
		{
			if(MarkdownRendererAPI.checkCancelled()) return;
			let removedPath = this.removedFiles[i];
			console.log("Removing old file: ", this.previousMetadata.fileInfo);
			let exportedPath = new Path(this.previousMetadata.fileInfo[removedPath].exportedPath);
			exportedPath.makeWebStyle(options.webStylePaths);

			let deletePath = this.web.destination.join(exportedPath);
			console.log("Deleting old file: " + deletePath.asString);
			await deletePath.delete(true);
			ExportLog.progress(i, this.removedFiles.length, "Deleting Old Files", "Deleting: " + deletePath.asString, "var(--color-orange)");
		}

		let folders = (await Path.getAllEmptyFoldersRecursive(this.web.destination));
		if(MarkdownRendererAPI.checkCancelled()) return;

		// sort by depth so that the deepest folders are deleted first
		folders.sort((a, b) => a.depth - b.depth);
		for	(let i = 0; i < folders.length; i++)
		{
			if(MarkdownRendererAPI.checkCancelled()) return;
			let folder = folders[i];
			ExportLog.progress(i, folders.length, "Deleting Empty Folders", "Deleting: " + folder.asString, "var(--color-orange)");
			await folder.directory.delete(true);
		}
	}

	public async updateBodyClasses()
	{
		if (!this.previousMetadata) return;
		if (this.previousMetadata.validBodyClasses == Website.validBodyClasses) return;
		console.log("Updating body classes of previous export");

		let convertableFiles = this.previousMetadata.files.filter((path) => MarkdownRendererAPI.isConvertable(path.split(".").pop() ?? ""));
		let exportedPaths = convertableFiles.map((path) => new Path(this.previousMetadata?.fileInfo[path]?.exportedPath ?? "", this.web.destination.asString));
		exportedPaths = exportedPaths.filter((path) => !path.isEmpty);

		for (let i = 0; i < exportedPaths.length; i++)
		{
			if(MarkdownRendererAPI.checkCancelled()) return;
			let exportedPath = exportedPaths[i];
			let content = await exportedPath.readFileString();
			if (!content) continue;
			let dom = new DOMParser().parseFromString(content, "text/html");
			let body = dom.querySelector("body");
			if (!body) continue;
			body.className = Website.validBodyClasses;
			await exportedPath.writeFile(dom.documentElement.outerHTML);
			ExportLog.progress(i, exportedPaths.length, "Updating Body Classes", "Updating: " + exportedPath.asString, "var(--color-yellow)");
		}
	}

	public isFileChanged(file: TFile): boolean
	{
		let metadata = this.getMetadataForFile(file);
		if (!metadata)
		{
			return true;
		}
		return metadata.modifiedTime < file.stat.mtime || metadata.sourceSize !== file.stat.size;
	}

	public hasFile(file: TFile): boolean
	{
		return this.getMetadataForFile(file) !== undefined;
	}

	public hasFileByPath(path: string): boolean
	{
		return this.getMetadataForPath(path) !== undefined;
	}

	public getMetadataForFile(file: TFile): {modifiedTime: number,sourceSize: number,exportedPath: string,dependencies: string[]} | undefined
	{
		return this.previousMetadata?.fileInfo[file.path];
	}

	public getMetadataForPath(path: string):  {modifiedTime: number,sourceSize: number,exportedPath: string,dependencies: string[]} | undefined
	{
		return this.previousMetadata?.fileInfo[path];
	}

	public isVersionChanged(): boolean
	{
		return this.previousMetadata?.pluginVersion !== HTMLExportPlugin.plugin.manifest.version;
	}

	public getAllFiles(): string[]
	{
		this.allFiles = [];

		for (let file of this.web.batchFiles)
		{
			this.allFiles.push(file.path);
		}

		for (let asset of this.web.dependencies)
		{
			if (this.allFiles.some((path) => Path.equal(path, asset.relativePath.asString))) continue;

			this.allFiles.push(asset.relativePath.copy.makeUnixStyle().asString);
		}

		return this.allFiles;
	}

	public getRemovedFiles(): string[]
	{
		if (!this.previousMetadata) return [];

		this.removedFiles = this.previousMetadata.files.filter((path) => 
		{
			return 	!this.allFiles.includes(path) && 
					!this.previousMetadata?.mainDependencies.includes(path) &&
					!this.keptDependencies.includes(path);
		});

		console.log("Old files: ", this.removedFiles);

		return this.removedFiles;
	}

	public getAddedFiles(): string[]
	{
		if (!this.previousMetadata) return [];

		this.addedFiles = this.allFiles.filter(path => !this.previousMetadata?.files.includes(path));
		console.log("New files: ", this.addedFiles);

		return this.addedFiles;
	}

	public getKeptDependencies(): string[]
	{
		if (!this.previousMetadata) return [];

		this.keptDependencies = [];
		
		for (let file of this.allFiles)
		{
			let dep = this.previousMetadata.fileInfo[file]?.dependencies ?? [];
			this.keptDependencies.push(...dep);
		}

		// add kept dependencies to the list of all files and remove duplicates
		this.allFiles.push(...this.keptDependencies);
		this.allFiles = this.allFiles.filter((path, index) => this.allFiles.findIndex((f) => f == path) == index);

		return this.keptDependencies;
	}

	public async build(options: MarkdownWebpageRendererAPIOptions): Promise<boolean>
	{
		this.getAllFiles();
		this.getKeptDependencies();
		this.getRemovedFiles();
		this.getAddedFiles();

		// create website metadata and index
		let metadataAsset = await this.createMetadata(options);
		if (!metadataAsset) return false;
		this.web.dependencies.push(metadataAsset);
		this.web.downloads.push(metadataAsset);

		if (options.addSearch) // only create index if search bar is enabled
		{
			let index = await this.createIndex();
			if (!index) return false;
			this.web.dependencies.push(index);
			this.web.downloads.push(index);
		}

		return true;
	}
}
