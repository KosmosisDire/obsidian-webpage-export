// --- START OF FILE file-tree.ts ---

import { Tree, TreeItem } from "./tree"; // Adjusted import if necessary
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

    /** Map from source vault path to FileTreeItem for quick lookup */
    public pathToItem: Map<string, FileTreeItem> = new Map();


	public constructor(files: Path[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super();

		// make sure every path is a file
		if (files.some((file) => file.isDirectory))
		{
			console.warn("FileTree: Some paths are directories. These will be treated as folders in the tree.");
			// files = files.filter((file) => !file.isDirectory); // Allow directories to form folder structure
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
        this.regexWhitelist = this.regexWhitelist.filter((pattern) => pattern.trim() != ""); // Ensure whitelist is also cleaned

		let filteredFiles = this.files.filter((file) => 
            this.regexBlacklist.every((pattern) => !file.path.match(new RegExp(pattern))) &&
            (this.regexWhitelist.length === 0 || this.regexWhitelist.some((pattern) => file.path.match(new RegExp(pattern))))
        );

        // Reset children and path map before repopulating
        this.children = [];
        this.pathToItem.clear();

		for (const file of filteredFiles)
		{
			const pathSections: Path[] = [];
			let currentPathSegment: Path | undefined = file;
			while (currentPathSegment != undefined && currentPathSegment.path !== "") // Iterate up to vault root
			{
				pathSections.push(currentPathSegment);
                currentPathSegment = currentPathSegment.parent;
			}
			pathSections.reverse(); // From root down to file/folder itself

			let currentParentNode: FileTreeItem | FileTree = this;
			for (let i = 0; i < pathSections.length; i++)
			{
				const section = pathSections[i]; // This is the vault path of the current segment
				const depth = i + 1; // Root is depth 0 for 'this', first level children are depth 1
                // A section is a folder if it's not the last segment OR if the original file path was a directory
				const isFolder = i < pathSections.length - 1 || file.isDirectory; 
                const titleForLookup = section.basename; // Use basename for folder title lookup initially

				let child = currentParentNode.children.find(sibling => sibling.dataRef == section.path) as FileTreeItem | undefined;
				
				if (child == undefined)
				{
					child = new FileTreeItem(this, currentParentNode, depth);
					child.isFolder = isFolder;
					child.dataRef = section.path; // Store the vault path
                    child.title = titleForLookup; // Default title

					if(child.isFolder) 
					{
						const tfolder = app.vault.getAbstractFileByPath(section.path); // Use getAbstractFileByPath
						if (tfolder && tfolder.name !== "") // Check if it's a valid folder (not vault root)
						{
                            child.title = tfolder.name; // Use actual folder name
							child.icon = (await _MarkdownRendererInternal.getIconForFile(tfolder)).icon;
						}
					}
                    
					currentParentNode.children.push(child);
                    this.pathToItem.set(child.dataRef, child); // Map by vault path
				}
				currentParentNode = child;
			}
			
			// After loop, currentParentNode is the FileTreeItem representing 'file'
			if (currentParentNode instanceof FileTreeItem && currentParentNode.dataRef === file.path)
			{
				const targetPath = file.copy; // path for href
				const tfile = app.vault.getAbstractFileByPath(file.path);

                currentParentNode.isFolder = file.isDirectory; // Correctly set isFolder for the final node

				if (file.isDirectory) 
                {
                    targetPath.folderize(); // This seems for URL generation, might not be needed for href if dataRef is used
                    if (tfile) currentParentNode.title = tfile.name; // Ensure folder title is correct
                }
				else 
				{
					if (targetPath.path.endsWith(".excalidraw.md")) targetPath.setExtension("drawing");
					currentParentNode.originalExtension = file.extensionName;
					if(!this.keepOriginalExtensions && MarkdownRendererAPI.isConvertable(targetPath.extensionName)) targetPath.setExtension("html");
				    if (tfile) {
						currentParentNode.title = (await _MarkdownRendererInternal.getTitleForFile(tfile)).title;
						currentParentNode.icon = (await _MarkdownRendererInternal.getIconForFile(tfile)).icon;
					}
				}
				currentParentNode.href = targetPath.path; // This is the output href
			}
		}

		if (this.sort) 
		{
			this.sortAlphabetically(); // Sorts children of 'this' and recursively
			this.sortByIsFolder();   // Sorts children of 'this' and recursively
		}
        this.assignTreeOrder(); // Assign treeOrder after all items are structured and sorted
	}

    private assignTreeOrder(): void {
        let orderCounter = { value: 0 }; // Use an object to pass by reference
        // Sort children at the root level first if not already done by recursive sort methods
        if (this.sort) {
            this.children.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
            this.children.sort((a, b) => (a.isFolder === b.isFolder) ? 0 : a.isFolder ? -1 : 1);
        }
        for (const child of this.children) {
            this.assignTreeOrderRecursive(child, orderCounter);
        }
    }

    private assignTreeOrderRecursive(item: FileTreeItem, orderCounter: { value: number }): void {
        item.treeOrder = orderCounter.value++;
        // Ensure item's children are sorted before recursing
        if (this.sort) {
            item.children.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
            item.children.sort((a, b) => (a.isFolder === b.isFolder) ? 0 : a.isFolder ? -1 : 1);
        }
        for (const child of item.children) {
            this.assignTreeOrderRecursive(child, orderCounter);
        }
    }

    /**
     * Retrieves a FileTreeItem by its original source vault path.
     * @param sourcePath The vault path of the file or folder.
     * @returns The FileTreeItem or undefined if not found.
     */
    public getItemBySourcePath(sourcePath: string): FileTreeItem | undefined {
        return this.pathToItem.get(sourcePath);
    }


	protected override async generateTree(container: HTMLElement): Promise<void> 
	{
		await this.populateTree(); // Ensure populateTree is called if not already
		await super.generateTree(container);
	}

	public sortByIsFolder(reverse: boolean = false)
	{
		this.children.sort((a, b) => {
            if (a.isFolder === b.isFolder) return 0;
            return reverse ? (a.isFolder ? 1 : -1) : (a.isFolder ? -1 : 1);
        });
		for (const child of this.children)
		{
			if (child.children.length > 0) child.sortByIsFolder(reverse);
		}
	}

	// Override sortAlphabetically to ensure it applies to FileTreeItem children
    public override sortAlphabetically(reverse: boolean = false)
    {
        this.children.sort((a, b) => 
            reverse 
            ? b.title.localeCompare(a.title, undefined, { numeric: true }) 
            : a.title.localeCompare(b.title, undefined, { numeric: true })
        );
        for (const child of this.children) {
            if (child.children.length > 0) child.sortAlphabetically(reverse);
        }
    }


	public forAllChildren(func: (child: FileTreeItem) => void, recursive: boolean = true)
	{
		for (const child of this.children)
		{
			func(child);
			if (recursive && child.children.length > 0) child.forAllChildren(func, recursive); // Pass recursive flag
		}
	}
}

export class FileTreeItem extends TreeItem
{
	public tree: FileTree; // Specific type for tree
	public children: FileTreeItem[] = [];
	public parent: FileTreeItem | FileTree; // Specific type for parent
	public isFolder = false;
	public originalExtension: string = "";
    // treeOrder is inherited from TreeItem (plugin/backend version)

	// Make sure constructor matches super
    constructor(tree: FileTree, parent: FileTreeItem | FileTree, depth: number) {
        super(tree, parent, depth);
        this.tree = tree;
        this.parent = parent;
    }


	public forAllChildren(func: (child: FileTreeItem) => void, recursive: boolean = true)
	{
		// super.forAllChildren(func, recursive); // This would call the base TreeItem's forAllChildren
        for (const child of this.children) {
            func(child);
            if (recursive && child.children.length > 0) { // Check child.children.length
                child.forAllChildren(func, recursive);
            }
        }
	}

	public sortByIsFolder(reverse: boolean = false)
	{
		this.children.sort((a, b) => {
            if (a.isFolder === b.isFolder) return 0;
            return reverse ? (a.isFolder ? 1 : -1) : (a.isFolder ? -1 : 1);
        });
		for (const child of this.children)
		{
			if (child.children.length > 0) child.sortByIsFolder(reverse);
		}
	}

    // Override sortAlphabetically to ensure it applies to FileTreeItem children
    public override sortAlphabetically(reverse: boolean = false)
    {
        this.children.sort((a, b) => 
            reverse 
            ? b.title.localeCompare(a.title, undefined, { numeric: true }) 
            : a.title.localeCompare(b.title, undefined, { numeric: true })
        );
        for (const child of this.children) {
            if (child.children.length > 0) child.sortAlphabetically(reverse);
        }
    }


	protected async insertSelf(container: HTMLElement): Promise<HTMLElement> 
	{
		const self = await super.insertSelf(container);

		self.classList.toggle("nav-folder-title", this.isFolder);
		self.classList.toggle("nav-file-title", !this.isFolder);

		if (!this.isFolder && this.tree.showFileExtentionTags && !this.tree.hideFileExtentionTags.includes(this.originalExtension) && this.originalExtension != "")
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
		const childrenContainer = super.insertChildren(container); // Renamed to avoid conflict
		childrenContainer.classList.toggle("nav-folder-children", this.isFolder);
		childrenContainer.classList.toggle("nav-file-children", !this.isFolder);
		return childrenContainer;
	}
}