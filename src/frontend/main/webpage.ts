import { Callout } from "./callouts";
import { WebpageData, DocumentType } from "./data";
import { Header } from "./headers";
import { LinkHandler } from "./links";
import { Website } from "./website";

export class WebpageDocument
{
	public title: string = "";
	public headers: Header[] = [];
	public callouts: Callout[] = [];
	public documentType: DocumentType = DocumentType.Markdown;
	public containerEl: HTMLElement = Website.centerContentEl;
	public documentEl: HTMLElement;
	public sizerEl: HTMLElement;
	public info: WebpageData;

	// url stuff
	public pathname: string;
	public hash: string;
	public query: string;
	public queryParameters: URLSearchParams; 

	public constructor(url: string)
	{
		url = url.trim();
		
		if (url.startsWith("http") || url.startsWith("www") || url.startsWith("/") || url.startsWith("\\"))
		{
			console.error("Please use a relative path from the root of the wesite to load a webpage");
			return;
		}

		if (url == "" || url == "/" || url == "\\") url = "/index.html";
		if (url.startsWith("#") || url.startsWith("?")) url = Website.document.pathname + url;

		this.pathname = url.split("?")[0].split("#")[0];
		let parsedURL = new URL(window.location.origin + "/" + this.pathname);
		this.hash = parsedURL.hash;
		this.query = parsedURL.search;
		this.queryParameters = parsedURL.searchParams;

		// load webpage data
		this.info = Website.getWebpageData(this.pathname);
		if (!this.info)
		{
			console.error("Failed to load webpage data for", this.pathname);
			return;
		}

		// set title
		this.title = this.info.title;

		setTimeout(() => this.containerEl.classList.remove("hide"));
	}
 
	public async load()
	{
		if (Website.document.pathname == this.pathname)
		{
			console.log("Already on this page");
			return;
		}

		let documentReq = await fetch(this.pathname);
		if (documentReq.ok)
		{
			let documentText = await documentReq.text();
			var html = new DOMParser().parseFromString(documentText, "text/html");

			let newDocumentEl = html.querySelector("#document");
			let newOutlineEl = html.querySelector("#outline");

			if (newDocumentEl)
			{
				newDocumentEl = document.adoptNode(newDocumentEl);
				document.querySelector("#document")?.replaceWith(newDocumentEl);
			}

			if (newOutlineEl)
			{
				newOutlineEl = document.adoptNode(newOutlineEl);
				document.querySelector("#outline")?.replaceWith(newOutlineEl);
			}

			this.sizerEl = document.querySelector("#sizer") as HTMLElement;
			this.documentEl = document.querySelector("#document") as HTMLElement;
			LinkHandler.initializeLinks(this.sizerEl ?? this.documentEl ?? this.containerEl);
			this.createCallouts();
			Website.document = this;
			Website.history.push(this.pathname);
		}
		else
		{
			console.error("Failed to load document", this.pathname);
		}
	}

	public async setActive()
	{

	}

	public createCallouts()
	{
		let calloutEls = Array.from(this.documentEl.querySelectorAll(".callout"));
		this.callouts = [];
		for (let calloutEl of calloutEls)
		{
			this.callouts.push(new Callout(calloutEl as HTMLElement));
		}
	}

}

// temp
//@ts-ignore
window.setActiveDocument = (url, showInTree, changeURL, animate = true) =>
{
	console.log("setActiveDocument", url, showInTree, changeURL, animate);
}

//@ts-ignore
window.getPointerPosition = (event) =>
{
	let touches: any = event.touches ? Array.from(event.touches) : [];
	let x = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientX, 0) / event.touches.length) : event.clientX;
	let y = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientY, 0) / event.touches.length) : event.clientY;
	return {x: x, y: y};
}
