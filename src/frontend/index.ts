import { WebpageDocument } from "./document";
import * as LinkHandler from "./links";
import { Bounds, Vector2 } from "./utils";
import { ObsidianWebsite } from "./website";

declare global {
	interface Window {
		WebpageDocument: typeof WebpageDocument;
		Bounds: typeof Bounds;
		Vector2: typeof Vector2;
		LinkHandler: typeof LinkHandler;
		ObsidianSite: ObsidianWebsite;
	}
	let ObsidianSite: ObsidianWebsite;
}

if (window && window.location) {
	window.ObsidianSite = new ObsidianWebsite();
	ObsidianSite = window.ObsidianSite;
	window.WebpageDocument = WebpageDocument;
	window.Bounds = Bounds;
	window.Vector2 = Vector2;
	window.LinkHandler = LinkHandler;

	ObsidianSite.init();
}
