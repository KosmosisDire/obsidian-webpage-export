import {  TFile } from "obsidian";
import { Tree, TreeItem } from "./tree";
import { Webpage } from "src/plugin/website/webpage";

export class OutlineTree extends Tree
{
	public file: TFile;
	public webpage: Webpage;
	public children: OutlineTreeItem[];
	public minDepth: number = 1;
	public depth: number = 0;

	private createTreeItem(heading: {heading: string, level: number, headingEl: HTMLElement}, parent: OutlineTreeItem | OutlineTree): OutlineTreeItem
	{
		const item = new OutlineTreeItem(this, parent, heading);
		item.title = heading.heading;
		return item;
	}

	public constructor(webpage: Webpage, minDepth = 1)
	{
		super();

		this.webpage = webpage;
		this.file = webpage.source;
		this.minDepth = minDepth;

		if (webpage.type != "markdown") return;

		const headings = webpage.headings;
		this.depth = Math.min(...headings.map(h => h.level)) - 1;

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

	public constructor(tree: OutlineTree, parent: OutlineTreeItem | OutlineTree, heading: {heading: string, level: number, headingEl: HTMLElement})
	{
		super(tree, parent, heading.level);
		this.heading = heading.heading;
		this.href = "#" + heading.headingEl.id;
		if (!tree.webpage.exportOptions.relativeHeaderLinks)
		{
			this.href = tree.webpage.targetPath + this.href;
		}
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
