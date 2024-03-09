namespace WebsiteNamespace
{


enum DocumentType
{
	Markdown,
	Canvas,
	Embed,
	Excalidraw,
	Kanban,
	Other
}

export interface FileData
{
	createdTime: number;
	modifiedTime: number;
	sourceSize: number;
	sourcePath: string;
	exportPath: string;
	showInTree: boolean;
	treeOrder: number;
	backlinks: string[];
}

export interface WebpageData extends FileData
{
	headers: {heading: string, level: number, id: string}[];
	aliases: string[];
	tags: string[];
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
	vaultName: string,
	createdTime: number;
	modifiedTime: number;
	pluginVersion: string,
	exportRoot: string,
	baseURL: string,
	
	themeName: string,
	bodyClasses: string,
	addCustomHead: boolean,
	addFavicon: boolean
}

class Website
{
	public static bodyEl: HTMLElement;
	public static websiteEl: HTMLElement;
	public static documentEl: HTMLElement;

	public static isLoaded: boolean = false;
	public static websiteData: WebsiteData | undefined = undefined;
	public static fileTree: Tree | undefined = undefined;
	public static outlineTree: Tree | undefined = undefined;
	public static leftSidebar: Sidebar | undefined = undefined;
	public static rightSidebar: Sidebar | undefined = undefined;
	public static loadedWebpage: WebpageDocument;

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
		this.websiteEl = document.querySelector(".website-container");
		this.documentEl = document.querySelector(".document-container");

		let fileTreeEl = document.querySelector(".nav-files-container") as HTMLElement;
		let outlineTreeEl = document.querySelector(".outline-tree") as HTMLElement;
		let leftSidebarEl = document.querySelector(".sidebar.sidebar-left") as HTMLElement;
		let rightSidebarEl = document.querySelector(".sidebar.sidebar-right") as HTMLElement;

		if (fileTreeEl) this.fileTree = new Tree(fileTreeEl);
		if (outlineTreeEl) this.outlineTree = new Tree(outlineTreeEl);
		if (leftSidebarEl) this.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) this.rightSidebar = new Sidebar(rightSidebarEl);

		this.loadedWebpage = new WebpageDocument(this.documentEl, DocumentType.Markdown);

		this.isLoaded = true;
		console.log("loaded");

		// @ts-ignore
		window.Website = Website;
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
}

Website.init();

class Header
{

}

class Tree
{
	public wrapperEl: HTMLElement;
	public rootEl: HTMLElement;
	public titleEl: HTMLElement;
	public childrenEl: HTMLElement;
	public collapseAllEl: HTMLElement;
	public children: TreeItem[];
	
	private _allCollapsed: boolean;
	get allCollapsed(): boolean { return this._allCollapsed; }
	set allCollapsed(value: boolean)
	{
		this._allCollapsed = value;
		this.children.forEach((child) =>
		{
			child.allCollapsed = value;
		});
	}

	constructor(container: HTMLElement)
	{
		this.wrapperEl = container.classList.contains("tree-container") ? container : container.querySelector(".tree-container") as HTMLElement;
		if (this.wrapperEl == null) throw new Error("Invalid tree container");

		this.rootEl = this.wrapperEl.querySelector(".mod-root") as HTMLElement;
		this.titleEl = this.wrapperEl.querySelector(".mod-root > .nav-folder-title > .nav-folder-title-content") as HTMLElement;
		this.childrenEl = this.wrapperEl.querySelector(".mod-root > .nav-folder-children") as HTMLElement;
		this.collapseAllEl = this.wrapperEl.querySelector(".tree-collapse-all") as HTMLElement;
		
		this.children = [];
		let childItems = Array.from(this.childrenEl.children).filter((el) => el.classList.contains("tree-item"));
		childItems.forEach((child) =>
		{
			this.children.push(new TreeItem(child as HTMLElement, this));
		});

		this.collapseAllEl.addEventListener("click", () =>
		{
			this.allCollapsed = !this.allCollapsed;
		});
	}
}

class TreeItem
{
	public itemEl: HTMLElement;
	public selfEl: HTMLElement;
	public collapseIconEl: HTMLElement | undefined;
	public innerEl: HTMLElement;
	public childrenEl: HTMLElement;

	public children: TreeItem[];
	public parent: TreeItem | Tree;

	private _isFolder: boolean;
	private _isLink: boolean;
	private _isCollapsible: boolean;
	private _collapsed: boolean;
	get isFolder(): boolean { return this._isFolder; }
	get isLink(): boolean { return this._isLink; }
	get collapsable(): boolean { return this._isCollapsible; }
	get collapsed(): boolean { return this._collapsed; }
	set collapsed(collapse: boolean)
	{
		// open parents if we are opening this one and it is hidden
		if (!collapse && this.parent instanceof TreeItem && this.parent.collapsed)
		{
			this.parent.collapsed = false;
		}

		this._collapsed = collapse;
		this.itemEl.classList.toggle("is-collapsed", collapse);
		this.collapseIconEl?.classList.toggle("is-collapsed", collapse);
		this.childrenEl.style.display = collapse ? "none" : "";
	}

	private _allCollapsed: boolean;
	get allCollapsed(): boolean { return this._allCollapsed; }
	set allCollapsed(collapse: boolean)
	{
		this.collapsed = collapse;
		this._allCollapsed = collapse;
		this.children.forEach((child) =>
		{
			child.collapsed = collapse;
		});
	}

	constructor(itemEl: HTMLElement, parent: TreeItem | Tree)
	{
		this.itemEl = itemEl;
		this.selfEl = itemEl.querySelector(".tree-item-self") as HTMLElement;
		this.collapseIconEl = itemEl.querySelector(".collapse-icon");
		this.innerEl = itemEl.querySelector(".tree-item-inner") as HTMLElement;
		this.childrenEl = itemEl.querySelector(".tree-item-children") as HTMLElement;

		this.parent = parent;
		this.children = [];
		let childItems = Array.from(this.childrenEl.children).filter((el) => el.classList.contains("tree-item"));
		childItems.forEach((child) =>
		{
			this.children.push(new TreeItem(child as HTMLElement, this));
		});

		this._isFolder = this.itemEl.classList.contains("nav-folder");
		this._isLink = this.selfEl.tagName == "A";
		this._isCollapsible = this.itemEl.classList.contains("mod-collapsible");
		this.collapsed = this.itemEl.classList.contains("is-collapsed");

		if (this._isCollapsible)
		{
			let clickItem = this.isLink ? this.collapseIconEl ?? this.selfEl : this.selfEl;
			clickItem.addEventListener("click", () =>
			{
				this.collapsed = !this.collapsed;
			});
		}
	}
}

class Canvas
{
	public centerView(){}
}

class Sidebar
{
	public containerEl: HTMLElement;
	public contentEl: HTMLElement;
	public topbarEl: HTMLElement;
	public collapseEl: HTMLElement;
	public topbarContentEl: HTMLElement;
	public resizeHandleEl: HTMLElement | undefined;
	
	private _sidebarID: string;
	get sidebarID(): string { return this._sidebarID; }
	private _isLeft: boolean;
	get isLeft(): boolean { return this._isLeft; }
	private _resizing;
	get resizing(): boolean { return this._resizing; }
	private _collapsed: boolean;
	get collapsed(): boolean { return this._collapsed; }
	set collapsed(collapse: boolean)
	{
		this._collapsed = collapse;	

		if (!collapse && document.body.classList.contains("floating-sidebars"))
		{
			document.body.addEventListener("click", this.clickOutsideCollapse);
		}
		if (collapse) document.body.removeEventListener("click", this.clickOutsideCollapse);

		this.containerEl.classList.toggle("is-collapsed", collapse);
	}

	constructor(container: HTMLElement)
	{
		if (!container.classList.contains("sidebar")) throw new Error("Invalid sidebar container");
		this.containerEl = container;
		this.contentEl = container.querySelector(".sidebar-content") as HTMLElement;
		this.topbarEl = container.querySelector(".sidebar-topbar") as HTMLElement;
		this.collapseEl = container.querySelector(".sidebar-collapse-icon") as HTMLElement;
		this.topbarContentEl = container.querySelector(".topbar-content") as HTMLElement;
		this.resizeHandleEl = container.querySelector(".sidebar-handle");
		this._isLeft = container.classList.contains("sidebar-left");
		this._sidebarID = container.classList.contains("sidebar-left") ? "sidebar-left" : "sidebar-right";

		this.collapseEl.addEventListener("click", () =>
		{
			this.collapsed = !this.collapsed;
		});

		this.setupSidebarResize();
	}

	private setupSidebarResize()
	{
		if (!this.resizeHandleEl) return;

		let minWidthEm = 15;
		let minResizeWidth = parseFloat(getComputedStyle(this.resizeHandleEl.parentElement).fontSize) * minWidthEm;
		let collapseWidth = minResizeWidth / 4.0;

		let savedWidth = localStorage.getItem(`${this.sidebarID}-width`);
		if (savedWidth) this.containerEl.style.setProperty('--sidebar-width', savedWidth);

		let localThis = this;
		function resizeMove(e)
		{
			if (!localThis.resizing) return;
			var distance = localThis.isLeft ? e.clientX : window.innerWidth - e.clientX;
			var newWidth = `min(max(${distance}px, ${minWidthEm}em), 40vw)`;

			if (distance < collapseWidth)
			{
				localThis.collapsed = true;
				localThis.containerEl.style.removeProperty('transition-duration');
			} 
			else 
			{
				localThis.collapsed = false;
				localThis.containerEl.style.setProperty('--sidebar-width', newWidth);
				if (distance > minResizeWidth) localThis.containerEl.style.transitionDuration = "0s";
			}
		}

		function handleClick(e) 
		{
			localThis._resizing = true;
			localThis.containerEl.classList.add('is-resizing');
			document.addEventListener('pointermove', resizeMove);
			document.addEventListener('pointerup', function () 
			{
				document.removeEventListener('pointermove', resizeMove);
				const finalWidth = getComputedStyle(localThis.containerEl).getPropertyValue('--sidebar-width');
				localStorage.setItem(`${localThis.sidebarID}-width`, finalWidth);
				localThis.containerEl.classList.remove('is-resizing');
				localThis.containerEl.style.removeProperty('transition-duration');
			});
		}

		this.resizeHandleEl.addEventListener('pointerdown', handleClick);

		// reset sidebar width on double click
		function resetSidebarEvent(e)
		{
			localThis.containerEl.style.removeProperty('transition-duration');
			localThis.containerEl.style.removeProperty('--sidebar-width');
			localStorage.removeItem(`${localThis.sidebarID}-width`);
		}

		this.resizeHandleEl.addEventListener('dblclick', resetSidebarEvent);
	}

	private clickOutsideCollapse(event)
	{
		// don't allow bubbling into sidebar
		if (event.target.closest(".sidebar")) return;
		this.collapsed = true;
	}
}

class LinkHandler
{
	public static initializeLinks(onElement: HTMLElement)
	{
	}
}

class GraphView
{
	centerView(){}
	setNodes(){}
}

class WebpageDocument
{
	public headers: Header[];
	public documentType: DocumentType;
	public documentContainerEl: HTMLElement;
	public webpageData: WebpageData;

	public constructor(documentContainerEl: HTMLElement, documentType: DocumentType)
	{
		console.log(documentContainerEl); 
		if (!documentContainerEl.classList.contains("document-container")) throw new Error("Invalid document container");
		this.documentContainerEl = documentContainerEl;
		this.documentType = documentType;
		this.headers = [];

		setTimeout(() => this.documentContainerEl.classList.remove("hide"));
	}
}


}


// temp
function setActiveDocument(url, showInTree, changeURL, animate = true)
{
	console.log("setActiveDocument", url, showInTree, changeURL, animate);
}

function getPointerPosition(event)
{
	let touches: any = event.touches ? Array.from(event.touches) : [];
	let x = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientX, 0) / event.touches.length) : event.clientX;
	let y = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientY, 0) / event.touches.length) : event.clientY;
	return {x: x, y: y};
}
