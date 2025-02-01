import { WebpageData } from "src/shared/website-data";
import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { BacklinksOptions } from "src/shared/features/backlinks";

export class Backlink {
	public backlinkEl: HTMLAnchorElement;
	public backlinkIconEl: HTMLElement;
	public backlinkTitleEl: HTMLElement;
	public targetData: WebpageData;

	private _url: string;
	public get url(): string {
		return this._url;
	}

	constructor(container: HTMLElement, targetURL: string) {
		this.targetData = ObsidianSite.getWebpageData(targetURL) as WebpageData;
		if (!this.targetData) {
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

interface BacklinksDependencies {
	backlinkPaths: string[];
}

export class BacklinkList extends DynamicInsertedFeature<
	BacklinksOptions,
	BacklinksDependencies
> {
	public backlinks: Backlink[];

	constructor(backlinkPaths: string[]) {
		super(ObsidianSite.metadata.featureOptions.backlinks, {
			backlinkPaths,
		});
	}

	protected generateContent(container: HTMLElement) {
		const deps = this.getDependencies();

		this.backlinks = deps.backlinkPaths.map(
			(url) => new Backlink(container, url)
		);
	}
}
