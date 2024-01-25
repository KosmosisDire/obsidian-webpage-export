import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import { Website } from "./website";
import Minisearch from 'minisearch';
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { RenderLog } from "scripts/html-generation/render-log";
import { Path } from "scripts/utils/path";
import { ExportPreset, Settings } from "scripts/settings/settings";
import HTMLExportPlugin from "scripts/main";
import { TFile } from "obsidian";

export class WebsiteIndex
{
	private web: Website;

	public exportTime: number = Date.now();
	public previousExportMetadata: any = undefined;
	
	public oldFilesSource: string[] = []; // old files that are no longer being exported. These have the format of the source in obsidian
	public oldFilesWeb: string[] = []; // old files that are no longer being exported. These have the format of the export in the website

	
	constructor(website: Website)
	{
		this.web = website;
	}

	public async init(): Promise<boolean>
	{
		this.exportTime = Date.now();
		this.previousExportMetadata = await this.getExportMetadata();

		// if the plugin version changed notify the user that all files will be exported
		if (!this.shouldApplyIncrementalExport() && Settings.settings.incrementalExport)
		{
			RenderLog.warning("New export or plugin version changed, exporting all files");
		}

		if (!this.previousExportMetadata) return false;
		return true;
	}

	public shouldApplyIncrementalExport(): boolean
	{
		return Settings.settings.incrementalExport && 
			   !this.isVersionChanged() && 
			   Settings.settings.exportPreset == ExportPreset.Website
			   && this.previousExportMetadata != undefined;
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
		// filter batchfiles to exclude convertable files
		let nonHTMLFiles = this.web.batchFiles.filter((file) => !MarkdownRenderer.isConvertable(file.extension));

		// progress counters
		let progressCount = 0;
		let totalCount = htmlWebpages.length + nonHTMLFiles.length + this.oldFilesWeb.length;


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
		for (const file of nonHTMLFiles)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			
			const filePath = new Path(file.path).makeUnixStyle().makeWebStyle(Settings.settings.makeNamesWebStyle).asString;
			if (index.has(filePath)) 
			{
				continue;
			}

			RenderLog.progress(progressCount, totalCount, "Indexing", "Adding: " + file.name, "var(--color-blue)");
			
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
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Indexing", "Removing: " + oldFile, "var(--color-blue)");

			if (index.has(oldFile))
				index.discard(oldFile);

			progressCount++;
		}

		RenderLog.progress(totalCount, totalCount, "Indexing", "Cleanup index", "var(--color-blue)");
		index.vacuum();

		return new Asset("search-index.json", JSON.stringify(index), AssetType.Other, InlinePolicy.NeverInline, false, Mutability.Temporary, 0);
	}

	public async createMetadata(): Promise<Asset | undefined>
	{
		// metadata stores a list of files in the export, their relative paths, and modification times. 
		// is also stores the vault name, the export time, and the plugin version
		let metadata: any = this.previousExportMetadata ?? {};
		metadata.vaultName = app.vault.getName();
		metadata.lastExport = this.exportTime;
		metadata.pluginVersion = HTMLExportPlugin.plugin.manifest.version;
		metadata.validBodyClasses = Website.validBodyClasses;
		metadata.files = this.previousExportMetadata?.files ?? {};

		// progress counters
		let progressCount = 0;
		let totalCount = this.web.webpages.length + this.web.dependencies.length + this.oldFilesWeb.length;
		
		for (const page of this.web.webpages)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + page.exportPath.asString, "var(--color-cyan)");

			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = page.source.stat.size;
			fileInfo.exportedPath = page.exportPath.asString;
			
			let exportPath = new Path(page.source.path).makeUnixStyle().asString;
			metadata.files[exportPath] = fileInfo;
			progressCount++;
		}

		for (const file of this.web.dependencies)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
			RenderLog.progress(progressCount, totalCount, "Creating Metadata", "Adding: " + file.relativeDownloadPath.asString, "var(--color-cyan)");
			
			let fileInfo: any = {};
			fileInfo.modifiedTime = this.exportTime;
			fileInfo.sourceSize = file.content.length;
			fileInfo.exportedPath = file.relativeDownloadPath.asString;
			
			let exportPath = file.relativeDownloadPath.copy.makeUnixStyle().asString;
			metadata.files[exportPath] = fileInfo;
			progressCount++;
		}

		// remove old files
		for (const oldFile of this.oldFilesSource)
		{
			if(MarkdownRenderer.checkCancelled()) return undefined;
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
			if(MarkdownRenderer.checkCancelled()) return;
			let file = this.oldFilesWeb[i];
			let path = this.web.destination.joinString(file);
			if (path.exists) 
			{
				await path.delete(true);
				RenderLog.progress(i, this.oldFilesWeb.length, "Deleting Old Files", "Deleting: " + path.asString, "var(--color-orange)");
			}
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

	public isFileChanged(file: TFile): boolean
	{
		let metadata = this.getMetadataForFile(file);
		if (!metadata)
		{
			console.log("File not found in metadata: " + file.path);
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

	public getMetadataForFile(file: TFile): any
	{
		return this.previousExportMetadata?.files[file.path];
	}

	public getMetadataForPath(path: string): any
	{
		return this.previousExportMetadata?.files[path];
	}

	public isVersionChanged(): boolean
	{
		return this.previousExportMetadata?.pluginVersion !== HTMLExportPlugin.plugin.manifest.version;
	}

	public getOldFiles(): string[]
	{
		if (!this.previousExportMetadata) return [];

		this.oldFilesSource = [];
		
		for (const file in this.previousExportMetadata.files)
		{
			if (!this.web.batchFiles.find(f => f.path == file))
			{
				this.oldFilesSource.push(file);
				this.oldFilesWeb.push(this.previousExportMetadata.files[file].exportedPath);
			}
		}

		return this.oldFilesSource;
	}

	public async build(): Promise<boolean>
	{
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
