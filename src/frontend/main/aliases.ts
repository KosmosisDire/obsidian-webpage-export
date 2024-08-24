import { InsertedFeature } from "src/shared/feature";


export class Aliases extends InsertedFeature
{
	public aliasNames: string[];
	public aliasElements: HTMLSpanElement[];

	constructor(aliases: string[])
	{
		super(ObsidianSite.metadata.featureOptions.alias);

		this.aliasNames = aliases;
		this.aliasElements = [];
		for (let tagName of aliases)
		{
			const aliasEl = document.createElement("span");
			aliasEl.classList.add("alias");
			aliasEl.innerText = tagName;
			this.contentEl.appendChild(aliasEl);
			this.aliasElements.push(aliasEl);
		}
	}
}
