export class Header {
    private static headerMap: WeakMap<HTMLElement, Header> = new WeakMap();

    private _id: string;
    private _level: number;
	private _divParent: HTMLElement;
    private _headerElement: HTMLElement;
    private _collapseIndicatorElement: HTMLElement | null;
    private _children: Header[] = [];
    private _isCollapsed: boolean = false;
    private _content: HTMLElement[] = [];

    constructor(element: HTMLElement) {
		this._divParent = element.parentElement as HTMLElement;
        this._headerElement = element;
        this._collapseIndicatorElement = this._headerElement.querySelector(".heading-collapse-indicator");
        this._id = element.id;
        this._level = parseInt(element.tagName.replace("H", ""));

        Header.headerMap.set(element, this);

        if (this._collapseIndicatorElement) {
            this._collapseIndicatorElement.addEventListener("click", () => {
                this.toggleCollapse();
            });
        }
    }

    public get id(): string {
        return this._id;
    }

    public get text(): string {
        return this._headerElement.textContent ?? "";
    }

    public set text(value: string) {
        this._headerElement.textContent = value;
    }

    public get level(): number {
        return this._level;
    }

    public get headerElement(): HTMLElement {
        return this._headerElement;
    }

    public get collapseIndicatorElement(): HTMLElement | null {
        return this._collapseIndicatorElement;
    }

    public get children(): Header[] {
        return this._children;
    }

    public get isCollapsed(): boolean {
        return this._isCollapsed;
    }

    public scrollTo(options: ScrollIntoViewOptions = { behavior: "smooth", block: "start" }): void {
        this._headerElement.scrollIntoView(options);
    }

    public find(predicate: (header: Header) => boolean): Header | undefined {
        if (predicate(this)) {
            return this;
        }

        for (const child of this.children) {
            const result = child.find(predicate);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public findByID(id: string): Header | undefined {
        if (id.startsWith("#")) {
            id = id.substring(1);
        }
        
        return this.find(header => header.id === id);
    }

	public getFlatChildren(): Header[] {
		let headers: Header[] = [this];
		for (const child of this._children) {
			headers = headers.concat(child.getFlatChildren());
		}
		return headers;
	}

	public toggleCollapse() {
        this._isCollapsed = !this._isCollapsed;
        this._collapseIndicatorElement?.classList.toggle("is-collapsed", this._isCollapsed);
        this._headerElement.classList.toggle("is-collapsed", this._isCollapsed);
        this.updateVisibility(this._isCollapsed);
    }

    private updateVisibility(collapse: boolean) {
        this._collapseIndicatorElement?.classList.toggle("is-collapsed", collapse);
        this._headerElement.classList.toggle("is-collapsed", collapse);

        for (const element of this._content) {
            element.style.display = collapse ? "none" : "";
        }

        for (const child of this._children) {
            child.headerElement.style.display = collapse ? "none" : "";
            if (collapse) {
                child.updateVisibility(true);
            } else {
                child.updateVisibility(child._isCollapsed);
            }
        }
    }

	// return content and child content
	public getHeaderWithContentRecursive(): HTMLElement[] 
	{
		let content: HTMLElement[] = [];
		content.push(this._divParent);
		for (const element of this._content) 
		{
			content.push(element);
		}
		for (const child of this._children) 
		{
			content = content.concat(child.getHeaderWithContentRecursive());
		}
		return content;
	}

    public static createHeaderTree(html: HTMLElement): Header[] {
        const headers = Array.from(html.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headerObjects = headers.map(el => new Header(el as HTMLElement));
        const rootHeaders: Header[] = [];
        const stack: Header[] = [];

        for (let i = 0; i < headerObjects.length; i++) {
            const currentHeader = headerObjects[i];
            
            while (stack.length > 0 && stack[stack.length - 1].level >= currentHeader.level) {
                stack.pop();
            }

            if (stack.length > 0) {
                stack[stack.length - 1].children.push(currentHeader);
            } else {
                rootHeaders.push(currentHeader);
            }

            stack.push(currentHeader);

            // Collect inline block content
            let nextElement = currentHeader.headerElement.nextElementSibling;
            while (nextElement && !(nextElement instanceof HTMLHeadingElement)) {
                if (nextElement instanceof HTMLElement) {
                    currentHeader._content.push(nextElement);
                }
                nextElement = nextElement.nextElementSibling;
            }

			// collect outer block content
			nextElement = currentHeader.headerElement.parentElement?.nextElementSibling ?? null;
			while (nextElement && !nextElement.querySelector('h1, h2, h3, h4, h5, h6'))
			{
				if (nextElement instanceof HTMLElement && !nextElement.classList.contains('footer'))
				{
					currentHeader._content.push(nextElement);
				}
				nextElement = nextElement.nextElementSibling;
			}

        }

        return rootHeaders;
    }

}
