
import { Search } from "./search";
import { Sidebar } from "./sidebars";
import { Tree } from "./trees";
import { Bounds, delay, getLengthInPixels, waitUntil } from "./utils";
import { WebpageDocument } from "./document";
import { FileData, WebpageData, WebsiteData } from "src/shared/website-data";
import { GraphView } from "./graph-view";
import { Notice } from "./notifications";
import { Theme } from "./theme";
import { LinkHandler } from "./links";
import { Shared } from "src/shared/shared";
import { FilePreviewPopover } from "./link-preview";

export class ObsidianWebsite
{
	public LinkHandler: LinkHandler = LinkHandler;
	public LinkPreview: unknown = FilePreviewPopover;

	public bodyEl: HTMLElement;
	public websiteEl: HTMLElement;
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
	public document: WebpageDocument;
	public graphView: GraphView | undefined = undefined;

	public entryPage: string;

	private onloadCallbacks: ((document: WebpageDocument) => void)[] = [];
	public onDocumentLoad(callback: (document: WebpageDocument) => void)
	{
		this.onloadCallbacks.push(callback);
	}

	public async init()
	{
		window.addEventListener("load", () => ObsidianSite.onInit());

		if (this.isHttp)
		{
			this.metadata = await this.loadWebsiteData() as WebsiteData;
			if (!this.metadata)
			{
				console.error("Failed to load website data.");
				return;
			}
		}
	}

	private async onInit()
	{
		if (!this.isHttp)
		{
			this.metadata = await this.loadWebsiteData() as WebsiteData;
			if (!this.metadata)
			{
				console.error("Failed to load website data.");
				this.metadata = new WebsiteData();
				this.metadata.ignoreMetadata = true;
			}
		}

		await waitUntil(() => this.metadata != undefined, 10);

		console.log("Website init");
		if(window.location.protocol != "file:") 
		{
			// @ts-expect-error defined in deferred.js
			await loadIncludes();
		}

		this.theme = new Theme();
 
		this.bodyEl = document.body;
		this.websiteEl = document.querySelector("#layout") as HTMLElement;
		this.centerContentEl = document.querySelector("#center-content") as HTMLElement;

		const fileTreeEl = document.querySelector("#file-explorer") as HTMLElement;
		const outlineTreeEl = document.querySelector("#outline") as HTMLElement;
		const leftSidebarEl = document.querySelector(".sidebar#left-sidebar") as HTMLElement;
		const rightSidebarEl = document.querySelector(".sidebar#right-sidebar") as HTMLElement;

		this.bodyEl.className += " " + this.metadata.bodyClasses;
		
		this.createLoadingEl();
		
		if (fileTreeEl) this.fileTree = new Tree(fileTreeEl);
		if (outlineTreeEl) this.outlineTree = new Tree(outlineTreeEl);
		if (leftSidebarEl) this.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) this.rightSidebar = new Sidebar(rightSidebarEl); 
		this.search = await new Search().init();

		const pathname = document.querySelector("meta[name='pathname']")?.getAttribute("content") ?? "unknown";
		this.entryPage = pathname;

		this.document = await new WebpageDocument(pathname);
		await this.document.loadChildDocuments();
		await this.document.postLoadInit();
		
		if (!ObsidianSite.metadata.ignoreMetadata && ObsidianSite.metadata.featureOptions.graphView.enabled)
		{
			this.loadGraphView().then(() => this.graphView?.showGraph([pathname]));
		}

		this.initEvents();

		FilePreviewPopover.loadPinnedPreviews();
		
		this.isLoaded = true;
		this.onloadCallbacks.forEach(cb => cb(this.document));
	}

	private initEvents()
	{
		window.addEventListener("popstate", async (e) =>
		{
			console.log("popstate", e);
			if (!e.state) return;
			const pathname = e.state.pathname;
			ObsidianSite.loadURL(pathname);
		});
		
		const localThis = this;
		window.addEventListener("resize", () => 
			{
				localThis.onResize()
			});
		this.onResize();
	}

	public async loadURL(url: string): Promise<WebpageDocument | undefined>
	{
		const header = LinkHandler.getHashFromURL(url);
		const query = LinkHandler.getQueryFromURL(url);
		url = LinkHandler.getPathnameFromURL(url);
		console.log("Loading URL", url, header, query);

		if (query && query.startsWith("query="))
		{
			this.search?.searchParseFilters(query.substring(6));
		}

		// if this document is already loaded
		if (this.document.pathname == url)
		{
			if (header) this.document.scrollToHeader(header);
			return this.document;
		}

		const data = ObsidianSite.getWebpageData(url) as WebpageData;
		if (!data)
		{
			new Notice("This page does not exist yet.");
			console.warn("Page does not exist", url);
			return undefined;
		}

		const page = await new WebpageDocument(url).load();
		
		setTimeout(() => 
		{
			this.onloadCallbacks.forEach(cb => cb(page));

			if (header)
			{
				page.scrollToHeader(header);
			}
		}, 100); // Small delay to ensure the DOM is updated
	
		return page;
	}

	public async fetch(url: string): Promise<Response | undefined>
	{
		url = LinkHandler.getPathnameFromURL(url);

		if (this.isHttp || url.startsWith("http"))
		{
			const req = await fetch(url);
			if (req.ok)
			{
				return req;
			}
			else
			{
				console.error("Failed to fetch", url);
				return;
			}
		}
		else
		{
			const file = this.getFileData(url);
			if (!file?.data)
			{
				console.error("Failed to fetch", url);
				return;
			}

			const req = new Response(file.data, { status: 200 });
			return req;
		}
	}

	public documentExists(url: string): boolean
	{
		url = LinkHandler.getPathnameFromURL(url);
		if (this.isHttp)
		{
			return !!this.metadata.webpages[url];
		}
		else
		{
			return !!this.getFileData(url)?.data;
		}
	}

	private async loadWebsiteData(): Promise<WebsiteData | undefined>
	{
		if (this.isHttp)
		{
			try
			{
				const dataReq = await fetch(Shared.libFolderName + "/metadata.json");
				if (dataReq.ok)
				{
					return await dataReq.json();
				}
				else
				{
					new Notice("Failed to load website metadata.");
					console.error("Failed to load website metadata.");
				}
			}
			catch (e)
			{
				new Notice("Failed to load website metadata.");
				console.error("Failed to load website metadata.", e);
			}
		}
		else
		{
			// when in file://
			return this.getLocalDataFromId("website-metadata") as WebsiteData;
		}

		return undefined;
	}

	private async loadGraphView()
	{
		const graphViewFeature = document.querySelector(".graph-view-wrapper") as HTMLElement;
		if (!graphViewFeature) return;

		const localThis = this;
		//@ts-ignore
		waitLoadScripts(["graph-render-worker", "graph-wasm"],  () =>
		{
			console.log("scripts loaded");
			async function initGraphView()
			{
				console.log("Initializing graph view"); 
				const graphView = new GraphView(graphViewFeature);
				localThis.graphView = graphView;
				console.log("Graph view initialized");
			}

			
			//@ts-ignore
			Module['onRuntimeInitialized'] = () => 
				{
					console.log("Wasm loaded");
					initGraphView();
				};

			//@ts-ignore
			run();

			setTimeout(() =>
			{
				if (localThis.graphView == undefined)
				{
					initGraphView();
				}
			}, 100);
		});

		await waitUntil(() => this.graphView != undefined);
	}

	public getLocalDataFromId(id: string): any | undefined
	{
		const el = document.getElementById(id);
		if (!el) return;
		return JSON.parse(decodeURI(atob(el.getAttribute("value") ?? "")));
	}

	private cachedWebpageDataMap: Map<string, WebpageData> = new Map();
	public getWebpageData(url: string): WebpageData | undefined
	{
		if (!this.isHttp)
		{
			if (this.cachedWebpageDataMap.has(url))
			{
				return this.cachedWebpageDataMap.get(url) as WebpageData;
			}
			else
			{
				const data = this.getLocalDataFromId(LinkHandler.getFileDataIdFromURL(url)) as WebpageData;
				this.cachedWebpageDataMap.set(url, data);
				return data;
			}
		}
		
		if (this.metadata)
		{
			const data = this.metadata.webpages[url];
			if (data)
			{
				return data;
			}
		}

		return;
	}

	private cachedFileDataMap: Map<string, FileData> = new Map();
	public getFileData(url: string): FileData
	{
		if (!this.isHttp)
		{
			if (this.cachedFileDataMap.has(url))
			{
				return this.cachedFileDataMap.get(url) as FileData;
			}
			else
			{
				const data = this.getLocalDataFromId(LinkHandler.getFileDataIdFromURL(url)) as FileData;
				this.cachedFileDataMap.set(url, data);
				return data;
			}
		}
		
		if (this.metadata)
		{
			const data = this.metadata.fileInfo[url];
			if (data)
			{
				return data;
			}
		}

		return {} as FileData;
	}


	public scrollTo(element: Element)
	{
		element.scrollIntoView();
	}

	public async showLoading(loading: boolean, inside: HTMLElement = this.centerContentEl)
	{
		inside.style.transitionDuration = "";
		inside.classList.toggle("hide", loading);
		this.loadingEl.classList.toggle("show", loading);
		// this.graphView?.graphRenderer?.canvas.classList.toggle("hide", loading);
		
		if(loading)
		{
			// position loading icon in the center of the screen
			const viewBounds = Bounds.fromElement(inside);
			this.loadingEl.style.left = (viewBounds.center.x - this.loadingEl.offsetWidth / 2) + "px";
			this.loadingEl.style.top = (viewBounds.center.y - this.loadingEl.offsetHeight / 2) + "px";
		}
	
		await delay(200);
	}

	private createLoadingEl()
	{
		this.loadingEl = document.createElement("div");
		this.loadingEl.classList.add("loading-icon");
		document.body.appendChild(this.loadingEl);
		this.loadingEl.innerHTML = `<div></div><div></div><div></div><div></div>`;
	}

	public get documentBounds(): Bounds 
	{
		return Bounds.fromElement(this.centerContentEl);
	}

	private onEndResize()
	{
		this.graphView?.graphRenderer?.autoResizeCanvas();
		document.body.classList.toggle("resizing", false);
	}

	private onStartResize()
	{
		document.body.classList.toggle("resizing", true);
	}

	private lastScreenWidth: number | undefined = undefined;
	private isResizing = false;
	private checkStillResizingTimeout: NodeJS.Timeout | undefined = undefined;
	private deviceSize: string = "large-screen";
	private onResize()
	{
		if (!this.isResizing)
		{
			this.onStartResize();
			this.isResizing = true;
		}

		const localThis = this;
	
		function widthNowInRange(low: number, high: number)
		{
			const w = window.innerWidth;
			return (w > low && w < high && localThis.lastScreenWidth == undefined) || ((w > low && w < high) && ((localThis.lastScreenWidth ?? 0) <= low || (localThis.lastScreenWidth ?? 0) >= high));
		}
	
		function widthNowGreaterThan(value: number)
		{
			const w = window.innerWidth;
			return (w > value && localThis.lastScreenWidth == undefined) || (w > value && (localThis.lastScreenWidth ?? 0) < value);
		}
	
		function widthNowLessThan(value: number)
		{
			const w = window.innerWidth;
			return (w < value && localThis.lastScreenWidth == undefined) || (w < value && (localThis.lastScreenWidth ?? 0) > value);
		}

		const docWidthCSS = this.metadata.featureOptions.document?.documentWidth ?? "45em";
		const leftWdithCSS = this.metadata.featureOptions.sidebar?.leftDefaultWidth ?? "20em";
		const rightWidthCSS = this.metadata.featureOptions.sidebar?.rightDefaultWidth ?? "20em";

		// calculate the css widths
		const docWidth = getLengthInPixels(docWidthCSS, this.centerContentEl);
		const leftWidth = this.leftSidebar ? getLengthInPixels(leftWdithCSS, this.leftSidebar?.containerEl) : 0;
		const rightWidth = this.rightSidebar ? getLengthInPixels(rightWidthCSS, this.rightSidebar?.containerEl) : 0;
	
		if (widthNowGreaterThan(docWidth + leftWidth + rightWidth) || widthNowGreaterThan(1025))
		{
			this.deviceSize = "large-screen";
			document.body.classList.toggle("floating-sidebars", false);
			document.body.classList.toggle("is-large-screen", true);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", false);

			if (this.leftSidebar) this.leftSidebar.collapsed = false;
			if (this.rightSidebar) this.rightSidebar.collapsed = false;
		}
		else if (widthNowInRange(docWidth + leftWidth, docWidth + leftWidth + rightWidth) || widthNowInRange(769, 1024))
		{
			this.deviceSize = "small screen";
			document.body.classList.toggle("floating-sidebars", false);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", true);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", false);
	
			if (this.leftSidebar && this.rightSidebar && !this.leftSidebar.collapsed) 
			{
				this.rightSidebar.collapsed = true;
			}
		}
		else if (widthNowInRange(leftWidth + rightWidth, docWidth + leftWidth) || widthNowInRange(481, 768))
		{
			this.deviceSize = "tablet";
			document.body.classList.toggle("floating-sidebars", true);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", true);
			document.body.classList.toggle("is-phone", false);
			
			if (this.leftSidebar && this.rightSidebar && !this.leftSidebar.collapsed) 
			{
				this.rightSidebar.collapsed = true;
			}
		}
		else if (widthNowLessThan(leftWidth + rightWidth) || widthNowLessThan(480))
		{
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
	
		if (this.checkStillResizingTimeout != undefined) clearTimeout(this.checkStillResizingTimeout);
	
		// wait a little bit of time and if the width is still the same then we are done resizing
		const screenWidthSnapshot = window.innerWidth;
		this.checkStillResizingTimeout = setTimeout(function ()
		{
			if (window.innerWidth == screenWidthSnapshot)
			{
				localThis.checkStillResizingTimeout = undefined;
				localThis.isResizing = false;
				localThis.onEndResize();
			}
		}, 200);
	
	}
}
