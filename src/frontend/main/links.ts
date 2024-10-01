import { FilePreviewPopover } from "./link-preview";

export class LinkHandler
{

	public static initializeLinks(onElement: HTMLElement)
	{
		console.log("Initializing links on element", onElement);
		onElement?.querySelectorAll(".internal-link, a.tag, a.tree-item-self, a.footnote-link").forEach(function(link: HTMLElement)
		{
			let target = link.getAttribute("href") ?? "null";

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
			});

			// if the link doesn't point to a valid document in ObsidianSite set it to unresolved
			if(target && !target.startsWith("http") && !ObsidianSite.documentExists(target))
			{
				link.classList.add("is-unresolved");
			}
			else if (link.classList.contains("internal-link"))
			{
				FilePreviewPopover.initializeLink(link, target);
			}
		});
	}

	public static getPathnameFromURL(url: string): string
	{
		if(url == "" || url == "/" || url == "\\") return "/index.html";
		if(url.startsWith("#") || url.startsWith("?")) return ObsidianSite.document.pathname.split("#")[0].split("?")[0] + url;
		return url.split("?")[0].split("#")[0];
	}

	public static getHashFromURL(url: string): string
	{
		return (url.split("#")[1] ?? "").split("?")[0] ?? "";
	}

	public static getQueryFromURL(url: string): string
	{
		return url.split("?")[1] ?? "";
	}

	public static getFileDataIdFromURL(url: string): string
	{
		url = this.getPathnameFromURL(url);
		if (url.startsWith("./")) url = url.substring(2);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		if (url.startsWith("../")) url = url.substring(3);
		return btoa(encodeURI(url));
	}
}
