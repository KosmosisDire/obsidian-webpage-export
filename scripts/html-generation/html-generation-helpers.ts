import { Settings } from "scripts/settings/settings";
import { AssetHandler } from "./asset-handler";
import { AssetType } from "./assets/asset";
import { RenderLog } from "./render-log";
import { getIcon as getObsidianIcon } from "obsidian";

export namespace HTMLGeneration
{
	export const arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";

	export function makeHeadingsTrees(html: HTMLElement)
	{
		// make headers into format:
		/*
		- .heading-wrapper
			- h1.heading
				- .heading-before
				- .heading-collapse-indicator.collapse-indicator.collapse-icon
				- "Text"
				- .heading-after
			- .heading-children
		*/

		function getHeaderEl(headingContainer: HTMLDivElement)
		{
			let first = headingContainer.firstElementChild;
			if (first && /[Hh][1-6]/g.test(first.tagName)) return first;
			else return;
		}
		
		function makeHeaderTree(headerDiv: HTMLDivElement, childrenContainer: HTMLElement)
		{
			let headerEl = getHeaderEl(headerDiv);

			if (!headerEl) return;

			let possibleChild = headerDiv.nextElementSibling;

			while (possibleChild != null)
			{
				let possibleChildHeader = getHeaderEl(possibleChild as HTMLDivElement);

				if(possibleChildHeader)
				{
					// if header is a sibling of this header then break
					if (possibleChildHeader.tagName <= headerEl.tagName)
					{
						break;
					}

					// if we reached the footer then break
					if (possibleChildHeader.querySelector(":has(section.footnotes)") || possibleChildHeader.classList.contains("mod-footer"))
					{
						break;
					}
				}

				let nextEl = possibleChild.nextElementSibling;
				childrenContainer.appendChild(possibleChild);
				possibleChild = nextEl;
			}
		}

		html.querySelectorAll("div:has(> :is(h1, h2, h3, h4, h5, h6)):not(.markdown-preview-sizer)").forEach(function (header: HTMLDivElement)
		{
			header.classList.add("heading-wrapper");

			// header.createEl("div", { cls: "heading-wrapper-span" }); 
			// the heading wrapper span is as wide as the whole screen, but has the same height and position as the heading wrapper
			// this is used for vertical hover effects
			// disabled because it is not being used

			let hEl = getHeaderEl(header) as HTMLHeadingElement;

			if (!hEl || hEl.classList.contains("heading")) return;

			hEl.classList.add("heading");

			let collapseIcon = hEl.querySelector(".heading-collapse-indicator");
			if (!collapseIcon)
			{
				collapseIcon = hEl.createDiv({ cls: "heading-collapse-indicator collapse-indicator collapse-icon" });
				collapseIcon.innerHTML = arrowHTML;
				hEl.prepend(collapseIcon);
			}

			if (!hEl.querySelector(".heading-after")) 
			{
				let afterEl = hEl.createDiv({ cls: "heading-after" });
				afterEl.textContent = "...";
			}

			// the before element is for future styling
			if (!hEl.querySelector(".heading-before")) 
			{
				let beforeEl = hEl.createDiv({ cls: "heading-before" });
				hEl.prepend(beforeEl);
				beforeEl.textContent = "";
			}

			let children = header.createDiv({ cls: "heading-children" });

			makeHeaderTree(header, children);
		});

		// add "heading" class to all headers that don't have it
		html.querySelectorAll(":is(h1, h2, h3, h4, h5, h6):not(.heading)").forEach((el) => el.classList.add("heading"));

		// remove collapsible arrows from h1 and inline titles
		html.querySelectorAll("div h1, div .inline-title").forEach((element) =>
		{
			element.querySelector(".heading-collapse-indicator")?.remove();
		});

		// remove all new lines from header elements which cause spacing issues
		html.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", ""));
	}

	export function createThemeToggle(container: HTMLElement) : HTMLElement
	{
		let toggle = container.createDiv();
		let label = toggle.createEl("label");
		let input = label.createEl("input");
		let div = label.createDiv();

		label.classList.add("theme-toggle-container");
		label.setAttribute("for", "theme_toggle");

		input.classList.add("theme-toggle-input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");

		div.classList.add("toggle-background");

		return toggle;
	}

	let _validBodyClasses: string | undefined = undefined;
	export function getValidBodyClasses(cleanCache: boolean): string
	{
		if (cleanCache) _validBodyClasses = undefined;
		if (_validBodyClasses) return _validBodyClasses;

		let bodyClasses = document.body.classList;
		let validClasses = "";

		if (Settings.settings.sidebarsAlwaysCollapsible) validClasses += " sidebars-always-collapsible ";
		if (Settings.settings.inlineAssets) validClasses += " inlined-assets ";
		validClasses += " loading ";
		
		// keep body classes that are referenced in the styles
		for (var style of AssetHandler.getAssetsOfType(AssetType.Style))
		{
			if (typeof(style.content) != "string") continue;
			
			// this matches every class name with the dot
			let matches = style.content.matchAll(/(?![0-9].*$)\.(?!cm.*$)(?![0-9].*$)[^ ͼ\>\+\{\(\,\.\[\)\:\;\/]{1,}/gm);
			for (var match of matches)
			{
				let className = match[0].replace(".", "").trim();
				if (bodyClasses.contains(className)) validClasses += " " + className + " ";
			}
		}

		_validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		_validBodyClasses = _validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();

		RenderLog.log("Body classes: " + _validBodyClasses);
		
		return _validBodyClasses;
	}

	export function getLucideIcon(iconName: string): string
	{
		const iconEl = getObsidianIcon(iconName);
		if (iconEl)
		{
			let svg = iconEl.outerHTML;
			iconEl.remove();
			return svg;
		}
		else 
		{
			console.error(`Invalid lucide icon name: ${iconName}`);
			return "�";
		}
	}

	export function getEmojiIcon(iconCode: string): string
	{
		let iconCodeInt = parseInt(iconCode, 16);
		if (!isNaN(iconCodeInt)) 
		{
			return String.fromCodePoint(iconCodeInt);
		} 
		else 
		{
			console.error(`Invalid sticker number in frontmatter: ${iconCode}`);
			return '�';
		}
	}

	export function getIcon(iconName: string): string
	{
		if (iconName.startsWith('emoji//'))
		{
			const iconCode = iconName.replace(/^emoji\/\//, '');
			return getEmojiIcon(iconCode);
		}
		else if (iconName.startsWith('lucide//'))
		{
			const lucideIconName = iconName.replace(/^lucide\/\//, '');
			return getLucideIcon(lucideIconName);
		}

		return iconName;
	}
	
}
