import { getIcon } from "obsidian";
import { FeatureGenerator } from "./feature-generator";
import { MarkdownRendererAPI } from "src/plugin/render-api/render-api";

export class SimpleFileListGenerator implements FeatureGenerator
{
	public items: string[];
	public options: {icons?: string[] | string, renderAsMarkdown?: boolean, title?: string};

	constructor(items: string[], options: {icons?: string[] | string, renderAsMarkdown?: boolean, title?: string})
	{
		this.items = items;
		this.options = options;
	}

	async generate(container?: HTMLElement): Promise<HTMLElement> 
	{
		container = container ?? document.body;
		const listWrapperEl = container.createDiv("file-list-wrapper");
		const titleEl = listWrapperEl.createDiv("file-list-title");
		if (this.options.title) titleEl.setText(this.options.title);
		const listContainerEl = listWrapperEl.createDiv("file-list");

		let i = 0;
		for (const item of this.items)
		{
			const itemEl = listContainerEl.createDiv("file-list-item");

			if (this.options.icons)
			{
				const icon = this.options.icons instanceof Array ? this.options.icons[i] : this.options.icons;
				const iconEl = getIcon(icon);

				if (iconEl)
				{
					iconEl.addClass("file-list-item-icon");
					itemEl.appendChild(iconEl);
				}
			}

			const itemTitleEl = itemEl.createDiv("file-list-item-title");

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
