import { WebpageDocument } from "./document";

// Register panels to run during document postProcess, before loading finishes
WebpageDocument.onPostProcess((doc) => updateAllPanels(doc));

export interface PanelPlacement {
	selector: string;
	position: "before" | "after" | "prepend" | "append";
}

export interface PanelConfig {
	id: string;
	title?: string;
	placement: PanelPlacement;
	render: (contentEl: HTMLElement, doc: WebpageDocument) => void;
}

export class Panel {
	readonly el: HTMLElement;
	readonly contentEl: HTMLElement;
	readonly id: string;
	readonly title: string | undefined;
	private config: PanelConfig;

	constructor(config: PanelConfig) {
		this.config = config;
		this.id = config.id;
		this.title = config.title;

		this.el = document.createElement("div");
		this.el.id = config.id;
		this.el.className = "feature";

		if (config.title) {
			const header = document.createElement("div");
			header.className = "feature-header";
			const title = document.createElement("div");
			title.className = "feature-title";
			title.textContent = config.title;
			header.appendChild(title);
			this.el.appendChild(header);
		}

		this.contentEl = document.createElement("div");
		this.contentEl.className = `${config.id}-content`;
		this.el.appendChild(this.contentEl);
	}

	update(doc: WebpageDocument) {
		this.contentEl.innerHTML = "";
		this.config.render(this.contentEl, doc);

		if (this.contentEl.childElementCount === 0) {
			// Nothing to show — remove if still in DOM
			if (this.el.isConnected) this.el.remove();
		} else {
			// Always re-mount: the target element may be a fresh document
			this.mount();
		}
	}

	private mount() {
		const target = document.querySelector(this.config.placement.selector);
		if (!target) return;

		switch (this.config.placement.position) {
			case "before": target.before(this.el); break;
			case "after": target.after(this.el); break;
			case "prepend": target.prepend(this.el); break;
			case "append": target.append(this.el); break;
		}
	}
}

// ─── Registry ────────────────────────────────────────────────────────────────

const panels: Panel[] = [];

export function registerPanel(config: PanelConfig): Panel {
	const panel = new Panel(config);
	panels.push(panel);
	return panel;
}

export function findPanel(predicate: (panel: Panel) => boolean): Panel | undefined {
	return panels.find(predicate);
}

export function updateAllPanels(doc: WebpageDocument) {
	for (const panel of panels) {
		panel.update(doc);
	}
}
