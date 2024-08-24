import { getIcon as getObsidianIcon, requestUrl } from "obsidian";
import { EmojiStyle } from "src/shared/website-data";
import { Settings } from "src/plugin/settings/settings";


export namespace IconHandler
{
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

			switch (Settings.exportOptions.iconEmojiStyle)
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
