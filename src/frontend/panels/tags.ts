import { navigate } from "../links";
import { registerPanel } from "../panel";

export const tagsPanel = registerPanel({
	id: "tags",
	title: "Tags",
	placement: { selector: ".header .data-bar", position: "append" },

	render(contentEl, doc) {
		// Combine inline tags (elements.tags) and frontmatter tags
		const inlineTags = doc.info?.elements?.tags ?? [];
		const frontmatterTags: string[] = doc.info?.frontmatter?.tags ?? [];
		const allTags = [...new Set([...inlineTags, ...frontmatterTags])];
		if (allTags.length === 0) return;

		for (const tag of allTags) {
			const cleaned = tag.replace(/^#/, "");
			const tagEl = document.createElement("a");
			tagEl.className = "tag";
			tagEl.href = `?query=tag:${cleaned}`;
			tagEl.textContent = `#${cleaned}`;

			tagEl.addEventListener("click", (e) => {
				e.preventDefault();
				navigate(tagEl.href);
			});

			contentEl.appendChild(tagEl);
		}
	},
});
