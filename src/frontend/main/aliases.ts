import { PageFeature } from "./page-feature";

export class Tags extends PageFeature
{
	public tagNames: string[];
	public tagElements: HTMLSpanElement[];

	constructor(tags: string[])
	{
		super(ObsidianSite.metadata.featureOptions.alias, "aliases");

		this.tagNames = tags;
		this.tagElements = [];
		for (let tagName of tags)
		{
			const tagEl = document.createElement("span");
			tagEl.classList.add("tag");
			tagEl.setAttribute("href", `?query=tag:${tagName.replace("#", "")}`);
			tagEl.innerText = tagName;
			this.contentEl.appendChild(tagEl);
			this.tagElements.push(tagEl);
		}
	}
}
