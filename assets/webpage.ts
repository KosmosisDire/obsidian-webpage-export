
class Website
{
	public static website: Website;
	public static isLoaded: boolean = false;
	public static loadedDocument: WebpageDocument | null = null;
	public static bodyEl: HTMLElement;
	public static webpageEl: HTMLElement;

	public static async init()
	{
		Website.website = new Website();
		window.addEventListener("load", () => Website.onInit());
	}

	private static onInit()
	{
		let docEl = document.querySelector(".document-container") as HTMLElement;
		this.loadedDocument = new WebpageDocument(docEl, Website.website, DocumentType.Markdown);

		this.bodyEl = document.body as HTMLElement;
		this.webpageEl = document.querySelector(".webpage-container") as HTMLElement;

		this.bodyEl.classList.toggle("loading", false);
		this.bodyEl.classList.toggle("loaded", true);
		this.isLoaded = true;
		console.log("loaded");
	}
}

Website.init();

class Header
{
	public level: number;
	public id: string;
	public text: string;
	public isCollapsed: boolean;
    public isVisible: boolean = true;
	public parent: Header | null;
	public childHeaders: Header[];
	public children: HTMLElement[];
	public nextHeader: Header | null;
	public previousHeader: Header | null;

	public wrapperEl: HTMLElement;
	public headingEl: HTMLHeadingElement;
	public childrenEl: HTMLElement;
	public collapseEl: HTMLElement | null;
	public containingSizer: HTMLElement | null;

	public document: WebpageDocument;

	constructor(wrapperEl: HTMLElement, document: WebpageDocument)
	{
		this.wrapperEl = wrapperEl;
		this.headingEl = wrapperEl.querySelector(".heading") as HTMLHeadingElement;
		this.childrenEl = wrapperEl.querySelector(".heading-children") as HTMLElement;
		this.collapseEl = wrapperEl.querySelector(".heading-collapse-indicator");
		this.containingSizer = wrapperEl.closest(".markdown-preview-sizer") ?? wrapperEl.closest(".view-content");

		if (this.headingEl == null || this.childrenEl == null) throw new Error("Invalid header element");

		this.level = parseInt(this.headingEl.tagName.substring(1));
		this.id = this.headingEl.id;
		this.text = this.headingEl.textContent ?? "";
		this.isCollapsed = this.wrapperEl.classList.contains("is-collapsed");

		this.document = document;
		this.document.headers.push(this);

		this.childHeaders = [];
		this.children = [];
		this.childrenEl.childNodes.forEach((child) =>
		{
			if (child instanceof HTMLElement)
			{
				if(child.classList.contains("heading-wrapper"))
				{
					let header = new Header(child, document);
					header.parent = this;
					this.childHeaders.push(header);
				}

				this.children.push(child);
			}
		});

		if (this.parent)
		{
			let index = this.parent.childHeaders.indexOf(this);
			this.previousHeader = this.parent.childHeaders[index - 1] ?? null;
			this.nextHeader = this.parent.childHeaders[index + 1] ?? null;
		}

		let localThis = this;

		this.collapseEl?.addEventListener("click", function () 
		{
			localThis.toggle();
		});
	}

	private collapseTimeout: number | null = null;
	private collapseHeight: number = 0;
	private forceShown: boolean = false;
	public async collapse(collapse: boolean, openParents = true, instant = false)
	{
		if (openParents && !collapse)
		{
			if (this.parent) this.parent.collapse(false, true, instant);
		}

		let needsChange = this.isCollapsed != collapse;
		if (!needsChange)
		{
			// if opening show the header
			if (!collapse && this.document?.documentType == DocumentType.Canvas) this.show(true);
			return;
		}


		if (this.collapseTimeout) 
		{
			clearTimeout(this.collapseTimeout);
			this.childrenEl.style.transitionDuration = "";
			this.childrenEl.style.height = "";
			this.wrapperEl.classList.toggle("is-animating", false);
		}


		if (collapse) 
		{
			this.collapseHeight = this.childrenEl.offsetHeight + parseFloat(this.children[this.children.length - 1]?.style.marginBottom || "0");

			// show all sibling headers after this one
			// this is so that when the header slides down you aren't left with a blank space
			let next = this.nextHeader;
			while (next && this.document.documentType == DocumentType.Canvas)
			{
				let localNext = next;

				// force show the sibling header for 500ms while this one is collapsing
				localNext.show(false, true, true);
				setTimeout(function()
				{
					localNext.forceShown = false;
				}, 500);

				next = next.nextHeader;
			}
		}

		let height = this.collapseHeight;
		this.childrenEl.style.height = height + "px";

		// if opening show the header
		if (!collapse && this.document.documentType == DocumentType.Canvas) this.show(true);

		this.isCollapsed = collapse;

		if (instant)
		{
			console.log("instant");
			this.childrenEl.style.transitionDuration = "0s";
			this.wrapperEl.classList.toggle("is-collapsed", collapse);
			this.childrenEl.style.height = "";
			this.childrenEl.style.transitionDuration = "";

			let newTotalHeight = Array.from(this.containingSizer?.children ?? []).reduce((acc, cur: HTMLElement) => acc + cur.offsetHeight, 0);
			if(this.containingSizer) this.containingSizer.style.minHeight = newTotalHeight + "px";

			return;
		}

		// get the length of the height transition on heading container and wait for that time before not displaying the contents
		let transitionDuration: string | number = getComputedStyle(this.childrenEl).transitionDuration;
		if (transitionDuration.endsWith("s")) transitionDuration = parseFloat(transitionDuration);
		else if (transitionDuration.endsWith("ms")) transitionDuration = parseFloat(transitionDuration) / 1000;
		else transitionDuration = 0;
		
		// multiply the duration by the height so that the transition is the same speed regardless of the height of the header
		let transitionDurationMod = Math.min(transitionDuration * Math.sqrt(height) / 16, 0.5); // longest transition is 0.5s
		this.childrenEl.style.transitionDuration = `${transitionDurationMod}s`;


		if (collapse) this.childrenEl.style.height = "0px";
		else this.childrenEl.style.height = height + "px";
		this.wrapperEl.classList.toggle("is-animating", true);
		this.wrapperEl.classList.toggle("is-collapsed", collapse);
        
        let localThis = this;

		setTimeout(function()
		{
			localThis.childrenEl.style.transitionDuration = "";
			if(!collapse) localThis.childrenEl.style.height = "";
			localThis.wrapperEl.classList.toggle("is-animating", false);

			let newTotalHeight = Array.from(localThis.containingSizer?.children ?? []).reduce((acc, cur: HTMLElement) => acc + cur.offsetHeight, 0);
			if(localThis.containingSizer) localThis.containingSizer.style.minHeight = newTotalHeight + "px";

		}, transitionDurationMod * 1000);
	}

    /**Restores a hidden header back to it's normal function */
    public show(showParents:boolean = false, showChildren:boolean = false, forceStay:boolean = false)
    {
        if (forceStay) this.forceShown = true;

		if (showParents)
		{
			if (this.parent) this.parent.show(true, false, forceStay);
		}

		if (showChildren)
		{
			this.childHeaders.forEach((header) =>
            {
                header.show(false, true, forceStay);
            });
		}

		if(this.isVisible || this.isCollapsed) return;


		this.wrapperEl.classList.toggle("is-hidden", false);
		this.wrapperEl.style.height = "";
		this.wrapperEl.style.visibility = "";
        this.isVisible = true;
    }

	public toggle(openParents = true)
	{
		this.collapse(!this.isCollapsed, openParents);
	}

	/**Hides everything in a header and then makes the header div take up the same space as the header element */
	public hide()
	{
		if(this.forceShown) return;
		if(!this.isVisible || this.isCollapsed) return;
		if(this.wrapperEl.style.display == "none") return;

		let height = this.wrapperEl.offsetHeight;
		this.wrapperEl.classList.toggle("is-hidden", true);
		if (height != 0) this.wrapperEl.style.height = height + "px";
		this.wrapperEl.style.visibility = "hidden";
        this.isVisible = false;
	}
}

class Tree
{

}

class TreeItem
{

}

class Canvas
{

}

class Sidebar
{

}

class SidebarGutter
{

}

export enum DocumentType
{
	Markdown,
	Canvas,
	Embed,
	Excalidraw,
	Kanban,
	Other
}

class WebpageDocument
{
	public headers: Header[];
	public website: Website;
	public documentType: DocumentType;
	public documentEl: HTMLElement;

	public constructor(documentEl: HTMLElement, website: Website, documentType: DocumentType)
	{
		this.documentEl = documentEl;
		this.website = website;
		this.documentType = documentType;

		this.headers = [];
		// only create top level headers, because headers create their own children
		this.documentEl.querySelectorAll(".heading-wrapper:not(:is(.heading-children .heading-wrapper))").forEach((headerEl) =>
		{
			new Header(headerEl as HTMLElement, this); // headers add themselves to the document
		});
	}

}
