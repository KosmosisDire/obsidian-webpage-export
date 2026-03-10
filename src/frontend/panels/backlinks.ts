import { navigate } from "../links";
import { registerPanel } from "../panel";
import { getFileData, metadata } from "../site-data";

export const backlinksPanel = registerPanel({
	id: "backlinks",
	title: "Backlinks",
	placement: { selector: ".footer", position: "append" },

	render(contentEl, doc) {
		const sourcePaths = doc.info?.links?.incoming;
		if (!sourcePaths || sourcePaths.length === 0) return;

		for (const sourcePath of sourcePaths) {
			// Convert vault source path to web path
			const webPath = metadata?.filePathMapping?.[sourcePath];
			if (!webPath || webPath === doc.pathname) continue;

			const data = getFileData(webPath);
			if (!data) continue;

			const link = document.createElement("a");
			link.className = "backlink";
			link.href = webPath;

			if (data.icon) {
				const iconEl = document.createElement("div");
				iconEl.className = "backlink-icon";
				iconEl.innerHTML = data.icon;
				link.appendChild(iconEl);
			}

			const titleEl = document.createElement("div");
			titleEl.className = "backlink-title";
			titleEl.textContent = data.title || webPath;
			link.appendChild(titleEl);

			link.addEventListener("click", (e) => {
				e.preventDefault();
				navigate(webPath);
			});

			contentEl.appendChild(link);
		}
	},
});
