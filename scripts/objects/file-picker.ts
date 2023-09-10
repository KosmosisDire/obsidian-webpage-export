import { TAbstractFile, TFile, TFolder } from "obsidian";
import { FileTree, FileTreeItem } from "./file-tree";
import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { Tree } from "./tree";

export class FilePickerTree extends FileTree
{
	public children: FilePickerTreeItem[] = [];

	public constructor(files: TFile[], keepOriginalExtensions: boolean = false, sort = true)
	{
		super(files, keepOriginalExtensions, sort);
		
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
				let path = new Path(file.path).makeUnixStyle();
				if (file instanceof TFolder) path.makeForceFolder();
				else if(!keepOriginalExtensions && MarkdownRenderer.isConvertable(path.extensionName)) path.setExtension("html");
				parent.href = path.asString;
				parent.title = path.basename == "." ? "" : path.basename;
			}
		}

		if (sort) 
		{
			this.sortAlphabetically();
			this.sortByIsFolder();
		}
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
			child.check(stringfiles.includes(new Path(child.href ?? "").makeUnixStyle().asString));
		});

		this.evaluateFolderChecks();
	}

	public forAllChildren(func: (child: FilePickerTreeItem) => void, recursive?: boolean): void {
		super.forAllChildren(func, recursive);
	}

	public evaluateFolderChecks()
	{
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

// export class FilePickerTree extends FileTree
// {
// 	public forAllChildren(func: (child: FileTreeItem) => void, recursive: boolean = true)
// 	{
// 		for (let child of this.children)
// 		{
// 			func(child);
// 			if (recursive) child.forAllChildren(func);
// 		}
// 	}

	// public static getFileSelectTree(exportedFiles: TFile[]): FilePickerTree
	// {
	// 	return new FilePickerTree(GlobalDataGenerator.getSortedFileTree(exportedFiles, false));
	// }

	// // If all children are checked, check the parent
	// // If any children are unchecked, uncheck the parent
	// evaluateFolderChecks()
	// {
	// 	this.container?.querySelectorAll(".tree-container .tree-item.mod-tree-folder").forEach((parentTreeItem: HTMLInputElement) =>
	// 	{
	// 		let checkbox = parentTreeItem.querySelector(".file-checkbox") as HTMLInputElement;
	// 		if(!checkbox.checked)
	// 		{
	// 			let uncheckedChildren = parentTreeItem?.querySelector(".tree-item-children")
	// 				?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");								
					
	// 			if (uncheckedChildren?.length == 0) 
	// 			{
	// 				checkbox.checked = true;
	// 				checkbox.classList.toggle("checked", checkbox.checked);
	// 			}
	// 		}
	// 		else
	// 		{
	// 			let uncheckedChildren = parentTreeItem?.querySelector(".tree-item-children")
	// 				?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");

	// 			if (uncheckedChildren?.length ?? 0 > 0) 
	// 			{
	// 				checkbox.checked = false;
	// 				checkbox.classList.toggle("checked", checkbox.checked);
	// 			}
	// 		}
	// 	});
	// }

	// public async buildTree(container: HTMLElement)
	// {
	// 	let tree = await WebsiteGenerator.buildTreeRecursive(this, document, 0, 0, true);

	// 	for (let i = 0; i < tree.length; i++)
	// 	{
	// 		let item = tree[i];
	// 		container.appendChild(item);
	// 	}

	// 	this.container = container;
	// 	this.forAllChildren((child) => child.container = container);

	// 	container.querySelectorAll(".tree-container .tree-item").forEach((treeItem: HTMLElement) =>
	// 	{
	// 		if (treeItem.classList.contains("is-collapsed")) this.setTreeCollapsed(treeItem, true, false);

	// 		let link = treeItem.querySelector(".tree-item-link");
	// 		let icon = treeItem.querySelector(".collapse-icon");

	// 		if(link)
	// 		{
	// 			// add a checkbox element to each item after the icon
	// 			let newCheckbox = link.createEl("input");
	// 			newCheckbox.classList.add("file-checkbox");
	// 			newCheckbox.setAttribute("type", "checkbox");
	// 			newCheckbox.addEventListener("click", (event) =>
	// 			{
	// 				event.stopPropagation();
	// 				treeItem.querySelectorAll(".file-checkbox").forEach((checkbox: HTMLInputElement) =>
	// 				{
	// 					checkbox.checked = newCheckbox.checked;
	// 					checkbox.classList.toggle("checked", newCheckbox.checked);
	// 				});

	// 				this.evaluateFolderChecks();
	// 			});
	// 			link.insertAdjacentElement("afterbegin", newCheckbox);
	// 		}

	// 		if(icon)
	// 		{
	// 			let This = this;
	// 			link?.addEventListener("click", function()
	// 			{
	// 				let parent = this.parentElement?.parentElement;
	// 				if (parent) 
	// 				{
	// 					This.toggleTreeCollapsed(parent);
	// 				}
	// 			});
	// 		}
	// 	});


	// 	container.querySelectorAll(".mod-tree-file .tree-item-link").forEach((link: HTMLElement) =>
	// 	{
	// 		link.addEventListener("click", (event) =>
	// 		{
	// 			let checkbox = link.querySelector(".file-checkbox") as HTMLInputElement;
	// 			if (checkbox) 
	// 			{
	// 				checkbox.checked = !checkbox.checked;
	// 				checkbox.classList.toggle("checked", checkbox.checked);
	// 				this.evaluateFolderChecks();
	// 			}
	// 		});
	// 	});
	// }

	// public getSelectedFiles(): TFile[]
	// {
	// 	let selectedFiles: TFile[] = [];

	// 	this.container?.querySelectorAll(".tree-container .tree-item").forEach((treeItem: HTMLInputElement) =>
	// 	{
	// 		let checkbox = treeItem.querySelector(".file-checkbox") as HTMLInputElement;
	// 		if (checkbox.checked)
	// 		{
	// 			let path = treeItem.querySelector(".tree-item-link")?.getAttribute("href")?.replaceAll(".html", ".md");
	// 			if (path)
	// 			{
	// 				let file = HTMLExportPlugin.plugin.app.vault.getAbstractFileByPath(path);
	// 				if (file instanceof TFile) selectedFiles.push(file);
	// 			}
	// 		}
	// 	});

	// 	return selectedFiles;
	// }

	// public setSelectedFiles(files: Path[])
	// {
	// 	let stringfiles = files.map(f => f.makeUnixStyle().asString);

	// 	this.container?.querySelectorAll(".tree-container .tree-item").forEach((treeItem: HTMLInputElement) =>
	// 	{
	// 		let path = treeItem.querySelector(".tree-item-link")?.getAttribute("href");
	// 		if (path)
	// 		{
	// 			let checkbox = treeItem.querySelector(".file-checkbox") as HTMLInputElement;
	// 			checkbox.checked = stringfiles.includes(new Path(path).makeUnixStyle().asString.replaceAll(".html", ".md"));
	// 			checkbox.classList.toggle("checked", checkbox.checked);
	// 		}
	// 	});

	// 	this.evaluateFolderChecks();
	// }
// }
