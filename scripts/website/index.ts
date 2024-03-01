import { Attachment } from "scripts/utils/downloadable";
import { Website } from "./website";
import { Webpage } from "./webpage";
import { TFile } from "obsidian";
import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options";
import { AssetHandler } from "scripts/assets-system/asset-handler";
import { ExportLog } from "scripts/render-api/render-api";
import Minisearch from 'minisearch';
import { Path } from "scripts/utils/path";
import HTMLExportPlugin from "scripts/main";
import { Settings } from "scripts/settings/settings";
import { AssetType } from "scripts/assets-system/asset-types";
import RSS from 'rss';
import { WebAsset } from "scripts/assets-system/base-asset";

export interface FileData
{
	createdTime: number;
	modifiedTime: number;
	sourceSize: number;
	sourcePath: string;
	exportPath: string;
	showInTree: boolean;
	treeOrder: number;
}

export interface WebpageData extends FileData
{
	headers: {heading: string, level: number, id: string}[];
	aliases: string[];
	tags: string[];
	backlinks: string[];
	links: string[];
	attachments: string[];

	title: string;
	pathToRoot: string;
	icon: string;
	description: string;
	author: string;
	coverImageURL: string;
	fullURL: string;
}

export interface WebsiteData
{
	webpages: {[targetPath: string]: WebpageData},
	fileInfo: {[targetPath: string]: FileData},
	sourceToTarget: {[sourcePath: string]: string},
	attachments: string[];
	shownInTree: string[];
	allFiles: string[];

	siteName: string,
	createdTime: number;
	modifiedTime: number;
	pluginVersion: string,
	exportRoot: string,
	themeName: string,
	bodyClasses: string,
	addCustomHead: boolean,
	addFavicon: boolean
}

export class Index
{
	private website: Website;
	private sourceToWebpage: Map<string, Webpage> = new Map();
	private sourceToAttachment: Map<string, Attachment> = new Map();
	private exportOptions: MarkdownWebpageRendererAPIOptions;

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
	public rssAsset: WebAsset | undefined = undefined;

	public deletedFiles: string[] = [];
	public newFiles: Attachment[] = [];
	public updatedFiles: Attachment[] = [];
	public allFiles: Attachment[] = [];

	public async load(website: Website, options: MarkdownWebpageRendererAPIOptions)
	{
		this.website = website;
		this.exportOptions = options;

		// try to load website data
		try
		{
			let metadataPath = this.website.destination.join(AssetHandler.libraryPath).joinString("metadata.json");
			let metadata = Settings.onlyExportModified ? await metadataPath.readAsString() : undefined; // only load metadata if we will use it
			if (metadata) 
			{
				this.oldWebsiteData = JSON.parse(metadata) as WebsiteData;
				this.websiteData = JSON.parse(metadata) as WebsiteData;

				this.deletedFiles = this.oldWebsiteData.allFiles ?? [];
			}
			else
			{
				this.websiteData = {} as WebsiteData;
				this.websiteData.createdTime = Date.now();
			}

			if (!this.websiteData.shownInTree) this.websiteData.shownInTree = [];
			if (!this.websiteData.attachments) this.websiteData.attachments = [];
			if (!this.websiteData.allFiles) this.websiteData.allFiles = [];
			if (!this.websiteData.webpages) this.websiteData.webpages = {};
			if (!this.websiteData.fileInfo) this.websiteData.fileInfo = {};
			if (!this.websiteData.sourceToTarget) this.websiteData.sourceToTarget = {};

			this.websiteData.modifiedTime = Date.now();
			this.websiteData.siteName = this.website.exportOptions.siteName ?? "";
			this.websiteData.exportRoot = this.website.exportOptions.exportRoot ?? "";
			this.websiteData.pluginVersion = HTMLExportPlugin.pluginVersion;
			this.websiteData.themeName = this.website.exportOptions.themeName ?? "Default";
			this.websiteData.bodyClasses = this.website.bodyClasses ?? "";
			this.websiteData.addCustomHead = Settings.customHeadContentPath != "";
			this.websiteData.addFavicon = Settings.faviconPath != "";
		}
		catch (e)
		{
			ExportLog.warning(e, "Failed to load metadata.json. Recreating metadata.");
		}

		// try to load minisearch
		try
		{
			// load current index or create a new one if it doesn't exist
			let indexPath = this.website.destination.join(AssetHandler.libraryPath).joinString("search-index.json");
			let indexJson = await indexPath.readAsString();
			if (indexJson)
			{
				this.minisearch = Minisearch.loadJSON(indexJson, this.minisearchOptions);
			}
			else throw new Error("No index found");
		}
		catch (e)
		{
			ExportLog.warning(e, "Failed to load search-index.json. Creating new index.");
			this.minisearch = new Minisearch(this.minisearchOptions);
		}

		this.rssPath = AssetHandler.generateSavePath("rss.xml", AssetType.Other, this.website.destination);
		this.rssURL = AssetHandler.generateSavePath("rss.xml", AssetType.Other, new Path(this.exportOptions.siteURL ?? "")).absolute();
	}

	public async finalize()
	{
		this.websiteData.shownInTree = this.attachmentsShownInTree.map((attachment) => attachment.targetPath.path);
		this.websiteData.allFiles = this.allFiles.map((file) => file.targetPath.path);

		// remove deleted files from website data
		for (let file of this.deletedFiles)
		{
			delete this.websiteData.fileInfo[file];
			delete this.websiteData.webpages[file];

			this.websiteData.attachments.remove(file);
			this.websiteData.allFiles.remove(file);
			this.websiteData.shownInTree.remove(file);

			let webpages = Object.values(this.websiteData.webpages);
			for (let webpage of webpages)
			{
				webpage.attachments.remove(file);
				webpage.backlinks.remove(file);
			}
		}

		if (!this.exportOptions.inlineOther)
			await this.indexSelf();

		console.log("Deleted: ", this.deletedFiles);
		console.log("New: ", this.newFiles);
		console.log("Updated: ", this.updatedFiles);
	}

	public async createRSSFeed()
	{
		let author = this.exportOptions.authorName || undefined;

		this.rssFeed = new RSS(
		{
			title: this.exportOptions.siteName ?? app.vault.getName(),
			description: "Obsidian digital garden",
			generator: "Webpage HTML Export plugin for Obsidian",
			feed_url: this.rssURL.path,
			site_url: this.exportOptions.siteURL ?? "",
			image_url: Path.joinStrings(this.exportOptions.siteURL ?? "", AssetHandler.favicon.targetPath.path).path,
			pubDate: new Date(this.websiteData.modifiedTime),
			copyright: author,
			ttl: 60,
			custom_elements:
			[
				{ "dc:creator": author },
			]
		});
		
		for (let page of this.webpages)
		{
			// only include pages with content
			if ((page.sizerElement?.innerText.length ?? 0) < 5) continue;

			let title = page.title;
			let url = Path.joinStrings(this.exportOptions.siteURL ?? "", page.targetPath.path).path;
			let guid = page.source.path;
			let date = new Date(page.source.stat.mtime);
			author = page.author ?? author;
			let media = page.coverImageURL ?? "";
			let hasMedia = media != "";
			let description = page.descriptionOrShortenedContent;

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

		let rssFileOld = await this.rssPath.readAsString();
		if (rssFileOld)
		{
			let rssDocOld = new DOMParser().parseFromString(rssFileOld, "text/xml");
			let rssDocNew = new DOMParser().parseFromString(rssXML, "text/xml");

			// insert old items into new rss and remove duplicates
			let oldItems = Array.from(rssDocOld.querySelectorAll("item"));
			let newItems = Array.from(rssDocNew.querySelectorAll("item"));

			// filter out deleted files and remove duplicated items favoring the new rss


			// remove all items from new rss
			newItems.forEach((item) => item.remove());

			// add items back to new rss
			let channel = rssDocNew.querySelector("channel");
			newItems.forEach((item) => channel?.appendChild(item));

			rssXML = rssDocNew.documentElement.outerHTML;
		}

		let rssAsset = new Attachment(rssXML, this.rssPath, null, this.exportOptions);
		this.addFile(rssAsset);
	}

	public async addFile(file: Attachment | Webpage)
	{
		if (file instanceof Webpage)
		{
			await this.updateWebpage(file);
		}
		else
		{
			this.updateAttachment(file);
		}

		if (!this.allFiles.includes(file))
		{
			this.allFiles.push(file);
			this.allFiles.sort((a, b) => (b.source?.stat.mtime ?? 0) - (a.source?.stat.mtime ?? 0));
		}

		if (file.showInTree && !this.attachmentsShownInTree.includes(file))
			this.attachmentsShownInTree.push(file);

		let key = file.targetPath.path;
		if(!this.hadFile(key))
		{
			this.newFiles.push(file);
		}
		else
		{
			let oldData = this.getOldFile(key);
			
			if (oldData)
			{
				if (oldData.modifiedTime != file.sourceStat.mtime && oldData.sourceSize != file.sourceStat.size)
				{
					this.updatedFiles.push(file);
				}
				else if (oldData.sourceSize != file.sourceStat.size)
				{
					// compare data to see if it's actually different
					let oldData = await file.targetPath.readAsBuffer();
					let newData = Buffer.from(file.data);
					if (!oldData?.equals(newData))
					{
						this.updatedFiles.push(file);
					}
				}
			}

			this.deletedFiles.remove(file.targetPath.path);
		}
	}

	public async addFiles(files: (Attachment | Webpage)[])
	{
		for (let file of files)
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
		for (let file of files)
		{
			this.removeFile(file);
		}
	}

	public getFileFromSrc(src: string, sourceFile: TFile): Attachment | undefined
	{
		let attachedFile = this.website.getFilePathFromSrc(src, sourceFile.path);
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

	public getFile(sourcePath: string): Attachment | Webpage | undefined
	{
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
		let promises: Promise<any>[] = [];

		if (this.oldWebsiteData)
		{
			let webpages = Object.entries(this.oldWebsiteData.webpages);
			for (let [path, data] of webpages)
			{
				let filePath = new Path(path, this.website.destination.path);
				let fileData = await filePath.readAsBuffer();
				if (fileData)
				{
					let document = new DOMParser().parseFromString(fileData.toString(), "text/html");
					await callback(document, data);
					promises.push(filePath.write(`<!DOCTYPE html>\n${document.documentElement.outerHTML}`));
				}
			}
		}

		Promise.all(promises);
	}

	private getPlainText(webpage: Webpage): string 
	{
		let contentElement = webpage.sizerElement ?? webpage.viewElement ?? webpage.document?.body;
		if (!contentElement)
		{
			return "";
		}

		let skipSelector = ".math, svg, img, .frontmatter, .metadata-container, .heading-after, style, script";
		function getTextNodes(element: HTMLElement): Node[]
		{
			const textNodes = [];
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
	
			let node;
			while (node = walker.nextNode()) 
			{
				if (node.parentElement?.closest(skipSelector))
				{
					continue;
				}

				textNodes.push(node);
			}
	
			return textNodes;
		}

		const textNodes = getTextNodes(contentElement);

		let content = '';
		for (const node of textNodes) 
		{
			content += ' ' + node.textContent + ' ';
		}

		content += webpage.hrefLinks.join(" ");
		content += webpage.srcLinks.join(" ");

		content = content.trim().replace(/\s+/g, ' ');

		return content;
	}

	private async addWebpageToWebsiteData(webpage: Webpage)
	{
		if (webpage.sourcePath && this.websiteData)
		{
			let webpageInfo: WebpageData = {} as WebpageData;
			webpageInfo.title = webpage.title;
			webpageInfo.icon = webpage.icon;
			webpageInfo.description = webpage.descriptionOrShortenedContent;
			webpageInfo.aliases = webpage.aliases;
			webpageInfo.tags = webpage.tags;
			webpageInfo.headers = await webpage.getStrippedHeadings();
			webpageInfo.backlinks = webpage.backlinks.map((backlink) => backlink.targetPath.path);
			webpageInfo.links = webpage.hrefLinks;
			webpageInfo.author = webpage.author;
			webpageInfo.coverImageURL = "";
			webpageInfo.fullURL = webpage.fullURL;
			webpageInfo.pathToRoot = webpage.pathToRoot.path;

			webpageInfo.createdTime = webpage.source.stat.ctime;
			webpageInfo.modifiedTime = webpage.source.stat.mtime;
			webpageInfo.sourceSize = webpage.source.stat.size;
			webpageInfo.sourcePath = new Path(webpage.source.path).path;
			webpageInfo.exportPath = webpage.targetPath.path;
			webpageInfo.showInTree = webpage.showInTree;
			webpageInfo.treeOrder = webpage.treeOrder;
			webpageInfo.attachments = webpage.attachments.map((download) => download.targetPath.path);

			// get file info version of the webpage
			let fileInfo: FileData = {} as FileData;
			fileInfo.createdTime = webpageInfo.createdTime;
			fileInfo.modifiedTime = webpageInfo.modifiedTime;
			fileInfo.sourceSize = webpageInfo.sourceSize;
			fileInfo.sourcePath = webpageInfo.sourcePath;
			fileInfo.exportPath = webpageInfo.exportPath;
			webpageInfo.showInTree = webpage.showInTree;
			webpageInfo.treeOrder = webpage.treeOrder;

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

			let headersInfo = await webpage.getStrippedHeadings();
			if (headersInfo.length > 0 && headersInfo[0].level == 1 && headersInfo[0].heading == webpage.title) headersInfo.shift();
			let headers = headersInfo.map((header) => header.heading);

			this.minisearch.add({
				title: webpage.title,
				aliases: webpage.aliases,
				headers: headers,
				tags: webpage.tags,
				path: webpagePath,
				content: webpage.description + " " + this.getPlainText(webpage),
			});
		}
	}

	private async updateWebpage(webpage: Webpage)
	{
		if (webpage.sourcePath && !this.sourceToWebpage.has(webpage.sourcePath))
		{
			this.sourceToWebpage.set(webpage.sourcePath, webpage);
		}

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
		let exportPath = attachment.targetPath.path;
		let key = exportPath;

		if (this.websiteData)
		{
			let fileInfo: FileData = {} as FileData;
			fileInfo.createdTime = attachment.sourceStat.ctime;
			fileInfo.modifiedTime = attachment.sourceStat.mtime;
			fileInfo.sourceSize = attachment.sourceStat.size;
			fileInfo.sourcePath = attachment.sourcePath ?? "";
			fileInfo.exportPath = exportPath;
			fileInfo.showInTree = attachment.showInTree;
			fileInfo.treeOrder = attachment.treeOrder;

			this.websiteData.fileInfo[key] = fileInfo;
			if (!this.websiteData.attachments.includes(key)) this.websiteData.attachments.push(key);
			this.websiteData.sourceToTarget[fileInfo.sourcePath] = fileInfo.exportPath;
		}

		return key;
	}

	private updateAttachment(attachment: Attachment)
	{
		this.addAttachmentToWebsiteData(attachment);

		let key = attachment.sourcePath ?? attachment.targetPath.path;
		if (!this.sourceToAttachment.has(key))
		{
			this.sourceToAttachment.set(key, attachment);
		}

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

		let key = webpage.targetPath.path;
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

		let key = attachment.targetPath.path;
		delete this.websiteData.fileInfo[key];
	}

	private async indexSelf()
	{
		let websiteDataString = JSON.stringify(this.websiteData);
		let indexDataString = JSON.stringify(this.minisearch);

		let websiteDataPath = AssetHandler.generateSavePath("metadata.json", AssetType.Other, this.website.destination);
		let indexDataPath = AssetHandler.generateSavePath("search-index.json", AssetType.Other, this.website.destination);

		let websiteDataAttachment = new Attachment(websiteDataString, websiteDataPath, null, this.exportOptions);
		let indexDataAttachment = new Attachment(indexDataString, indexDataPath, null, this.exportOptions);
		
		await this.addFiles([websiteDataAttachment, indexDataAttachment]);

		websiteDataAttachment.data = JSON.stringify(this.websiteData);
	}

}
