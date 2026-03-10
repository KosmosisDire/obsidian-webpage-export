import { ObservableSet } from "../observable-set";
import { TreeItemData, FileTreeItemData, FileTreeOptions } from "./tree-data";
import { transformFilesToTree, findItemByPath } from "./file-tree-transform";

// ─── SVG icons ───────────────────────────────────────────────────────────────

const COLLAPSE_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;

const COLLAPSE_ALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M3 5h8"/><path d="M3 12h8"/><path d="M3 19h8"/><path d="m15 5 3 3 3-3"/><path d="m15 19 3-3 3 3"/></svg>`;
const EXPAND_ALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M3 5h8"/><path d="M3 12h8"/><path d="M3 19h8"/><path d="m15 8 3-3 3 3"/><path d="m15 16 3 3 3-3"/></svg>`;

// ─── TreeNode: a rendered tree item bound to a DOM element ───────────────────

export class TreeNode<T extends TreeItemData = TreeItemData> {
	readonly data: T;
	readonly el: HTMLElement;
	readonly selfEl: HTMLElement;
	readonly childrenEl: HTMLElement;
	readonly collapseIconEl: HTMLElement | null;
	readonly children: TreeNode<T>[] = [];
	readonly tree: Tree<T>;
	readonly parent: TreeNode<T> | null;

	private _collapsed: boolean;

	constructor(
		tree: Tree<T>,
		parent: TreeNode<T> | null,
		data: T,
		opts: TreeRenderOptions<T>
	) {
		this.tree = tree;
		this.parent = parent;
		this.data = data;
		this._collapsed = tree.collapsed.has(data.id);

		const isFolder = !!data.isFolder;
		const isCollapsible =
			data.children.length > 0 &&
			data.depth >= (opts.minCollapsableDepth ?? 1);

		// ── outer wrapper: .tree-item.nav-folder|nav-file ──
		this.el = document.createElement("div");
		this.el.className = "tree-item"
			+ (isFolder ? " nav-folder" : " nav-file")
			+ (isCollapsible ? " mod-collapsible" : "")
			+ (this._collapsed ? " is-collapsed" : "");
		this.el.dataset.depth = String(data.depth);

		// ── self row: <a> for files with href, <div> for folders ──
		const isLink = !!data.href && !isFolder;
		this.selfEl = document.createElement(isLink ? "a" : "div");
		this.selfEl.className = "tree-item-self is-clickable"
			+ (isFolder ? " nav-folder-title" : " nav-file-title")
			+ (isCollapsible ? " mod-collapsible" : "");
		if (isLink) (this.selfEl as HTMLAnchorElement).href = data.href!;
		this.selfEl.dataset.path = data.dataRef || data.href || data.title;
		this.el.appendChild(this.selfEl);

		// ── optional: prepend extras before collapse icon (checkboxes etc) ──
		if (opts.renderBefore) opts.renderBefore(this.selfEl, data);

		// ── collapse icon ──
		if (isCollapsible) {
			this.collapseIconEl = document.createElement("div");
			this.collapseIconEl.className =
				"tree-item-icon collapse-icon nav-folder-collapse-indicator"
				+ (this._collapsed ? " is-collapsed" : "");
			this.collapseIconEl.innerHTML = COLLAPSE_ARROW_SVG;
			this.selfEl.appendChild(this.collapseIconEl);

			this.collapseIconEl.addEventListener("click", (e) => {
				e.stopPropagation();
				e.preventDefault();
				this.toggleCollapse();
			});
		} else {
			this.collapseIconEl = null;
		}

		// ── icon slot ──
		if (opts.renderIcon) opts.renderIcon(this.selfEl, data);

		// ── inner content (title) ──
		const innerEl = document.createElement("div");
		innerEl.className = "tree-item-inner"
			+ (isFolder ? " nav-folder-title-content" : " nav-file-title-content");
		innerEl.textContent = data.title;
		this.selfEl.appendChild(innerEl);

		// ── extras after title (extension tags etc) ──
		if (opts.renderAfter) opts.renderAfter(this.selfEl, data);

		// ── click handling on the self row ──
		if (isCollapsible && !isLink) {
			// Folders: click anywhere on the row toggles collapse
			this.selfEl.addEventListener("click", (e) => {
				if (opts.onItemClick) opts.onItemClick(e, data, this as TreeNode<T>);
				else this.toggleCollapse();
			});
		} else if (opts.onItemClick) {
			this.selfEl.addEventListener("click", (e) => {
				opts.onItemClick!(e, data, this as TreeNode<T>);
			});
		}

		// ── children container ──
		this.childrenEl = document.createElement("div");
		this.childrenEl.className = "tree-item-children"
			+ (isFolder ? " nav-folder-children" : " nav-file-children");
		this.childrenEl.style.display = this._collapsed ? "none" : "block";
		this.el.appendChild(this.childrenEl);

		// ── recurse into children ──
		for (const childData of data.children) {
			const childNode = new TreeNode(tree, this, childData as T, opts);
			this.children.push(childNode);
			this.childrenEl.appendChild(childNode.el);
			tree.nodeMap.set(childData.id, childNode);
		}
	}

	get collapsed(): boolean {
		return this._collapsed;
	}

	set collapsed(value: boolean) {
		if (this._collapsed === value) return;
		this._collapsed = value;
		this.el.classList.toggle("is-collapsed", value);
		this.collapseIconEl?.classList.toggle("is-collapsed", value);
		this.childrenEl.style.display = value ? "none" : "block";

		if (value) this.tree.collapsed.add(this.data.id);
		else this.tree.collapsed.delete(this.data.id);
	}

	toggleCollapse() {
		this.collapsed = !this.collapsed;
	}

	setActive() {
		if (this.tree.activeNode) {
			this.tree.activeNode.selfEl.classList.remove("is-active");
		}
		this.tree.activeNode = this;
		this.selfEl.classList.add("is-active");
	}

	reveal() {
		let node: TreeNode<T> | null = this.parent;
		while (node) {
			node.collapsed = false;
			node = node.parent;
		}
	}

	forAll(fn: (node: TreeNode<T>) => void) {
		fn(this);
		for (const child of this.children) child.forAll(fn);
	}
}

// ─── Tree render options ─────────────────────────────────────────────────────

export interface TreeRenderOptions<T extends TreeItemData = TreeItemData> {
	minCollapsableDepth?: number;
	startCollapsed?: boolean;
	minDepth?: number;

	// Render hooks — append elements into the self row at specific positions
	renderBefore?: (selfEl: HTMLElement, data: T) => void;
	renderIcon?: (selfEl: HTMLElement, data: T) => void;
	renderAfter?: (selfEl: HTMLElement, data: T) => void;

	// Click on the self row
	onItemClick?: (event: MouseEvent, data: T, node: TreeNode<T>) => void;
}

// ─── Tree: the root container ────────────────────────────────────────────────

export class Tree<T extends TreeItemData = TreeItemData> {
	readonly el: HTMLElement;
	readonly children: TreeNode<T>[] = [];
	readonly nodeMap = new Map<string, TreeNode<T>>();
	readonly collapsed = new ObservableSet<string>();
	activeNode: TreeNode<T> | null = null;

	private collapseAllEl: HTMLElement | null = null;
	private opts: TreeRenderOptions<T>;

	constructor(
		items: T[],
		opts: TreeRenderOptions<T> & {
			id?: string;
			class?: string;
			title?: string;
			showCollapseAll?: boolean;
		} = {}
	) {
		this.opts = opts;

		// Initialize collapsed set if starting collapsed
		if (opts.startCollapsed) {
			const collectCollapsible = (list: T[]) => {
				for (const item of list) {
					if (
						item.children.length > 0 &&
						item.depth >= (opts.minCollapsableDepth ?? 1)
					) {
						this.collapsed.add(item.id);
					}
					collectCollapsible(item.children as T[]);
				}
			};
			collectCollapsible(items);
		}

		// ── container ──
		this.el = document.createElement("div");
		this.el.className = "tree-container" + (opts.class ? " " + opts.class : "");
		if (opts.id) this.el.id = opts.id;

		// ── header ──
		if (opts.title || opts.showCollapseAll !== false) {
			const header = document.createElement("div");
			header.className = "feature-header";
			this.el.appendChild(header);

			if (opts.title) {
				const titleEl = document.createElement("div");
				titleEl.className = "feature-title";
				titleEl.textContent = opts.title;
				header.appendChild(titleEl);
			}

			if (opts.showCollapseAll !== false) {
				this.collapseAllEl = document.createElement("button");
				this.collapseAllEl.className = "clickable-icon nav-action-button tree-collapse-all";
				this.collapseAllEl.setAttribute("aria-label", "Collapse All");
				this.collapseAllEl.innerHTML = opts.startCollapsed ? EXPAND_ALL_SVG : COLLAPSE_ALL_SVG;
				header.appendChild(this.collapseAllEl);

				this.collapseAllEl.addEventListener("click", (e) => {
					e.stopPropagation();
					this.toggleCollapseAll();
				});
			}
		}

		// ── render items ──
		const filteredItems = opts.minDepth
			? items.filter((item) => item.depth >= opts.minDepth!)
			: items;

		for (const itemData of filteredItems) {
			const node = new TreeNode<T>(this, null, itemData, opts);
			this.children.push(node);
			this.el.appendChild(node.el);
			this.nodeMap.set(itemData.id, node);
		}
	}

	findByPath(path: string): TreeNode<T> | undefined {
		return this.nodeMap.get(path);
	}

	revealPath(path: string) {
		const node = this.findByPath(path);
		if (node) node.reveal();
	}

	collapseAll() {
		this.forAll((node) => {
			if (node.collapseIconEl) node.collapsed = true;
		});
	}

	expandAll() {
		this.forAll((node) => {
			node.collapsed = false;
		});
	}

	toggleCollapseAll() {
		// If anything is expanded, collapse all. Otherwise expand all.
		let anyExpanded = false;
		this.forAll((node) => {
			if (node.collapseIconEl && !node.collapsed) anyExpanded = true;
		});
		if (anyExpanded) this.collapseAll();
		else this.expandAll();

		if (this.collapseAllEl) {
			this.collapseAllEl.innerHTML = anyExpanded ? EXPAND_ALL_SVG : COLLAPSE_ALL_SVG;
		}
	}

	forAll(fn: (node: TreeNode<T>) => void) {
		for (const child of this.children) child.forAll(fn);
	}

	/** Mount this tree into a container element */
	mount(container: HTMLElement) {
		container.appendChild(this.el);
	}

	/** Remove from DOM */
	destroy() {
		this.el.remove();
	}
}

// ─── FileTree: convenience wrapper for file path lists ───────────────────────

export interface FileTreeConfig extends FileTreeOptions {
	id?: string;
	class?: string;
	title?: string;
	minCollapsableDepth?: number;
	minDepth?: number;
	startCollapsed?: boolean;
	showCollapseAll?: boolean;
	showFileExtensionTags?: boolean;
	hideFileExtensionTags?: string[];
	onFileClick?: (path: string) => void;
	/** Map of file path → { icon?, title? } for overriding tree item display */
	fileMetadata?: Record<string, { icon?: string; title?: string }>;
	/** Map of folder path → { icon?, title? } for overriding folder display */
	folderMetadata?: Record<string, { icon?: string; title?: string }>;
}

export function createFileTree(
	files: string[],
	config: FileTreeConfig = {}
): Tree<FileTreeItemData> {
	const items = transformFilesToTree(files, {
		sort: config.sort,
		showFileExtensionTags: config.showFileExtensionTags,
		hideFileExtensionTags: config.hideFileExtensionTags,
		regexBlacklist: config.regexBlacklist,
		regexWhitelist: config.regexWhitelist,
	});

	// Apply metadata overrides (icon + display title) from file/folder data
	if (config.fileMetadata || config.folderMetadata) {
		const applyMetadata = (list: FileTreeItemData[]) => {
			for (const item of list) {
				if (item.dataRef) {
					const meta = item.isFolder
						? config.folderMetadata?.[item.dataRef]
						: config.fileMetadata?.[item.dataRef];
					if (meta) {
						if (meta.title) item.title = meta.title;
						if (meta.icon) item.icon = meta.icon;
					}
				}
				if (item.children.length > 0) applyMetadata(item.children);
			}
		};
		applyMetadata(items);
	}

	return new Tree<FileTreeItemData>(items, {
		id: config.id,
		class: config.class,
		title: config.title,
		minCollapsableDepth: config.minCollapsableDepth ?? 1,
		minDepth: config.minDepth,
		startCollapsed: config.startCollapsed,
		showCollapseAll: config.showCollapseAll,

		renderIcon(selfEl, data) {
			if (!data.icon) return;
			const iconEl = document.createElement("div");
			iconEl.className = "tree-icon iconize-icon";
			iconEl.innerHTML = data.icon;
			selfEl.appendChild(iconEl);
		},

		renderAfter(selfEl, data) {
			// File extension tag
			if (
				!data.isFolder &&
				config.showFileExtensionTags !== false &&
				data.originalExtension &&
				data.originalExtension !== "" &&
				(!config.hideFileExtensionTags ||
					!config.hideFileExtensionTags.includes(data.originalExtension))
			) {
				const tag = document.createElement("div");
				tag.className = "nav-file-tag";
				tag.textContent = data.originalExtension;
				selfEl.appendChild(tag);
			}
		},

		onItemClick(event, data, node) {
			if (data.isFolder) {
				node.toggleCollapse();
			} else if (config.onFileClick) {
				config.onFileClick(data.dataRef || data.href || "");
			}
		},
	});
}

// Re-export data types for convenience
export type { TreeItemData, FileTreeItemData, FileTreeOptions } from "./tree-data";
export { transformFilesToTree, findItemByPath } from "./file-tree-transform";
