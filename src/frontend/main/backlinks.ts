import { WebpageData } from "shared/website-data";
import { WebpageDocument } from "./document";
import { ObsidianWebsite } from "./website";

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

export class BacklinkList
{
	public containerEl: HTMLElement;
	public titleEl: HTMLElement;
	public contentEl: HTMLElement;
	public backlinks: Backlink[];

	constructor(parent: HTMLElement, title: string, backlinks: string[])
	{
		this.containerEl = document.createElement("div");
		this.containerEl.classList.add("backlinks-container");
		this.containerEl.classList.add("hide");
		parent.appendChild(this.containerEl);

		this.titleEl = document.createElement("div");
		this.titleEl.classList.add("backlinks-title");
		this.titleEl.innerText = title;
		this.containerEl.appendChild(this.titleEl);

		this.contentEl = document.createElement("div");
		this.contentEl.classList.add("backlinks-content");
		this.containerEl.appendChild(this.contentEl);

		this.backlinks = backlinks.map(url => new Backlink(this.contentEl, url));

		// unhide
		setTimeout(() => this.containerEl.classList.remove("hide"), 0);
	}
}
