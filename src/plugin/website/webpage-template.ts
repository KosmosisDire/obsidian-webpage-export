import { InsertedFeatureOptions, RelationType } from "shared/website-data";
import { MarkdownWebpageRendererAPIOptions } from "../render-api/api-options";
import { ExportLog } from "plugin/render-api/render-api";





export namespace WebpageTemplate
{
	export function createWebpageTemplate(options: MarkdownWebpageRendererAPIOptions): HTMLElement
	{
		let doc = document.implementation.createHTMLDocument();

		const collapseSidebarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`;
		const layout = doc.body.createDiv({attr: {id: "layout"}});
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


		let leftSidebarScript = leftSidebar.createEl("script");
		let rightSidebarScript = rightSidebar.createEl("script");
		leftSidebarScript.setAttribute("defer", "");
		rightSidebarScript.setAttribute("defer", "");
		leftSidebarScript.innerHTML = `let ls = document.querySelector("#right-sidebar"); ls.classList.add("is-collapsed"); if (window.innerWidth > 768) ls.classList.remove("is-collapsed"); ls.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-left-width"));`;
		rightSidebarScript.innerHTML = `let rs = document.querySelector("#left-sidebar"); rs.classList.add("is-collapsed"); if (window.innerWidth > 768) rs.classList.remove("is-collapsed"); rs.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-right-width"));`;

		return layout;
	}

	export function insertFeature(feature: HTMLElement, featureOptions: InsertedFeatureOptions, layout: HTMLElement): void
	{
		let relation = layout.querySelector(featureOptions.relationSelector);
		if (relation)
		{
			if (featureOptions.relationType === RelationType.Child)
			{
				relation.append(feature);
				console.log("appended", feature, featureOptions, relation);
			}
			else if (featureOptions.relationType === RelationType.Before)
			{
				relation.before(feature);
			}
			else if (featureOptions.relationType === RelationType.After)
			{
				relation.after(feature);
			}
		}
		else
		{
			ExportLog.warning(`Could not find relation element for feature ${featureOptions.displayTitle} with selector: ${featureOptions.relationSelector}`);
		}
	}
}
