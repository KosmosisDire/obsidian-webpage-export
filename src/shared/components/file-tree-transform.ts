import { FileTreeItemData, FileTreeOptions } from "./tree-data";
import { Path } from "../path";

export function transformFilesToTree(
	files: string[],
	options: FileTreeOptions = {}
): FileTreeItemData[] {
	const {
		sort = true,
		regexBlacklist = [],
		regexWhitelist = [],
	} = options;

	// Filter files based on regex patterns
	const filteredFiles = files.filter((file) => {
		const passesBlacklist =
			regexBlacklist.length === 0 ||
			regexBlacklist.every((pattern) => !file.match(new RegExp(pattern)));
		const passesWhitelist =
			regexWhitelist.length === 0 ||
			regexWhitelist.some((pattern) => file.match(new RegExp(pattern)));
		return passesBlacklist && passesWhitelist;
	});

	// Build tree structure
	const rootItems: FileTreeItemData[] = [];
	const itemMap = new Map<string, FileTreeItemData>();

	for (const filePath of filteredFiles) {
		// Build list of ancestor paths + the file itself
		const pathSegments: string[] = [];
		let current = new Path(filePath);
		pathSegments.unshift(current.path);
		while (current.parent) {
			current = current.parent;
			pathSegments.unshift(current.path);
		}

		let parentItems = rootItems;
		let parentPathStr = "";

		for (let i = 0; i < pathSegments.length; i++) {
			const segment = pathSegments[i];
			const segmentPath = new Path(segment);
			const isLastSegment = i === pathSegments.length - 1;
			const isFolder = !isLastSegment || segment.endsWith("/");

			let item = itemMap.get(segment);

			if (!item) {
				const itemName = isLastSegment
					? segmentPath.fullName
					: segment
							.substring(
								parentPathStr.length + (parentPathStr ? 1 : 0)
							)
							.replace(/\/$/, "");

				item = {
					id: segment,
					title: isFolder ? itemName : segmentPath.basename,
					depth: i + 1,
					dataRef: segment,
					href: !isFolder ? segment : undefined,
					isFolder,
					children: [],
					originalExtension: !isFolder
						? segmentPath.extensionName
						: undefined,
					file: !isFolder
						? {
								path: segment,
								basename: segmentPath.basename,
								extensionName: segmentPath.extensionName,
							}
						: undefined,
				};

				itemMap.set(segment, item);
				parentItems.push(item);
			}

			parentItems = item.children;
			parentPathStr = segment;
		}
	}

	if (sort) sortTree(rootItems);

	let orderCounter = 0;
	assignTreeOrder(rootItems, () => orderCounter++);

	return rootItems;
}

function sortTree(items: FileTreeItemData[]) {
	items.sort((a, b) =>
		a.title.localeCompare(b.title, undefined, { numeric: true })
	);
	// Folders before files
	items.sort((a, b) => {
		if (a.isFolder === b.isFolder) return 0;
		return a.isFolder ? -1 : 1;
	});
	for (const item of items) {
		if (item.children.length > 0) sortTree(item.children);
	}
}

function assignTreeOrder(
	items: FileTreeItemData[],
	getNextOrder: () => number
) {
	for (const item of items) {
		item.treeOrder = getNextOrder();
		if (item.children.length > 0)
			assignTreeOrder(item.children, getNextOrder);
	}
}

export function findItemByPath(
	items: FileTreeItemData[],
	path: string
): FileTreeItemData | undefined {
	for (const item of items) {
		if (item.dataRef === path || item.href === path) return item;
		if (item.children) {
			const found = findItemByPath(item.children, path);
			if (found) return found;
		}
	}
	return undefined;
}
