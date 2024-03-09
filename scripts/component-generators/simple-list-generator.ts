import { getIcon } from "obsidian";
import { ComponentGenerator } from "./component-generator";
import { MarkdownRendererAPI } from "scripts/render-api/render-api";

export class SimpleFileListGenerator implements ComponentGenerator
{
	public items: string[];
	public options: {icons?: string[] | string, renderAsMarkdown?: boolean, title?: string};

	constructor(items: string[], options: {icons?: string[] | string, renderAsMarkdown?: boolean, title?: string})
	{
		this.items = items;
		this.options = options;
	}

	insert(container: HTMLElement): HTMLElement 
	{
		let listWrapperEl = container.createDiv("file-list-wrapper");
		let titleEl = listWrapperEl.createDiv("file-list-title");
		if (this.options.title) titleEl.setText(this.options.title);
		let listContainerEl = listWrapperEl.createDiv("file-list");

		let i = 0;
		for (let item of this.items)
		{
			let itemEl = listContainerEl.createDiv("file-list-item");

			if (this.options.icons)
			{
				let icon = this.options.icons instanceof Array ? this.options.icons[i] : this.options.icons;
				let iconEl = getIcon(icon);

				if (iconEl)
				{
					iconEl.addClass("file-list-item-icon");
					itemEl.appendChild(iconEl);
				}
			}

			let itemTitleEl = itemEl.createDiv("file-list-item-title");

			if (this.options.renderAsMarkdown)
			{
				MarkdownRendererAPI.renderMarkdownSimpleEl(item, itemTitleEl);
			}
			else
			{
				itemTitleEl.setText(item);
			}
		
			i++;
		}

		return listWrapperEl;
	}

}
