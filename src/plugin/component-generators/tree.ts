import { MarkdownRendererAPI } from "plugin/render-api/render-api";
import { Path } from "plugin/utils/path";
import { ComponentGenerator } from "plugin/component-generators/component-generator";

export class Tree implements ComponentGenerator
{
	public children: TreeItem[] = [];
	public minCollapsableDepth: number = 1;
	public title: string | undefined = undefined;
	public class: string = "";
	public id: string = "";
	public showNestingIndicator = true;
	public minDepth: number = 1; 
	public generateWithItemsClosed: boolean = false;
	public makeLinksWebStyle: boolean = false;
	public renderMarkdownTitles: boolean = true;
	public addCollapseAllButton: boolean = true;
	public container: HTMLElement | undefined = undefined;

	protected async buildTreeRecursive(tree: TreeItem, container: HTMLElement, minDepth:number = 1, closeAllItems: boolean = false): Promise<void>
	{
		tree.minCollapsableDepth = this.minCollapsableDepth;
		const treeItem = await tree.insert(container, closeAllItems);
		
		if(!tree.childContainer) return;

		for (const item of tree.children)
		{
			if(item.depth < minDepth) continue;
			await this.buildTreeRecursive(item, tree.childContainer, minDepth, closeAllItems);
		}
	}

	//**Generate the raw tree with no extra containers or buttons*/
	protected async generateTree(container: HTMLElement)
	{
		for (const item of this.children)
		{
			await this.buildTreeRecursive(item, container, this.minDepth, this.generateWithItemsClosed);
		}

		this.forAllChildren((child) =>
		{
			if (child.isCollapsed) child.setCollapse(true, false);
		});
	}
	
	//**Generate a tree with a title and full tree collapse button*/
	public async insert(container: HTMLElement)
	{
		/*
		- div.tree-header
				- span.sidebar-section-header
				- button.tree-collapse-all
					- svg
		- div.tree-container.mod-root.nav-folder
			- div.tree-scroll-area.tree-item-children
				- div.tree-item // invisible first item
				- div.tree-item
					- div.tree-item-contents
						- div.tree-item-icon
							- svg
						- a.internal-link
							- span.tree-item-title
					- div.tree-item-children
		*/

		this.container = container;
		const wrapper = container.createDiv({ attr: {id: this.id, class: this.class + " tree-container"} });
			const root = wrapper.createDiv("tree-item nav-folder mod-root");
				root.setAttribute("data-depth", "0");
				if (this.title || this.addCollapseAllButton){
					const title = root.createDiv("tree-item-self nav-folder-title");
					if (this.title){
						const titleInner = title.createDiv("tree-item-inner nav-folder-title-content");
							titleInner.textContent = this.title;
					}
					if (this.addCollapseAllButton){
						const collapseAllEl = title.createEl('button', { cls: "clickable-icon nav-action-button tree-collapse-all" });
							collapseAllEl.setAttribute("aria-label", "Collapse All");
							collapseAllEl.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></svg>";
							if (this.generateWithItemsClosed) collapseAllEl.classList.add("is-collapsed");
					}
				}
				const children = root.createDiv("tree-item-children nav-folder-children");
					children.createDiv("nav-folder-spacer");

		if (this.showNestingIndicator) root.classList.add("mod-nav-indicator");

		await this.generateTree(children);
	}

	public sortAlphabetically(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? b.title.localeCompare(a.title, undefined, { numeric: true }) : a.title.localeCompare(b.title, undefined, { numeric: true }));
		for (const child of this.children)
		{
			child.sortAlphabetically();
		}
	}

	public forAllChildren(func: (child: TreeItem) => void, recursive: boolean = true)
	{
		for (const child of this.children)
		{
			func(child);
			if (recursive) child.forAllChildren(func);
		}
	}
}

export class TreeItem
{
	public tree: Tree;
	public children: TreeItem[] = [];
	public parent: TreeItem | Tree;
	public depth: number = 0;
	public title: string = "";
	public icon: string = "";
	private _href: string | undefined = undefined;
	public get href(): string | undefined { return this._href; }
	public set href(value: string | undefined) { this._href = value; this.dataRef = this.dataRef ?? value; }
	public dataRef: string | undefined = undefined;
	public minCollapsableDepth: number = 1;
	public isCollapsed: boolean = false;
	public childContainer: HTMLDivElement | undefined = undefined;

	public itemEl: HTMLDivElement | undefined = undefined;
	public collapseIcon: HTMLElement | undefined = undefined;

	public constructor(tree: Tree, parent: TreeItem | Tree, depth: number)
	{
		this.tree = tree;
		this.parent = parent;
		this.depth = depth;
	}

	public async insert(container: HTMLElement, startClosed: boolean = true): Promise<HTMLDivElement>
	{
		if(startClosed) this.isCollapsed = true;
		this.itemEl = this.insertItem(container);
		await this.insertSelf(this.itemEl);
		this.insertChildren(this.itemEl);

		return this.itemEl;
	}

	public forAllChildren(func: (child: TreeItem) => void, recursive: boolean = true)
	{
		for (const child of this.children)
		{
			func(child);
			if (recursive) child.forAllChildren(func);
		}
	}
	
	public async setCollapse(collapsed: boolean, animate = true)
	{
		if (!this.isCollapsible()) return;
		if (!this.itemEl || !this.itemEl.classList.contains("mod-collapsible")) return;

		const children = this.itemEl.querySelector(".tree-item-children") as HTMLElement;

		if (children == null) return;

		if (collapsed)
		{
			this.itemEl.classList.add("is-collapsed");
			this.collapseIcon?.classList.add("is-collapsed");
			if(animate) this.slideUp(children, 100);
			else children.style.display = "none";
		}
		else
		{
			this.itemEl.classList.remove("is-collapsed");
			this.collapseIcon?.classList.remove("is-collapsed");
			if(animate) this.slideDown(children, 100);
			else children.style.removeProperty("display");
		}

		this.isCollapsed = collapsed;
	}

	public toggleCollapse()
	{
		if (!this.itemEl) return;
		this.setCollapse(!this.itemEl.classList.contains("is-collapsed"));
	}

	public sortAlphabetically(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? b.title.localeCompare(a.title, undefined, { numeric: true }) : a.title.localeCompare(b.title, undefined, { numeric: true }));
		for (const child of this.children)
		{
			child.sortAlphabetically();
		}
	}

	protected isCollapsible(): boolean
	{
		return this.children.length != 0 && this.depth >= this.minCollapsableDepth;
	}

	protected insertItem(container: HTMLElement): HTMLDivElement
	{
		const itemEl = container.createDiv("tree-item");
		itemEl.setAttribute("data-depth", this.depth.toString());
		if (this.isCollapsible()) itemEl.classList.add("mod-collapsible");
		if (this.isCollapsed) itemEl.classList.add("is-collapsed");
		return itemEl;
	}

	protected async insertInner(container: HTMLElement): Promise<HTMLDivElement>
	{
		const itemContentsEl = container.createDiv("tree-item-inner");

		if (this.tree.renderMarkdownTitles) MarkdownRendererAPI.renderMarkdownSimpleEl(this.title, itemContentsEl);
		else itemContentsEl.innerText = this.title;

		// remove a tags from the title
		itemContentsEl.querySelectorAll("a").forEach((a) => 
		{
			const span = a.ownerDocument.createElement("span");
			span.innerHTML = a.innerHTML;
			a.replaceWith(span);
		});

		return itemContentsEl;
	}

	protected async insertSelf(container: HTMLElement): Promise<HTMLElement>
	{
		if (this.tree.makeLinksWebStyle && this.href) this.href = Path.slugify(this.href);
		const itemLinkEl = container.createEl(this.href ? "a" : "div", { cls: "tree-item-self is-clickable" });

		if (this.href) 
			itemLinkEl.setAttribute("href", this.href);

		itemLinkEl.setAttribute("data-path", this.dataRef ?? this.href ?? this.title);

		if (this.isCollapsible()) 
			this.insertCollapseIcon(itemLinkEl);
		
		this.insertIcon(itemLinkEl);
		await this.insertInner(itemLinkEl);

		return itemLinkEl
	}

	protected insertCollapseIcon(container: HTMLElement): HTMLElement | undefined
	{
		const arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;

		this.collapseIcon = container.createDiv("tree-item-icon collapse-icon");
		if (this.isCollapsed) this.collapseIcon.classList.add("is-collapsed");
		this.collapseIcon.innerHTML = arrowIcon;
		return this.collapseIcon;
	}

	protected insertIcon(container: HTMLElement): HTMLDivElement | undefined
	{
		if (this.icon.trim() == "") return undefined;
		
		const itemIconEl = container.createDiv("tree-icon iconize-icon");

		if (this.tree.renderMarkdownTitles) MarkdownRendererAPI.renderMarkdownSimpleEl(this.icon, itemIconEl);
		else itemIconEl.innerText = this.icon;

		return itemIconEl;
	}

	protected insertChildren(container: HTMLElement): HTMLDivElement
	{
		this.childContainer = container.createDiv("tree-item-children");
		return this.childContainer;
	}

	protected slideUp(target: HTMLElement, duration=500)
	{
		target.style.transitionProperty = 'height, margin, padding';
		target.style.transitionDuration = duration + 'ms';
		target.style.boxSizing = 'border-box';
		target.style.height = target.offsetHeight + 'px';
		target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = "0";
		target.style.paddingTop = "0";
		target.style.paddingBottom = "0";
		target.style.marginTop = "0";
		target.style.marginBottom = "0";
		window.setTimeout(async () => {
				target.style.display = 'none';
				target.style.removeProperty('height');
				target.style.removeProperty('padding-top');
				target.style.removeProperty('padding-bottom');
				target.style.removeProperty('margin-top');
				target.style.removeProperty('margin-bottom');
				target.style.removeProperty('overflow');
				target.style.removeProperty('transition-duration');
				target.style.removeProperty('transition-property');
		}, duration);
	}

	protected slideDown(target: HTMLElement, duration=500)
	{
		target.style.removeProperty('display');
		let display = window.getComputedStyle(target).display;
		if (display === 'none') display = 'block';
		target.style.display = display;
		const height = target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = "0";
		target.style.paddingTop = "0";
		target.style.paddingBottom = "0";
		target.style.marginTop = "0";
		target.style.marginBottom = "0";
		target.offsetHeight;
		target.style.boxSizing = 'border-box';
		target.style.transitionProperty = "height, margin, padding";
		target.style.transitionDuration = duration + 'ms';
		target.style.height = height + 'px';
		target.style.removeProperty('padding-top');
		target.style.removeProperty('padding-bottom');
		target.style.removeProperty('margin-top');
		target.style.removeProperty('margin-bottom');
		window.setTimeout(async () => {
			target.style.removeProperty('height');
			target.style.removeProperty('overflow');
			target.style.removeProperty('transition-duration');
			target.style.removeProperty('transition-property');
		}, duration);
	}
}
