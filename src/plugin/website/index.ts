import { Attachment } from "src/plugin/utils/downloadable";
import { Website } from "./website";
import { Webpage } from "./webpage";
import { Notice, TFile } from "obsidian";
import { ExportPipelineOptions } from "src/plugin/website/pipeline-options.js";
import { AssetHandler } from "src/plugin/asset-loaders/asset-handler";
import { ExportLog } from "src/plugin/render-api/render-api";
import Minisearch from 'minisearch';
import { Path } from "src/plugin/utils/path";
import HTMLExportPlugin from "src/plugin/main";
import { AssetType } from "src/plugin/asset-loaders/asset-types";
import RSS from 'rss';
import { AssetLoader } from "src/plugin/asset-loaders/base-asset";
import { FileData, WebpageData, WebsiteData } from "src/shared/website-data";
import { Utils } from "src/plugin/utils/utils";
import { Shared } from "src/shared/shared";
import { WebpageTemplate } from "./webpage-template";

export class Index
{
	private website: Website;
	private sourceToWebpage: Map<string, Webpage> = new Map();
	private sourceToAttachment: Map<string, Attachment> = new Map();
	private exportOptions: ExportPipelineOptions;

	private stopWords = ["a", "about", "actually", "almost", "also", "although", "always", "am", "an", "and", "any", "are", "as", "at", "be", "became", "become", "but", "by", "can", "could", "did", "do", "does", "each", "either", "else", "for", "from", "had", "has", "have", "hence", "how", "i", "if", "in", "is", "it", "its", "just", "may", "maybe", "me", "might", "mine", "must", "my", "mine", "must", "my", "neither", "nor", "not", "of", "oh", "ok", "when", "where", "whereas", "wherever", "whenever", "whether", "which", "while", "who", "whom", "whoever", "whose", "why", "will", "with", "within", "without", "would", "yes", "yet", "you", "your"];
	private minisearchOptions = 
	{
		idField: 'path',
		fields: ['title', 'aliases', 'headers', 'tags', 'path', 'content'],
		storeFields: ['title', 'aliases', 'headers', 'tags', 'path'],
		processTerm: (term:any, _fieldName:any) =>
			this.stopWords.includes(term) ? null : term.toLowerCase()
	}

	public webpages: Webpage[] = [];
	public attachments: Attachment[] = [];
	public attachmentsShownInTree: Attachment[] = [];

	public oldWebsiteData: WebsiteData | undefined = undefined;
	public websiteData: WebsiteData = {} as WebsiteData;
	public minisearch: Minisearch<any> | undefined = undefined;
	public rssFeed: RSS | undefined = undefined;
	public rssPath: Path;
	public rssURL: Path;
	public rssAsset: AssetLoader | undefined = undefined;

	public deletedFiles: string[] = [];
	public newFiles: Attachment[] = [];
	public updatedFiles: Attachment[] = [];
	public allFiles: Attachment[] = [];

	public async load(website: Website, options: ExportPipelineOptions)
	{
		this.website = website;
		this.exportOptions = options;

		try
		{
			// try to load website data
			const metadataPath = this.website.destination.join(AssetHandler.libraryPath).joinString(Shared.metadataFileName);
	
			const metadata = await metadataPath.readAsString();
			if (metadata) 
			{
				this.oldWebsiteData = JSON.parse(metadata) as WebsiteData;
				this.websiteData = JSON.parse(metadata) as WebsiteData;

				this.deletedFiles = this.oldWebsiteData.allFiles ?? [];
			}
			else
			{
				console.log("No metadata found. Creating new metadata.");
				this.websiteData = {} as WebsiteData;
				this.websiteData.createdTime = Date.now();
			}
			
			// default values
			if (!this.websiteData.shownInTree) this.websiteData.shownInTree = [];
			if (!this.websiteData.attachments) this.websiteData.attachments = [];
			if (!this.websiteData.allFiles) this.websiteData.allFiles = [];
			if (!this.websiteData.webpages) this.websiteData.webpages = {};
			if (!this.websiteData.fileInfo) this.websiteData.fileInfo = {};
			if (!this.websiteData.sourceToTarget) this.websiteData.sourceToTarget = {};
			this.websiteData.featureOptions = 
			{
				backlinks: options.backlinkOptions,
				tags: options.tagOptions,
				alias: options.aliasOptions,
				properties: options.propertiesOptions,
				fileNavigation: options.fileNavigationOptions,
				search: options.searchOptions,
				outline: options.outlineOptions,
				themeToggle: options.themeToggleOptions,
				graphView: options.graphViewOptions,
				sidebar: options.sidebarOptions,
				customHead: options.customHeadOptions,
				document: options.documentOptions,
				rss: options.rssOptions,
				linkPreview: options.linkPreviewOptions,
			};
			
			// set global values
			this.websiteData.modifiedTime = Date.now();
			this.websiteData.siteName = this.website.exportOptions.siteName ?? "";
			this.websiteData.vaultName = app.vault.getName();
			this.websiteData.exportRoot = this.website.exportOptions.exportRoot ?? "";
			this.websiteData.baseURL = this.website.exportOptions.rssOptions.siteUrl ?? "";
			this.websiteData.pluginVersion = HTMLExportPlugin.pluginVersion;
			this.websiteData.themeName = this.website.exportOptions.themeName ?? "Default";
			this.websiteData.bodyClasses = await WebpageTemplate.getValidBodyClasses() ?? "";
			this.websiteData.hasFavicon = this.exportOptions.faviconPath != "";
		}
		catch (e)
		{
			ExportLog.warning(e, "Failed to load metadata.json. Recreating metadata.");
		}

		// load current index or create a new one if it doesn't exist
		try
		{			
			const indexPath = this.website.destination.join(AssetHandler.libraryPath).joinString(Shared.searchIndexFileName);
			const indexJson = await indexPath.readAsString();
			if (indexJson)
			{
				this.minisearch = Minisearch.loadJSON(indexJson, this.minisearchOptions);
			}
			else throw new Error("No index found");
		}
		catch (e)
		{
			ExportLog.log(e, "No search-index.json exists. Creating new index.");
			this.minisearch = new Minisearch(this.minisearchOptions);
		}

		this.rssPath = AssetHandler.generateSavePath("rss.xml", AssetType.Other, this.website.destination);
		this.rssURL = AssetHandler.generateSavePath("rss.xml", AssetType.Other, new Path(this.exportOptions.rssOptions.siteUrl ?? "")).absolute();
	}

	public async finalize()
	{

		this.websiteData.shownInTree = this.attachmentsShownInTree.map((attachment) => attachment.targetPath.path);
		this.websiteData.allFiles = this.allFiles.map((file) => file.targetPath.path);

		// remove deleted files from website data
		for (const file of this.deletedFiles)
		{
			delete this.websiteData.fileInfo[file];
			delete this.websiteData.webpages[file];

			this.websiteData.attachments.remove(file);
			this.websiteData.allFiles.remove(file);
			this.websiteData.shownInTree.remove(file);

			const webpages = Object.values(this.websiteData.webpages);
			for (const webpage of webpages)
			{
				webpage.attachments.remove(file);
				webpage.backlinks.remove(file);
			}
		}
	}

	/**
	 * Simply deletes metadata.json and search-index.json
	 */
	public async clearCache()
	{
		const metadataPath = this.website.destination.join(AssetHandler.libraryPath).joinString(Shared.metadataFileName);
		const indexPath = this.website.destination.join(AssetHandler.libraryPath).joinString(Shared.searchIndexFileName);

		await metadataPath.delete();
		await indexPath.delete();
	}

	public async createRSSFeed()
	{
		let author = this.exportOptions.rssOptions.authorName || undefined;

		this.rssFeed = new RSS(
		{
			title: this.exportOptions.siteName ?? app.vault.getName(),
			description: "Obsidian digital garden",
			generator: "Webpage HTML Export plugin for Obsidian",
			feed_url: this.rssURL.path,
			site_url: this.exportOptions.rssOptions.siteUrl ?? "",
			image_url: Path.joinStrings(this.exportOptions.rssOptions.siteUrl ?? "", AssetHandler.favicon.targetPath.path).path,
			pubDate: new Date(this.websiteData.modifiedTime),
			copyright: author,
			ttl: 60,
			custom_elements:
			[
				{ "dc:creator": author },
			]
		});
		
		for (const page of this.webpages)
		{
			const title = page.title;
			const url = Path.joinStrings(this.exportOptions.rssOptions.siteUrl ?? "", page.targetPath.path).path;
			const guid = page.source.path;
			const date = page.outputData.rssDate ?? new Date(page.source.stat.mtime);
			author = page.outputData.author ?? author;
			const media = page.outputData.coverImageURL ?? "";
			const hasMedia = media != "";
			const description = page.outputData.descriptionOrShortenedContent;

			this.rssFeed.item(
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

		let rssXML = this.rssFeed.xml();

		const rssFileOld = await this.rssPath.readAsString();
		if (rssFileOld)
		{
			const rssDocOld = new DOMParser().parseFromString(rssFileOld, "text/xml");
			const rssDocNew = new DOMParser().parseFromString(rssXML, "text/xml");

			// insert old items into new rss and remove duplicates
			let oldItems = Array.from(rssDocOld.querySelectorAll("item"));
			let newItems = Array.from(rssDocNew.querySelectorAll("item"));

			// filter out deleted files and remove duplicated items favoring the new rss
			oldItems = oldItems.filter((oldItem) => !this.deletedFiles.includes(oldItem.querySelector("guid")?.textContent ?? ""));
			oldItems = oldItems.filter((oldItem) => !newItems.some((newItem) => newItem.querySelector("guid")?.textContent == oldItem.querySelector("guid")?.textContent));
			
			// remove all items from new rss
			newItems.forEach((item) => item.remove());
			
			
			// add items back to new rss with old items
			newItems = newItems.concat(oldItems);
			const channel = rssDocNew.querySelector("channel");
			newItems.forEach((item) => channel?.appendChild(item));

			rssXML = rssDocNew.documentElement.outerHTML;
		}

		const rssAsset = new Attachment(rssXML, this.rssPath, null, this.exportOptions);
		this.addFile(rssAsset);
	}

	public async addFile(file: Attachment | Webpage)
	{
		// determine if the file is new, updated, or unchanged
		let updatedFile = false;
		let newFile = false;
		const key = file.targetPath.path;
		if(!this.hadFile(key))
		{
			this.newFiles.push(file);
			newFile = true;
		}
		else
		{
			const oldData = this.getOldFile(key);
			if (oldData)
			{
				if (oldData.modifiedTime != file.sourceStat.mtime || oldData.sourceSize != file.sourceStat.size)
				{
					this.updatedFiles.push(file);
					updatedFile = true;
				}
			}

			this.deletedFiles.remove(file.targetPath.path);

			// if we didn't update the file make sure we don't delete the file's attachments
			// if we did update the file we don't need to worry, because the attachments will be recreated
			if (!updatedFile)
			{
				const oldWebpage = this.getOldWebpage(key);
				if (oldWebpage)
				{
					for (const attachment of oldWebpage.attachments)
					{
						this.deletedFiles.remove(attachment);
					}
				}
			}
		}

		// add the file to the list of all files
		if (!this.allFiles.includes(file))
		{
			this.allFiles.push(file);
			this.allFiles.sort((a, b) => (b.source?.stat.mtime ?? 0) - (a.source?.stat.mtime ?? 0));
		}

		// add the file to the list of files shown in the tree
		if (file.showInTree && !this.attachmentsShownInTree.includes(file))
			this.attachmentsShownInTree.push(file);

		if (file instanceof Webpage && file.sourcePath && !this.sourceToWebpage.has(file.sourcePath))
		{
			this.sourceToWebpage.set(file.sourcePath, file);
		}

		if (file instanceof Attachment && file.sourcePath && !this.sourceToAttachment.has(file.sourcePath))
		{
			this.sourceToAttachment.set(file.sourcePath, file);
		}

		// only update the index if the file is new or updated
		if (newFile || updatedFile)
		{
			if (file instanceof Webpage)
			{
				await this.updateWebpage(file);
			}
			else
			{
				this.updateAttachment(file);
			}
		}
	}

	public async addFiles(files: (Attachment | Webpage)[])
	{
		for (const file of files)
		{
			this.addFile(file);
		}
	}

	public async removeFile(file: Attachment | Webpage)
	{
		if (file instanceof Webpage)
		{
			this.removeWebpage(file);
		}
		else
		{
			this.removeAttachment(file);
		}
	}

	public async removeFiles(files: (Attachment | Webpage)[])
	{
		for (const file of files)
		{
			this.removeFile(file);
		}
	}

	public getFileFromSrc(src: string, sourceFile: TFile): Attachment | undefined
	{
		const attachedFile = this.website.getFilePathFromSrc(src, sourceFile.path);
		return this.getFile(attachedFile.pathname);
	}

	public getAttachment(sourcePath: string): Attachment | undefined
	{
		return this.sourceToAttachment.get(sourcePath);
	}

	public getWebpage(sourcePath: string): Webpage | undefined
	{
		return this.sourceToWebpage.get(sourcePath);
	}

	public getFile(sourcePath: string, preferAttachment: boolean = false): Attachment | Webpage | undefined
	{
		if (preferAttachment)
		{
			return this.sourceToAttachment.get(sourcePath) ?? this.sourceToWebpage.get(sourcePath);
		}
		
		return this.sourceToWebpage.get(sourcePath) ?? this.sourceToAttachment.get(sourcePath);
	}

	public hasFile(sourcePath: string): boolean
	{
		return this.sourceToWebpage.has(sourcePath);
	}

	public hadFile(targetPath: string): boolean
	{
		return this.oldWebsiteData?.fileInfo[targetPath] != undefined;
	}

	public getOldFile(targetPath: string): FileData | undefined
	{
		return this.oldWebsiteData?.fileInfo[targetPath];
	}

	public getOldWebpage(targetPath: string): WebpageData | undefined
	{
		return this.oldWebsiteData?.webpages[targetPath];
	}

	public async applyToOldWebpages(callback: (document: Document, oldData: WebpageData) => Promise<any>)
	{
		const promises: Promise<any>[] = [];

		if (this.oldWebsiteData)
		{
			const webpages = Object.entries(this.oldWebsiteData.webpages);
			for (const [path, data] of webpages)
			{
				// skip files that were deleted
				if (this.deletedFiles.includes(path)) continue;

				const filePath = new Path(path, this.website.destination.path);
				const fileData = await filePath.readAsBuffer();
				if (fileData)
				{
					const document = new DOMParser().parseFromString(fileData.toString(), "text/html");
					await callback(document, data);
					promises.push(filePath.write(`<!DOCTYPE html>\n${document.documentElement.outerHTML}`));
				}
			}
		}

		Promise.all(promises);
	}

	private async addWebpageToWebsiteData(webpage: Webpage)
	{
		if (webpage.sourcePath && this.websiteData)
		{
			const webpageInfo: WebpageData = {} as WebpageData;
			webpageInfo.title = webpage.title;
			webpageInfo.icon = webpage.icon;
			webpageInfo.description = webpage.outputData.descriptionOrShortenedContent;
			webpageInfo.aliases = webpage.outputData.aliases;
			webpageInfo.inlineTags = webpage.outputData.inlineTags;
			webpageInfo.frontmatterTags = webpage.outputData.frontmatterTags;
			webpageInfo.headers = await webpage.outputData.renderedHeadings;
			webpageInfo.links = webpage.outputData.linksToOtherFiles;
			webpageInfo.author = webpage.outputData.author;
			webpageInfo.coverImageURL = webpage.outputData.coverImageURL;
			webpageInfo.fullURL = webpage.outputData.fullURL;
			webpageInfo.pathToRoot = webpage.outputData.pathToRoot == "" ? "." : webpage.outputData.pathToRoot;
			webpageInfo.attachments = webpage.attachments.map((download) => download.targetPath.path);
			
			webpageInfo.createdTime = webpage.source.stat.ctime;
			webpageInfo.modifiedTime = webpage.source.stat.mtime;
			webpageInfo.sourceSize = webpage.source.stat.size;
			webpageInfo.sourcePath = new Path(webpage.source.path).path;
			webpageInfo.exportPath = webpage.targetPath.path;
			webpageInfo.showInTree = webpage.showInTree;
			webpageInfo.treeOrder = webpage.treeOrder;
			webpageInfo.backlinks = webpage.outputData.backlinks.map((backlink) => backlink.targetPath.path);
			webpageInfo.type = webpage.type;
			if (this.exportOptions.combineAsSingleFile)
			{
				webpageInfo.data = webpage.data.toString();
			}

			// get file info version of the webpage
			const fileInfo: FileData = {} as FileData;
			fileInfo.createdTime = webpageInfo.createdTime;
			fileInfo.modifiedTime = webpageInfo.modifiedTime;
			fileInfo.sourceSize = webpageInfo.sourceSize;
			fileInfo.sourcePath = webpageInfo.sourcePath;
			fileInfo.exportPath = webpageInfo.exportPath;
			fileInfo.showInTree = webpageInfo.showInTree;
			fileInfo.treeOrder = webpageInfo.treeOrder;
			fileInfo.backlinks = webpageInfo.backlinks;
			fileInfo.type = webpageInfo.type;
			fileInfo.data = null;
			

			this.websiteData.webpages[webpageInfo.exportPath] = webpageInfo;
			this.websiteData.fileInfo[webpageInfo.exportPath] = fileInfo;
			this.websiteData.sourceToTarget[webpageInfo.sourcePath] = webpageInfo.exportPath;
		}
	}

	private async addWebpageToMinisearch(webpage: Webpage)
	{
		if (this.minisearch)
		{
			const webpagePath = webpage.targetPath.path;
			if (this.minisearch.has(webpagePath)) 
			{
				this.minisearch.discard(webpagePath);
			}

			const headersInfo = await webpage.outputData.renderedHeadings;
			if (headersInfo.length > 0 && headersInfo[0].level == 1 && headersInfo[0].heading == webpage.title) headersInfo.shift();
			const headers = headersInfo.map((header) => header.heading);

			this.minisearch.add({
				title: webpage.title,
				aliases: webpage.outputData.aliases,
				headers: headers,
				tags: webpage.outputData.allTags,
				path: webpagePath,
				content: webpage.outputData.description + " " + webpage.outputData.searchContent,
			});
		}
	}

	private async updateWebpage(webpage: Webpage)
	{
		if (!this.webpages.includes(webpage))
		{
			this.webpages.push(webpage);
			this.webpages.sort((a, b) => b.source.stat.mtime - a.source.stat.mtime);
		}

		await this.addWebpageToWebsiteData(webpage);
		await this.addWebpageToMinisearch(webpage);
	}

	private addAttachmentToWebsiteData(attachment: Attachment): string
	{
		const exportPath = attachment.targetPath.path;
		const key = exportPath;

		if (this.websiteData)
		{
			const fileInfo: FileData = {} as FileData;
			fileInfo.createdTime = attachment.sourceStat.ctime;
			fileInfo.modifiedTime = attachment.sourceStat.mtime;
			fileInfo.sourceSize = attachment.sourceStat.size;
			fileInfo.sourcePath = attachment.sourcePath ?? "";
			fileInfo.exportPath = exportPath;
			fileInfo.showInTree = attachment.showInTree;
			fileInfo.treeOrder = attachment.treeOrder;
			fileInfo.backlinks = [];
			fileInfo.type = AssetLoader.extentionToType(attachment.targetPath.extension);
			fileInfo.data = null;
			if (this.exportOptions.combineAsSingleFile)
			{
				if (attachment.data instanceof Buffer) fileInfo.data = attachment.data.toString("base64");
				else fileInfo.data = attachment.data.toString();
			}

			this.websiteData.fileInfo[key] = fileInfo;
			if (!this.websiteData.attachments.includes(key)) this.websiteData.attachments.push(key);
			this.websiteData.sourceToTarget[fileInfo.sourcePath] = fileInfo.exportPath;
		}

		return key;
	}

	private updateAttachment(attachment: Attachment)
	{
		this.addAttachmentToWebsiteData(attachment);

		if (!this.attachments.includes(attachment))
		{
			this.attachments.push(attachment);
			this.attachments.sort((a, b) => (b.source?.stat.mtime ?? 0) - (a.source?.stat.mtime ?? 0));
		}
	}

	private removeWebpage(webpage: Webpage)
	{
		if (webpage.sourcePath && !this.sourceToWebpage.has(webpage.sourcePath))
		{
			this.sourceToWebpage.delete(webpage.sourcePath);
		}

		const key = webpage.targetPath.path;
		delete this.websiteData.webpages[key];
		delete this.websiteData.fileInfo[key];

		if (this.minisearch)
		{
			if (this.minisearch.has(key)) 
			{
				this.minisearch.discard(key);
			}
		}
	}

	private removeAttachment(attachment: Attachment)
	{
		if (attachment.sourcePath && !this.sourceToAttachment.has(attachment.sourcePath))
		{
			this.sourceToAttachment.delete(attachment.sourcePath);
		}

		const key = attachment.targetPath.path;
		delete this.websiteData.fileInfo[key];
	}

	public websiteDataAttachment(): Attachment
	{
		const websiteDataString = JSON.stringify(this.websiteData);
		const websiteDataPath = AssetHandler.generateSavePath("metadata.json", AssetType.Other, this.website.destination);
		return new Attachment(websiteDataString, websiteDataPath, null, this.exportOptions);
	}

	public indexDataAttachment(): Attachment
	{
		const indexDataString = JSON.stringify(this.minisearch);
		const indexDataPath = AssetHandler.generateSavePath("search-index.json", AssetType.Other, this.website.destination);
		return new Attachment(indexDataString, indexDataPath, null, this.exportOptions);
	}

}
