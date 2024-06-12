import { WebpageData } from "shared/website-data";
import { PageFeature } from "./page-feature";

// this is for backlinks but it can actually be used to display any link technically

export class Backlink
{
	public backlinkEl: HTMLAnchorElement;
	public backlinkIconEl: HTMLElement;
	public backlinkTitleEl: HTMLElement;
	public targetData: WebpageData;

	private _url: string;
	public get url(): string
	{
		return this._url;
	}

	constructor(container: HTMLElement, targetURL: string)
	{
		this.targetData = ObsidianSite.getWebpageData(targetURL) as WebpageData;
		if (!this.targetData)
		{
			console.error("Failed to find target for backlink", targetURL);
			return;
		}

		this._url = targetURL;

		this.backlinkEl = document.createElement("a");
		this.backlinkEl.href = targetURL;
		this.backlinkEl.classList.add("backlink");
		container.appendChild(this.backlinkEl);

		this.backlinkIconEl = document.createElement("div");
		this.backlinkIconEl.classList.add("backlink-icon");
		this.backlinkIconEl.innerHTML = this.targetData.icon;
		this.backlinkEl.appendChild(this.backlinkIconEl);

		this.backlinkTitleEl = document.createElement("div");
		this.backlinkTitleEl.classList.add("backlink-title");
		this.backlinkTitleEl.innerText = this.targetData.title;
		this.backlinkEl.appendChild(this.backlinkTitleEl);

		this.backlinkEl.addEventListener("click", (e) => {
			e.preventDefault();
			ObsidianSite.loadURL(this.url);
		});
	}
}

export class BacklinkList extends PageFeature
{
	public backlinks: Backlink[];

	constructor(backlinkPaths: string[])
	{
		super(ObsidianSite.metadata.featureOptions.backlinks, "backlinks");

		this.backlinks = backlinkPaths.map(url => new Backlink(this.contentEl, url));
	}
}
