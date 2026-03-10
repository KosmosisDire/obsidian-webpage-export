import { registerPanel } from "../panel";
import { buildOutlineData, OutlineItemData } from "@shared/components/outline-tree";
import { Tree } from "@shared/components/tree";

let cleanupScrollTracking: (() => void) | null = null;

export const outlinePanel = registerPanel({
	id: "outline",
	placement: { selector: "#right-sidebar-content", position: "append" },

	render(contentEl, doc) {
		// Clean up previous scroll tracking
		if (cleanupScrollTracking) {
			cleanupScrollTracking();
			cleanupScrollTracking = null;
		}

		if (!doc.info?.elements?.headers?.length) return;

		const items = buildOutlineData(doc.info);
		if (items.length === 0) return;

		const tree = new Tree<OutlineItemData>(items, {
			id: "outline",
			title: "Outline",
			showCollapseAll: true,
			minCollapsableDepth: 2,

			renderAfter(selfEl, data) {
				const inner = selfEl.querySelector(".tree-item-inner");
				if (inner) {
					inner.setAttribute("heading-name", data.heading);
					inner.classList.add("heading-link");

					if (data.html) {
						inner.innerHTML = data.html;
					}
				}
			},

			onItemClick(event, data, node) {
				event.preventDefault();
				const header = doc.findHeader(h => h.id === data.headingId);
				if (header) {
					header.scrollTo();
				} else {
					const el = document.getElementById(data.headingId);
					if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			},
		});

		tree.mount(contentEl);

		// Set up scroll-based active heading tracking
		cleanupScrollTracking = setupScrollTracking(tree, doc.documentEl);
	},
});

/**
 * Track which heading is currently visible and highlight it in the outline.
 * Finds the last heading that has scrolled above the viewport top.
 */
function setupScrollTracking(tree: Tree<OutlineItemData>, docEl: HTMLElement): () => void {
	const scrollContainer = document.querySelector("#document-container > .obsidian-document") ?? docEl;

	function onScroll() {
		const headings = docEl.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
		if (headings.length === 0) return;

		// Find the last heading whose top edge is above the viewport
		let activeId: string | null = null;
		const offset = 10;

		for (let i = 0; i < headings.length; i++) {
			const heading = headings[i];
			const rect = heading.getBoundingClientRect();
			if (rect.top <= offset) {
				activeId = heading.id;
			} else {
				break;
			}
		}

		// If nothing scrolled past yet, highlight the first heading
		if (!activeId && headings.length > 0) {
			activeId = headings[0].id;
		}

		if (activeId) {
			const node = tree.findByPath(activeId);
			if (node && node !== tree.activeNode) {
				node.setActive();
				node.reveal();
				node.selfEl.scrollIntoView({ block: "nearest" });
			}
		}
	}

	scrollContainer.addEventListener("scroll", onScroll, { passive: true });
	// Set initial state
	requestAnimationFrame(onScroll);

	return () => {
		scrollContainer.removeEventListener("scroll", onScroll);
	};
}
