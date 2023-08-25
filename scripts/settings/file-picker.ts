import { TFile } from "obsidian";
import { GlobalDataGenerator } from "scripts/html-generation/global-gen";
import { LinkTree } from "scripts/html-generation/link-tree";

export class FileSelectTree extends LinkTree
{
	public selected: boolean = false;
	public checkbox: HTMLInputElement | undefined = undefined;
	public fileElement: HTMLElement | undefined = undefined;

	constructor(tree: LinkTree)
	{
		super(tree.source, tree.parent, tree.depth, tree.root);
		this.children = tree.children.map(c => new FileSelectTree(c));
	}

	public static getFileSelectTree(exportedFiles: TFile[] | undefined = undefined): FileSelectTree
	{
		return new FileSelectTree(GlobalDataGenerator.getFileTree(exportedFiles));
	}
}


