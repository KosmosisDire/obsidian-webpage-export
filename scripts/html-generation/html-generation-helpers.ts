import { SettingsPage } from "scripts/settings/settings";
import { AssetHandler } from "./asset-handler";
import { AssetType } from "./assets/asset";
import { RenderLog } from "./render-log";
import { getIcon as getObsidianIcon } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { ObsidianStyles } from "./assets/obsidian-styles";

export namespace HTMLGeneration
{
	export const arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";

	export function makeHeadingsTrees(html: HTMLElement)
	{
		// make headers into format:
		/*
		- .heading-wrapper
			- h1.heading
				- .heading-collapse-indicator.collapse-indicator.collapse-icon
				- "Text"
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

		html.querySelectorAll("div:has(> :is(h1, h2, h3, h4, h5, h6):not([class^='block-language-'] *)):not(.markdown-preview-sizer)").forEach(function (header: HTMLDivElement)
		{
			header.classList.add("heading-wrapper");

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
		let label = container.createEl("label");
		let input = label.createEl("input");
		let div = label.createDiv();

		label.classList.add("theme-toggle-container");
		label.setAttribute("for", "theme_toggle");

		input.classList.add("theme-toggle-input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");

		div.classList.add("toggle-background");

		return label;
	}

	let _validBodyClasses: string | undefined = undefined;
	export async function getValidBodyClasses(cleanCache: boolean): Promise<string>
	{
		if (cleanCache) _validBodyClasses = undefined;
		if (_validBodyClasses) return _validBodyClasses;

		let bodyClasses = Array.from(document.body.classList);
		// filter classes
		bodyClasses = bodyClasses.filter((value) => 
			ObsidianStyles.stylesKeep.some(keep => value.includes(keep)) || 
			!ObsidianStyles.stylesFilter.some(filter => value.includes(filter))
		);

		let validClasses = "";
		validClasses += " publish ";
		validClasses += " css-settings-manager ";
		
		// keep body classes that are referenced in the styles
		let styles = AssetHandler.getAssetsOfType(AssetType.Style);
		let i = 0;
		let classes: string[] = [];

		for (var style of styles)
		{
			RenderLog.progress(i, styles.length, "Compiling css classes", "Scanning: " + style.filename, "var(--color-yellow)");
			if (typeof(style.content) != "string") continue;
			
			// this matches every class name with the dot
			let matches = Array.from(style.content.matchAll(/\.([A-Za-z_-]+[\w-]+)/g));
			let styleClasses = matches.map(match => match[0].substring(1).trim());
			// remove duplicates
			styleClasses = styleClasses.filter((value, index, self) => self.indexOf(value) === index);
			classes = classes.concat(styleClasses);
			i++;
			await Utils.delay(0);
		}

		// remove duplicates
		RenderLog.progress(1, 1, "Filtering classes", "...", "var(--color-yellow)");
		classes = classes.filter((value, index, self) => self.indexOf(value) === index);
		RenderLog.progress(1, 1, "Sorting classes", "...", "var(--color-yellow)");
		classes = classes.sort();

		i = 0;
		for (var bodyClass of bodyClasses)
		{
			RenderLog.progress(i, bodyClasses.length, "Collecting valid classes", "Scanning: " + bodyClass, "var(--color-yellow)");

			if (classes.includes(bodyClass))
			{
				validClasses += bodyClass + " ";
			}

			i++;
		}

		RenderLog.progress(1, 1, "Cleanup classes", "...", "var(--color-yellow)");
		_validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		RenderLog.progress(1, 1, "Filter duplicate classes", _validBodyClasses.length + " classes", "var(--color-yellow)");
		_validBodyClasses = _validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();
		
		RenderLog.progress(1, 1, "Classes done", "...", "var(--color-yellow)");

		return _validBodyClasses;
	}

	export function getLucideIcon(iconName: string): string | undefined
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
			return undefined;
		}
	}

	export function getEmojiIcon(iconCode: string): string | undefined
	{
		let iconCodeInt = parseInt(iconCode, 16);
		if (!isNaN(iconCodeInt)) 
		{
			return String.fromCodePoint(iconCodeInt);
		} 
		else 
		{
			return undefined;
		}
	}

	export function getIcon(iconName: string): string
	{
		if (iconName.startsWith('emoji//'))
		{
			const iconCode = iconName.replace(/^emoji\/\//, '');
			return getEmojiIcon(iconCode) ?? "�";
		}
		else if (iconName.startsWith('lucide//'))
		{
			const lucideIconName = iconName.replace(/^lucide\/\//, '');
			return getLucideIcon(lucideIconName) ?? "�";
		}

		return getLucideIcon(iconName) ?? iconName; // try and parse a plain lucide icon name
	}
	
}
