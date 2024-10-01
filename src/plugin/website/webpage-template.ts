import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";
import { ExportLog } from "src/plugin/render-api/render-api";
import { ExportPipelineOptions } from "./pipeline-options";
import { AssetHandler } from "../asset-loaders/asset-handler";
import { AssetType } from "../asset-loaders/asset-types";
import { Utils } from "../utils/utils";



export class WebpageTemplate
{
	private doc: Document;
	private options: ExportPipelineOptions;
	private rssURL: string;
	public deferredFeatures: {feature: HTMLElement, featureOptions: InsertedFeatureOptions}[] = [];


	constructor (options: ExportPipelineOptions, rssURL: string)
	{
		this.options = options;
		this.rssURL = rssURL;
	}

	public async loadLayout(): Promise<void>
	{
		this.doc = document.implementation.createHTMLDocument();

		const collapseSidebarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`;
		
		const head = this.doc.head;
		head.innerHTML += `<meta property="og:site_name" content="${this.options.rssOptions.siteName}">`;
		head.innerHTML += `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">`;
		head.innerHTML += `<meta charset="UTF-8">`;

		if (!this.options.combineAsSingleFile)
		{
			if (this.options.rssOptions.enabled)
			{
				head.innerHTML += `<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${this.rssURL}">`;
			}

			head.innerHTML += AssetHandler.getHeadReferences(this.options);
		}

		const body = this.doc.body;
		if (this.options.addBodyClasses)
			body.setAttribute("class", await this.getValidBodyClasses(false));

		const layout = this.doc.body.createDiv({attr: {id: "layout"}});
			const leftContent = layout.createDiv({attr: {id: "left-content", class: "leaf"}});
				const leftSidebar = leftContent.createDiv({attr: {id: "left-sidebar", class: "sidebar"}});
					const leftSidebarHandle = leftSidebar.createDiv({attr: {class: "sidebar-handle"}});
					const leftTopbar = leftSidebar.createDiv({attr: {class: "sidebar-topbar"}});
						const leftTopbarContent = leftTopbar.createDiv({attr: {class: "topbar-content"}});
						const leftCollapseIcon = leftTopbar.createDiv({attr: {class: "clickable-icon sidebar-collapse-icon"}});
							leftCollapseIcon.innerHTML = collapseSidebarIcon;
					const leftSidebarContentWrapper = leftSidebar.createDiv({attr: {class: "sidebar-content-wrapper"}});
						const leftSidebarContent = leftSidebarContentWrapper.createDiv({attr: {id: "left-sidebar-content", class: "leaf-content"}});
			const centerContent = layout.createDiv({attr: {id: "center-content", class: "leaf"}});
			const rightContent = layout.createDiv({attr: {id: "right-content", class: "leaf"}});
				const rightSidebar = rightContent.createDiv({attr: {id: "right-sidebar", class: "sidebar"}});
					const rightSidebarHandle = rightSidebar.createDiv({attr: {class: "sidebar-handle"}});
					const rightTopbar = rightSidebar.createDiv({attr: {class: "sidebar-topbar"}});
						const rightTopbarContent = rightTopbar.createDiv({attr: {class: "topbar-content"}});
						const rightCollapseIcon = rightTopbar.createDiv({attr: {class: "clickable-icon sidebar-collapse-icon"}});
							rightCollapseIcon.innerHTML = collapseSidebarIcon;
					const rightSidebarContentWrapper = rightSidebar.createDiv({attr: {class: "sidebar-content-wrapper"}});
						const rightSidebarContent = rightSidebarContentWrapper.createDiv({attr: {id: "right-sidebar-content", class: "leaf-content"}});

		leftContent.style.setProperty("--sidebar-width", "var(--sidebar-width-left)");
		rightContent.style.setProperty("--sidebar-width", "var(--sidebar-width-right)");

		let leftSidebarScript = leftSidebar.createEl("script");
		let rightSidebarScript = rightSidebar.createEl("script");
		leftSidebarScript.setAttribute("defer", "");
		rightSidebarScript.setAttribute("defer", "");
		leftSidebarScript.innerHTML = `let ls = document.querySelector("#left-sidebar"); ls.classList.toggle("is-collapsed", window.innerWidth < 768); ls.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-left-width"));`;
		rightSidebarScript.innerHTML = `let rs = document.querySelector("#right-sidebar"); rs.classList.toggle("is-collapsed", window.innerWidth < 768); rs.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-right-width"));`;

		// delete sidebars if they are not needed
		if (!this.options.sidebarOptions.enabled)
		{
			leftSidebar.remove();
			rightSidebar.remove();
		}
	}

	public insertFeature(feature: HTMLElement, featureOptions: InsertedFeatureOptions): void
	{
		const existingFeature = this.doc.body.querySelector("#" + featureOptions.featureId);
		if (existingFeature)
		{
			console.warn(`Feature with id ${featureOptions.featureId} already exists in the layout. Removing the existing feature.`);
			existingFeature.remove();
		}

		let insertedSuccesfully = featureOptions.insertFeature(this.doc.documentElement, feature);

		if (insertedSuccesfully)
		{
			// check if there are any deferred features that can now be inserted
			let deferredFeatures = this.deferredFeatures;
			this.deferredFeatures = [];
			for (let deferredFeature of deferredFeatures)
			{
				if (deferredFeature.feature === feature) continue;
				this.insertFeature(deferredFeature.feature, deferredFeature.featureOptions);
			}
		}
		else
		{
			// try to insert the feature later when new features are added
			this.deferredFeatures.push({feature, featureOptions});
		}
	}

	public insertFeatureString(feature: string, featureOptions: InsertedFeatureOptions): void
	{
		let div = this.doc.createElement("div");
		div.classList.add("parsed-feature-container");
		div.style.display = "contents";
		div.innerHTML = feature;
		this.insertFeature(div as HTMLElement, featureOptions);
	}

	public getDocElementInner(): string
	{
		for (let feature of this.deferredFeatures)
		{
			ExportLog.warning(`Could not insert feature ${feature.featureOptions.featureId} with placement: ${feature.featureOptions.featurePlacement}`);
		}

		return this.doc.documentElement.innerHTML;
	}

	private readonly ignoreClasses = ["publish", "css-settings-manager", "theme-light", "theme-dark"];
	private _validBodyClasses: string | undefined = undefined;
	public async getValidBodyClasses(cleanCache: boolean): Promise<string>
	{
		if (cleanCache) this._validBodyClasses = undefined;
		if (this._validBodyClasses) return this._validBodyClasses;
		
		const bodyClasses = Array.from(document.body.classList); 

		let validClasses = "";
		validClasses += " publish ";
		validClasses += " css-settings-manager ";
		
		// keep body classes that are referenced in the styles
		const styles = AssetHandler.getAssetsOfType(AssetType.Style);
		let i = 0;
		let classes: string[] = [];

		for (const style of styles)
		{
			ExportLog.progress(0, "Compiling css classes", "Scanning: " + style.filename, "var(--color-yellow)");
			if (typeof(style.data) != "string") continue;
			
			// this matches every class name with the dot
			const matches = Array.from(style.data.matchAll(/\.([A-Za-z_-]+[\w-]+)/g));
			let styleClasses = matches.map(match => match[0].substring(1).trim());
			// remove duplicates
			styleClasses = styleClasses.filter((value, index, self) => self.indexOf(value) === index);
			classes = classes.concat(styleClasses);
			i++;
			await Utils.delay(0);
		}

		// remove duplicates
		ExportLog.progress(0, "Filtering classes", "...", "var(--color-yellow)");
		classes = classes.filter((value, index, self) => self.indexOf(value) === index);
		ExportLog.progress(0, "Sorting classes", "...", "var(--color-yellow)");
		classes = classes.sort();

		i = 0;
		for (const bodyClass of bodyClasses)
		{
			ExportLog.progress(0, "Collecting valid classes", "Scanning: " + bodyClass, "var(--color-yellow)");

			if (classes.includes(bodyClass) && !this.ignoreClasses.includes(bodyClass))
			{
				validClasses += bodyClass + " ";
			}

			i++;
		}

		ExportLog.progress(0, "Cleanup classes", "...", "var(--color-yellow)");
		this._validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		ExportLog.progress(0, "Filter duplicate classes", this._validBodyClasses.length + " classes", "var(--color-yellow)");
		this._validBodyClasses = this._validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();
		
		ExportLog.progress(0, "Classes done", "...", "var(--color-yellow)");

		return this._validBodyClasses;
	}
}
