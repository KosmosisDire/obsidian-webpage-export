import { WebpageData } from "src/shared/website-data";
import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { BacklinksOptions } from "src/shared/features/backlinks";
import { InsertedFeature } from "src/shared/inserted-feature";

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

	protected getElementDefinitions() {
		const definitions = super.getElementDefinitions();
		
		// Add conditional class for sidebar placement
		const currentClasses = definitions[InsertedFeature.CONTENT_KEY].className;
		const baseClasses = Array.isArray(currentClasses)
			? [...currentClasses]
			: (currentClasses ? [currentClasses] : []);

		// Add height constraint class when in right sidebar
		if (this.options.placeInRightSidebar) {
			baseClasses.push('backlinks-constrained');
		}

		definitions[InsertedFeature.CONTENT_KEY].className = baseClasses;
		
		return definitions;
	}

	protected generateContent(container: HTMLElement) {
		const deps = this.getDependencies();

		this.backlinks = deps.backlinkPaths.map(
			(url) => new Backlink(container, url)
		);
	}

	protected onAfterMount(): void {
		// Add CSS styles for height constraints
		if (this.options.placeInRightSidebar && !document.getElementById('backlinks-height-styles')) {
			const style = document.createElement('style');
			style.id = 'backlinks-height-styles';
			style.textContent = `
				/* Backlinks height constraints when in right sidebar */
				.backlinks-constrained {
					max-height: 33.33vh;
					overflow-y: auto;
					overflow-x: hidden;
				}
				
				/* Ensure proper scrolling behavior */
				.backlinks-constrained::-webkit-scrollbar {
					width: 8px;
				}
				
				.backlinks-constrained::-webkit-scrollbar-track {
					background: var(--background-secondary);
				}
				
				.backlinks-constrained::-webkit-scrollbar-thumb {
					background: var(--text-muted);
					border-radius: 4px;
				}
				
				.backlinks-constrained::-webkit-scrollbar-thumb:hover {
					background: var(--text-accent);
				}
				
				/* Responsive adjustments */
				@media (max-width: 768px) {
					.backlinks-constrained {
						max-height: 25vh;
					}
				}
				
				@media (max-width: 480px) {
					.backlinks-constrained {
						max-height: 20vh;
					}
				}
			`;
			document.head.appendChild(style);
		}
	}

	public destroy(): void {
		super.destroy();
		
		// Clean up dynamically added styles if no other constrained backlinks exist
		if (document.querySelectorAll('.backlinks-constrained').length === 0) {
			const styleEl = document.getElementById('backlinks-height-styles');
			if (styleEl) {
				styleEl.remove();
			}
		}
	}
}
