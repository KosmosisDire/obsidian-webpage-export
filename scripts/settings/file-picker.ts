import { TFile } from "obsidian";
import { GlobalDataGenerator } from "scripts/html-generation/global-gen";
import { HTMLGenerator } from "scripts/html-generation/html-generator";
import { LinkTree } from "scripts/html-generation/link-tree";
import HTMLExportPlugin from "scripts/main";
import { Path } from "scripts/utils/path";

export class FilePicker extends LinkTree
{
	public children: FilePicker[] = [];
	public container: HTMLElement | undefined;

	public forAllChildren(func: (child: FilePicker) => void, recursive: boolean = true)
	{
		for (let child of this.children)
		{
			func(child);
			if (recursive) child.forAllChildren(func);
		}
	}

	constructor(tree: LinkTree)
	{
		super(tree.source, tree.parent, tree.depth, tree.root);
		this.children = tree.children.map(c => new FilePicker(c));
	}

	public slideUp = (target: HTMLElement, duration=500) => {

		target.style.transitionProperty = 'height, margin, padding';
		target.style.transitionDuration = duration + 'ms';
		target.style.boxSizing = 'border-box';
		target.style.height = target.offsetHeight + 'px';
		target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = "0";
		target.style.paddingTop = "0";
		target.style.paddingBottom = "0";
		target.style.marginTop = "0";
		target.style.marginBottom = "0";
		window.setTimeout(async () => {
				target.style.display = 'none';
				target.style.removeProperty('height');
				target.style.removeProperty('padding-top');
				target.style.removeProperty('padding-bottom');
				target.style.removeProperty('margin-top');
				target.style.removeProperty('margin-bottom');
				target.style.removeProperty('overflow');
				target.style.removeProperty('transition-duration');
				target.style.removeProperty('transition-property');
		}, duration);
	}

	public slideDown = (target: HTMLElement, duration=500) => {

		target.style.removeProperty('display');
		let display = window.getComputedStyle(target).display;
		if (display === 'none') display = 'block';
		target.style.display = display;
		let height = target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = "0";
		target.style.paddingTop = "0";
		target.style.paddingBottom = "0";
		target.style.marginTop = "0";
		target.style.marginBottom = "0";
		target.offsetHeight;
		target.style.boxSizing = 'border-box';
		target.style.transitionProperty = "height, margin, padding";
		target.style.transitionDuration = duration + 'ms';
		target.style.height = height + 'px';
		target.style.removeProperty('padding-top');
		target.style.removeProperty('padding-bottom');
		target.style.removeProperty('margin-top');
		target.style.removeProperty('margin-bottom');
		window.setTimeout(async () => {
			target.style.removeProperty('height');
			target.style.removeProperty('overflow');
			target.style.removeProperty('transition-duration');
			target.style.removeProperty('transition-property');
		}, duration);
	}

	public async setTreeCollapsed(element: HTMLElement, collapsed: boolean, animate = true)
	{
		if (!element || !element.classList.contains("mod-collapsible")) return;

		let children = element.querySelector(".tree-item-children") as HTMLElement;

		if (children == null) return;

		if (collapsed)
		{
			element.classList.add("is-collapsed");
			if(animate) this.slideUp(children, 100);
			else children.style.display = "none";
		}
		else
		{
			element.classList.remove("is-collapsed");
			if(animate) this.slideDown(children, 100);
			else children.style.removeProperty("display");
		}
	}

	public toggleTreeCollapsed(element: HTMLElement)
	{
		if (!element) return;
		this.setTreeCollapsed(element, !element.classList.contains("is-collapsed"));
	}

	public static getFileSelectTree(exportedFiles: TFile[]): FilePicker
	{
		return new FilePicker(GlobalDataGenerator.getFileTree(exportedFiles));
	}

	public buildTree(container: HTMLElement)
	{
		let tree = HTMLGenerator.buildTreeRecursive(this, document, 0, 0, true);

		for (let i = 0; i < tree.length; i++)
		{
			let item = tree[i];
			container.appendChild(item);
		}

		this.container = container;
		this.forAllChildren((child) => child.container = container);

		container.querySelectorAll(".tree-container .tree-item").forEach((item: HTMLElement) =>
		{
			if (item.classList.contains("is-collapsed")) this.setTreeCollapsed(item, true, false);

			let contents = item.querySelector(".tree-item-contents");
			let icon = item.querySelector(".collapse-icon");

			if(contents)
			{
				// add a checkbox element to each item after the icon
				let newCheckbox = contents.createEl("input");
				newCheckbox.classList.add("file-checkbox");
				newCheckbox.setAttribute("type", "checkbox");
				newCheckbox.addEventListener("change", () =>
				{
					item.querySelectorAll(".file-checkbox").forEach((checkbox: HTMLInputElement) =>
					{
						checkbox.checked = newCheckbox.checked;
						checkbox.classList.toggle("checked", newCheckbox.checked);
					});

					this.container?.querySelectorAll(".file-checkbox").forEach((checkbox: HTMLInputElement) =>
					{
						if(!checkbox.checked)
						{
							let uncheckedChildren = checkbox.parentElement?.parentElement?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");
							if (uncheckedChildren?.length == 0) 
							{
								checkbox.checked = true;
								checkbox.classList.toggle("checked", checkbox.checked);
							}
						}
						else
						{
							let uncheckedChildren = checkbox.parentElement?.parentElement?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");
							if (uncheckedChildren?.length ?? 0 > 0) 
							{
								checkbox.checked = false;
								checkbox.classList.toggle("checked", checkbox.checked);
							}
						}
					});
				});
				contents.insertAdjacentElement("afterbegin", newCheckbox);
			}

			if(icon)
			{
				let This = this;
				icon.addEventListener("click", function()
				{
					let parent = this.parentElement?.parentElement;
					if (parent) 
					{
						This.toggleTreeCollapsed(parent);
					}
				});
			}
		});


		container.querySelectorAll(".mod-tree-file .tree-item-link").forEach((link: HTMLElement) =>
		{
			link.addEventListener("click", (event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				
				console.log("clicked");
				let checkbox = link.parentElement?.querySelector(".file-checkbox") as HTMLInputElement;
				if (checkbox) 
				{
					checkbox.click();
				}
			});
		});
	}

	public getSelectedFiles(): TFile[]
	{
		let selectedFiles: TFile[] = [];

		this.container?.querySelectorAll(".file-checkbox").forEach((checkbox: HTMLInputElement) =>
		{
			if (checkbox.checked)
			{
				let path = checkbox.parentElement?.querySelector(".tree-item-link")?.getAttribute("href")?.replaceAll(".html", ".md");
				if (path)
				{
					let file = HTMLExportPlugin.plugin.app.vault.getAbstractFileByPath(path);
					if (file instanceof TFile) selectedFiles.push(file);
				}
			}
		});

		return selectedFiles;
	}

	public setSelectedFiles(files: Path[])
	{
		let stringfiles = files.map(f => f.makeUnixStyle().asString);

		this.container?.querySelectorAll(".file-checkbox").forEach((checkbox: HTMLInputElement) =>
		{
			let path = checkbox.parentElement?.querySelector(".tree-item-link")?.getAttribute("href");
			if (path)
			{
				checkbox.checked = stringfiles.includes(new Path(path).makeUnixStyle().asString.replaceAll(".html", ".md"));
				checkbox.classList.toggle("checked", checkbox.checked);
			}
		});

		this.container?.querySelectorAll(".file-checkbox").forEach((checkbox: HTMLInputElement) =>
		{
			if(!checkbox.checked)
			{
				let uncheckedChildren = checkbox.parentElement?.parentElement?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");
				if (uncheckedChildren?.length == 0) 
				{
					checkbox.checked = true;
					checkbox.classList.toggle("checked", checkbox.checked);
				}
			}
			else
			{
				let uncheckedChildren = checkbox.parentElement?.parentElement?.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");
				if (uncheckedChildren?.length ?? 0 > 0) 
				{
					checkbox.checked = false;
					checkbox.classList.toggle("checked", checkbox.checked);
				}
			}
		});
	}
}
