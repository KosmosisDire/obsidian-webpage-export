
export class Header
{
	private _id: string;
	public get id(): string
	{
		return this._id;
	}

	public get text(): string
	{
		return this.headerElement.textContent ?? "";
	}

	public set text(value: string)
	{
		this.headerElement.textContent = value;
	}

	private _level: number;
	public get level(): number
	{
		return this._level;
	}

	private _headerElement: HTMLElement;
	public get headerElement(): HTMLElement
	{
		return this._headerElement;
	}

	private _wrapperElement: HTMLElement;
	public get wrapperElement(): HTMLElement
	{
		return this._wrapperElement;
	}

	private _children: Header[] = [];
	public get children(): Header[]
	{
		return this._children;
	}

	private _childContainer: HTMLElement;

	public constructor(element: HTMLElement)
	{
		if (element.tagName.startsWith("H") && element.parentElement?.classList.contains("heading-wrapper"))
		{
			element = element.parentElement;
		}

		if (element.tagName.startsWith("H") && element.parentElement?.classList.contains("header") && element.parentElement.parentElement)
		{
			this._childContainer = element.parentElement.parentElement;
		}

		if (element.classList.contains("heading-wrapper"))
		{
			this._wrapperElement = element;
			this._childContainer = element.querySelector(".heading-children") as HTMLElement;
			this._headerElement = element.querySelector("h1, h2, h3, h4, h5, h6") as HTMLElement;
		}

		if (element.tagName.startsWith("H"))
		{
			this._headerElement = element;
		}

		if (!this._headerElement)
		{
			console.error("Header element not found in wrapper element", element);
			return;
		}

		this._id = this.headerElement.id;
		this._level = parseInt(this.headerElement.tagName.replace("H", ""));

		if (this._childContainer)
		{
			this.initializeChildren();
		}
	}

	private initializeChildren(): void
	{
		// walk through all immediate children of the child container
		// if the child is a header, add it to the children array

		let child = this._childContainer.firstElementChild;
		while (child)
		{
			if (child.classList.contains("heading-wrapper"))
			{
				this._children.push(new Header(child as HTMLElement));
			}

			child = child.nextElementSibling;
		}
	}

	public scrollTo(options: ScrollIntoViewOptions = { behavior: "smooth", block: "start" }): void
	{
		this.headerElement.scrollIntoView(options);
	}

	public find(predicate: (header: Header) => boolean): Header | undefined
	{
		if (predicate(this))
		{
			return this;
		}

		for (const child of this.children)
		{
			const result = child.find(predicate);
			if (result)
			{
				return result;
			}
		}

		return undefined;
	}

	public findByID(id: string): Header | undefined
	{
		if (id.startsWith("#"))
		{
			id = id.substring(1);
		}
		
		return this.find(header => header.id == id);
	}
}
