import { InsertedFeatureOptions, InsertedFeatureOptionsWithTitle } from "./features/feature-options-base";

export class InsertedFeature<
	TOptions extends InsertedFeatureOptions
> {
	protected _options: TOptions;

	// DOM elements
	protected featureEl: HTMLElement | null = null;
	protected contentEl: HTMLElement | null = null;
	protected headerEl: HTMLElement | null = null;
	protected titleEl: HTMLElement | null = null;
	private createdElements: Set<HTMLElement> = new Set();

	constructor(options: TOptions, featureEl?: HTMLElement) {
		this._options = options;

		if (featureEl) {
			this.replaceFeature(featureEl);
		} else {
			this.setupFeatureContainer();
		}

		this.options.insertFeature(document.body, this.featureEl!);
	}

	/**
	 * Replaces the entire feature with new content, maintaining the feature structure
	 */
	protected replaceFeature(featureEl: HTMLElement) {
		// Clean up any previously created elements
		this.destroy();

		this.featureEl = featureEl;
		this.featureEl.id = this.options.featureId;

		// Find or create header
		this.headerEl = this.featureEl.querySelector(".feature-header");
		if (!this.headerEl) {
			this.headerEl = document.createElement("div");
			this.headerEl.classList.add("feature-header");
			this.featureEl.prepend(this.headerEl);
			this.createdElements.add(this.headerEl);
		}

		// Handle title if needed
		if (
			this._options instanceof InsertedFeatureOptionsWithTitle &&
			(this._options.displayTitle || "").length > 0
		) {
			this.titleEl = this.headerEl.querySelector(".feature-title");
			if (!this.titleEl) {
				this.titleEl = document.createElement("div");
				this.titleEl.classList.add("feature-title");
				this.headerEl.prepend(this.titleEl);
				this.createdElements.add(this.titleEl);
			}
			this.titleEl.innerText = this._options.displayTitle;
		}

		// Find or create content container
		this.contentEl = this.featureEl.querySelector(
			"." + this.options.featureId + "-content"
		);
		if (!this.contentEl) {
			this.contentEl = document.createElement("div");
			this.contentEl.classList.add(this.options.featureId + "-content");
			this.featureEl.appendChild(this.contentEl);
			this.createdElements.add(this.contentEl);
		}

		// Update content
		this.updateContent();
	}

	private setupFeatureContainer() {
		const featureEl = document.createElement("div");
		featureEl.classList.add("hide");

		// Create an empty feature and then use replaceFeature to set it up
		this.replaceFeature(featureEl);

		// Handle initial hide/show
		setTimeout(() => this.featureEl?.classList.remove("hide"), 0);
	}

	protected generateContent(): HTMLElement | string {
		// Override this method in subclasses
		return document.createElement("div");
	}

	protected updateContent() {
		if (!this.contentEl) return;

		const content = this.generateContent();

		// Clear existing content
		while (this.contentEl.firstChild) {
			this.contentEl.removeChild(this.contentEl.firstChild);
		}

		// Add new content
		if (content instanceof HTMLElement) {
			this.contentEl.appendChild(content);
		} else {
			this.contentEl.innerHTML = content;
		}
	}

	public get options(): TOptions {
		return this._options;
	}

	public destroy() {
		this.createdElements.forEach((element) => {
			if (element.parentNode) {
				element.parentNode.removeChild(element);
			}
		});
		this.createdElements.clear();

		// Clear references
		this.featureEl = null;
		this.contentEl = null;
		this.headerEl = null;
		this.titleEl = null;
	}
}
