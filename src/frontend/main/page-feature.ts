import { InsertedFeatureOptions } from "shared/website-data";


export class PageFeature
{
	parent: HTMLElement;
	title: string;
	containerEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	
	/**
	 * A feature that is inserted onto the page and is unique to each document.
	 * @param featureOptions 
	 * @param featurePrefix 
	 */
	constructor(featureOptions: InsertedFeatureOptions, featurePrefix: string)
	{
		console.log("PageFeature constructor");
		this.parent = document.querySelector(featureOptions.relationSelector) as HTMLElement;
		if (!this.parent) this.parent = ObsidianSite.document.footerEl ?? ObsidianSite.document.headerEl ?? ObsidianSite.document.sizerEl ?? ObsidianSite.document.documentEl;
		this.title = featureOptions.displayTitle;

		this.containerEl = document.createElement("div");
		this.containerEl.classList.add(featurePrefix + "-container");
		this.containerEl.classList.add("hide");
		this.parent.appendChild(this.containerEl);

		if (this.title && this.title.length > 0)
		{
			this.titleEl = document.createElement("div");
			this.titleEl.classList.add("feature-title");
			this.titleEl.innerText = this.title;
			this.containerEl.appendChild(this.titleEl);
		}

		this.contentEl = document.createElement("div");
		this.contentEl.classList.add(featurePrefix + "-content");
		this.containerEl.appendChild(this.contentEl);
		console.log(this.containerEl);

		// unhide
		setTimeout(() => this.containerEl.classList.remove("hide"), 0);
	}
}
