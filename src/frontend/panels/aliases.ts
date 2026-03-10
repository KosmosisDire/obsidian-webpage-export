import { registerPanel } from "../panel";

export const aliasesPanel = registerPanel({
	id: "aliases",
	title: "Aliases",
	placement: { selector: ".header .data-bar", position: "prepend" },

	render(contentEl, doc) {
		// Aliases live in frontmatter, not as a top-level field
		const aliases: string[] = doc.info?.aliases ?? doc.info?.frontmatter?.aliases ?? [];
		if (aliases.length === 0) return;

		for (const alias of aliases) {
			const span = document.createElement("span");
			span.className = "alias";
			span.textContent = alias;
			contentEl.appendChild(span);
		}
	},
});
