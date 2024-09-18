
export class LinkHandler
{
	public static initializeLinks(onElement: HTMLElement)
	{
		console.log("Initializing links on element", onElement);
		onElement?.querySelectorAll(".internal-link, a.tag, a.tree-item-self, a.footnote-link").forEach(function(link)
		{
			link.addEventListener("click", function(event)
			{
				let target = link.getAttribute("href");
	
				event.preventDefault();
				event.stopPropagation();
	
				if(!target)
				{
					console.log("No target found for link");
					return;
				}
				
				const relativePathnameStrip = ObsidianSite.document.pathname.split("#")[0].split("?")[0];
	
				if(target.startsWith("#") || target.startsWith("?")) target = relativePathnameStrip + target;
				ObsidianSite.loadURL(target);
			});
		});
	}

	public static getPathnameFromURL(url: string): string
	{
		if(url == "" || url == "/" || url == "\\") return "/index.html";
		if(url.startsWith("#") || url.startsWith("?")) return ObsidianSite.document.pathname + url;
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
		return btoa(encodeURI(url));
	}
}
