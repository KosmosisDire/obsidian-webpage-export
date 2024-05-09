import { WebpageData, DocumentType } from "shared/website-data";
import { BacklinkList } from "./backlinks";
import { Callout } from "./callouts";
import { Canvas } from "./canvas";
import { Header } from "./headers";
import { LinkHandler } from "./links";
import { List } from "./lists";
import { Bounds } from "./utils";
import { Notice } from "./notifications";

export class WebpageDocument
{
	public title: string = "";
	public headers: Header[] = [];
	public callouts: Callout[] = [];
	public lists: List[] = [];
	public backlinkList: BacklinkList;
	public children: WebpageDocument[] = [];
	public parent: WebpageDocument | null;
	public canvas: Canvas;

	public documentType: DocumentType;
	public containerEl: HTMLElement;
	public documentEl: HTMLElement;
	public sizerEl: HTMLElement;
	public footerEl: HTMLElement;
	public info: WebpageData;

	// url stuff
	public pathname: string;
	public hash: string;
	public query: string;
	public queryParameters: URLSearchParams; 

	public initialized: boolean = false;
	public get isRootDocument(): boolean
	{
		return !this.parent;
	}

	public get bounds(): Bounds
	{
		return Bounds.fromElement(this.documentEl);
	}

	private _exists: boolean = false;
	public get exists(): boolean
	{
		return this._exists;
	}

	public constructor(url: string)
	{
		url = url.trim();

		if (url.startsWith("http") || url.startsWith("www") || url.startsWith("/") || url.startsWith("\\"))
		{
			console.error("Please use a relative path from the root of the wesite to load a webpage");
			return;
		}

		if (url == "" || url == "/" || url == "\\") url = "/index.html";
		if (url.startsWith("#") || url.startsWith("?")) url = ObsidianSite.document.pathname + url;

		this.pathname = LinkHandler.getPathnameFromURL(url);
		const parsedURL = new URL(window.location.origin + "/" + url);
		this.hash = parsedURL.hash;
		this.query = parsedURL.search;
		this.queryParameters = parsedURL.searchParams;

		// load webpage data
		this.info = ObsidianSite.getWebpageData(this.pathname) as WebpageData;
		if (!this.info)
		{
			new Notice("This page does not exist yet.");
			console.warn("This page does not exist yet.", this.pathname);
			return;
		}

		this._exists = true;

		// set type
		this.documentType = this.info.type as DocumentType;
		console.log("Document type", this.documentType, this.info.type);

		// set title
		this.title = this.info.title;
	}
 
	public async init(): Promise<WebpageDocument>
	{
		if (!this.pathname || this.initialized || !this.exists) return this;
		this.initialized = true;

		if (!this.containerEl) this.containerEl = ObsidianSite.centerContentEl;

		this.sizerEl = this.containerEl.querySelector(".sizer") as HTMLElement;
		this.documentEl = this.containerEl.querySelector(".document") as HTMLElement;

		if (this.isRootDocument)
		{
			LinkHandler.initializeLinks(this.sizerEl ?? this.documentEl ?? this.containerEl);
			this.createCallouts();
			this.createLists();
		}

		if (this.documentType == DocumentType.Canvas)
		{
			this.canvas = new Canvas(this);
		}

		return this;
	}

	public async setAsActive()
	{
		if (ObsidianSite.document) // only push to history if we are not the first loaded page
		{
			let pathname: string | null = this.pathname;
			if (pathname == "index.html") pathname = "/";
			if (!ObsidianSite.isHttp) pathname = null;
			history.pushState({pathname: pathname}, this.title, pathname);
		}

		await ObsidianSite.graphView?.showGraph([this.pathname]);
		ObsidianSite.fileTree?.findByPath(this.pathname)?.setActive();
		ObsidianSite.fileTree?.revealPath(this.pathname);
		ObsidianSite.graphView?.setActiveNodeByPath(this.pathname);
		ObsidianSite.document = this;
	}

	public async load(parent: WebpageDocument | null = null, containerEl: HTMLElement = ObsidianSite.centerContentEl): Promise<WebpageDocument>
	{
		if (!this.pathname || !this.exists) return this;
		if (!parent && ObsidianSite.document.pathname == this.pathname)
		{
			console.log("Already on this page");
			new Notice("This page is already open.", 2000);
			return ObsidianSite.document;
		}

		let oldDocument = ObsidianSite.document;

		await ObsidianSite.showLoading(true, containerEl);

		if (this.isRootDocument)
		{
			await this.setAsActive();
		}

		this.parent = parent;
		this.containerEl = containerEl;

		const documentReq = await ObsidianSite.fetch(this.pathname);
		if (documentReq?.ok)
		{
			const documentText = await documentReq.text();
			const html = new DOMParser().parseFromString(documentText, "text/html");

			let newDocumentEl = html.querySelector(".document");
			let newOutlineEl = html.querySelector("#outline");

			if (newDocumentEl)
			{
				newDocumentEl = document.adoptNode(newDocumentEl);
				const docEl = containerEl.querySelector(".document");
				if (docEl) docEl.replaceWith(newDocumentEl);
				else containerEl.appendChild(newDocumentEl);
			}

			if (!parent && newOutlineEl) // only replace the outline if we are the root document
			{
				newOutlineEl = document.adoptNode(newOutlineEl);
				document.querySelector("#outline")?.replaceWith(newOutlineEl);
			}

			this.sizerEl = this.containerEl.querySelector(".sizer") as HTMLElement;
			this.documentEl = this.containerEl.querySelector(".document") as HTMLElement;

			this.footerEl = document.createElement("div");
			this.footerEl.classList.add("footer");
			(this.sizerEl ?? this.documentEl).appendChild(this.footerEl);

			if (ObsidianSite.metadata.featureOptions.backlinks.show) 
				this.createBacklinks();

			await this.loadChildDocuments();

			this.initialized = false;
		}
		else
		{
			new Notice("This document could not be loaded.");
			console.error("Failed to load document", this.pathname);
			oldDocument?.setAsActive();
		}

		await ObsidianSite.showLoading(false, containerEl);
		return this;
	}

	public createCallouts()
	{
		const calloutEls = Array.from(this.documentEl.querySelectorAll(".callout"));
		this.callouts = [];
		for (const calloutEl of calloutEls)
		{
			this.callouts.push(new Callout(calloutEl as HTMLElement));
		}
	}

	public createLists()
	{
		const listEls = Array.from(this.documentEl.querySelectorAll(":is(ul, ol):not(:is(ul, ol) :is(ul, ol))"));
		this.lists = [];
		for (const listEl of listEls)
		{
			this.lists.push(new List(listEl as HTMLElement, undefined));
		}
	}

	public createBacklinks()
	{
		const backlinks = this.info.backlinks?.filter(b => b != this.pathname);
		if (!backlinks || backlinks.length == 0) return;

		let parent = document.querySelector(ObsidianSite.metadata.featureOptions.backlinks.parentSelector) as HTMLElement;
		if (!parent) parent = this.footerEl ?? this.sizerEl ?? this.documentEl;
		const title = ObsidianSite.metadata.featureOptions.backlinks.displayTitle;

		this.backlinkList = new BacklinkList(parent, title, backlinks);
	}

	public async loadChildDocuments()
	{
		// prevent infinite recursion
		let parentTemp: WebpageDocument | null = this;
		let parentCount = 0;
		while (parentTemp)
		{
			parentTemp = parentTemp.parent;
			parentCount++;
		}
		if (parentCount > 4) return;

		// load child documents
		const childRefs = Array.from(this.documentEl.querySelectorAll("link[itemprop='include-document']"));
		const promises: Promise<WebpageDocument>[] = [];
		for (const ref of childRefs)
		{
			const url = ref.getAttribute("href");
			if (!url) continue;
			const childPromise = new WebpageDocument(url).load(this, ref.parentElement as HTMLElement);
			promises.push(childPromise);
		}

		const initPromises = (await Promise.all(promises)).map(c => c.init());
		let childrenTemp = await Promise.all(initPromises);
		console.log("Loaded child documents", childrenTemp);
		this.children.push(...childrenTemp);
	}

	public getMinReadableWidth(): number
	{
		const fontSize = parseFloat(getComputedStyle(this.sizerEl).fontSize);
		return fontSize * 30;
	}

}
