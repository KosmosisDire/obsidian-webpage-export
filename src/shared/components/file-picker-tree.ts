import { ObservableSet } from "../observable-set";
import { FileTreeItemData, FileTreeOptions } from "./tree-data";
import { transformFilesToTree } from "./file-tree-transform";
import { Tree, TreeNode, TreeRenderOptions } from "./tree";

// ─── Selection state manager ─────────────────────────────────────────────────

export class FilePickerSelection {
	readonly selected = new ObservableSet<string>();
	private itemsById = new Map<string, FileTreeItemData>();

	setItems(items: FileTreeItemData[]) {
		this.itemsById.clear();
		const walk = (list: FileTreeItemData[]) => {
			for (const item of list) {
				this.itemsById.set(item.id, item);
				if (item.children.length > 0) walk(item.children);
			}
		};
		walk(items);
	}

	isSelected(id: string): boolean {
		return this.selected.has(id);
	}

	toggle(id: string) {
		this.selected.toggle(id);
	}

	selectWithChildren(id: string, select: boolean) {
		const walk = (itemId: string) => {
			const item = this.itemsById.get(itemId);
			if (!item) return;
			if (select && !this.selected.has(itemId)) this.selected.add(itemId);
			else if (!select && this.selected.has(itemId)) this.selected.delete(itemId);
			for (const child of item.children) walk(child.id);
		};
		walk(id);
	}

	selectAll(select: boolean) {
		if (select) {
			for (const [id] of this.itemsById) this.selected.add(id);
		} else {
			this.selected.clear();
		}
	}

	evaluateFolderSelections() {
		// Process from deepest to shallowest
		const depthMap = new Map<number, FileTreeItemData[]>();
		let maxDepth = 0;
		for (const [, item] of this.itemsById) {
			if (item.depth > maxDepth) maxDepth = item.depth;
			const list = depthMap.get(item.depth) || [];
			list.push(item);
			depthMap.set(item.depth, list);
		}

		for (let depth = maxDepth; depth >= 1; depth--) {
			const items = depthMap.get(depth) || [];
			for (const item of items) {
				if (item.isFolder && item.children.length > 0) {
					const allSelected = item.children.every((c) =>
						this.selected.has(c.id)
					);
					if (allSelected && !this.selected.has(item.id))
						this.selected.add(item.id);
					else if (!allSelected && this.selected.has(item.id))
						this.selected.delete(item.id);
				}
			}
		}
	}

	getSelectedFiles(): string[] {
		const files: string[] = [];
		for (const [id, item] of this.itemsById) {
			if (this.selected.has(id) && !item.isFolder) {
				files.push(item.dataRef || id);
			}
		}
		return files;
	}

	getSelectedPaths(): string[] {
		// Check if everything is selected
		let total = 0;
		let selectedCount = 0;
		for (const [id] of this.itemsById) {
			total++;
			if (this.selected.has(id)) selectedCount++;
		}
		if (total > 0 && total === selectedCount) return ["all"];

		// Collect selected with optimization: if a folder is selected, skip its children
		const collectPaths = (items: FileTreeItemData[]): string[] => {
			const paths: string[] = [];
			for (const item of items) {
				if (this.selected.has(item.id)) {
					paths.push(item.dataRef || item.id);
				} else if (item.children.length > 0) {
					paths.push(...collectPaths(item.children));
				}
			}
			return paths;
		};
		return collectPaths(Array.from(this.itemsById.values()).filter((i) => i.depth === 1));
	}

	setSelectedPaths(paths: string[], rootItems: FileTreeItemData[]) {
		this.selectAll(false);
		if (paths.includes("all")) {
			this.selectAll(true);
			return;
		}
		for (const path of paths) {
			for (const [id, item] of this.itemsById) {
				if (item.dataRef === path && !this.selected.has(id)) {
					this.selected.add(id);
				}
			}
		}
		this.evaluateFolderSelections();
	}
}

// ─── FilePickerTree: a Tree with checkboxes ──────────────────────────────────

export interface FilePickerTreeConfig extends FileTreeOptions {
	id?: string;
	class?: string;
	title?: string;
	minCollapsableDepth?: number;
	minDepth?: number;
	startCollapsed?: boolean;
	initialSelection?: string[];
	onSelectionChange?: (paths: string[]) => void;
}

export interface FilePickerTreeHandle {
	tree: Tree<FileTreeItemData>;
	selection: FilePickerSelection;
	getSelectedFiles(): string[];
	getSelectedPaths(): string[];
	setSelectedPaths(paths: string[]): void;
	selectAll(selected: boolean): void;
}

export function createFilePickerTree(
	files: string[],
	config: FilePickerTreeConfig = {}
): FilePickerTreeHandle {
	const items = transformFilesToTree(files, {
		sort: config.sort ?? true,
		regexBlacklist: config.regexBlacklist,
		regexWhitelist: config.regexWhitelist,
	});

	const selection = new FilePickerSelection();
	selection.setItems(items);

	// Map of node ID → checkbox element for reactive updates
	const checkboxMap = new Map<string, HTMLInputElement>();

	const updateCheckboxUI = (id: string) => {
		const cb = checkboxMap.get(id);
		if (cb) {
			const checked = selection.isSelected(id);
			cb.checked = checked;
			cb.classList.toggle("checked", checked);
		}
	};

	const updateAllCheckboxes = () => {
		for (const [id] of checkboxMap) updateCheckboxUI(id);
	};

	// Listen for selection changes
	selection.selected.subscribe(() => {
		updateAllCheckboxes();
		if (config.onSelectionChange) {
			config.onSelectionChange(selection.getSelectedPaths());
		}
	});

	const handleCheckboxChange = (
		itemId: string,
		checked: boolean,
		data: FileTreeItemData
	) => {
		if (data.isFolder) {
			selection.selectWithChildren(itemId, checked);
		} else {
			if (checked && !selection.isSelected(itemId))
				selection.selected.add(itemId);
			else if (!checked && selection.isSelected(itemId))
				selection.selected.delete(itemId);
		}
		selection.evaluateFolderSelections();
	};

	// Build tree with checkbox render hooks
	const tree = new Tree<FileTreeItemData>(items, {
		id: config.id,
		class: config.class,
		minCollapsableDepth: config.minCollapsableDepth ?? 1,
		minDepth: config.minDepth,
		startCollapsed: config.startCollapsed,
		showCollapseAll: true,

		renderBefore(selfEl, data) {
			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.className = "file-checkbox";
			checkbox.checked = selection.isSelected(data.id);
			if (checkbox.checked) checkbox.classList.add("checked");

			checkbox.addEventListener("click", (e) => {
				e.stopPropagation();
				handleCheckboxChange(
					data.id,
					(e.target as HTMLInputElement).checked,
					data
				);
			});

			checkboxMap.set(data.id, checkbox);
			selfEl.appendChild(checkbox);
		},

		onItemClick(event, data, node) {
			event.preventDefault();
			if (data.isFolder) {
				node.toggleCollapse();
			} else {
				const isSelected = selection.isSelected(data.id);
				handleCheckboxChange(data.id, !isSelected, data);
			}
		},
	});

	// ── Insert title and "Select All" into header ──
	const header = tree.el.querySelector(".feature-header");
	if (header) {
		// Title
		if (config.title) {
			const titleEl = document.createElement("div");
			titleEl.className = "feature-title";
			titleEl.textContent = config.title;
			header.insertBefore(titleEl, header.firstChild);
		}

		// Select All row
		const selectAllRow = document.createElement("div");
		selectAllRow.className = "tree-item select-all";

		const selectAllSelf = document.createElement("div");
		selectAllSelf.className = "tree-item-self is-clickable";
		selectAllRow.appendChild(selectAllSelf);

		const selectAllCheckbox = document.createElement("input");
		selectAllCheckbox.type = "checkbox";
		selectAllCheckbox.className = "file-checkbox";
		selectAllSelf.appendChild(selectAllCheckbox);

		const selectAllInner = document.createElement("div");
		selectAllInner.className = "tree-item-inner";
		selectAllInner.textContent = "Select All";
		selectAllSelf.appendChild(selectAllInner);

		const handleSelectAll = () => {
			const allSelected = isAllSelected();
			selection.selectAll(!allSelected);
		};

		const isAllSelected = (): boolean => {
			let total = 0;
			let selected = 0;
			tree.forAll((node) => {
				total++;
				if (selection.isSelected(node.data.id)) selected++;
			});
			return total > 0 && total === selected;
		};

		selectAllSelf.addEventListener("click", handleSelectAll);
		selectAllCheckbox.addEventListener("click", (e) => {
			e.stopPropagation();
			handleSelectAll();
		});

		// Update select-all checkbox when selection changes
		selection.selected.subscribe(() => {
			const all = isAllSelected();
			selectAllCheckbox.checked = all;
			selectAllCheckbox.classList.toggle("checked", all);
		});

		// Insert select-all before the collapse-all button
		const collapseBtn = header.querySelector(".tree-collapse-all");
		header.insertBefore(selectAllRow, collapseBtn);
	}

	// Apply initial selection
	if (config.initialSelection) {
		selection.setSelectedPaths(config.initialSelection, items);
	}

	return {
		tree,
		selection,
		getSelectedFiles: () => selection.getSelectedFiles(),
		getSelectedPaths: () => selection.getSelectedPaths(),
		setSelectedPaths: (paths) =>
			selection.setSelectedPaths(paths, items),
		selectAll: (selected) => selection.selectAll(selected),
	};
}
