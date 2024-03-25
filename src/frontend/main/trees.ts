import { slideDown, slideUp } from "./utils";
import { Website } from "./website.txt";

export class TreeItem
{
	public itemEl: HTMLElement;
	public selfEl: HTMLElement;
	public collapseIconEl: HTMLElement | undefined;
	public innerEl: HTMLElement;
	public childrenEl: HTMLElement;

	get path(): string { return this.selfEl.getAttribute("href") ?? ""; }

	public children: TreeItem[];
	public parent: TreeItem | undefined;

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
		if (collapse) slideUp(this.childrenEl, 150);
		else slideDown(this.childrenEl, 150);
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

	constructor(itemEl: HTMLElement, parent: TreeItem | undefined)
	{
		this.itemEl = itemEl;
		this.selfEl = itemEl.querySelector(".tree-item-self") as HTMLElement;
		this.collapseIconEl = itemEl.querySelector(".collapse-icon") as HTMLElement | undefined;
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

	public filter(showPaths: string[])
	{
		this.itemEl.classList.add("filtered");

		// uncollapse all items
		this.allCollapsed = false;

		// hide all items
		let allItems = Array.from(this.itemEl.querySelectorAll(".tree-item:not(.filtered-out)"));
		allItems.push(this.itemEl);
		for (let item of allItems)
		{
			item.classList.add("filtered-out");
		}

		// unhide items that match the search
		showPaths.forEach((path) =>
		{
			let item = this.find((child) => child.selfEl.getAttribute("href") == path);
			if (item) item.itemEl.classList.remove("filtered-out");
		});
	}

	public async unfilter()
	{
		this.itemEl.classList.remove("filtered");

		let filteredItems = Array.from(this.itemEl.querySelectorAll(".tree-item.filtered-out"));
		filteredItems.push(this.itemEl);
		for (let item of filteredItems)
		{
			item.classList.remove("filtered-out");
		}

		this.allCollapsed = true;
	}

	public sort(sortFunction: (a: TreeItem, b: TreeItem) => number)
	{
		this.itemEl.classList.add("sorted");

		this.children.sort(sortFunction);
		this.children.forEach((child) =>
		{
			child.sort(sortFunction);
		});

		this.children.forEach((child) =>
		{
			this.childrenEl.appendChild(child.itemEl);
		});
	}

	public unsort()
	{
		this.itemEl.classList.remove("sorted");

		this.sort((a, b) => (Website.getWebpageData(a.path)?.treeOrder ?? 0) - (Website.getWebpageData(b.path)?.treeOrder ?? 0));
	}

	/**
	 * Find child recursively
	 * @param predicate Function returning true if the item is the one we are looking for
	 * @returns The item if found, undefined otherwise
	 */
	public find(predicate: (item: TreeItem) => boolean): TreeItem | undefined
	{
		if (predicate(this)) return this;
		for (let child of this.children)
		{
			let found = child.find(predicate);
			if (found) return found;
		}
		return undefined;
	}
}


export class Tree extends TreeItem
{
	public wrapperEl: HTMLElement;
	public rootEl: HTMLElement;
	public titleEl: HTMLElement;
	public collapseAllEl: HTMLElement;

	constructor(container: HTMLElement)
	{
		let wrapperEl = container.classList.contains("tree-container") ? container : container.querySelector(".tree-container") as HTMLElement;
		if (wrapperEl == null) throw new Error("Invalid tree container");
		super(wrapperEl, undefined);
		this.wrapperEl = wrapperEl;

		this.rootEl = this.wrapperEl.querySelector(".mod-root") as HTMLElement;
		this.itemEl = this.rootEl;
		this.selfEl = this.wrapperEl.querySelector(".mod-root > .tree-item-self") as HTMLElement;
		this.titleEl = this.wrapperEl.querySelector(".mod-root > .nav-folder-title > .nav-folder-title-content") as HTMLElement;
		this.innerEl = this.titleEl;
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
