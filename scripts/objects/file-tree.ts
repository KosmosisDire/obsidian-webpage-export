import { TAbstractFile, TFile, TFolder } from "obsidian";
import { Tree, TreeItem } from "./tree";
import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { Website } from "./website";

export class FileTree extends Tree
{
	public children: FileTreeItem[] = [];

	public constructor(files: TFile[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super();

		this.renderMarkdownTitles = true;

		for (let file of files)
		{
			let pathSections: TAbstractFile[] = [];

			let parentFile: TAbstractFile = file;
			while (parentFile != undefined)
			{
				pathSections.push(parentFile);
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

					if(child.isFolder) child.itemClass = "mod-tree-folder"
					else child.itemClass = "mod-tree-file"

					parent.children.push(child);
				}

				parent = child;
			}
			
			if (parent instanceof FileTreeItem)
			{
				let titleInfo = Website.getTitle(file);
				let path = new Path(file.path).makeUnixStyle();

				if (file instanceof TFolder) path.makeForceFolder();
				else if(!keepOriginalExtensions && MarkdownRenderer.isConvertable(path.extensionName)) path.setExtension("html");

				parent.href = path.asString;	
				parent.title = path.basename == "." ? "" : `${titleInfo.emoji} ${titleInfo.title}`;
			}
		}

		if (sort) 
		{
			this.sortAlphabetically();
			this.sortByIsFolder();
		}
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
	public children: FileTreeItem[] = [];
	public parent: FileTreeItem | FileTree;
	public isFolder = false;

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
}
