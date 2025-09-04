import { Tree, TreeItem } from "./BaseTree";
import { FileData } from "@shared/types";

export class OutlineTree extends Tree
{
	public webpage: FileData;
	public children: OutlineTreeItem[];
	public minDepth: number = 1;
	public depth: number = 0;

	private createTreeItem(heading: {text: string, level: number}, parent: OutlineTreeItem | OutlineTree): OutlineTreeItem
	{
		const headingData = {
			heading: heading.text,
			level: heading.level,
			// TODO: Pass in an actual heading ID if available
			headingId: heading.text.toLowerCase().replace(/\s+/g, '-')
		};
		const item = new OutlineTreeItem(this, parent, headingData);
		item.title = heading.text;
		return item;
	}

	public constructor(webpage: FileData, minDepth = 1)
	{
		super();

		this.webpage = webpage;
		this.minDepth = minDepth;

		// FileData always contains processed content, no need to check type

		const headings = webpage.elements.headers;
		this.depth = Math.min(...headings.map((h: { text: string; level: number }) => h.level)) - 1;

		let parent: OutlineTreeItem | OutlineTree = this;
		for (const heading of headings)
		{
			if (heading.level < minDepth) continue;
			
			if (heading.level > parent.depth)
			{
				const child = this.createTreeItem(heading, parent);
				parent.children.push(child);
				if(heading.level == parent.depth + 1) parent = child;
			}
			else if (heading.level == parent.depth)
			{
				if(parent instanceof OutlineTreeItem) 
				{
					const child = this.createTreeItem(heading, parent.parent);
					parent.parent.children.push(child);
					parent = child;
				}
			}
			else if (heading.level < parent.depth)
			{
				if (parent instanceof OutlineTreeItem)
				{
					const levelChange = parent.depth - heading.level;
					let backParent: OutlineTreeItem | OutlineTree = (parent.parent as OutlineTreeItem | OutlineTree) ?? parent;
					for (let i = 0; i < levelChange; i++)
					{
						if (backParent instanceof OutlineTreeItem) backParent = (backParent.parent as OutlineTreeItem | OutlineTree) ?? backParent;
					}
					
					const child = this.createTreeItem(heading, backParent);
					backParent.children.push(child);
					parent = child;
				}
			}
		}
	}
}


export class OutlineTreeItem extends TreeItem
{
	public children: OutlineTreeItem[] = [];
	public parent: OutlineTreeItem | OutlineTree;
	public heading: string;

	public constructor(tree: OutlineTree, parent: OutlineTreeItem | OutlineTree, heading: {heading: string, level: number, headingId: string})
	{
		super(tree, parent, heading.level);
		this.heading = heading.heading;
		this.href = "#" + heading.headingId;

		// TODO: Fix relative header links
		// if (!tree.webpage.exportOptions.relativeHeaderLinks)
		// {
		// 	this.href = tree.webpage.targetPath + this.href;
		// }
	}

	public forAllChildren(func: (child: OutlineTreeItem) => void, recursive: boolean = true)
	{
		super.forAllChildren(func, recursive);
	}

	protected override async insertInner(container: HTMLElement): Promise<HTMLDivElement> 
	{
		const linkEl = await super.insertInner(container);
		linkEl?.setAttribute("heading-name", this.heading);
		linkEl.classList.add("heading-link");

		return linkEl;
	}
}