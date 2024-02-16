import { EmojiStyle, Settings, SettingsPage } from "scripts/settings/settings";
import { AssetHandler } from "./asset-handler";
import { AssetType } from "./assets/asset";
import { ExportLog } from "./render-log";
import { getIcon as getObsidianIcon, requestUrl } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { ObsidianStyles } from "./assets/obsidian-styles";

export namespace HTMLGeneration
{
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
			ExportLog.progress(i, styles.length, "Compiling css classes", "Scanning: " + style.filename, "var(--color-yellow)");
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
		ExportLog.progress(1, 1, "Filtering classes", "...", "var(--color-yellow)");
		classes = classes.filter((value, index, self) => self.indexOf(value) === index);
		ExportLog.progress(1, 1, "Sorting classes", "...", "var(--color-yellow)");
		classes = classes.sort();

		i = 0;
		for (var bodyClass of bodyClasses)
		{
			ExportLog.progress(i, bodyClasses.length, "Collecting valid classes", "Scanning: " + bodyClass, "var(--color-yellow)");

			if (classes.includes(bodyClass))
			{
				validClasses += bodyClass + " ";
			}

			i++;
		}

		ExportLog.progress(1, 1, "Cleanup classes", "...", "var(--color-yellow)");
		_validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		ExportLog.progress(1, 1, "Filter duplicate classes", _validBodyClasses.length + " classes", "var(--color-yellow)");
		_validBodyClasses = _validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();
		
		ExportLog.progress(1, 1, "Classes done", "...", "var(--color-yellow)");

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
			let codepoint = [...iconName].map(e => e.codePointAt(0)!.toString(16)).join(`-`);

			switch (Settings.emojiStyle)
			{
				case EmojiStyle.Twemoji:
					return `<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codepoint}.svg" class="emoji" />`;
				case EmojiStyle.OpenMoji:
					console.log(codepoint);
					return `<img src="https://openmoji.org/data/color/svg/${codepoint.toUpperCase()}.svg" class="emoji" />`;
				case EmojiStyle.OpenMojiOutline:
					let req = await requestUrl(`https://openmoji.org/data/black/svg/${codepoint.toUpperCase()}.svg`);
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
