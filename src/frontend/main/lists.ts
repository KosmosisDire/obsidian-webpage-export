
export class ListItem
{
	public itemEl: HTMLElement;
	public child: List | undefined;
	public parent: List | undefined = undefined;
	public collapsible: boolean = false;
	public collapseEl: HTMLElement | undefined = undefined;
	public line: number = 0;

	public get isChecked(): boolean
	{
		return this.itemEl.classList.contains("is-checked");
	}

	public get isCollapsed(): boolean
	{
		return this.itemEl.classList.contains("is-collapsed");
	}

	public set isCollapsed(collapse: boolean)
	{
		this.itemEl.classList.toggle("is-collapsed", collapse);
		if (this.collapseEl) this.collapseEl.classList.toggle("is-collapsed", collapse);
	}

	public get textContent(): string
	{
		return Array.prototype.filter
		.call(this.itemEl.childNodes, (child: Node) => child.nodeType === Node.TEXT_NODE)
		.map((child: Node) => child.textContent)
		.join('').trim();
	}

	public get htmlContent(): string
	{
		return this.itemEl.innerHTML;
	}

	public constructor(element: HTMLElement, parent: List | undefined)
	{
		this.itemEl = element;
		this.parent = parent;
		this.line = parseInt(this.itemEl.getAttribute("data-line") ?? "0");
		this.collapseEl = Array.from(this.itemEl.children).find((el) => el.classList.contains("list-collapse-indicator")) as HTMLElement | undefined;
		
		const child = this.itemEl.querySelector("ol, ul");
		if (child)
		{
			this.child = new List(child as HTMLElement, this);
			if (this.collapseEl)
			{
				this.collapsible = true;

				const localThis = this;
				this.collapseEl.addEventListener("click", function (event)
				{
					localThis.isCollapsed = !localThis.isCollapsed;
					event.stopPropagation();
				});
			}
		}
	}
}

enum ListType
{
	Ordered = "ordered",
	Unordered = "unordered",
	Checklist = "checklist"
}

export class List
{
	public listEl: HTMLElement;
	public listType: ListType;
	public children: ListItem[] = [];
	public parent: ListItem | undefined = undefined;

	public get linearList(): ListItem[]
	{
		let list: ListItem[] = [];
		this.children.forEach((child) =>
		{
			list.push(child);
			if (child.child) list = list.concat(child.child.linearList);
		});
		return list;
	}

	public constructor(element: HTMLElement, parent: ListItem | undefined)
	{
		if (element.tagName != "OL" && element.tagName != "UL") throw new Error("Invalid list element");
		this.listType = element.tagName == "OL" ? ListType.Ordered : element.classList.contains("contains-task-list") ? ListType.Checklist : ListType.Unordered;
		
		this.listEl = element;
		this.parent = parent;

		const childItems = Array.from(this.listEl.children).filter((el) => el.tagName == "LI");
		childItems.forEach((child) =>
		{
			this.children.push(new ListItem(child as HTMLElement, this));
		});
	}
}
