import { WebsiteData, DocumentType } from "./data";
import { LinkHandler } from "./links";
import { Search } from "./search";
import { Sidebar } from "./sidebars";
import { Tree } from "./trees";
import { WebpageDocument } from "./webpage";

export class Website
{
	public static bodyEl: HTMLElement;
	public static websiteEl: HTMLElement;
	public static centerContentEl: HTMLElement;

	public static isLoaded: boolean = false;
	public static websiteData: WebsiteData | undefined = undefined;

	public static fileTree: Tree | undefined = undefined;
	public static outlineTree: Tree | undefined = undefined;
	public static search: Search | undefined = undefined;
	public static leftSidebar: Sidebar | undefined = undefined;
	public static rightSidebar: Sidebar | undefined = undefined;
	public static document: WebpageDocument;

	public static history: string[] = [];
	public static entryPage: string;

	private static onloadCallbacks: ((document: WebpageDocument) => void)[] = [];
	public static onDocumentLoad(callback: (document: WebpageDocument) => void)
	{
		this.onloadCallbacks.push(callback);
	}

	public static async init()
	{
		window.addEventListener("load", () => Website.onInit());
		this.websiteData = await this.loadWebsiteData();
	}

	private static async onInit()
	{
		if(window.location.protocol != "file:") 
		{
			// @ts-ignore
			await loadIncludes(); // defined in deferred.js
		}
 
		this.bodyEl = document.body;
		this.websiteEl = document.querySelector("#layout") as HTMLElement;
		this.centerContentEl = document.querySelector("#center-content") as HTMLElement;

		let fileTreeEl = document.querySelector("#file-explorer") as HTMLElement;
		let outlineTreeEl = document.querySelector("#outline-tree") as HTMLElement;
		let leftSidebarEl = document.querySelector(".sidebar#left-sidebar") as HTMLElement;
		let rightSidebarEl = document.querySelector(".sidebar#right-sidebar") as HTMLElement;

		if (fileTreeEl) this.fileTree = new Tree(fileTreeEl);
		if (outlineTreeEl) this.outlineTree = new Tree(outlineTreeEl);
		if (leftSidebarEl) this.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) this.rightSidebar = new Sidebar(rightSidebarEl); 
		this.search = await new Search().init();

		let pathname = document.querySelector("meta[name='pathname']")?.getAttribute("content") ?? "unknown";
		this.document = new WebpageDocument(pathname);

		this.entryPage = pathname;
		this.history.push(pathname);
		LinkHandler.initializeLinks(document.body);

		// @ts-ignore
		window.Website = Website;
		// @ts-ignore
		window.Webpage = WebpageDocument;
		
		this.isLoaded = true;
	}

	private static async loadWebsiteData(): Promise<WebsiteData | undefined>
	{
		if (window.location.protocol != "file:")
		{
			try
			{
				let dataReq = await fetch("lib/metadata.json");
				if (dataReq.ok)
				{
					return await dataReq.json();
				}
				else
				{
					console.log("Failed to load website metadata.");
				}
			}
			catch (e)
			{
				console.log("Failed to load website metadata.", e);
			}
		}

		return undefined;
	}

	public static getWebpageData(url: string)
	{
		if (this.websiteData)
		{
			let data = this.websiteData.webpages[url];
			if (data)
			{
				return data;
			}
		}

		return undefined;
	}

	public static scrollTo(element: Element)
	{
		element.scrollIntoView();
	}
}

Website.init();
