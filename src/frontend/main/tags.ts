import { PageFeature } from "./page-feature";

export class Tags extends PageFeature
{
	public tagNames: string[];
	public tagElements: HTMLSpanElement[];

	constructor(tags: string[])
	{
		super(ObsidianSite.metadata.featureOptions.tags, "tags");

		this.tagNames = tags;
		this.tagElements = [];
		for (let tagName of tags)
		{
			const tagEl = document.createElement("a");
			tagEl.classList.add("tag");
			tagEl.setAttribute("href", `?query=tag:${tagName.replace("#", "")}`);
			tagEl.innerText = tagName;
			this.contentEl.appendChild(tagEl);
			this.tagElements.push(tagEl);
		}
	}
}
