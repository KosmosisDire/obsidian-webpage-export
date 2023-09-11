import { HeadingCache, TFile } from "obsidian";
import { Tree, TreeItem } from "./tree";


export class OutlineTree extends Tree
{
	public children: OutlineTreeItem[];
	public minDepth: number = 1;
	public depth: number = 0;

	private createTreeItem(heading: HeadingCache, parent: OutlineTreeItem | OutlineTree, depth: number): OutlineTreeItem
	{
		let item = new OutlineTreeItem(this, parent, depth);
		item.title = heading.heading;
		item.href = "#" + heading.heading.replaceAll(" ", "_");
		return item;
	}

	public constructor(file: TFile, minDepth = 1)
	{
		super();

		this.minDepth = minDepth;

		let headings = app.metadataCache.getFileCache(file)?.headings ?? [];
		if(headings.length > 0 && (headings[0].level != 1 && minDepth <= 1 && headings[0].heading != file.basename)) headings.unshift({heading: file.basename, level: 1, position: {start: {col: 0, line: 0, offset: 0}, end: {col: 0, line: 0, offset: 0}}});
		this.depth = Math.min(...headings.map(h => h.level)) - 1;

		let parent: OutlineTreeItem | OutlineTree = this;
		for (let heading of headings)
		{
			if (heading.level < minDepth) continue;
			
			if (heading.level > parent.depth)
			{
				let child = this.createTreeItem(heading, parent, heading.level);
				parent.children.push(child);
				if(heading.level == parent.depth + 1) parent = child;
			}
			else if (heading.level == parent.depth)
			{
				if(parent instanceof OutlineTreeItem) 
				{
					let child = this.createTreeItem(heading, parent.parent, heading.level);
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
					
					let child = this.createTreeItem(heading, backParent, heading.level);
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

	public constructor(tree: OutlineTree, parent: OutlineTreeItem | OutlineTree, depth: number)
	{
		super(tree, parent, depth);
	}

	public forAllChildren(func: (child: OutlineTreeItem) => void, recursive: boolean = true)
	{
		super.forAllChildren(func, recursive);
	}

	protected isCollapsible(): boolean 
	{
		return super.isCollapsible() && this.depth > 1;
	}
}
