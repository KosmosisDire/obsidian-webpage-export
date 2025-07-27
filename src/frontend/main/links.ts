import { FilePreviewPopover } from "./link-preview";

export class LinkHandler
{

	public static initializeLinks(onElement: HTMLElement)
	{
		console.log("Initializing links on element", onElement);
		onElement?.querySelectorAll(".internal-link, a.tag, a.tree-item-self, a.footnote-link").forEach(function(link: HTMLElement)
		{
			const target = link.getAttribute("href") ?? "null";

			if(target == "null")
			{
				console.log("No target found for link");
				return;
			}

			link.addEventListener("click", function(event)
			{
				event.preventDefault();
				event.stopPropagation();
				ObsidianSite.loadURL(target);

				// Close the sidebar containing this link on phone
				if (ObsidianSite.deviceSize === "phone")
				{
					// Find which sidebar contains this link
					const leftSidebar = link.closest("#left-sidebar");
					const rightSidebar = link.closest("#right-sidebar");

					if (leftSidebar && ObsidianSite.leftSidebar?.collapsed === false)
					{
						ObsidianSite.leftSidebar.collapsed = true;
					}
					else if (rightSidebar && ObsidianSite.rightSidebar?.collapsed === false)
					{
						ObsidianSite.rightSidebar.collapsed = true;
					}
				}
			});

			// if the link doesn't point to a valid document in ObsidianSite set it to unresolved
			if(target && !target.startsWith("http") && !ObsidianSite.documentExists(target))
			{
				link.classList.add("is-unresolved");
			}
			else if (link.classList.contains("internal-link"))
			{
				// Only initialize link preview if the feature is enabled
				if (!ObsidianSite.metadata?.ignoreMetadata && 
					ObsidianSite.metadata?.featureOptions?.linkPreview?.enabled)
				{
					FilePreviewPopover.initializeLink(link, target);
				}
			}
		});
	}

	public static getPathnameFromURL(url: string): string
	{
		if(url == "" || url == "/" || url == "\\") return "index.html";
		if(url?.startsWith("#") || url?.startsWith("?")) return (ObsidianSite.document?.pathname?.split("#")[0]?.split("?")[0] ?? "") + (url ?? "");
		return url?.split("?")[0]?.split("#")[0]?.trim() ?? "";
	}

	public static getHashFromURL(url: string): string
	{
		return (url.split("#")[1] ?? "").split("?")[0]?.trim() ?? "";
	}

	public static getQueryFromURL(url: string): string
	{
		return url.split("?")[1]?.trim() ?? "";
	}

	public static getFileDataIdFromURL(url: string): string
	{
		url = this.getPathnameFromURL(url);
		if (url.startsWith("./")) url = url.substring(2);
		while (url.startsWith("../")) {
			url = url.substring(3);
		}
		return btoa(encodeURI(url));
	}
}
