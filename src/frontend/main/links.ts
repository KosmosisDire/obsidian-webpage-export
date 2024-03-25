import { WebpageDocument } from "./webpage";
import { Website } from "./website.txt";

export class LinkHandler
{
	public static initializeLinks(onElement: HTMLElement)
	{
		onElement?.querySelectorAll(".internal-link, a.tag, .tree-item-self, .footnote-link").forEach(function(link)
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
				
				let relativePathnameStrip = Website.document.pathname.split("#")[0].split("?")[0];
	
				if(target.startsWith("#") || target.startsWith("?")) target = relativePathnameStrip + target;
				new WebpageDocument(target).load();
			});
		});
	}
}
