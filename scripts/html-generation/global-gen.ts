import { Path } from "scripts/utils/path";
import { ExportSettings } from "scripts/export-settings";
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

export class GlobalDataGenerator
{

	static InOutQuadBlend(start: number, end: number, t: number): number
	{
		t /= 2;
		let t2 = 2.0 * t * (1.0 - t) + 0.5;
		t2 -= 0.5;
		t2 *= 2.0;
		return start + (end - start) * t2;
	}

	static graphCache: {nodeCount: number, linkCount: number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[]} | undefined;

	public static clearGraphCache()
	{
		GlobalDataGenerator.graphCache = undefined;
	}

	public static getGlobalGraph(minRadius: number, maxRadius: number): {nodeCount: number, linkCount: number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[]}
	{
		if (this.graphCache != undefined) return this.graphCache;

		let nodeCount = 0;
		let indexedRadii: {index: number, radius: number}[] = [];
		let labels: string[] = [];
		let linkSources: number[] = [];
		let linkTargets: number[] = [];
		let linkCounts: number[] = [];
		let paths: string[] = [];

		// generate all posible nodes from files
		for (let file of app.vault.getFiles())
		{
			if (file.extension != "md" && file.extension != "canvas") continue;

			indexedRadii.push({index: nodeCount, radius: minRadius});
			labels.push(file.basename);
			paths.push(file.path);
			linkCounts.push(0);
			nodeCount++;
		}

		// count the number of links for each node
		let maxLinks: number = 0;
		for (let link of Object.entries(app.metadataCache.resolvedLinks))
		{
			let sourceIndex = paths.indexOf(link[0]);
			let targetLinks = Object.entries(link[1]);


			for (let targetLink of targetLinks)
			{
				let targetIndex = paths.indexOf(targetLink[0]);

				if (sourceIndex == -1 || targetIndex == -1) 
				{
					continue;
				}
				

				linkCounts[sourceIndex]++;
				linkCounts[targetIndex]++;
				linkSources.push(sourceIndex);
				linkTargets.push(targetIndex);
			}

			if (linkCounts[sourceIndex] > maxLinks) maxLinks = linkCounts[sourceIndex];
		}


		// set the radius of each node based on the number of links
		for (let link of Object.entries(app.metadataCache.resolvedLinks))
		{
			let sourceIndex = paths.indexOf(link[0]);

			indexedRadii[sourceIndex].radius = GlobalDataGenerator.InOutQuadBlend(minRadius, maxRadius, Math.min(linkCounts[sourceIndex] / (maxLinks * 0.8), 1.0));
		}

		// sort radii and then sort others based on radii
		indexedRadii.sort((a, b) => b.radius - a.radius);

		let radii = indexedRadii.map(r => r.radius);
		labels = indexedRadii.map(r => labels[r.index]);
		linkSources = linkSources.map(s => indexedRadii.findIndex(r => r.index == s));
		linkTargets = linkTargets.map(t => indexedRadii.findIndex(r => r.index == t));
		linkCounts = indexedRadii.map(r => linkCounts[r.index]);
		paths = indexedRadii.map(r => ExportSettings.settings.makeNamesWebStyle ? Path.toWebStyle(paths[r.index]) : paths[r.index]);
		paths = paths.map(p => 
			{
				return new Path(p).setExtension(".html").makeUnixStyle().asString;
			});

		this.graphCache = {nodeCount: nodeCount, linkCount: linkSources.length, radii: radii, labels: labels, paths: paths, linkSources: linkSources, linkTargets: linkTargets};

		return this.graphCache ?? {nodeCount: 0, linkCount: 0, radii: [], labels: [], paths: [], linkSources: [], linkTargets: []};
	}


	static fileTreeCache: LinkTree | undefined;

	public static clearFileTreeCache()
	{
		GlobalDataGenerator.fileTreeCache = undefined;
	}

	// return the file tree as a list of objects with size, title, and href
	// size is the depth of the file from the root
	// the list will be sorted first by size, then by title
	// the list will include folders and files
	public static getFileTree(exportedFiles: TFile[] | undefined = undefined): LinkTree
	{
		if (this.fileTreeCache != undefined) return this.fileTreeCache;
		if (exportedFiles == undefined) return new LinkTree(undefined, undefined, 0);
		
		let fileTree = LinkTree.fromFiles(exportedFiles);
		fileTree.sortAlphabetically();
		fileTree.sortByIsFolder(true);
		if(ExportSettings.settings.makeNamesWebStyle) fileTree.makeLinksWebStyle();

		this.fileTreeCache = fileTree;

		return fileTree;
	}
}
