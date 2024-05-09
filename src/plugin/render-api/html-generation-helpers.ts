import { EmojiStyle, Settings } from "plugin/settings/settings";
import { AssetHandler } from "plugin/asset-loaders/asset-handler";
import { ExportLog } from "plugin/render-api/render-api";
import { getIcon as getObsidianIcon, requestUrl } from "obsidian";
import { Utils } from "plugin/utils/utils";
import { ObsidianStyles } from "plugin/asset-loaders/obsidian-styles";
import { AssetType } from "plugin/asset-loaders/asset-types";

export namespace HTMLGeneration
{
	export function createThemeToggle(container: HTMLElement) : HTMLElement
	{
		const label = container.createEl("label");
		const input = label.createEl("input");
		const div = label.createDiv();

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

		const bodyClasses = Array.from(document.body.classList);

		let validClasses = "";
		validClasses += " publish ";
		validClasses += " css-settings-manager ";
		
		// keep body classes that are referenced in the styles
		const styles = AssetHandler.getAssetsOfType(AssetType.Style);
		let i = 0;
		let classes: string[] = [];

		for (const style of styles)
		{
			ExportLog.progress(i / styles.length, "Compiling css classes", "Scanning: " + style.filename, "var(--color-yellow)");
			if (typeof(style.data) != "string") continue;
			
			// this matches every class name with the dot
			const matches = Array.from(style.data.matchAll(/\.([A-Za-z_-]+[\w-]+)/g));
			let styleClasses = matches.map(match => match[0].substring(1).trim());
			// remove duplicates
			styleClasses = styleClasses.filter((value, index, self) => self.indexOf(value) === index);
			classes = classes.concat(styleClasses);
			i++;
			await Utils.delay(0);
		}

		// remove duplicates
		ExportLog.progress(1, "Filtering classes", "...", "var(--color-yellow)");
		classes = classes.filter((value, index, self) => self.indexOf(value) === index);
		ExportLog.progress(1, "Sorting classes", "...", "var(--color-yellow)");
		classes = classes.sort();

		i = 0;
		for (const bodyClass of bodyClasses)
		{
			ExportLog.progress(i / bodyClasses.length, "Collecting valid classes", "Scanning: " + bodyClass, "var(--color-yellow)");

			if (classes.includes(bodyClass))
			{
				validClasses += bodyClass + " ";
			}

			i++;
		}

		ExportLog.progress(1, "Cleanup classes", "...", "var(--color-yellow)");
		_validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		ExportLog.progress(1, "Filter duplicate classes", _validBodyClasses.length + " classes", "var(--color-yellow)");
		_validBodyClasses = _validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();
		
		ExportLog.progress(1, "Classes done", "...", "var(--color-yellow)");

		return _validBodyClasses;
	}

	export function getLucideIcon(iconName: string): string | undefined
	{
		const iconEl = getObsidianIcon(iconName);
		if (iconEl)
		{
			const svg = iconEl.outerHTML;
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
		const iconCodeInt = parseInt(iconCode, 16);
		if (!isNaN(iconCodeInt)) 
		{
			return String.fromCodePoint(iconCodeInt);
		} 
		else 
		{
			return undefined;
		}
	}

	export async function getIcon(iconName: string): Promise<string>
	{
		if (iconName.startsWith('emoji//'))
		{
			const iconCode = iconName.replace(/^emoji\/\//, '');
			iconName = getEmojiIcon(iconCode) ?? "�";
		}
		else if (iconName.startsWith('lucide//'))
		{
			const lucideIconName = iconName.replace(/^lucide\/\//, '');
			iconName = getLucideIcon(lucideIconName) ?? "�";
		}

		// if it's an emoji convert it into a twemoji
		if ((/^\p{Emoji}/gu).test(iconName))
		{
			const codepoint = [...iconName].map(e => e.codePointAt(0)!.toString(16)).join(`-`);

			switch (Settings.emojiStyle)
			{
				case EmojiStyle.Twemoji:
					return `<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codepoint}.svg" class="emoji" />`;
				case EmojiStyle.OpenMoji:
					return `<img src="https://openmoji.org/data/color/svg/${codepoint.toUpperCase()}.svg" class="emoji" />`;
				case EmojiStyle.OpenMojiOutline:
					const req = await requestUrl(`https://openmoji.org/data/black/svg/${codepoint.toUpperCase()}.svg`);
					if (req.status == 200)
						return req.text.replaceAll(/#00+/g, "currentColor").replaceAll(`stroke-width="2"`, `stroke-width="5"`);
			
					return iconName;
				case EmojiStyle.FluentUI:
					return `<img src="https://emoji.fluent-cdn.com/1.0.0/100x100/${codepoint}.png" class="emoji" />`;
				default:
					return iconName;
			}
		}

		return getLucideIcon(iconName.toLowerCase()) ?? iconName; // try and parse a plain lucide icon name
	}
	
}
