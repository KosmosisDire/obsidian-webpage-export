import { InsertedFeatureOptions } from "shared/features/feature-options-base";

export class InsertedFeature
{
	protected _options: InsertedFeatureOptions;

	public get options(): InsertedFeatureOptions
	{
		return this._options;
	}

	public set options(options: InsertedFeatureOptions)
	{
		this._options = options;
	}


	featureEl: HTMLElement;
	contentEl: HTMLElement;
	headerEl: HTMLElement;
	titleEl: HTMLElement;
	
	/**
	 * A feature that is inserted onto the page and is unique to each document.
	 * @param featureOptions 
	 * @param featurePrefix 
	 */
	constructor(featureOptions: InsertedFeatureOptions, featureEl?: HTMLElement)
	{
		this.options = new InsertedFeatureOptions(featureOptions);
		console.log("Feature options", this.options);
		this.featureEl = featureEl as HTMLElement;

		const contentEl = this.featureEl?.querySelector("." + featureOptions.featureId + "-content") as HTMLElement;
		if (contentEl) this.contentEl = contentEl;

		const headerEl = this.featureEl?.querySelector(".feature-header") as HTMLElement;
		if (headerEl) this.headerEl = headerEl;

		const titleEl = this.featureEl?.querySelector(".feature-title") as HTMLElement;
		if (titleEl) this.titleEl = titleEl;



		if (!this.featureEl)
		{
			this.featureEl = document.createElement("div");
			this.featureEl.id = featureOptions.featureId;
			this.featureEl.classList.add("hide");

			// unhide
			setTimeout(() => this.featureEl.classList.remove("hide"), 0);
		}

		if (!this.contentEl)
		{
			this.contentEl = document.createElement("div");
			this.contentEl.classList.add(featureOptions.featureId + "-content");
			this.featureEl.appendChild(this.contentEl);
		}

		if (!this.headerEl)
		{
			this.headerEl = document.createElement("div");
			this.headerEl.classList.add("feature-header");
			this.featureEl.prepend(this.headerEl);
		}

		if ((this._options.displayTitle || "").length > 0)
		{
			if (!this.titleEl)
			{
				this.titleEl = document.createElement("div");
				this.titleEl.classList.add("feature-title");
				this.headerEl.prepend(this.titleEl);
			}

			this.titleEl.innerText = this._options.displayTitle;
		}

		// add to the page
		this.options.insertFeature(document.body, this.featureEl);
	}
}
