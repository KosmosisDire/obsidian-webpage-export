import { Search } from "./search";
import { Sidebar } from "./sidebars";
import { Tree } from "./trees";
import { Bounds, delay, getLengthInPixels, waitUntil } from "./utils";
import { WebpageDocument as ObsidianDocument } from "./document";
import {
	DocumentType,
	FileData,
	WebpageData,
	WebsiteData,
	WebsiteOptions,
} from "src/shared/website-data";
import { GraphView } from "./graph-view";
import { Notice } from "./notifications";
import { Theme } from "./theme";
import { LinkHandler } from "./links";
import { Shared } from "src/shared/shared";
import { FilePreviewPopover } from "./link-preview";
import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { CounterFeature } from "./counter-feature";
import {
	FeatureRelation,
	InsertedFeatureOptions,
	RelationType,
} from "src/shared/features/feature-options-base";
import { BacklinkList } from "./backlinks";
import { Tags } from "./tags";
import { Aliases } from "./aliases";

type Constructor<T> = new () => T;

function isConstructor(value: any): value is Constructor<any> {
	return (
		typeof value === "function" &&
		value.prototype &&
		value.prototype.constructor === value &&
		value.prototype.constructor.name !== "Object"
	);
}

export class ObsidianWebsite {
	public LinkHandler: LinkHandler = LinkHandler;
	public LinkPreview: unknown = FilePreviewPopover;

	public bodyEl: HTMLElement;
	public horizontalLayout: HTMLElement;
	public centerContentEl: HTMLElement;
	public loadingEl: HTMLElement;

	public isLoaded: boolean = false;
	public isHttp: boolean = window.location.protocol != "file:";
	public metadata: WebsiteData;
	public theme: Theme;
	public fileTree: Tree | undefined = undefined;
	public outlineTree: Tree | undefined = undefined;
	public search: Search | undefined = undefined;
	public leftSidebar: Sidebar | undefined = undefined;
	public rightSidebar: Sidebar | undefined = undefined;
	public document: ObsidianDocument;
	public graphView: GraphView | undefined = undefined;
	public backlinkList: BacklinkList | undefined = undefined;
	public tags: Tags | undefined = undefined;
	public aliases: Aliases | undefined = undefined;

	public entryPage: string;

	private onloadCallbacks: ((document: ObsidianDocument) => void)[] = [];
	public onDocumentLoad(callback: (document: ObsidianDocument) => void) {
		this.onloadCallbacks.push(callback);
	}

	public async init() {
		window.addEventListener("load", () => ObsidianSite.onInit());

		if (this.isHttp) {
			this.metadata = (await this.loadWebsiteData()) as WebsiteData;
			if (!this.metadata) {
				console.error("Failed to load website data.");
				return;
			}
		}
	}

	private async onInit() {
		if (!this.isHttp) {
			this.metadata = (await this.loadWebsiteData()) as WebsiteData;
			if (!this.metadata) {
				console.error("Failed to load website data.");
				this.metadata = new WebsiteData();
				this.metadata.ignoreMetadata = true;
			}
		}

		await waitUntil(() => this.metadata != undefined, 16);

		console.log("Website init");
		if (window.location.protocol != "file:") {
			// @ts-expect-error defined in deferred.js
			await loadIncludes();
		}

		this.theme = new Theme();

		this.bodyEl = document.body;
		this.horizontalLayout = document.querySelector("#main-horizontal") as HTMLElement;
		this.centerContentEl = document.querySelector(
			"#center-content"
		) as HTMLElement;

		const fileTreeEl = document.querySelector(
			"#file-explorer"
		) as HTMLElement;
		const outlineTreeEl = document.querySelector("#outline") as HTMLElement;
		const leftSidebarEl = document.querySelector(
			".sidebar#left-sidebar"
		) as HTMLElement;
		const rightSidebarEl = document.querySelector(
			".sidebar#right-sidebar"
		) as HTMLElement;

		this.bodyEl.className += " " + this.metadata.bodyClasses;

		this.createLoadingEl();

		if (fileTreeEl) this.fileTree = new Tree(fileTreeEl);
		if (outlineTreeEl) this.outlineTree = new Tree(outlineTreeEl, this.metadata.featureOptions.outline.minCollapseDepth);
		if (leftSidebarEl) this.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) this.rightSidebar = new Sidebar(rightSidebarEl);
		this.search = await new Search().init();

		const pathname =
			document
				.querySelector("meta[name='pathname']")
				?.getAttribute("content") ?? "unknown";
		this.entryPage = pathname;

		this.document = await new ObsidianDocument(pathname);
		await this.document.loadChildDocuments();
		await this.document.postLoadInit();

		if (
			!ObsidianSite.metadata.ignoreMetadata &&
			ObsidianSite.metadata.featureOptions.graphView.enabled
		) {
			this.loadGraphView().then(() =>
				this.graphView?.showGraph([pathname])
			);
		}

		this.initEvents();

		FilePreviewPopover.loadPinnedPreviews();

		this.onDocumentLoad((doc) => {

			if (!ObsidianSite.metadata.ignoreMetadata) {
				const insertBacklinks =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.backlinks.enabled &&
					doc.documentType == DocumentType.Markdown;
				const insertTags =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.tags.enabled &&
					doc.documentType == DocumentType.Markdown;
				const insertAliases =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.alias.enabled &&
					doc.documentType == DocumentType.Markdown;

				// ------------------ BACKLINKS -----------------
				if (insertBacklinks) {
					const backlinks = doc.info.backlinks?.filter(
						(b) => b != doc.pathname
					);

					if (!this.backlinkList) {
						this.backlinkList = new BacklinkList(
							doc.info.backlinks ?? []
						);
					} else {
						this.backlinkList?.modifyDependencies((d) => {
							d.backlinkPaths = doc.info.backlinks ?? [];
						});
					}

					if (!backlinks || backlinks.length == 0) {
						this.backlinkList?.hide();
					} else {
						this.backlinkList?.show();
					}
				} else {
					this.backlinkList?.hide();
				}

				// ------------------ TAGS -----------------
				if (insertTags) {
					const tags: string[] = [];

					if (ObsidianSite.metadata.featureOptions.tags.showInlineTags &&
						doc.info.inlineTags
					) {
						tags.push(...doc.info.inlineTags);
					}
					if (ObsidianSite.metadata.featureOptions.tags
						.showFrontmatterTags &&
						doc.info.frontmatterTags
					) {
						tags.push(...doc.info.frontmatterTags);
					}

					if (!this.tags) {
						this.tags = new Tags(tags);
					} else {
						this.tags?.modifyDependencies((d) => {
							d.tags = tags;
						});
					}

					if (tags.length == 0) {
						this.tags?.hide();
					} else {
						this.tags?.show();
					}
				} else {
					this.tags?.hide();
				}

				// ------------------ ALIASES -----------------
				if (insertAliases) {
					const aliases = doc.info.aliases;

					if (!this.aliases) {
						this.aliases = new Aliases(aliases ?? []);
					} else {
						this.aliases?.modifyDependencies((d) => {
							d.aliases = aliases ?? [];
						});
					}

					if (!aliases || aliases.length == 0) {
						this.aliases?.hide();
					} else {
						this.aliases?.show();
					}
				} else {
					this.aliases?.hide();
				}
			}
		});

		// Set initial history state
		if (this.isHttp) {
			let initialPath = this.document.pathname;
			if (initialPath == "index.html") initialPath = "";
			history.replaceState(
				{ pathname: initialPath },
				this.document.title,
				initialPath
			);
		}

		this.isLoaded = true;
		this.onloadCallbacks.forEach((cb) => cb(this.document));
	}

	private initEvents() {
		window.addEventListener("popstate", async (e) => {
			console.log("popstate", e);
			if (!e.state) return;
			const pathname = e.state.pathname;
			await ObsidianSite.loadURL(pathname, false);
		});

		const localThis = this;
		window.addEventListener("resize", () => {
			localThis.onResize();
		});
		this.onResize();
	}

	public updateMetaTag(name: string, content: string) {
		let meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
		if (!meta) {
			meta = document.createElement('meta');
			if (name.startsWith('og:')) {
				meta.setAttribute('property', name);
			} else {
				meta.setAttribute('name', name);
			}
			document.head.appendChild(meta);
		}
		meta.setAttribute('content', content);
	}

	public async loadURL(url: string, pushState: boolean = true): Promise<ObsidianDocument | undefined> {
		const header = LinkHandler.getHashFromURL(url);
		const query = LinkHandler.getQueryFromURL(url);
		url = LinkHandler.getPathnameFromURL(url);
		console.log("Loading URL", url, header, query);

		if (query && query.startsWith("query=")) {
			this.search?.searchParseFilters(query.substring(6));
			return;
		}

		// if this document is already loaded
		if (this.document.pathname == url) {
			if (header) this.document.scrollToHeader(header);
			else {
				new Notice("This page is already loaded.");
			}

			return this.document;
		}

		const data = ObsidianSite.getWebpageData(url) as WebpageData;
		if (!data) {
			new Notice("This page does not exist yet.");
			console.warn("Page does not exist", url);
			return undefined;
		}

		const page = await new ObsidianDocument(url).load();

		if (!page)
		{
			new Notice("Failed to load page. Unknown error.");
			return;	
		}

		// Update meta tags
		document.title = page.title;
		this.updateMetaTag("pathname", page.pathname);
		this.updateMetaTag("description", page.info?.description || "");
		this.updateMetaTag("author", page.info?.author || "");
		this.updateMetaTag("og:title", page.title);
		this.updateMetaTag("og:description", page.info?.description || "");
		this.updateMetaTag("og:url", window.location.href);
		this.updateMetaTag("og:image", page.info?.coverImageURL || "");

		// Update graph view and file tree
		await this.graphView?.showGraph([page.pathname]);
		this.fileTree?.findByPath(page.pathname)?.setActive();
		this.fileTree?.revealPath(page.pathname);
		this.graphView?.setActiveNodeByPath(page.pathname);
		this.document = page;

		if (this.document && this.isHttp && pushState) {
			let currentPath = this.document.pathname;
			if (currentPath == "index.html") currentPath = "";
			history.pushState(
				{ pathname: currentPath },
				this.document.title,
				currentPath
			);
		}

		// update outline - TODO: make this a dynamic inserted feature
		let newOutlineEl = page.sourceHtml.querySelector("#outline") as HTMLElement;
		if (newOutlineEl) {
			newOutlineEl = document.adoptNode(newOutlineEl);
			document.querySelector("#outline")?.replaceWith(newOutlineEl);
			ObsidianSite.outlineTree = new Tree(newOutlineEl, this.metadata.featureOptions.outline.minCollapseDepth);
		}

		setTimeout(async () => {

			this.onloadCallbacks.forEach((cb) => cb(page));

			await page.show();

			if (header) {
				page.scrollToHeader(header);
			}
		}, 100); // Small delay to ensure the DOM is updated

		return page;
	}

	public async fetch(url: string): Promise<Response | undefined> {
		url = LinkHandler.getPathnameFromURL(url);

		if (this.isHttp || url.startsWith("http")) {
			const req = await fetch(url);
			if (req.ok) {
				return req;
			} else {
				console.error("Failed to fetch", url);
				return;
			}
		} else {
			const file = this.getFileData(url);
			if (!file?.data) {
				console.error("Failed to fetch", url);
				return;
			}

			const req = new Response(file.data, { status: 200 });
			return req;
		}
	}

	public documentExists(url: string): boolean {
		url = LinkHandler.getPathnameFromURL(url);
		if (this.isHttp) {
			return !!this.metadata.webpages[url];
		} else {
			return !!this.getFileData(url)?.data;
		}
	}

	private async loadWebsiteData(): Promise<WebsiteData | undefined> {
		if (this.isHttp) {
			try {
				const dataReq = await fetch(
					Shared.libFolderName + "/metadata.json"
				);
				if (dataReq.ok) {
					const jsonStr = await dataReq.text();
					return WebsiteData.fromJSON(jsonStr);
				}
			} catch (e) {
				console.error("Failed to load website metadata.", e);
				new Notice("Failed to load website metadata.");
			}
		} else {
			const jsonData = this.getLocalDataFromId("website-metadata");
			return jsonData
				? WebsiteData.fromJSON(JSON.stringify(jsonData))
				: undefined;
		}
		return undefined;
	}

	private async loadGraphView() {
		const graphViewFeature = document.querySelector(
			".graph-view-wrapper"
		) as HTMLElement;
		if (!graphViewFeature) return;

		const localThis = this;
		//@ts-ignore
		waitLoadScripts(["graph-render-worker", "graph-wasm"], () => {
			console.log("scripts loaded");
			async function initGraphView() {
				console.log("Initializing graph view");
				const graphView = new GraphView(graphViewFeature);
				localThis.graphView = graphView;
				console.log("Graph view initialized");
			}

			//@ts-ignore
			Module["onRuntimeInitialized"] = () => {
				console.log("Wasm loaded");
				initGraphView();
			};

			//@ts-ignore
			run();

			setTimeout(() => {
				if (localThis.graphView == undefined) {
					initGraphView();
				}
			}, 100);
		});

		await waitUntil(() => this.graphView != undefined);
	}

	public getLocalDataFromId(id: string): any | undefined {
		const el = document.getElementById(id);
		if (!el) return;
		return JSON.parse(decodeURI(atob(el.getAttribute("value") ?? "")));
	}

	private cachedWebpageDataMap: Map<string, WebpageData> = new Map();
	public getWebpageData(url: string): WebpageData | undefined {
		if (!this.isHttp) {
			if (this.cachedWebpageDataMap.has(url)) {
				return this.cachedWebpageDataMap.get(url) as WebpageData;
			} else {
				const data = this.getLocalDataFromId(
					LinkHandler.getFileDataIdFromURL(url)
				) as WebpageData;
				this.cachedWebpageDataMap.set(url, data);
				return data;
			}
		}

		if (this.metadata) {
			const data = this.metadata.webpages[url];
			if (data) {
				return data;
			}
		}

		return;
	}

	private cachedFileDataMap: Map<string, FileData> = new Map();
	public getFileData(url: string): FileData {
		if (!this.isHttp) {
			if (this.cachedFileDataMap.has(url)) {
				return this.cachedFileDataMap.get(url) as FileData;
			} else {
				const data = this.getLocalDataFromId(
					LinkHandler.getFileDataIdFromURL(url)
				) as FileData;
				this.cachedFileDataMap.set(url, data);
				return data;
			}
		}

		if (this.metadata) {
			const data = this.metadata.fileInfo[url];
			if (data) {
				return data;
			}
		}

		return {} as FileData;
	}

	public scrollTo(element: Element) {
		element.scrollIntoView();
	}

	public async showLoading(
		loading: boolean,
		inside: HTMLElement = this.centerContentEl
	) {
		inside.style.transitionDuration = "";
		inside.classList.toggle("hide", loading);
		this.loadingEl.classList.toggle("show", loading);
		// this.graphView?.graphRenderer?.canvas.classList.toggle("hide", loading);

		if (loading) {
			// position loading icon in the center of the screen
			const viewBounds = Bounds.fromElement(inside);
			this.loadingEl.style.left =
				viewBounds.center.x - this.loadingEl.offsetWidth / 2 + "px";
			this.loadingEl.style.top =
				viewBounds.center.y - this.loadingEl.offsetHeight / 2 + "px";
		}

		await delay(200);
	}

	private createLoadingEl() {
		this.loadingEl = document.createElement("div");
		this.loadingEl.classList.add("loading-icon");
		document.body.appendChild(this.loadingEl);
		this.loadingEl.innerHTML = `<div></div><div></div><div></div><div></div>`;
	}

	public get documentBounds(): Bounds {
		return Bounds.fromElement(this.centerContentEl);
	}

	private onEndResize() {
		this.graphView?.graphRenderer?.autoResizeCanvas();
		document.body.classList.toggle("resizing", false);
	}

	private onStartResize() {
		document.body.classList.toggle("resizing", true);
	}

	private lastScreenWidth: number | undefined = undefined;
	private isResizing = false;
	private checkStillResizingTimeout: NodeJS.Timeout | undefined = undefined;
	private _deviceSize: string = "large-screen";
	public get deviceSize(): string {
		return this._deviceSize;
	}
	private set deviceSize(size: string) {
		this._deviceSize = size;
	}
	
	private onResize() {
		if (!this.isResizing) {
			this.onStartResize();
			this.isResizing = true;
		}

		const localThis = this;

		function widthNowInRange(low: number, high: number) {
			const w = window.innerWidth;
			return (
				(w > low &&
					w < high &&
					localThis.lastScreenWidth == undefined) ||
				(w > low &&
					w < high &&
					((localThis.lastScreenWidth ?? 0) <= low ||
						(localThis.lastScreenWidth ?? 0) >= high))
			);
		}

		function widthNowGreaterThan(value: number) {
			const w = window.innerWidth;
			return (
				(w > value && localThis.lastScreenWidth == undefined) ||
				(w > value && (localThis.lastScreenWidth ?? 0) < value)
			);
		}

		function widthNowLessThan(value: number) {
			const w = window.innerWidth;
			return (
				(w < value && localThis.lastScreenWidth == undefined) ||
				(w < value && (localThis.lastScreenWidth ?? 0) > value)
			);
		}

		const docWidthCSS =
			this.metadata.featureOptions.document?.documentWidth ?? "45em";
		const leftWdithCSS =
			this.metadata.featureOptions.sidebar?.leftDefaultWidth ?? "20em";
		const rightWidthCSS =
			this.metadata.featureOptions.sidebar?.rightDefaultWidth ?? "20em";

		// calculate the css widths
		const docWidth = getLengthInPixels(docWidthCSS, this.centerContentEl);
		const leftWidth = this.leftSidebar
			? getLengthInPixels(leftWdithCSS, this.leftSidebar?.containerEl)
			: 0;
		const rightWidth = this.rightSidebar
			? getLengthInPixels(rightWidthCSS, this.rightSidebar?.containerEl)
			: 0;

		if (
			widthNowGreaterThan(docWidth + leftWidth + rightWidth) ||
			widthNowGreaterThan(1025)
		) {
			this.deviceSize = "large-screen";
			document.body.classList.toggle("floating-sidebars", false);
			document.body.classList.toggle("is-large-screen", true);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", false);

			if (this.leftSidebar) this.leftSidebar.collapsed = false;
			if (this.rightSidebar) this.rightSidebar.collapsed = false;
		} else if (
			widthNowInRange(
				docWidth + leftWidth,
				docWidth + leftWidth + rightWidth
			) ||
			widthNowInRange(769, 1024)
		) {
			this.deviceSize = "small screen";
			document.body.classList.toggle("floating-sidebars", false);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", true);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", false);

			if (
				this.leftSidebar &&
				this.rightSidebar &&
				!this.leftSidebar.collapsed
			) {
				this.rightSidebar.collapsed = true;
			}
		} else if (
			widthNowInRange(leftWidth + rightWidth, docWidth + leftWidth) ||
			widthNowInRange(481, 768)
		) {
			this.deviceSize = "tablet";
			document.body.classList.toggle("floating-sidebars", true);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", true);
			document.body.classList.toggle("is-phone", false);

			if (
				this.leftSidebar &&
				this.rightSidebar &&
				!this.leftSidebar.collapsed
			) {
				this.rightSidebar.collapsed = true;
			}
		} else if (
			widthNowLessThan(leftWidth + rightWidth) ||
			widthNowLessThan(480)
		) {
			this.deviceSize = "phone";
			document.body.classList.toggle("floating-sidebars", true);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", true);
			if (this.leftSidebar) this.leftSidebar.collapsed = true;
			if (this.rightSidebar) this.rightSidebar.collapsed = true;
		}

		this.lastScreenWidth = window.innerWidth;

		if (this.checkStillResizingTimeout != undefined)
			clearTimeout(this.checkStillResizingTimeout);

		// wait a little bit of time and if the width is still the same then we are done resizing
		const screenWidthSnapshot = window.innerWidth;
		this.checkStillResizingTimeout = setTimeout(function () {
			if (window.innerWidth == screenWidthSnapshot) {
				localThis.checkStillResizingTimeout = undefined;
				localThis.isResizing = false;
				localThis.onEndResize();
			}
		}, 200);
	}
}
