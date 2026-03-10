/**
 * Base data for any tree item. Framework-free — just data.
 */
export interface TreeItemData {
	id: string;
	title: string;
	icon?: string;
	href?: string;
	dataRef?: string;
	depth: number;
	children: TreeItemData[];
	isFolder?: boolean;
	originalExtension?: string;
	treeOrder?: number;
}

/**
 * Extended data for file tree items, produced by transformFilesToTree.
 */
export interface FileTreeItemData extends TreeItemData {
	children: FileTreeItemData[];
	isFolder: boolean;
	originalExtension?: string;
	file?: { path: string; basename: string; extensionName: string };
}

export interface FileTreeOptions {
	sort?: boolean;
	showFileExtensionTags?: boolean;
	hideFileExtensionTags?: string[];
	regexBlacklist?: string[];
	regexWhitelist?: string[];
}
