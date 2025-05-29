import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { LinkHandler } from "./links";
import { slideDown, slideUp } from "./utils";

export class TreeItem
{
	public itemEl: HTMLElement;
	public selfEl: HTMLElement;
	public collapseIconEl: HTMLElement | undefined;
	public innerEl: HTMLElement;
	public childrenEl: HTMLElement;

	protected _path = "";
	get path(): string { return this._path; }
	set path(path: string)
	{
		if (this.root.pathToItem)
		{
			this.root.pathToItem.delete(this._path);
			this.root.pathToItem.set(path, this);
		}

		this._path = path;
		this.selfEl.setAttribute("href", path);
	}

	get title(): string { return this.innerEl.innerHTML; }
	set title(title: string)
	{
		this.innerEl.innerHTML = title;
	}

	public children: TreeItem[];
	public parent: TreeItem | undefined;
	public root: Tree;
	public depth: number;
	protected minCollapseDepth: number;

	protected _isFolder: boolean;
	protected _isLink: boolean;
	protected _isCollapsible: boolean;
	protected _collapsed: boolean;
	get isFolder(): boolean { return this._isFolder; }
	get isLink(): boolean { return this._isLink; }
	/**
	 * Can this item be collapsed?
	 */
	get collapsable(): boolean { return this._isCollapsible; }
	/**
	 * Is the item collapsed?
	 */
	get collapsed(): boolean { return this._collapsed; }
	/**
	 * Collapse or uncollapse the item
	 */
	set collapsed(collapse: boolean)
	{
		if (!this.collapsable) collapse = false;
		if (this.collapsed == collapse) return;
		// open parents if we are opening this one and it is hidden
		if (!collapse && this.parent instanceof TreeItem && this.parent.collapsed)
		{
			this.parent.collapsed = false;
		}

		this._collapsed = collapse;
		this.itemEl.classList.toggle("is-collapsed", collapse);
		this.collapseIconEl?.classList.toggle("is-collapsed", collapse);
		if (collapse) slideUp(this.childrenEl, this.collapseAnimationLength);
		else slideDown(this.childrenEl, this.collapseAnimationLength);

		this.parent?._checkAnyChildrenOpen();
	}

	protected _collapsedRecursive: boolean;
	get collapsedRecursive(): boolean { return this._collapsedRecursive; }
	/**
	 * Collapse or uncollapse all children recursively
	 */
	set collapsedRecursive(collapse: boolean)
	{
		if (this.collapsedRecursive == collapse) return;
		this._collapsedRecursive = collapse;
		this.children.forEach((child) =>
		{
			child.collapsed = collapse;
			child.collapsedRecursive = collapse;
		});
	}

	private _anyChildrenOpen: boolean;
	/**
	 * Are any immediate children uncollapsed / open?
	 */
	get anyChildrenOpen(): boolean { return this._anyChildrenOpen; }
	public _checkAnyChildrenOpen() // seperate since this isn't supposed to be set by the user but has to be public
	{
		this._anyChildrenOpen = this.children.some((child) => !child.collapsed && child.collapsable);
		this._collapsedRecursive = !this._anyChildrenOpen;
		return this._anyChildrenOpen;
	}

	public forAllChildren(callback: (item: TreeItem) => void)
	{
		this.children.forEach((child) =>
		{
			callback(child);
			child.forAllChildren(callback);
		});
	}

	// allow to either set the animation length destructively or temporarily override it
	private collapseAnimationLength: number = 150;
	private _oldAnimationLength: number = this.collapseAnimationLength;
	/**
	 * Temporarily override the animation length for this and all children (use restoreAnimationLength to reset it)
	 */
	public overrideAnimationLength(length: number)
	{
		this._oldAnimationLength = this.collapseAnimationLength;
		this.collapseAnimationLength = length;
		this.children.forEach((child) =>
		{
			child.overrideAnimationLength(length);
		});
	}
	/**
	 * Reset the animation length to the item's old value for this and all children
	 */
	public restoreAnimationLength()
	{
		this.collapseAnimationLength = this._oldAnimationLength;
		this.children.forEach((child) =>
		{
			child.restoreAnimationLength();
		});
	}

	constructor(itemEl: HTMLElement, parent: TreeItem | undefined, depth: number = 0, minCollapseDepth: number = 1)
	{
		this.root = (this instanceof Tree ? this : (parent?.root ?? (parent instanceof Tree ? parent : undefined))) as Tree;
		this.parent = parent;
		this.minCollapseDepth = minCollapseDepth;
		
		let isRoot = this instanceof Tree;
		this.itemEl = itemEl;
		this.selfEl = isRoot ? itemEl : itemEl.querySelector(".tree-item-self") as HTMLElement;
		this.collapseIconEl = isRoot? itemEl : this.selfEl.querySelector(".collapse-icon") as HTMLElement | undefined;
		this.innerEl = isRoot ? itemEl : this.selfEl.querySelector(".tree-item-inner") as HTMLElement;
		this.childrenEl = isRoot ? itemEl : itemEl.querySelector(".tree-item-children") as HTMLElement;

		const hrefAttr = this.selfEl.getAttribute("href");
		if (hrefAttr) this.path = hrefAttr;
		this.children = [];
		const childItems = Array.from(this.childrenEl.children).filter((el) => el.classList.contains("tree-item"));
		childItems.forEach((child) =>
		{
			this.children.push(new TreeItem(child as HTMLElement, this, depth + 1, this.minCollapseDepth));
		});

		// TODO: fix min collapse depth being passed from plugin
		this._isFolder = this.itemEl.classList.contains("nav-folder");
		this._isLink = this.selfEl.tagName == "A";
		this.depth = depth;
		this._isCollapsible = this.itemEl.classList.contains("mod-collapsible") && this.depth >= this.minCollapseDepth;
		
		if (!this._isCollapsible)
		{
			// Remove collapse icon if not collapsible
			if (this.collapseIconEl && !(this instanceof Tree))
			{
				console.log(this);
				this.collapseIconEl.remove();
				this.collapseIconEl = undefined;
			}
			
			// Remove collapsible classes
			this.selfEl.classList.remove("mod-collapsible");
			this.itemEl.classList.remove("mod-collapsible");
			this.itemEl.classList.remove("is-collapsed");
		}
		
		this.collapsed = this.itemEl.classList.contains("is-collapsed");

		if (this._isCollapsible) 
		{
			const clickItem = this.isLink ? this.collapseIconEl ?? this.selfEl : this.selfEl;
			clickItem.addEventListener("click", (e) =>
			{
				this.collapsed = !this.collapsed;
				e.preventDefault();
				e.stopPropagation();
			});
		}

		this._checkAnyChildrenOpen();
	}

	public setActive()
	{
		if (this.root.activeItem) this.root.activeItem.selfEl.classList.remove("is-active");
		this.root.activeItem = this;
		this.selfEl.classList.add("is-active");
	}

	public setFiltered(filteredOut: boolean)
	{
		if (filteredOut)
		{
			this.itemEl.classList.add("filtered-out");
		}
		else
		{
			this.itemEl.classList.remove("filtered-out");
			this.parent?.setFiltered(false);
		}
	}

	public filter(paths: string[])
	{
		this.overrideAnimationLength(0);
		this.itemEl.classList.add("filtered");
		

		// uncollapse all items
		this.collapsedRecursive = false;

		// hide all items
		this.forAllChildren((child) =>
		{
			child.setFiltered(true);
		});

		// unhide items that match the search
		paths.forEach((path) =>
		{
			const item = this.findByPath(path);
			if (item) item.setFiltered(false);
		});
	}

	public async unfilter()
	{
		this.itemEl.classList.remove("filtered");

		// unhide all items
		this.forAllChildren((child) =>
		{
			child.setFiltered(false);
		});

		this.collapsedRecursive = true;
		this.restoreAnimationLength();
	}

	public setSubHeadings(hintLabelLists: Map<string, string[]>)
	{
		this.removeSubHeadings();

		for (const [path, hintLabels] of hintLabelLists)
		{
			if (hintLabels.length == 0) continue;
			const item = this.findByPath(path);
			if (!item) continue;

			item.itemEl.classList.add("has-hints");
			const hintContainer = document.createElement("div");
			hintContainer.classList.add("tree-hint-container");
			item.itemEl.appendChild(hintContainer);

			hintLabels.forEach((label) =>
			{
				const hintLabelEl = document.createElement("a");
				hintLabelEl.classList.add("tree-hint-label");
				hintLabelEl.classList.add("internal-link");
				hintLabelEl.textContent = label;
				hintLabelEl.href = path + "#" + label;
				hintContainer.appendChild(hintLabelEl);
			});

			LinkHandler.initializeLinks(hintContainer);
		}
	}

	public removeSubHeadings()
	{
		this.itemEl.classList.remove("has-hints");
		this.itemEl.querySelectorAll(".tree-hint-container").forEach((el) =>
		{
			el.remove();
		});
		this.itemEl.querySelectorAll(".has-hints").forEach((el) =>
		{
			el.classList.remove("has-hints");
		});

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

		this.sort((a, b) => (ObsidianSite.getWebpageData(a.path)?.treeOrder ?? 0) - (ObsidianSite.getWebpageData(b.path)?.treeOrder ?? 0));
	}

	/**
	 * Find child recursively
	 * @param predicate Function returning true if the item is the one we are looking for
	 * @returns The item if found, undefined otherwise
	 */
	public find(predicate: (item: TreeItem) => boolean): TreeItem | undefined
	{
		if (predicate(this)) return this;
		for (const child of this.children)
		{
			const found = child.find(predicate);
			if (found) return found;
		}
		return undefined;
	}

	public findByPath(path: string): TreeItem | undefined
	{
		return this.root.pathToItem.get(path);
	}
}


export class Tree extends TreeItem
{
	public activeItem: TreeItem | undefined;
	public rootEl: HTMLElement;
	// public titleEl: HTMLElement;
	public collapseAllEl: HTMLElement;

	private collapsePath1: SVGPathElement;
	private collapsePath2: SVGPathElement;
	private static readonly collapsePaths = ["m7 15 5 5 5-5", "m7 9 5-5 5 5"]; // path 1, path 2 - svg paths
	private static readonly uncollapsePaths = ["m7 20 5-5 5 5", "m7 4 5 5 5-5"]; // path 1, path 2 - svg paths

	public pathToItem: Map<string, TreeItem> = new Map();

	// set the collapse all icon state depending on the children
	public override _checkAnyChildrenOpen(): boolean 
	{
		const open = super._checkAnyChildrenOpen();
		this.setCollapseIcon(!open);
		return open;
	}

	constructor(container: HTMLElement, minCollapseDepth: number = 1)
	{
		const wrapperEl = container.classList.contains("tree-container") ? container : container.querySelector(".tree-container") as HTMLElement;
		if (wrapperEl == null) throw new Error("Invalid tree container");
		super(wrapperEl, undefined, 0, minCollapseDepth);

		this.rootEl = wrapperEl;
		this.childrenEl = this.rootEl;
		this.selfEl = this.rootEl;
		this.innerEl = this.rootEl;

		this.collapseAllEl = this.rootEl.querySelector(".tree-collapse-all") as HTMLElement;
		const collapseSvg = this.collapseAllEl?.querySelector("svg");
		if (collapseSvg) 
		{
			collapseSvg.innerHTML = "<path d></path><path d></path>";
			this.collapsePath1 = collapseSvg.querySelector("path") as SVGPathElement;
			this.collapsePath2 = collapseSvg.querySelector("path:last-child") as SVGPathElement;
		}
		

		this.forAllChildren((child) =>
		{
			if (child.path != "")
				this.pathToItem.set(child.path, child);
		});

		this.collapseAllEl?.addEventListener("click", () =>
		{
			this.setCollapseIcon(!this.collapsedRecursive);
			this.collapsedRecursive = !this.collapsedRecursive;
		});

		LinkHandler.initializeLinks(this.rootEl);

		// if there are any non-collapsed items, set the collapse icon to uncollapsed, otherwise to collapsed
		this.setCollapseIcon(!this.anyChildrenOpen);
	}

	private setCollapseIcon(collapsed: boolean)
	{
		if (collapsed)
		{
			this.collapsePath1?.setAttribute("d", Tree.collapsePaths[0]);
			this.collapsePath2?.setAttribute("d", Tree.collapsePaths[1]);
		}
		else
		{
			this.collapsePath1?.setAttribute("d", Tree.uncollapsePaths[0]);
			this.collapsePath2?.setAttribute("d", Tree.uncollapsePaths[1]);
		}
	}

	public revealPath(path: string)
	{
		const item = this.findByPath(path);
		if (!item) return;
		item.collapsed = false;
	}
}
