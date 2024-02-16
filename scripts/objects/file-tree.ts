import { TAbstractFile, TFile, TFolder } from "obsidian";
import { Tree, TreeItem } from "./tree";
import { Path } from "scripts/utils/path";
import { Website } from "./website";
import { MarkdownRendererAPI } from "scripts/render-api";

export class FileTree extends Tree
{
	public children: FileTreeItem[] = [];
	public showFileExtentionTags: boolean = true;
	/** File extentions matching this will not show extention tags */
	public hideFileExtentionTags: string[] = [];

	public files: TFile[];
	public keepOriginalExtensions: boolean;
	public sort: boolean;

	public constructor(files: TFile[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super();
		this.files = files;
		this.keepOriginalExtensions = keepOriginalExtensions;
		this.sort = sort;
		this.renderMarkdownTitles = true;
	}

	protected async populateTree()
	{
		for (let file of this.files)
		{
			let pathSections: TAbstractFile[] = [];

			let parentFile: TAbstractFile = file;
			while (parentFile != undefined)
			{
				pathSections.push(parentFile);
				// @ts-ignore
				parentFile = parentFile.parent;
			}

			pathSections.reverse();

			let parent: FileTreeItem | FileTree = this;
			for (let i = 1; i < pathSections.length; i++)
			{
				let section = pathSections[i];
				let isFolder = section instanceof TFolder;

				// make sure this section hasn't already been added
				let child = parent.children.find(sibling => sibling.title == section.name && sibling.isFolder == isFolder && sibling.depth == i) as FileTreeItem | undefined;
				
				if (child == undefined)
				{
					child = new FileTreeItem(this, parent, i);
					child.title = section.name;
					child.isFolder = isFolder;

					if(child.isFolder) 
					{
						child.itemClass = "mod-tree-folder nav-folder";
						let titleInfo = await Website.getTitleAndIcon(section);
						child.icon = titleInfo.icon;
					}
					else child.itemClass = "mod-tree-file nav-file"

					parent.children.push(child);
				}

				parent = child;
			}
			
			if (parent instanceof FileTreeItem)
			{
				let titleInfo = await Website.getTitleAndIcon(file);
				let path = new Path(file.path).makeUnixStyle();

				if (file instanceof TFolder) path.makeForceFolder();
				else 
				{
					if (path.asString.endsWith(".excalidraw.md")) path.setExtension("drawing");
					parent.originalExtension = path.extensionName;
					if(!this.keepOriginalExtensions && MarkdownRendererAPI.isConvertable(path.extensionName)) path.setExtension("html");
				}

				parent.href = path.asString;	
				parent.title = path.basename == "." ? "" : titleInfo.title;
				parent.icon = titleInfo.icon || "";
			}
		}

		if (this.sort) 
		{
			this.sortAlphabetically();
			this.sortByIsFolder();
		}
	}

	public override async generateTree(container: HTMLElement): Promise<void> 
	{
		await this.populateTree();
		await super.generateTree(container);
	}

	public sortByIsFolder(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? (a.isFolder && !b.isFolder ? -1 : 1) : (a.isFolder && !b.isFolder ? -1 : 1));
		for (let child of this.children)
		{
			child.sortByIsFolder(reverse);
		}
	}

	public forAllChildren(func: (child: FileTreeItem) => void, recursive: boolean = true)
	{
		for (let child of this.children)
		{
			func(child);
			if (recursive) child.forAllChildren(func);
		}
	}
}

export class FileTreeItem extends TreeItem
{
	public tree: FileTree;
	public children: FileTreeItem[] = [];
	public parent: FileTreeItem | FileTree;
	public isFolder = false;
	public originalExtension: string = "";

	public forAllChildren(func: (child: FileTreeItem) => void, recursive: boolean = true)
	{
		super.forAllChildren(func, recursive);
	}

	public sortByIsFolder(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? (a.isFolder && !b.isFolder ? -1 : 1) : (a.isFolder && !b.isFolder ? -1 : 1));
		for (let child of this.children)
		{
			child.sortByIsFolder(reverse);
		}
	}

	protected override async createItemContents(container: HTMLElement): Promise<HTMLDivElement> 
	{
		let containerEl = await super.createItemContents(container);
		if (this.isFolder) containerEl.addClass("nav-folder-title");
		else containerEl.addClass("nav-file-title");

		if (!this.isFolder && this.tree.showFileExtentionTags && !this.tree.hideFileExtentionTags.contains(this.originalExtension))
		{
			let tag = containerEl.createDiv({ cls: "nav-file-tag" });
			tag.textContent = this.originalExtension.toUpperCase();
		}

		return containerEl;
	}

	protected override async createItemTitle(container: HTMLElement): Promise<HTMLSpanElement>
	{
		let titleEl = await super.createItemTitle(container);
		if (this.isFolder) titleEl.addClass("nav-folder-title-content", "tree-item-inner");
		else titleEl.addClass("nav-file-title-content", "tree-item-inner");
		return titleEl; 
	}
}
