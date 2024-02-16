import { TAbstractFile, TFile, TFolder } from "obsidian";
import { FileTree, FileTreeItem } from "./file-tree";
import { Path } from "scripts/utils/path";
import { Website } from "./website";
import { MarkdownRendererAPI } from "scripts/render-api";

export class FilePickerTree extends FileTree
{
	public children: FilePickerTreeItem[] = [];
	public selectAllItem: FilePickerTreeItem | undefined;

	public constructor(files: TFile[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super(files, keepOriginalExtensions, sort);
	}

	protected override async populateTree(): Promise<void> 
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

					if(child.isFolder) 
					{
						child.href = section.path;
						child.itemClass = "mod-tree-folder"
					}
					else 
					{
						child.file = file;
						child.itemClass = "mod-tree-file"
					}

					parent.children.push(child);
				}
				parent = child;
			}
			
			if (parent instanceof FilePickerTreeItem)
			{
				let titleInfo = await Website.getTitleAndIcon(file, true);
				let path = new Path(file.path).makeUnixStyle();

				if (file instanceof TFolder) path.makeForceFolder();
				else 
				{
					parent.originalExtension = path.extensionName;
					if(!this.keepOriginalExtensions && MarkdownRendererAPI.isConvertable(path.extensionName)) path.setExtension("html");
				}
				parent.href = path.asString;
				parent.title = path.basename == "." ? "" : titleInfo.title;
			}
		}

		if (this.sort) 
		{
			this.sortAlphabetically();
			this.sortByIsFolder();
		}
	}

	public async generateTree(container: HTMLElement): Promise<void> 
	{
		await super.generateTree(container);

		// add a select all button at the top
		let selectAllButton = new FilePickerTreeItem(this, this, 0);
		selectAllButton.title = "Select All";
		selectAllButton.itemClass = "mod-tree-control";
		let itemEl = await selectAllButton.generateItemHTML(container);

		// remove all event listeners from the select all button
		let oldItemEl = itemEl;
		itemEl = itemEl.cloneNode(true) as HTMLDivElement;
		selectAllButton.checkbox = itemEl.querySelector("input") as HTMLInputElement;
		selectAllButton.itemEl = itemEl;
		selectAllButton.childContainer = itemEl.querySelector(".tree-item-children") as HTMLDivElement;

		container.prepend(itemEl);

		oldItemEl.remove();


		let localThis = this;
		function selectAll()
		{
			let checked = selectAllButton.checkbox.checked;
			selectAllButton.check(!checked);
			localThis.forAllChildren((child) => child.check(!checked));
		}

		selectAllButton.checkbox.addEventListener("click", (event) =>
		{
			selectAllButton.checkbox.checked = !selectAllButton.checkbox.checked;
			selectAll();
			event.stopPropagation();
		});

		selectAllButton.itemEl.addEventListener("click", () =>
		{
			selectAll();
		});

		this.selectAllItem = selectAllButton;
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

	public getSelectedFilesSavePaths(): string[]
	{
		let selectedFiles: string[] = [];

		if (this.selectAllItem?.checked) 
		{
			selectedFiles = ["all"];
			return selectedFiles;
		}
		
		this.forAllChildren((child) =>
		{
			selectedFiles.push(...child.getSelectedFilesSavePaths());
		}, false);


		return selectedFiles;
	}

	public setSelectedFiles(files: string[])
	{
		if (files.includes("all"))
		{
			this.selectAllItem?.check(true, false, true);
			this.forAllChildren((child) => child.check(true));
			return;
		}

		this.forAllChildren((child) =>
		{
			if(files.includes(child.href ?? ""))
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
					child.check(true, false, true);
				}
				else if (uncheckedChildren?.length ?? 0 > 0)
				{
					child.check(false, false, true);
				}
			}
		});	

		// if all folders are checked, check the select all button, otherwise uncheck it
		if (this.children.reduce((acc, child) => acc && child.checked, true))
		{
			this.selectAllItem?.check(true, false, true);
		}
		else
		{
			this.selectAllItem?.check(false, false, true);
		}
	}
}

export class FilePickerTreeItem extends FileTreeItem
{
	public file: TFile;
	public checkbox: HTMLInputElement;
	public tree: FilePickerTree;
	public checked: boolean = false;

	protected async createItemContents(container: HTMLElement): Promise<HTMLDivElement>
	{
		let linkEl = await super.createItemContents(container);

		this.checkbox = linkEl.createEl("input");
		linkEl.prepend(this.checkbox);
		this.checkbox.classList.add("file-checkbox");
		this.checkbox.setAttribute("type", "checkbox");
		this.checkbox.addEventListener("click", (event) =>
		{
			event.stopPropagation();

			this.check(this.checkbox.checked, false);
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

	public check(checked: boolean, evaluate: boolean = false, skipChildren: boolean = false)
	{
		this.checked = checked;
		this.checkbox.checked = checked;
		this.checkbox.classList.toggle("checked", checked);
		if (!skipChildren) this.checkAllChildren(checked);
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

	public getSelectedFilesSavePaths(): string[]
	{
		let selectedFiles: string[] = [];

		if (this.checked) 
		{
			selectedFiles.push(this.href ?? "");
		}
		else if (this.isFolder)
		{
			this.forAllChildren((child) =>
			{
				selectedFiles.push(...child.getSelectedFilesSavePaths());
			}, false);
		}
		
		return selectedFiles;
	}

}
