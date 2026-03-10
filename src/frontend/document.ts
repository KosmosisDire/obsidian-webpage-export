import { FileData, DocumentType } from "@shared/types";
import { Callout } from "./callouts";
import { Header } from "./headers";
import { initializeLinks, getPathnameFromURL, getHashFromURL, getQueryFromURL } from "./links";
import { List } from "./lists";
import { showLoading } from "./layout";
import { getFileData } from "./site-data";
import { Bounds } from "./utils";
import { Notice } from "./notice";

type DocumentHook = (doc: WebpageDocument) => void;
const postProcessHooks: DocumentHook[] = [];

export class WebpageDocument {
	static onPostProcess(hook: DocumentHook) { postProcessHooks.push(hook); }
	public title: string = "";
	public headers: Header[] = [];
	public callouts: Callout[] = [];
	public lists: List[] = [];
	public children: WebpageDocument[] = [];
	public parent: WebpageDocument | null;
	public isPreview: boolean = false;

	public documentType: DocumentType;
	public containerEl: HTMLElement;
	public documentEl: HTMLElement;
	public sizerEl: HTMLElement | undefined;
	public footerEl: HTMLElement;
	public headerEl: HTMLElement;
	public info: FileData;

	public sourceHtml: Document;

	public pathname: string;
	public hash: string;
	public query: string;

	public initialized: boolean = false;

	get isMainDocument(): boolean {
		return this.parent == null && !this.isPreview;
	}

	get bounds(): Bounds {
		return Bounds.fromElement(this.documentEl);
	}

	private _exists: boolean = false;
	get exists(): boolean { return this._exists; }

	constructor(url: string) {
		if (!window?.location) return;
		url = url.trim();

		if (url.startsWith("http") || url.startsWith("www") || url.startsWith("\\")) {
			console.error("Please use an absolute web path (starting with /) to load a webpage");
			return;
		}

		this.pathname = getPathnameFromURL(url);
		this.hash = getHashFromURL(url);
		this.query = getQueryFromURL(url);

		// Load file data from site metadata
		this.info = getFileData(this.pathname)!;
		if (!this.info) {
			new Notice("This page does not exist yet.");
			console.warn("This page does not exist yet.", this.pathname);
			return;
		}

		this._exists = true;

		// Set type
		this.documentType = (this.info.type as DocumentType) ?? DocumentType.Markdown;

		// Set title
		this.title = this.info.title || this.info.frontmatter?.title || this.pathname;
	}

	findHeader(predicate: (header: Header) => boolean): Header | null {
		for (const header of this.headers) {
			const result = header.find(predicate);
			if (result) return result;
		}
		return null;
	}

	getFlatHeaders(): Header[] {
		return this.headers.flatMap(h => h.getFlatChildren());
	}

	scrollToHeader(headerId: string) {
		const header = this.findHeader(h => h.id === headerId);
		if (header) header.scrollTo();
	}

	private findElements() {
		this.sizerEl = (
			this.documentType === DocumentType.Markdown
				? this.containerEl.querySelector(".markdown-preview-sizer")
				: undefined
		) as HTMLElement;
		this.documentEl = this.containerEl.querySelector(".obsidian-document") as HTMLElement;
		this.headerEl = this.containerEl.querySelector(".header") as HTMLElement;
		this.footerEl = this.containerEl.querySelector(".footer") as HTMLElement;
	}

	async load(
		parent: WebpageDocument | null = null,
		containerEl: HTMLElement,
		isPreview: boolean = false,
	): Promise<WebpageDocument | undefined> {
		this.parent = parent;
		this.isPreview = isPreview;

		if (!this.pathname || !this.exists || !this.info) return this;

		this.containerEl = containerEl;
		await showLoading(true, containerEl);

		try {
			const html = this.info.content?.html;
			if (!html) {
				new Notice("This document has no content.");
				console.error("No HTML content for", this.pathname);
				return undefined;
			}

			// Parse the HTML content and insert into the DOM
			this.sourceHtml = new DOMParser().parseFromString(
				`<div class="obsidian-document markdown-preview-view markdown-rendered node-insert-event is-readable-line-width allow-fold-headings allow-fold-lists show-indentation-guide show-properties">${html}</div>`,
				"text/html"
			);

			let newDocumentEl = this.sourceHtml.querySelector(".obsidian-document");
			if (newDocumentEl) {
				newDocumentEl = document.adoptNode(newDocumentEl);
				const existing = containerEl.querySelector(".obsidian-document");
				if (existing) {
					existing.before(newDocumentEl);
					existing.remove();
				} else {
					containerEl.appendChild(newDocumentEl);
				}
			}

			await this.loadChildDocuments();
			await this.postLoadInit();
			this.initialized = true;
		} finally {
			await showLoading(false, containerEl);
		}

		return this;
	}

	async postLoadInit(): Promise<WebpageDocument> {
		this.findElements();
		if (!this.documentEl) return this;

		this.postProcess();

		if (this.isMainDocument || this.isPreview) {
			this.processHeaders();
			this.processCallouts();
			this.processLists();
		}

		if (this.isMainDocument || this.isPreview) {
			initializeLinks(this.documentEl ?? this.containerEl);
		}

		for (const hook of postProcessHooks) hook(this);

		return this;
	}

	processHeaders() {
		if (!this.documentEl) return;
		this.headers = Header.createHeaderTree(this.documentEl);
	}

	processCallouts() {
		if (!this.documentEl) return;
		const calloutEls = Array.from(this.documentEl.querySelectorAll(".callout"));
		this.callouts = calloutEls.map(el => new Callout(el as HTMLElement));
	}

	processLists() {
		if (!this.documentEl) return;
		const listEls = Array.from(
			this.documentEl.querySelectorAll(":is(ul, ol):not(:is(ul, ol) :is(ul, ol))")
		);
		this.lists = listEls.map(el => new List(el as HTMLElement, undefined));
	}

	postProcess() {
		if (!this.documentEl || !this.sizerEl)
		{
			console.warn("Document postProcess: missing documentEl or sizerEl", this);
			return;
		}

		// Build document header with icon and title
		this.buildDocumentHeader();

		// add .footer to bottom of page
		if (!this.footerEl) {
			this.footerEl = document.createElement("div");
			this.footerEl.className = "footer";
			this.sizerEl!.appendChild(this.footerEl);

			// footer data bar
			const dataBar = document.createElement("div");
			dataBar.className = "data-bar";
			this.footerEl.appendChild(dataBar);
		}

		// Add .heading class to all headers
		this.documentEl.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(el => {
			el.classList.add("heading");
		});

		// Assign IDs from centralized header data, matched via data-heading attribute.
		// Track duplicates so repeated headings get the correct sequential ID.
		const headerData = this.info?.elements?.headers ?? [];
		const seenCounts = new Map<string, number>();
		this.documentEl.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(el => {
			if (el.id) return;
			const dataHeading = el.getAttribute("data-heading");
			if (!dataHeading) return;

			const count = seenCounts.get(dataHeading) ?? 0;
			seenCounts.set(dataHeading, count + 1);

			// Find the nth header in the data with matching text
			let matched = 0;
			for (const h of headerData) {
				if (h.text === dataHeading) {
					if (matched === count) {
						el.id = h.id;
						break;
					}
					matched++;
				}
			}
		});

		// Fix kanban checkboxes
		this.documentEl
			.querySelectorAll(".kanban-plugin__item.is-complete input[type='checkbox']")
			.forEach((el: Element) => (el as HTMLInputElement).checked = true);
	}

	private buildDocumentHeader() {
		if (!this.documentEl || !this.info) return;

		// Remove any existing inline-title or header that Obsidian may have left
		this.documentEl.querySelector(".inline-title")?.remove();
		this.documentEl.querySelector(".mod-header")?.remove();

		// Create .header container with h1 and data-bar inside
		const headerDiv = document.createElement("div");
		headerDiv.className = "header";

		const h1 = document.createElement("h1");
		h1.className = "page-title heading";
		h1.id = this.title;

		const icon = this.info.icon;
		if (icon) {
			const iconDiv = document.createElement("div");
			iconDiv.id = "webpage-icon";
			iconDiv.innerHTML = icon;
			h1.appendChild(iconDiv);
		}

		h1.appendChild(document.createTextNode(this.title));
		headerDiv.appendChild(h1);

		const dataBar = document.createElement("div");
		dataBar.className = "data-bar";
		headerDiv.appendChild(dataBar);

		// Insert at the top of the document
		const sizer = this.documentEl.querySelector(".markdown-preview-sizer");
		const target = sizer ?? this.documentEl;
		target.prepend(headerDiv);
	}

	async loadChildDocuments() {
		this.findElements();
		if (!this.documentEl) return;

		// Prevent infinite recursion
		let depth = 0;
		let p: WebpageDocument | null = this;
		while (p) { p = p.parent; depth++; }
		if (depth > 4) return;

		const childRefs = Array.from(
			this.documentEl.querySelectorAll("link[itemprop='include-document']")
		);
		const promises: Promise<WebpageDocument | undefined>[] = [];

		for (const ref of childRefs) {
			const url = ref.getAttribute("href");
			if (!url) continue;
			const childPromise = new WebpageDocument(url).load(
				this,
				ref.parentElement as HTMLElement
			);
			promises.push(childPromise);
			ref.remove();
		}

		const children = await Promise.all(promises);
		this.children.push(...children.filter(c => c != undefined) as WebpageDocument[]);
	}

	async loadChild(url: string, containerEl: HTMLElement): Promise<WebpageDocument | undefined> {
		const child = new WebpageDocument(url);
		const loaded = await child.load(this, containerEl);
		if (loaded) this.children.push(loaded);
		return loaded;
	}

	async unloadChild(child: WebpageDocument) {
		this.children = this.children.filter(c => c !== child);
		child.documentEl?.remove();
	}

	getMinReadableWidth(): number {
		const fontSize = parseFloat(
			getComputedStyle(this.sizerEl ?? this.documentEl).fontSize
		);
		return fontSize * 30;
	}
}
