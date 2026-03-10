export class ListItem {
	public itemEl: HTMLElement;
	public child: List | undefined;
	public parent: List | undefined;
	public collapsible: boolean = false;
	public collapseEl: HTMLElement | undefined;
	public line: number = 0;

	get isChecked(): boolean { return this.itemEl.classList.contains("is-checked"); }
	get isCollapsed(): boolean { return this.itemEl.classList.contains("is-collapsed"); }
	set isCollapsed(collapse: boolean) {
		this.itemEl.classList.toggle("is-collapsed", collapse);
		if (this.collapseEl) this.collapseEl.classList.toggle("is-collapsed", collapse);
	}

	get textContent(): string {
		return Array.prototype.filter
			.call(this.itemEl.childNodes, (child: Node) => child.nodeType === Node.TEXT_NODE)
			.map((child: Node) => child.textContent)
			.join("").trim();
	}

	constructor(element: HTMLElement, parent: List | undefined) {
		this.itemEl = element;
		this.parent = parent;
		this.line = parseInt(this.itemEl.getAttribute("data-line") ?? "0");
		this.collapseEl = Array.from(this.itemEl.children).find(
			el => el.classList.contains("list-collapse-indicator")
		) as HTMLElement | undefined;

		const child = this.itemEl.querySelector("ol, ul");
		if (child) {
			this.child = new List(child as HTMLElement, this);
			if (this.collapseEl) {
				this.collapsible = true;
				this.collapseEl.addEventListener("click", (e) => {
					this.isCollapsed = !this.isCollapsed;
					e.stopPropagation();
				});
			}
		}
	}
}

export enum ListType {
	Ordered = "ordered",
	Unordered = "unordered",
	Checklist = "checklist",
}

export class List {
	public listEl: HTMLElement;
	public listType: ListType;
	public children: ListItem[] = [];
	public parent: ListItem | undefined;

	get linearList(): ListItem[] {
		let list: ListItem[] = [];
		for (const child of this.children) {
			list.push(child);
			if (child.child) list = list.concat(child.child.linearList);
		}
		return list;
	}

	constructor(element: HTMLElement, parent: ListItem | undefined) {
		this.listEl = element;
		this.parent = parent;
		this.listType = element.tagName === "OL"
			? ListType.Ordered
			: element.classList.contains("contains-task-list")
				? ListType.Checklist
				: ListType.Unordered;

		const childItems = Array.from(this.listEl.children).filter(el => el.tagName === "LI");
		for (const child of childItems) {
			this.children.push(new ListItem(child as HTMLElement, this));
		}
	}
}
