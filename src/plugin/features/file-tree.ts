import { Tree, TreeItem } from "./tree";
import { Path } from "src/plugin/utils/path";
import { Website } from "src/plugin/website/website";
import { _MarkdownRendererInternal, MarkdownRendererAPI } from "src/plugin/render-api/render-api";

export class FileTree extends Tree
{
	public children: FileTreeItem[] = [];
	public showFileExtentionTags: boolean = true;
	/** File extentions matching this will not show extention tags */
	public hideFileExtentionTags: string[] = [];

	/** Remove files that match these regexes */
	public regexBlacklist: string[] = [];
	/** Remove files that don't match these regexes */
	public regexWhitelist: string[] = [];

	public files: Path[];
	public keepOriginalExtensions: boolean;
	public sort: boolean;

	public constructor(files: Path[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super();

		// make sure every path is a file
		if (files.some((file) => file.isDirectory))
		{
			console.error("FileTree: All paths must be files, not directories");
			files = files.filter((file) => !file.isDirectory);
		}

		this.files = files;
		this.keepOriginalExtensions = keepOriginalExtensions;
		this.sort = sort;
		this.renderMarkdownTitles = true;
		this.addCollapseAllButton = true;
	}

	protected async populateTree()
	{
		this.regexBlacklist = this.regexBlacklist.filter((pattern) => pattern.trim() != "");
		let filteredFiles = this.files.filter((file) => this.regexBlacklist.every((pattern) => !file.path.match(new RegExp(pattern))));
		filteredFiles = filteredFiles.filter((file) => this.regexWhitelist.every((pattern) => file.path.match(new RegExp(pattern))));
		for (const file of filteredFiles)
		{
			const pathSections: Path[] = [];

			let parentFile: Path = file;
			while (parentFile != undefined)
			{
				pathSections.push(parentFile);
				// @ts-ignore
				parentFile = parentFile.parent;
			}

			pathSections.reverse();

			let parent: FileTreeItem | FileTree = this;
			for (let i = 0; i < pathSections.length; i++)
			{
				const section = pathSections[i];
				const depth = i+1;
				const isFolder = section.isDirectory;

				// make sure this section hasn't already been added
				let child = parent.children.find(sibling => sibling.title == section.basename && sibling.isFolder == isFolder && sibling.depth == depth) as FileTreeItem | undefined;
				
				if (child == undefined)
				{
					child = new FileTreeItem(this, parent, depth);
					child.title = section.basename;
					child.isFolder = isFolder;
					child.dataRef = section.path;

					if(child.isFolder) 
					{
						const tfolder = app.vault.getFolderByPath(section.path);
						if (tfolder)
						{
							child.icon = (await _MarkdownRendererInternal.getIconForFile(tfolder)).icon;
						}
					}

					parent.children.push(child);
				}

				parent = child;
			}
			
			if (parent instanceof FileTreeItem)
			{
				
				const path = file.copy;
				const tfile = app.vault.getAbstractFileByPath(path.path);

				if (file.isDirectory) path.folderize();
				else 
				{
					if (path.path.endsWith(".excalidraw.md")) path.setExtension("drawing");
					parent.originalExtension = path.extensionName;
					if(!this.keepOriginalExtensions && MarkdownRendererAPI.isConvertable(path.extensionName)) path.setExtension("html");
				}

				parent.href = path.path;
				if (tfile)
				{
					parent.title = (await _MarkdownRendererInternal.getTitleForFile(tfile)).title;
					parent.icon = (await _MarkdownRendererInternal.getIconForFile(tfile)).icon;
				}
			}
		}

		if (this.sort) 
		{
			this.sortAlphabetically();
			this.sortByIsFolder();
		}
	}

	protected override async generateTree(container: HTMLElement): Promise<void> 
	{
		await this.populateTree();
		await super.generateTree(container);
	}

	public sortByIsFolder(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? (a.isFolder && !b.isFolder ? -1 : 1) : (a.isFolder && !b.isFolder ? -1 : 1));
		for (const child of this.children)
		{
			child.sortByIsFolder(reverse);
		}
	}

	public forAllChildren(func: (child: FileTreeItem) => void, recursive: boolean = true)
	{
		for (const child of this.children)
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
		for (const child of this.children)
		{
			child.sortByIsFolder(reverse);
		}
	}

	protected async insertSelf(container: HTMLElement): Promise<HTMLElement> 
	{
		const self = await super.insertSelf(container);

		self.classList.toggle("nav-folder-title", this.isFolder);
		self.classList.toggle("nav-file-title", !this.isFolder);

		if (!this.isFolder && this.tree.showFileExtentionTags && !this.tree.hideFileExtentionTags.contains(this.originalExtension) && this.originalExtension != "")
		{
			const tag = self.createDiv({ cls: "nav-file-tag" });
			tag.textContent = this.originalExtension;
		}

		return self;
	}

	protected override async insertInner(container: HTMLElement): Promise<HTMLDivElement> 
	{
		const inner = await super.insertInner(container);
		inner.classList.toggle("nav-folder-title-content", this.isFolder);
		inner.classList.toggle("nav-file-title-content", !this.isFolder);
		return inner;
	}

	protected override insertCollapseIcon(container: HTMLElement): HTMLElement | undefined
	{
		const icon = super.insertCollapseIcon(container);
		icon?.classList.toggle("nav-folder-collapse-indicator", this.isFolder);
		return icon;
	}

	protected insertItem(container: HTMLElement): HTMLDivElement 
	{
		const item = super.insertItem(container);
		item.classList.toggle("nav-folder", this.isFolder);
		item.classList.toggle("nav-file", !this.isFolder);
		return item;
	}

	protected insertChildren(container: HTMLElement): HTMLDivElement 
	{
		const children = super.insertChildren(container);
		children.classList.toggle("nav-folder-children", this.isFolder);
		children.classList.toggle("nav-file-children", !this.isFolder);
		return children;
	}
}
