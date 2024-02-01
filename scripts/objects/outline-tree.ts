import { HeadingCache, TFile } from "obsidian";
import { Tree, TreeItem } from "./tree";
import { Webpage } from "./webpage";


export class OutlineTree extends Tree
{
	public file: TFile;
	public webpage: Webpage;
	public children: OutlineTreeItem[];
	public minDepth: number = 1;
	public depth: number = 0;

	private createTreeItem(heading: {heading: string, level: number, headingEl: HTMLElement}, parent: OutlineTreeItem | OutlineTree): OutlineTreeItem
	{
		let item = new OutlineTreeItem(this, parent, heading);
		item.title = heading.heading;
		return item;
	}

	public constructor(webpage: Webpage, minDepth = 1)
	{
		super();

		this.webpage = webpage;
		this.file = webpage.source;
		this.minDepth = minDepth;

		// let headings = app.metadataCache.getFileCache(this.file)?.headings ?? [];
		let headings = webpage.getHeadings();

		// if(headings.length > 0 && (headings[0].level != 1 && minDepth <= 1 && headings[0].heading != this.file.basename)) headings.unshift({heading: this.file.basename, level: 1});
		this.depth = Math.min(...headings.map(h => h.level)) - 1;

		let parent: OutlineTreeItem | OutlineTree = this;
		for (let heading of headings)
		{
			if (heading.level < minDepth) continue;
			
			if (heading.level > parent.depth)
			{
				let child = this.createTreeItem(heading, parent);
				parent.children.push(child);
				if(heading.level == parent.depth + 1) parent = child;
			}
			else if (heading.level == parent.depth)
			{
				if(parent instanceof OutlineTreeItem) 
				{
					let child = this.createTreeItem(heading, parent.parent);
					parent.parent.children.push(child);
					parent = child;
				}
			}
			else if (heading.level < parent.depth)
			{
				if (parent instanceof OutlineTreeItem)
				{
					let levelChange = parent.depth - heading.level;
					let backParent: OutlineTreeItem | OutlineTree = (parent.parent as OutlineTreeItem | OutlineTree) ?? parent;
					for (let i = 0; i < levelChange; i++)
					{
						if (backParent instanceof OutlineTreeItem) backParent = (backParent.parent as OutlineTreeItem | OutlineTree) ?? backParent;
					}
					
					let child = this.createTreeItem(heading, backParent);
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
		this.href = tree.webpage.exportPath + "#" + heading.headingEl.id;
	}

	public forAllChildren(func: (child: OutlineTreeItem) => void, recursive: boolean = true)
	{
		super.forAllChildren(func, recursive);
	}

	protected isCollapsible(): boolean 
	{
		return super.isCollapsible() && this.depth > 1;
	}

	protected override async createItemContents(container: HTMLElement): Promise<HTMLDivElement> 
	{
		let linkEl = await super.createItemContents(container);
		linkEl?.setAttribute("heading-name", this.heading);
		linkEl.classList.add("heading-link");

		return linkEl;
	}
}
