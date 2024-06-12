
import { Search } from "./search";
import { Sidebar } from "./sidebars";
import { Tree } from "./trees";
import { Bounds, delay, waitUntil } from "./utils";
import { WebpageDocument } from "./document";
import { WebpageData, WebsiteData } from "shared/website-data";
import { GraphView } from "./graph-view";
import { Notice } from "./notifications";
import { Theme } from "./theme";
import { LinkHandler } from "./links";

export class ObsidianWebsite
{
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

		this.metadata = await this.loadWebsiteData() as WebsiteData;
		if (!this.metadata)
		{
			console.error("Failed to load website data.");
			return;
		}
	}

	private async onInit()
	{
		await waitUntil(() => this.metadata != undefined);
		console.log("Website init");
		if(window.location.protocol != "file:") 
		{
			// @ts-ignore
			await loadIncludes(); // defined in deferred.js
		}

		this.theme = new Theme();
 
		this.bodyEl = document.body;
		this.websiteEl = document.querySelector("#layout") as HTMLElement;
		this.centerContentEl = document.querySelector("#center-content") as HTMLElement;

		const fileTreeEl = document.querySelector("#file-explorer") as HTMLElement;
		const outlineTreeEl = document.querySelector("#outline-tree") as HTMLElement;
		const leftSidebarEl = document.querySelector(".sidebar#left-sidebar") as HTMLElement;
		const rightSidebarEl = document.querySelector(".sidebar#right-sidebar") as HTMLElement;
		
		this.createLoadingEl();
		
		if (fileTreeEl) this.fileTree = new Tree(fileTreeEl);
		if (outlineTreeEl) this.outlineTree = new Tree(outlineTreeEl);
		if (leftSidebarEl) this.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) this.rightSidebar = new Sidebar(rightSidebarEl); 
		this.search = await new Search().init();

		const pathname = document.querySelector("meta[name='pathname']")?.getAttribute("content") ?? "unknown";
		this.entryPage = pathname;

		this.document = await (await new WebpageDocument(pathname).init()).postLoadInit();
		
		if (ObsidianSite.metadata.featureOptions.graphView.enabled)
		{
			this.loadGraphView().then(() => this.graphView?.showGraph([pathname]));
		}

		this.initEvents();
		
		this.isLoaded = true;
		this.onloadCallbacks.forEach(cb => cb(this.document));
	}

	private initEvents()
	{
		window.addEventListener("popstate", async (e) =>
		{
			console.log("popstate", e);
			const pathname = e.state.pathname;
			ObsidianSite.loadURL(pathname);
		});
	}

	public async loadURL(url: string): Promise<WebpageDocument | undefined>
	{
		url = LinkHandler.getPathnameFromURL(url);
		let data = ObsidianSite.getWebpageData(url) as WebpageData;
		if (!data)
		{
			new Notice("This page does not exist yet.");
			console.warn("Page does not exist", url);
			return undefined;
		}

		let page = await (await new WebpageDocument(url).load()).init();
		this.onloadCallbacks.forEach(cb => cb(this.document));
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
			var file = this.metadata.fileInfo[url];
			if (!file?.data)
			{
				console.error("Failed to fetch", url);
				return;
			}

			let req = new Response(file.data, {status: 200});
			return req;
		}
	}

	private async loadWebsiteData(): Promise<WebsiteData | undefined>
	{
		if (this.isHttp)
		{
			try
			{
				const dataReq = await fetch("lib/metadata.json");
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
		else
		{
			// when local the metadata is embedded
			const dataEl = document.querySelector("data#website-metadata");
			if (!dataEl) return undefined;
			return JSON.parse(decodeURI(dataEl.getAttribute("value") ?? ""))
		}

		return undefined;
	}

	private async loadGraphView()
	{
		const localThis = this;
		//@ts-ignore
		waitLoadScripts(["pixi", "graph-render-worker", "graph-wasm"],  () =>
		{
			console.log("scripts loaded");
			async function initGraphView()
			{
				console.log("Initializing graph view"); 
				const graphView = new GraphView();
				localThis.graphView = graphView;
				console.log("Graph view initialized");
			}

			//@ts-ignore
			Module['onRuntimeInitialized'] = initGraphView;

			setTimeout(() =>
			{
				console.log(localThis.graphView);
				if (localThis.graphView == undefined)
				{
					initGraphView();
				}
			}, 300);
		});

		await waitUntil(() => this.graphView != undefined);
	}

	public getWebpageData(url: string)
	{
		if (this.metadata)
		{
			const data = this.metadata.webpages[url];
			if (data)
			{
				return data;
			}
		}

		return undefined;
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
		this.graphView?.graphRenderer?.canvas.classList.toggle("hide", loading);
		
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
}
