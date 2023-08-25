import { TFile } from "obsidian";
import { GlobalDataGenerator } from "scripts/html-generation/global-gen";
import { HTMLGenerator } from "scripts/html-generation/html-generator";
import { LinkTree } from "scripts/html-generation/link-tree";

export class FilePicker extends LinkTree
{
	public selected: boolean = false;
	public checkbox: HTMLInputElement | undefined = undefined;
	public fileElement: HTMLElement | undefined = undefined;

	constructor(tree: LinkTree)
	{
		super(tree.source, tree.parent, tree.depth, tree.root);
		this.children = tree.children.map(c => new FilePicker(c));
	}

	public static getFileSelectTree(exportedFiles: TFile[]): FilePicker
	{
		return new FilePicker(GlobalDataGenerator.getFileTree(exportedFiles));
	}

	public buildTree(container: HTMLElement)
	{
		let tree = HTMLGenerator.buildTreeRecursive(this, document, 0, 0, false);
		for (let i = 0; i < tree.length; i++)
		{
			container.appendChild(tree[i]);
		}
	}
}
