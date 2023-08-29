import { Path } from "scripts/utils/path";
import { HeadingCache, TAbstractFile, TFile, TFolder } from "obsidian";

export const enum TreeItemType
{
	Heading = "heading",
	File = "file",
	Folder = "folder",
	None = "none"
}

function isHeadingCache(obj: any): obj is HeadingCache 
{
	return obj != undefined && "heading" in obj && "level" in obj;
}

export class LinkTree
{
	public children: LinkTree[] = [];
	public parent: LinkTree | undefined = undefined;
	#source: TAbstractFile | HeadingCache | undefined = undefined;
	#type: TreeItemType;
	public depth: number = 0;
	public title: string = "";
	public href: string | undefined = undefined;
	public root: LinkTree | undefined = undefined;
	public isRoot: boolean = false;

	public forAllChildren(func: (child: LinkTree) => void, recursive: boolean = true)
	{
		for (let child of this.children)
		{
			func(child);
			if (recursive) child.forAllChildren(func);
		}
	}

	/**
	 * Sets the source of this tree item. This also sets the type, title and href based on the source.
	 */
	set source(source: TAbstractFile | HeadingCache | undefined)
	{
		this.#type= isHeadingCache(source) ? TreeItemType.Heading :
					source instanceof TFolder ? TreeItemType.Folder :
					source instanceof TFile ? TreeItemType.File :
					TreeItemType.None;

		if (isHeadingCache(source))
		{
			this.title = source.heading;
			this.href = "#" + source.heading.replaceAll(" ", "_");
		}
		else if (source instanceof TAbstractFile)
		{
			let path = new Path(source.path).makeUnixStyle();
			if (source instanceof TFolder) path.makeForceFolder();
			else path.setExtension("html");

			this.href = path.asString;
			this.title = path.basename == "." ? "" : path.basename;
		}
		else
		{
			this.title = "";
			this.href = undefined;
		}


		this.#source = source;
	}

	get source(): TAbstractFile | HeadingCache | undefined
	{
		return this.#source;
	}

	get type(): TreeItemType
	{
		return this.#type;
	}

	constructor(source: TAbstractFile | HeadingCache | undefined, parent: LinkTree | undefined, depth: number, root: LinkTree | undefined = undefined)
	{
		this.source = source;
		this.parent = parent;
		this.depth = depth;

		if(root == undefined) this.root = this.findRoot();
	}

	private findRoot(): LinkTree
	{
		let searchRoot = this.parent ?? this;
		while (searchRoot.parent != undefined)
		{
			searchRoot = searchRoot.parent;
		}

		searchRoot = searchRoot.parent ?? searchRoot;

		searchRoot.isRoot = true;

		return searchRoot;
	}

	/**
	 * Creates a tree from a list of files.
	 * @returns The root of the tree.
	 */
	public static fromFiles(files: TFile[]): LinkTree
	{
		let root = new LinkTree(undefined, undefined, 0);

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

			let parent = root;
			for (let i = 1; i < pathSections.length; i++)
			{
				let section = pathSections[i];
				let sectionType = section instanceof TFolder ? TreeItemType.Folder : (section instanceof TFile ? TreeItemType.File : TreeItemType.None);
				let child = parent.children.find(c => c.title == section.name && c.type == sectionType && c.depth == i);
				if (child == undefined)
				{
					child = new LinkTree(section, parent, i, root);
					parent.children.push(child);
				}
				parent = child;
			}
			parent.source = file;
		}

		return root;
	}

	/**
	 * Creates a tree from the headings in a document.
	 * @returns The root of the tree.
	 * @param fileDocument The document to create the tree from.
	 * @param minDepth The minimum depth of headings to include in the tree. 1 will include h1.
	 */
	public static headersFromFile(file: TFile, minDepth: number = 1): LinkTree
	{
		let headings = app.metadataCache.getFileCache(file)?.headings ?? [];
		if(headings.length > 0 && (headings[0].level != 1 && minDepth <= 1 && headings[0].heading != file.basename)) headings.unshift({heading: file.basename, level: 1, position: {start: {col: 0, line: 0, offset: 0}, end: {col: 0, line: 0, offset: 0}}});
		let minHeadingSize = Math.min(...headings.map(h => h.level));
		let root = new LinkTree(undefined, undefined, minHeadingSize - 1);

		let parent = root;
		for (let heading of headings)
		{
			if (heading.level < minDepth) continue;
			
			if (heading.level > parent.depth)
			{
				let child = new LinkTree(heading, parent, heading.level, root);
				parent.children.push(child);
				if(heading.level == parent.depth + 1 || parent == root) parent = child;
			}
			else if (heading.level == parent.depth)
			{
				let child = new LinkTree(heading, parent.parent, heading.level, root);
				parent.parent?.children.push(child);
				parent = child;
			}
			else if (heading.level < parent.depth)
			{
				let levelChange = parent.depth - heading.level;
				let backParent = parent.parent ?? parent;
				for (let i = 0; i < levelChange; i++)
				{
					backParent = backParent.parent ?? backParent;
				}

				let child = new LinkTree(heading, backParent, heading.level, root);
				backParent.children.push(child);
				parent = child;
			}
		}

		return root;
	}

	public flatten(): LinkTree[]
	{
		let list: LinkTree[] = [];
		if(this.parent != undefined) list.push(this);
		for (let child of this.children)
		{
			list = list.concat(child.flatten());
		}
		return list;
	}

	public sortAlphabetically(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title));
		for (let child of this.children)
		{
			child.sortAlphabetically();
		}
	}

	public sortByIsFolder(reverse: boolean = false)
	{
		this.children.sort((a, b) => reverse ? (a.type == TreeItemType.Folder && b.type != TreeItemType.Folder ? -1 : 1) : (a.type == TreeItemType.Folder && b.type != TreeItemType.Folder ? 1 : -1));
		for (let child of this.children)
		{
			child.sortByIsFolder(reverse);
		}
	}

	public makeLinksWebStyle()
	{
		for (let child of this.children)
		{
			child.href = Path.toWebStyle(child.href ?? "") || child.href;
			child.makeLinksWebStyle();
		}
	}
}
