import { TAbstractFile, TFile, TFolder } from "obsidian";
import { FileTree, FileTreeItem } from "./file-tree";
import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { Tree } from "./tree";
import { Utils } from "scripts/utils/utils";
import { Website } from "./website";

export class FilePickerTree extends FileTree
{
	public children: FilePickerTreeItem[] = [];
	public selectAllItem: FilePickerTreeItem | undefined;

	public constructor(files: TFile[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super(files, keepOriginalExtensions, sort);

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

			let parent: FilePickerTreeItem | FilePickerTree = this;
			for (let i = 1; i < pathSections.length; i++)
			{
				let section = pathSections[i];
				let isFolder = section instanceof TFolder;

				// make sure this section hasn't already been added
				let child = parent.children.find(sibling => sibling.title == section.name && sibling.isFolder == isFolder && sibling.depth == i) as FilePickerTreeItem | undefined;
				
				if (child == undefined)
				{
					child = new FilePickerTreeItem(this, parent, i);
					child.title = section.name;
					child.isFolder = isFolder;

					if(!child.isFolder) child.file = file;

					if(child.isFolder) child.itemClass = "mod-tree-folder"
					else child.itemClass = "mod-tree-file"

					parent.children.push(child);
				}
				parent = child;
			}
			
			if (parent instanceof FilePickerTreeItem)
			{
				let titleInfo = Website.getTitle(file);
				let path = new Path(file.path).makeUnixStyle();

				if (file instanceof TFolder) path.makeForceFolder();
				else if(!keepOriginalExtensions && MarkdownRenderer.isConvertable(path.extensionName)) path.setExtension("html");

				parent.href = path.asString;
				parent.title = path.basename == "." ? "" : path.basename == ".." ? ".." : `${titleInfo.emoji} ${titleInfo.title}`;
			}
		}

		if (sort) 
		{
			this.sortAlphabetically();
			this.sortByIsFolder();
		}
	}

	public async generateTree(container: HTMLElement): Promise<void> 
	{
		await super.generateTree(container);

		// add a select all button at the top
		let item = new FilePickerTreeItem(this, this, 0);
		item.title = "Select All";
		item.itemClass = "mod-tree-control";
		let itemEl = await item.generateItemHTML(container);

		// remove all event listeners from the select all button
		let oldItemEl = itemEl;
		itemEl = itemEl.cloneNode(true) as HTMLDivElement;
		item.checkbox = itemEl.querySelector("input") as HTMLInputElement;
		item.itemEl = itemEl;
		item.childContainer = itemEl.querySelector(".tree-item-children") as HTMLDivElement;

		container.prepend(itemEl);

		oldItemEl.remove();


		let localThis = this;
		function selectAll()
		{
			let checked = item.checkbox.checked;
			item.check(!checked);
			localThis.forAllChildren((child) => child.check(!checked));
		}

		item.checkbox.addEventListener("click", (event) =>
		{
			item.checkbox.checked = !item.checkbox.checked;
			selectAll();
			event.stopPropagation();
		});

		item.itemEl.addEventListener("click", () =>
		{
			selectAll();
		});

		this.selectAllItem = item;
	}
	
	public getSelectedFiles(): TFile[]
	{
		let selectedFiles: TFile[] = [];
		
		this.forAllChildren((child) =>
		{
			if(child.checked && !child.isFolder) selectedFiles.push(child.file);
		});

		return selectedFiles;
	}

	public setSelectedFiles(files: Path[])
	{
		let stringfiles = files.map(f => f.makeUnixStyle().asString);

		this.forAllChildren((child) =>
		{
			if(stringfiles.includes(new Path(child.href ?? "").makeUnixStyle().asString))
			{
				child.check(true);
			}
		});

		this.evaluateFolderChecks();
	}

	public forAllChildren(func: (child: FilePickerTreeItem) => void, recursive?: boolean): void {
		super.forAllChildren(func, recursive);
	}

	public evaluateFolderChecks()
	{
		// if all a folder's children are checked, check the folder, otherwise uncheck it
		this.forAllChildren((child) => 
		{
			if(child.isFolder)
			{
				let uncheckedChildren = child?.itemEl?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");

				if (!child.checked && uncheckedChildren?.length == 0)
				{
					child.check(true);
				}
				else if (uncheckedChildren?.length ?? 0 > 0)
				{
					child.check(false);
				}
			}
		});	

		// if all folders are checked, check the select all button, otherwise uncheck it
		if (this.children.reduce((acc, child) => acc && child.checked, true))
		{
			this.selectAllItem?.check(true);
		}
		else
		{
			this.selectAllItem?.check(false);
		}
	}
}

export class FilePickerTreeItem extends FileTreeItem
{
	public file: TFile;
	public checkbox: HTMLInputElement;
	public tree: FilePickerTree;
	public checked: boolean = false;

	protected createItemLink(container: HTMLElement): HTMLAnchorElement
	{
		let linkEl = super.createItemLink(container);

		this.checkbox = linkEl.createEl("input");
		this.checkbox.classList.add("file-checkbox");
		this.checkbox.setAttribute("type", "checkbox");
		this.checkbox.addEventListener("click", (event) =>
		{
			event.stopPropagation();

			this.check(this.checkbox.checked, false);
			this.checkAllChildren(this.checkbox.checked);
			this.tree.evaluateFolderChecks();
		});

		let localThis = this;
		linkEl?.addEventListener("click", function(event)
		{
			if(localThis.isFolder) localThis.toggleCollapse();
			else localThis.toggle(true);
		});
		
		return linkEl;
	}

	public check(checked: boolean, evaluate: boolean = false)
	{
		this.checked = checked;
		this.checkbox.checked = checked;
		this.checkbox.classList.toggle("checked", checked);
		if(evaluate) this.tree.evaluateFolderChecks();
	}

	public toggle(evaluate = false)
	{
		this.check(!this.checked, evaluate);
	}

	public checkAllChildren(checked: boolean)
	{
		this.forAllChildren((child) => child.check(checked));
	}

	public forAllChildren(func: (child: FilePickerTreeItem) => void, recursive?: boolean): void 
	{
		super.forAllChildren(func, recursive);
	}

}
