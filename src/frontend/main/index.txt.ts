import { Canvas } from "./canvas";
import { WebpageDocument } from "./document";
import { FilePreviewPopover } from "./link-preview";
import { LinkHandler } from "./links";
import { Search } from "./search";
import { Bounds, Vector2 } from "./utils";
import { ObsidianWebsite } from "./website";



declare global 
{
    interface Window 
	{ 
		WebpageDocument: typeof WebpageDocument;
		Canvas: typeof Canvas;
		Bounds: typeof Bounds;
		Vector2: typeof Vector2;
		LinkHandler: typeof LinkHandler;
		FilePreviewPopover: typeof FilePreviewPopover;

		ObsidianSite: ObsidianWebsite;
	}

	let ObsidianSite: ObsidianWebsite;
}

if (window && window.location)
{
	window.ObsidianSite = new ObsidianWebsite();
	ObsidianSite = window.ObsidianSite;
	window.WebpageDocument = WebpageDocument;
	window.Canvas = Canvas;
	window.Bounds = Bounds;
	window.Vector2 = Vector2;
	window.LinkHandler = LinkHandler;
	window.FilePreviewPopover = FilePreviewPopover;

	ObsidianSite.init();
}

