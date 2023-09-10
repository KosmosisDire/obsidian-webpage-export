// import { Path } from "scripts/utils/path";
// import { HeadingCache, TAbstractFile, TFile, TFolder } from "obsidian";
// import { MarkdownRenderer } from "../html-generation/markdown-renderer";
// import { TreeItem } from "./tree";

// export const enum TreeItemType
// {
// 	Heading = "heading",
// 	File = "file",
// 	Folder = "folder",
// 	None = "none"
// }

// function isHeadingCache(obj: any): obj is HeadingCache 
// {
// 	return obj != undefined && "heading" in obj && "level" in obj;
// }

// export class LinkTreeItem extends TreeItem
// {
// 	public children: LinkTreeItem[] = [];
// 	public parent: LinkTreeItem | undefined = undefined;
// 	public root: LinkTreeItem | undefined = undefined;
// 	#source: TAbstractFile | HeadingCache | undefined = undefined;
// 	#type: TreeItemType;
// 	public keepOriginalExtensions: boolean = false;

// 	constructor(source: TAbstractFile | HeadingCache | undefined, parent: LinkTreeItem | undefined, depth: number, root: LinkTreeItem | undefined = undefined, keepOriginalExtensions: boolean = false)
// 	{
// 		super();
// 		this.keepOriginalExtensions = keepOriginalExtensions;
// 		this.source = source;
// 		this.parent = parent;
// 		this.depth = depth;

// 		if(root == undefined) this.root = this.findRoot();
// 	}


// 	public forAllChildren(func: (child: LinkTreeItem) => void, recursive: boolean = true)
// 	{
// 		for (let child of this.children)
// 		{
// 			func(child);
// 			if (recursive) child.forAllChildren(func);
// 		}
// 	}

// 	protected findRoot(): LinkTreeItem
// 	{
// 		let searchRoot = this.parent ?? this;
// 		while (searchRoot.parent != undefined)
// 		{
// 			searchRoot = searchRoot.parent;
// 		}

// 		searchRoot = searchRoot.parent ?? searchRoot;

// 		searchRoot.isRoot = true;

// 		return searchRoot;
// 	}
	
// 	public flatten(): LinkTreeItem[]
// 	{
// 		let list: LinkTreeItem[] = [];
// 		if(this.parent != undefined) list.push(this);
// 		for (let child of this.children)
// 		{
// 			list = list.concat(child.flatten());
// 		}
// 		return list;
// 	}

// 	/**
// 	 * Sets the source of this tree item. This also sets the type, title and href based on the source.
// 	 */
// 	set source(source: TAbstractFile | HeadingCache | undefined)
// 	{
// 		this.#type= isHeadingCache(source) ? TreeItemType.Heading :
// 					source instanceof TFolder ? TreeItemType.Folder :
// 					source instanceof TFile ? TreeItemType.File :
// 					TreeItemType.None;

// 		switch (this.type)
// 		{
// 			case TreeItemType.Folder:
// 				this.itemClass = "mod-tree-folder";
// 				break;
// 			case TreeItemType.File:
// 				this.itemClass = "mod-tree-file";
// 				break;
// 			case TreeItemType.Heading:
// 				this.itemClass = "mod-tree-heading";
// 				break;
// 		}

// 		if (isHeadingCache(source))
// 		{
// 			this.title = source.heading;
// 			this.href = "#" + source.heading.replaceAll(" ", "_");
// 		}
// 		else if (source instanceof TAbstractFile)
// 		{
// 			let path = new Path(source.path).makeUnixStyle();
// 			if (source instanceof TFolder) path.makeForceFolder();
// 			else if(!this.keepOriginalExtensions && MarkdownRenderer.isConvertable(path.extensionName)) path.setExtension("html");

// 			this.href = path.asString;
// 			this.title = path.basename == "." ? "" : path.basename;
// 		}
// 		else
// 		{
// 			this.title = "";
// 			this.href = undefined;
// 		}

// 		this.#source = source;
// 	}

// 	get source(): TAbstractFile | HeadingCache | undefined
// 	{
// 		return this.#source;
// 	}

// 	get type(): TreeItemType
// 	{
// 		return this.#type;
// 	}

	
// 	public makeLinksWebStyle()
// 	{
// 		for (let child of this.children)
// 		{
// 			child.href = Path.toWebStyle(child.href ?? "") || child.href;
// 			child.makeLinksWebStyle();
// 		}
// 	}
// }
