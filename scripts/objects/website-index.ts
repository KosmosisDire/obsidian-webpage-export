import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import { Website } from "./website";
import Minisearch from 'minisearch';
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { RenderLog } from "scripts/html-generation/render-log";
import { Path } from "scripts/utils/path";
import { ExportPreset, Settings } from "scripts/settings/settings";
import HTMLExportPlugin from "scripts/main";
import { TFile } from "obsidian";
import { AssetHandler } from "scripts/html-generation/asset-handler";

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
	
	private allFiles: string[] = []; // all files that are being exported
	private removedFiles: string[] = []; // old files that are no longer being exported
	private addedFiles: string[] = []; // new files that are being exported
	private keptDependencies: string[] = []; // dependencies that are being kept

	constructor(website: Website)
	{
		this.web = website;
	}

	public async init(): Promise<boolean>
	{
		this.exportTime = Date.now();
		this.previousMetadata = await this.getExportMetadata();

		// if the plugin version changed notify the user that all files will be exported
		if (!this.shouldApplyIncrementalExport() && Settings.settings.incrementalExport)
		{
			RenderLog.warning("New export or plugin version changed, exporting all files");
		}

		if (!this.previousMetadata) return false;
		return true;
	}

	public shouldApplyIncrementalExport(): boolean
	{
		return Settings.settings.incrementalExport && 
			   !this.isVersionChanged() && 
			   Settings.settings.exportPreset == ExportPreset.Website
			   && this.previousMetadata != undefined;
	}

	private async getExportMetadata(): Promise<any>
	{
		let metadataPath = this.web.destination.join(Asset.libraryPath).joinString("metadata.json");
		let metadata = await metadataPath.readFileString();
		if (metadata) return JSON.parse(metadata);
		return undefined;
	}

	public async createIndex(): Promise<Asset | undefined>
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
		let indexPath = this.web.destination.join(Asset.libraryPath).joinString("search-index.json");
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

		const htmlWebpages = this.web.webpages.filter(webpage => webpage.document && webpage.contentElement);

		// progress counters
		let progressCount = 0;
		let totalCount = htmlWebpages.length + this.web.dependencies.length + this.removedFiles.length;


		for (const webpage of htmlWebpages) 
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
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
					title: (await Website.getTitleAndIcon(webpage.source)).title,
					content: content,
					tags: webpage.getTags(),
					headers: webpage.getHeadings().map((header) => header.heading),
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
			if(MarkdownRenderer.checkCancelled()) return undefined;
			
			const filePath = file.relativeDownloadPath.asString;
			if (index.has(filePath)) 
			{
				continue;
			}

			RenderLog.progress(progressCount, totalCount, "Indexing", "Adding: " + file.filename, "var(--color-blue)");
			
			index.add({
				path: filePath,
				title: file.relativeDownloadPath.basename,
				content: "",
				tags: [],
				headers: [],
			});

			progressCount++;
		}

		// remove old files
		for (const oldFile of this.removedFiles)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Indexing", "Removing: " + oldFile, "var(--color-blue)");

			if (index.has(oldFile))
				index.discard(oldFile);

			progressCount++;
		}

		RenderLog.progress(totalCount, totalCount, "Indexing", "Cleanup index", "var(--color-blue)");
		index.vacuum();

		return new Asset("search-index.json", JSON.stringify(index), AssetType.Other, InlinePolicy.NeverInline, false, Mutability.Temporary);
	}

	public async createMetadata(): Promise<Asset | undefined>
	{
		// metadata stores a list of files in the export, their relative paths, and modification times. 
		// is also stores the vault name, the export time, and the plugin version
		let metadata: any = this.previousMetadata ? JSON.parse(JSON.stringify(this.previousMetadata)) : {};
		metadata.vaultName = app.vault.getName();
		metadata.lastExport = this.exportTime;
		metadata.pluginVersion = HTMLExportPlugin.plugin.manifest.version;
		metadata.validBodyClasses = Website.validBodyClasses;
		metadata.files = this.allFiles;
		metadata.mainDependencies = AssetHandler.getAssetDownloads().map((asset) => asset.relativeDownloadPath.copy.makeUnixStyle().asString);
		if (!metadata.fileInfo) metadata.fileInfo = {};

		// progress counters
		let progressCount = 0;
		let totalCount = this.web.webpages.length + this.web.dependencies.length + this.removedFiles.length;
		
		for (const page of this.web.webpages)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + page.exportPath.asString, "var(--color-cyan)");

			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = page.source.stat.size;
			fileInfo.exportedPath = page.exportPath.copy.makeUnixStyle().asString;
			fileInfo.dependencies = page.dependencies.map((asset) => asset.relativeDownloadPath.copy.makeUnixStyle().asString);
			
			let exportPath = new Path(page.source.path).makeUnixStyle().asString;
			metadata.fileInfo[exportPath] = fileInfo;
			progressCount++;
		}

		for (const file of this.web.dependencies)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + file.relativeDownloadPath.asString, "var(--color-cyan)");

			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = file.content.length;
			fileInfo.exportedPath = file.relativeDownloadPath.copy.makeUnixStyle().asString;
			fileInfo.dependencies = [];

			let exportPath = file.relativeDownloadPath.copy.makeUnixStyle().asString;
			metadata.fileInfo[exportPath] = fileInfo;
			progressCount++;
		}

		// remove old files
		for (const oldFile of this.removedFiles)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Removing: " + oldFile, "var(--color-cyan)");
			delete metadata.fileInfo[oldFile];
			progressCount++;
		}

		return new Asset("metadata.json", JSON.stringify(metadata, null, 2), AssetType.Other, InlinePolicy.NeverInline, false, Mutability.Temporary);
	}

	public async deleteOldFiles()
	{
		if (!this.previousMetadata) return;
		if (this.removedFiles.length == 0)
		{
			RenderLog.log("No old files to delete");
			return;
		}

		for (let i = 0; i < this.removedFiles.length; i++)
		{
			if(MarkdownRenderer.checkCancelled()) return;
			let removedPath = this.removedFiles[i];
			console.log("Removing old file: ", this.previousMetadata.fileInfo);
			let exportedPath = new Path(this.previousMetadata.fileInfo[removedPath].exportedPath);
			exportedPath.makeWebStyle(Settings.settings.makeNamesWebStyle);

			let deletePath = this.web.destination.join(exportedPath);
			console.log("Deleting old file: " + deletePath.asString);
			await deletePath.delete(true);
			RenderLog.progress(i, this.removedFiles.length, "Deleting Old Files", "Deleting: " + deletePath.asString, "var(--color-orange)");
		}

		let folders = (await Path.getAllEmptyFoldersRecursive(this.web.destination));
		if(MarkdownRenderer.checkCancelled()) return;

		// sort by depth so that the deepest folders are deleted first
		folders.sort((a, b) => a.depth - b.depth);
		for	(let i = 0; i < folders.length; i++)
		{
			if(MarkdownRenderer.checkCancelled()) return;
			let folder = folders[i];
			RenderLog.progress(i, folders.length, "Deleting Empty Folders", "Deleting: " + folder.asString, "var(--color-orange)");
			await folder.directory.delete(true);
		}
	}

	public async updateBodyClasses()
	{
		if (!this.previousMetadata) return;
		if (this.previousMetadata.validBodyClasses == Website.validBodyClasses) return;
		console.log("Updating body classes from: ", this.previousMetadata.validBodyClasses, " to: ", Website.validBodyClasses);

		let convertableFiles = this.previousMetadata.files.filter((path) => MarkdownRenderer.isConvertable(path.split(".").pop() ?? ""));
		let exportedPaths = convertableFiles.map((path) => new Path(this.previousMetadata?.fileInfo[path]?.exportedPath ?? "", this.web.destination.asString));
		exportedPaths = exportedPaths.filter((path) => !path.isEmpty);

		for (let i = 0; i < exportedPaths.length; i++)
		{
			if(MarkdownRenderer.checkCancelled()) return;
			let exportedPath = exportedPaths[i];
			let content = await exportedPath.readFileString();
			if (!content) continue;
			let dom = new DOMParser().parseFromString(content, "text/html");
			let body = dom.querySelector("body");
			if (!body) continue;
			body.className = Website.validBodyClasses;
			await exportedPath.writeFile(dom.documentElement.outerHTML);
			RenderLog.progress(i, exportedPaths.length, "Updating Body Classes", "Updating: " + exportedPath.asString, "var(--color-yellow)");
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
			if (this.allFiles.some((path) => Path.equal(path, asset.relativeDownloadPath.asString))) continue;

			this.allFiles.push(asset.relativeDownloadPath.copy.makeUnixStyle().asString);
		}

		console.log("All files: ", this.allFiles);

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

		console.log("Kept dependencies: ", this.keptDependencies);

		return this.keptDependencies;
	}

	public async build(): Promise<boolean>
	{
		this.getAllFiles();
		this.getKeptDependencies();
		this.getRemovedFiles();
		this.getAddedFiles();

		// create website metadata and index
		let metadataAsset = await this.createMetadata();
		if (!metadataAsset) return false;
		this.web.dependencies.push(metadataAsset);
		this.web.downloads.push(metadataAsset);

		if (Settings.settings.includeSearchBar) // only create index if search bar is enabled
		{
			let index = await this.createIndex();
			if (!index) return false;
			this.web.dependencies.push(index);
			this.web.downloads.push(index);
		}

		return true;
	}
}
