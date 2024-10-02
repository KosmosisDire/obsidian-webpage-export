import { WebpageData, DocumentType } from "src/shared/website-data";
import { BacklinkList } from "./backlinks";
import { Callout } from "./callouts";
import { Canvas } from "./canvas";
import { Header } from "./headers";
import { LinkHandler } from "./links";
import { List } from "./lists";
import { Bounds } from "./utils";
import { Notice } from "./notifications";
import { Tags } from "./tags";
import { Tree } from "./trees";

export class WebpageDocument
{
	public title: string = "";
	public headers: Header[] = [];
	public callouts: Callout[] = [];
	public lists: List[] = [];
	public backlinkList: BacklinkList;
	public tags: Tags;
	public children: WebpageDocument[] = [];
	public parent: WebpageDocument | null;
	public isPreview: boolean = false;
	public canvas: Canvas;

	public documentType: DocumentType;
	public containerEl: HTMLElement;
	public documentEl: HTMLElement;
	public sizerEl: HTMLElement | undefined;
	public footerEl: HTMLElement;
	public headerEl: HTMLElement;
	public info: WebpageData;

	// url stuff
	public pathname: string;
	public hash: string;
	public query: string;
	public queryParameters: URLSearchParams; 

	public initialized: boolean = false;
	public get isMainDocument(): boolean
	{
		return this.parent == null && !this.isPreview;
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
		if (!window?.location) return;
		
		url = url.trim();

		if (url.startsWith("http") || url.startsWith("www") || url.startsWith("/") || url.startsWith("\\"))
		{
			console.error("Please use a relative path from the root of the wesite to load a webpage");
			return;
		}

		this.pathname = LinkHandler.getPathnameFromURL(url);
		this.hash = LinkHandler.getHashFromURL(url);
		this.query = LinkHandler.getQueryFromURL(url);
		let origin = window?.location?.origin;
		if (origin == "null") origin = "file://";

		// load webpage data
		this.info = ObsidianSite.getWebpageData(this.pathname) as WebpageData;
		if (!this.info && !ObsidianSite.metadata.ignoreMetadata)
		{
			new Notice("This page does not exist yet.");
			console.warn("This page does not exist yet.", this.pathname);
			return;
		}

		this._exists = true;

		// set type
		this.documentType = this.info?.type as DocumentType ?? DocumentType.Markdown;

		// set title
		this.title = this.info?.title ?? this.pathname;
	}

	public findHeader(predicate: (header: Header) => boolean): Header | null
	{
		for (const header of this.headers)
		{
			let result = header.find(predicate);
			if (result) return result;
		}
		return null;
	}

	public scrollToHeader(headerId: string)
	{
		console.log("Scrolling to header", headerId);
		const header = this.findHeader(h => h.id == headerId);
		if (header) header.scrollTo();
	}

	private findElements()
	{
		if (!this.containerEl) this.containerEl = ObsidianSite.centerContentEl;
		this.sizerEl = (this.documentType == DocumentType.Markdown ? this.containerEl.querySelector(".markdown-preview-sizer") : undefined) as HTMLElement;
		this.documentEl = this.containerEl.querySelector(".obsidian-document") as HTMLElement;
		this.headerEl = this.containerEl.querySelector(".header") as HTMLElement;
		this.footerEl = this.containerEl.querySelector(".footer") as HTMLElement;
	}

	public async setAsActive()
	{
		if (ObsidianSite.document) // only push to history if we are not the first loaded page
		{
			let pathname: string | null = this.pathname;
			if (pathname == "index.html") pathname = "";
			if (!ObsidianSite.isHttp) pathname = null;
			history.pushState({pathname: pathname}, this.title, pathname);
		}

		await ObsidianSite.graphView?.showGraph([this.pathname]);
		ObsidianSite.fileTree?.findByPath(this.pathname)?.setActive();
		ObsidianSite.fileTree?.revealPath(this.pathname);
		ObsidianSite.graphView?.setActiveNodeByPath(this.pathname);
		ObsidianSite.document = this;
	}

	public async load(parent: WebpageDocument | null = null, containerEl: HTMLElement = ObsidianSite.centerContentEl, isPreview: boolean = false, headerOnly: boolean = false): Promise<WebpageDocument>
	{
		this.parent = parent;
		this.isPreview = isPreview;

		if (!this.pathname || !this.exists) return this;
		if (this.isMainDocument && ObsidianSite.document.pathname == this.pathname)
		{
			console.log("Already on this page");
			new Notice("This page is already open.", 2000);
			return ObsidianSite.document;
		}

		let oldDocument = ObsidianSite.document;
		await ObsidianSite.showLoading(true, containerEl);

		this.containerEl = containerEl;
		
		if (this.isMainDocument)
		{
			await this.setAsActive();
		}

		const documentReq = await ObsidianSite.fetch(this.pathname);
		if (documentReq?.ok)
		{
			const documentText = await documentReq.text();
			const html = new DOMParser().parseFromString(documentText, "text/html");

			let newDocumentEl = html.querySelector(".obsidian-document");
			let newOutlineEl = html.querySelector("#outline") as HTMLElement;

			if (newDocumentEl)
			{
				newDocumentEl = document.adoptNode(newDocumentEl);
				const docEl = containerEl.querySelector(".obsidian-document");
				if (docEl)
				{
					docEl.before(newDocumentEl);
					docEl.remove();
				}
				else containerEl.appendChild(newDocumentEl);
			}

			if (this.isMainDocument && newOutlineEl) // only replace the outline if we are the root document
			{
				newOutlineEl = document.adoptNode(newOutlineEl);
				document.querySelector("#outline")?.replaceWith(newOutlineEl);
				ObsidianSite.outlineTree = new Tree(newOutlineEl);
			}

			await this.loadChildDocuments();
			await this.postLoadInit();

			if (this.sizerEl && headerOnly && this.hash && this.hash != "")
			{
				var header = this.headers.find(h => h.findByID(this.hash))?.findByID(this.hash);
				if (header)
				{
					this.sizerEl.innerHTML = header.getHeaderWithContentRecursive().map(e => e.outerHTML).join("");
				}
			}

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

	public async postLoadInit(): Promise<WebpageDocument>
	{
		this.findElements();
		this.postProcess();

		if (this.isMainDocument && !ObsidianSite.metadata.ignoreMetadata && ObsidianSite.metadata.featureOptions.backlinks.enabled && this.documentType == DocumentType.Markdown)
			this.createBacklinks();

		if (this.isMainDocument && !ObsidianSite.metadata.ignoreMetadata && ObsidianSite.metadata.featureOptions.tags.enabled && this.documentType == DocumentType.Markdown) 
			this.createTags();

		if (this.isMainDocument || this.isPreview)
		{
			this.createHeaders();
			this.createCallouts();
			this.createLists();
		}

		if (this.documentType == DocumentType.Canvas)
		{
			this.canvas = new Canvas(this);
		}

		if (this.isMainDocument || this.isPreview)
			LinkHandler.initializeLinks(this.documentEl ?? this.containerEl);

		return this;
	}

	public createHeaders()
	{
		this.headers = Header.createHeaderTree(this.documentEl);
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
		this.backlinkList = new BacklinkList(backlinks);
	}

	public createTags()
	{
		const tags = [];

		if (ObsidianSite.metadata.featureOptions.tags.showInlineTags && this.info.inlineTags)
			tags.push(...this.info.inlineTags);
		if (ObsidianSite.metadata.featureOptions.tags.showFrontmatterTags && this.info.frontmatterTags)
			tags.push(...this.info.frontmatterTags);

		if (tags.length == 0) return;

		this.tags = new Tags(tags);
	}

	public postProcess()
	{
		// make completed kanban checkboxes checked
		this.documentEl?.querySelectorAll(".kanban-plugin__item.is-complete input[type='checkbox']").forEach((el: HTMLInputElement) => el.checked = true);

		// toggle list and header collapse CSS
		if (!ObsidianSite.metadata.ignoreMetadata)
		{
			this.documentEl?.classList.toggle("allow-fold-headings", ObsidianSite.metadata.featureOptions.document.allowFoldingHeadings);
			this.documentEl?.classList.toggle("allow-fold-lists", ObsidianSite.metadata.featureOptions.document.allowFoldingLists);
		}
	}

	public async loadChildDocuments()
	{
		this.findElements();
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
			console.log("Loading child", url);
			ref.remove();
		}

		const childrenTemp = await Promise.all(promises);
		console.log("Loaded child documents", childrenTemp);
		this.children.push(...childrenTemp);
	}

	public async loadChild(url: string, containerEl: HTMLElement): Promise<WebpageDocument>
	{
		const child = new WebpageDocument(url);
		await child.load(this, containerEl);
		this.children.push(child);
		return child;
	}

	public async unloadChild(child: WebpageDocument)
	{
		this.children = this.children.filter(c => c != child);
		child.documentEl?.remove();
	}

	public getMinReadableWidth(): number
	{
		const fontSize = parseFloat(getComputedStyle(this.sizerEl ?? this.documentEl).fontSize);
		return fontSize * 30;
	}

}
