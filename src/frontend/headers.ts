export class Header {
	private static headerMap: WeakMap<HTMLElement, Header> = new WeakMap();

	private _id: string;
	private _level: number;
	private _headerElement: HTMLElement;
	private _collapseIndicatorElement: HTMLElement | null;
	private _children: Header[] = [];
	private _isCollapsed: boolean = false;
	private _content: HTMLElement[] = [];

	constructor(element: HTMLElement) {
		this._headerElement = element;
		this._collapseIndicatorElement = element.querySelector(".heading-collapse-indicator");
		this._id = element.id;
		this._level = parseInt(element.tagName.replace("H", ""));
		Header.headerMap.set(element, this);

		if (this._collapseIndicatorElement) {
			this._collapseIndicatorElement.addEventListener("click", () => this.toggleCollapse());
		}
	}

	get id(): string { return this._id; }
	get text(): string { return this._headerElement.textContent ?? ""; }
	set text(v: string) { this._headerElement.textContent = v; }
	get level(): number { return this._level; }
	get headerElement(): HTMLElement { return this._headerElement; }
	get collapseIndicatorElement(): HTMLElement | null { return this._collapseIndicatorElement; }
	get children(): Header[] { return this._children; }
	get isCollapsed(): boolean { return this._isCollapsed; }

	scrollTo(options: ScrollIntoViewOptions = { behavior: "smooth", block: "start" }) {
		this._headerElement.scrollIntoView(options);
	}

	find(predicate: (header: Header) => boolean): Header | undefined {
		if (predicate(this)) return this;
		for (const child of this.children) {
			const result = child.find(predicate);
			if (result) return result;
		}
		return undefined;
	}

	getFlatChildren(): Header[] {
		let headers: Header[] = [this];
		for (const child of this._children) {
			headers = headers.concat(child.getFlatChildren());
		}
		return headers;
	}

	toggleCollapse() {
		this._isCollapsed = !this._isCollapsed;
		this._collapseIndicatorElement?.classList.toggle("is-collapsed", this._isCollapsed);
		this._headerElement.classList.toggle("is-collapsed", this._isCollapsed);
		this.updateVisibility(this._isCollapsed);
	}

	private updateVisibility(collapse: boolean) {
		this._collapseIndicatorElement?.classList.toggle("is-collapsed", collapse);
		this._headerElement.classList.toggle("is-collapsed", collapse);

		for (const el of this._content) {
			el.style.display = collapse ? "none" : "";
		}

		for (const child of this._children) {
			child.headerElement.style.display = collapse ? "none" : "";
			child.updateVisibility(collapse ? true : child._isCollapsed);
		}
	}

	static createHeaderTree(html: HTMLElement): Header[] {
		const headers = Array.from(html.querySelectorAll("h1, h2, h3, h4, h5, h6"));
		const headerObjects = headers.map(el => new Header(el as HTMLElement));
		const rootHeaders: Header[] = [];
		const stack: Header[] = [];

		for (const currentHeader of headerObjects) {
			while (stack.length > 0 && stack[stack.length - 1].level >= currentHeader.level) {
				stack.pop();
			}

			if (stack.length > 0) {
				stack[stack.length - 1].children.push(currentHeader);
			} else {
				rootHeaders.push(currentHeader);
			}

			stack.push(currentHeader);

			// Collect inline block content (siblings after the heading)
			let next = currentHeader.headerElement.nextElementSibling;
			while (next && !(next instanceof HTMLHeadingElement)) {
				if (next instanceof HTMLElement) currentHeader._content.push(next);
				next = next.nextElementSibling;
			}

			// Collect outer block content (siblings of the heading's parent div)
			next = currentHeader.headerElement.parentElement?.nextElementSibling ?? null;
			while (next && !next.querySelector("h1, h2, h3, h4, h5, h6")) {
				if (next instanceof HTMLElement && !next.classList.contains("footer")) {
					currentHeader._content.push(next);
				}
				next = next.nextElementSibling;
			}
		}

		return rootHeaders;
	}
}
