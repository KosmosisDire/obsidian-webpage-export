import { TreeItemData } from "./tree-data";
import { Tree, TreeRenderOptions } from "./tree";
import { FileData } from "@shared/types";

export interface OutlineItemData extends TreeItemData {
	heading: string;
	headingId: string;
	html?: string;
	children: OutlineItemData[];
}

/**
 * Build outline tree data from a FileData's headers.
 * Returns a flat list of root-level OutlineItemData items with nested children.
 */
export function buildOutlineData(webpage: FileData, minDepth: number = 1): OutlineItemData[] {
	const headings = webpage.elements.headers;
	if (!headings || headings.length === 0) return [];

	const rootItems: OutlineItemData[] = [];

	// Use a stack to track parent at each depth
	const stack: { item: OutlineItemData | null; depth: number }[] = [
		{ item: null, depth: 0 },
	];

	for (const heading of headings) {
		if (heading.level < minDepth) continue;

		const headingId = heading.id;
		const item: OutlineItemData = {
			id: headingId,
			title: heading.text,
			heading: heading.text,
			headingId,
			html: heading.html,
			href: "#" + headingId,
			depth: heading.level,
			children: [],
		};

		// Pop stack until we find a parent with lower depth
		while (stack.length > 1 && stack[stack.length - 1].depth >= heading.level) {
			stack.pop();
		}

		const parent = stack[stack.length - 1];
		if (parent.item) {
			parent.item.children.push(item);
		} else {
			rootItems.push(item);
		}

		stack.push({ item, depth: heading.level });
	}

	return rootItems;
}

/**
 * Create a rendered outline tree from a FileData.
 */
export function createOutlineTree(
	webpage: FileData,
	opts: {
		minDepth?: number;
		minCollapsableDepth?: number;
		id?: string;
	} = {}
): Tree<OutlineItemData> {
	const items = buildOutlineData(webpage, opts.minDepth ?? 1);

	return new Tree<OutlineItemData>(items, {
		id: opts.id || "outline",
		minCollapsableDepth: opts.minCollapsableDepth ?? 2,
		showCollapseAll: true,

		renderAfter(selfEl, data) {
			// Add heading-link class to the inner element
			const inner = selfEl.querySelector(".tree-item-inner");
			if (inner) {
				inner.setAttribute("heading-name", data.heading);
				inner.classList.add("heading-link");
			}
		},
	});
}
