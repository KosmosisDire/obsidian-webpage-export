import { TAbstractFile, TFile, TFolder, getIcon as getObsidianIcon } from "obsidian";
import { FolderData } from "@shared/types";
import { MarkdownRendererAPI } from "../renderer/renderer";

// ─── Low-level icon resolution ───────────────────────────────────────────────

function getLucideIcon(name: string): string | undefined {
	const el = getObsidianIcon(name);
	if (!el) return undefined;
	const svg = el.outerHTML;
	el.remove();
	return svg;
}

/**
 * Converts an icon property string into rendered HTML (SVG or emoji).
 *
 * Supported formats:
 *   - "lucide//icon-name"  → Obsidian's built-in lucide SVG
 *   - "emoji//1F4D6"       → Unicode emoji from hex codepoint
 *   - Plain lucide name    → tries getObsidianIcon as fallback
 *   - Raw emoji character  → passed through as-is
 *   - Iconize identifier-wrapped name (e.g. ":LiFile:")
 */
export function resolveIcon(iconProperty: string): string {
	if (!iconProperty) return "";

	// lucide// prefix
	if (iconProperty.startsWith("lucide//")) {
		const name = iconProperty.slice("lucide//".length);
		return getLucideIcon(name) ?? "";
	}

	// emoji// prefix (hex codepoint)
	if (iconProperty.startsWith("emoji//")) {
		const code = iconProperty.slice("emoji//".length);
		const codeInt = parseInt(code, 16);
		return !isNaN(codeInt) ? String.fromCodePoint(codeInt) : "";
	}

	// Already an emoji character — pass through
	if (/^\p{Emoji}/u.test(iconProperty)) {
		return iconProperty;
	}

	// Try as a plain lucide icon name
	return getLucideIcon(iconProperty.toLowerCase()) ?? "";
}

// ─── Iconize (obsidian-icon-folder) plugin support ───────────────────────────

function getIconizeData(): any | null {
	//@ts-ignore
	if (!app?.plugins?.enabledPlugins?.has("obsidian-icon-folder")) return null;
	//@ts-ignore
	return app.plugins.plugins["obsidian-icon-folder"]?.data ?? null;
}

/**
 * Tries to get an icon from the Iconize plugin for a given file/folder path.
 * Returns rendered SVG/emoji, or empty string if not found.
 */
function getIconFromIconize(path: string): string {
	const data = getIconizeData();
	if (!data) return "";

	const noteIconsEnabled = data.settings?.iconsInNotesEnabled ?? false;
	if (!noteIconsEnabled) return "";

	const iconIdentifier = data.settings?.iconIdentifier ?? ":";
	let iconProp = data[path];

	// iconProp can be a string or an object with iconName
	if (iconProp && typeof iconProp !== "string") {
		iconProp = iconProp.iconName ?? "";
	}

	if (!iconProp || typeof iconProp !== "string" || !iconProp.trim()) return "";

	// Check if it's an emoji
	const emojiMatch = iconProp.trim().match(/\p{Emoji}/u);
	if (emojiMatch && emojiMatch.length === 1 && emojiMatch.index === 0) {
		return iconProp;
	}

	// It's an icon name — wrap with identifier and try to resolve
	// Iconize uses formats like "LiFile" (Lucide), "SiGithub" (SimpleIcons), etc.
	// Try resolving as lucide first (strip "Li" prefix if present)
	const trimmed = iconProp.trim();
	if (trimmed.startsWith("Li")) {
		// Convert PascalCase to kebab-case for lucide: "LiFileText" → "file-text"
		const lucideName = trimmed.slice(2).replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
		const svg = getLucideIcon(lucideName);
		if (svg) return svg;
	}

	// Try the raw name as a lucide icon
	const svg = getLucideIcon(trimmed.toLowerCase());
	if (svg) return svg;

	// Fall back to identifier-wrapped string (rendered by Iconize's CSS on the client)
	return `${iconIdentifier}${trimmed}${iconIdentifier}`;
}

// ─── High-level: get icon for a file or folder ──────────────────────────────

/**
 * Gets the icon for a file from frontmatter, then Iconize plugin as fallback.
 */
export function getIconForFile(file: TAbstractFile): string {
	if (file instanceof TFile) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		const fmIcon = fm?.icon ?? fm?.sticker ?? fm?.banner_icon;
		if (fmIcon) {
			const resolved = resolveIcon(fmIcon);
			if (resolved) return resolved;
		}
	}

	// Try Iconize plugin
	const iconizeIcon = getIconFromIconize(file.path);
	if (iconizeIcon) return iconizeIcon;

	return "";
}

/**
 * Gets the icon string from frontmatter properties.
 * Used when you already have the frontmatter object (e.g. during file processing).
 */
export function getIconFromFrontmatter(frontmatter: any): string {
	const iconProp: string | undefined =
		frontmatter?.icon ?? frontmatter?.sticker ?? frontmatter?.banner_icon;
	if (!iconProp) return "";
	return resolveIcon(iconProp);
}

// ─── Display title ───────────────────────────────────────────────────────────

/**
 * Gets the display title for a file.
 * Uses frontmatter `title` if present, otherwise falls back to basename.
 */
export function getDisplayTitle(basename: string, frontmatter: any): string {
	const fmTitle = frontmatter?.title;
	if (fmTitle && typeof fmTitle === "string") return fmTitle;
	return basename;
}

// ─── Folder metadata collection ──────────────────────────────────────────────

/**
 * Collects folder metadata from the vault.
 * Checks folder note frontmatter and Iconize plugin for icons/titles.
 */
export async function collectFolderMetadata(folders: TFolder[], webPathMapping: Record<string, string>): Promise<Record<string, FolderData>> {
	const result: Record<string, FolderData> = {};

	for (const folder of folders) {
		let icon = "";
		let title = folder.name;

		// Check for a "folder note" — a .md file with the same name as the folder
		const folderNote = folder.children.find(
			(child): child is TFile =>
				child instanceof TFile && child.basename === folder.name
		);

		if (folderNote) {
			const cache = app.metadataCache.getFileCache(folderNote);
			const fm = cache?.frontmatter;
			if (fm) {
				icon = getIconFromFrontmatter(fm);
				const fmTitle = fm.title;
				if (fmTitle && typeof fmTitle === "string") title = fmTitle;
			}
		}

		// Try Iconize plugin if no icon from frontmatter
		if (!icon) {
			icon = getIconFromIconize(folder.path);
		}

		// Pass through markdown renderer so plugins like Iconize resolve their identifiers
		if (icon) {
			icon = await MarkdownRendererAPI.renderMarkdownSimple(icon) ?? icon;
		}

		const webPath = webPathMapping[folder.path];
		result[webPath] = { path: webPath, title, icon };
	}

	return result;
}
