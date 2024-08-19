import { AliasesOptions } from "./features/aliases";
import { BacklinksOptions } from "./features/backlinks";
import { CustomHeadOptions } from "./features/custom-head";
import { DocumentOptions } from "./features/document";
import { FileNavigationOptions } from "./features/file-navigation";
import { GraphViewOptions } from "./features/graph-view";
import { OutlineOptions } from "./features/outline";
import { PropertiesOptions } from "./features/properties";
import { SearchOptions } from "./features/search";
import { SidebarOptions } from "./features/sidebar";
import { TagsOptions } from "./features/tags";
import { ThemeToggleOptions } from "./features/theme-toggle";

export enum EmojiStyle
{
	Native = "Native",
	Twemoji = "Twemoji",
	OpenMoji = "OpenMoji",
	OpenMojiOutline = "OpenMojiOutline",
	FluentUI = "FluentUI",
}

export enum DocumentType
{
	Markdown = "markdown",
	Canvas = "canvas",
	Excalidraw = "excalidraw",
	Kanban = "kanban",
	Attachment = "attachment",
	Other = "other"
}

export interface FileData
{
	createdTime: number;
	modifiedTime: number;
	sourceSize: number;
	sourcePath: string;
	exportPath: string;
	showInTree: boolean;
	treeOrder: number;
	backlinks: string[];
	type: string;
	data: string | null;
}

export interface WebpageData extends FileData
{
	headers: {heading: string, level: number, id: string}[];
	aliases: string[];
	inlineTags: string[];
	frontmatterTags: string[];
	links: string[];
	attachments: string[];

	title: string;
	pathToRoot: string;
	icon: string;
	description: string;
	author: string;
	coverImageURL: string;
	fullURL: string;
}

export class WebsiteOptions
{
	/**
	 * The options for the backlinks feature.
	 */
	backlinks: BacklinksOptions;

	/**
	 * The options for the tags feature.
	 */
	tags: TagsOptions;

	/**
	 * The options for the aliases feature.
	 */
	alias: AliasesOptions;

	/**
	 * The options for the properties feature.
	 */
	properties: PropertiesOptions;

	/**
	 * The options for the file navigation feature.
	 */
	fileNavigation: FileNavigationOptions;

	/**
	 * The options for the search feature.
	 */
	search: SearchOptions;

	/**
	 * The options for the outline feature.
	 */
	outline: OutlineOptions;

	/**
	 * The options for the theme toggle feature.
	 */
	themeToggle: ThemeToggleOptions;

	/**
	 * The options for the graph view feature.
	 */
	graphView: GraphViewOptions;

	/**
	 * The options for the sidebar feature.
	 */
	sidebar: SidebarOptions;

	/**
	 * Custom head content options
	 */
	customHead: CustomHeadOptions;

	/**
	 * Document section options
	 */
	document: DocumentOptions;
}

export class WebsiteData
{
	webpages: {[targetPath: string]: WebpageData};
	fileInfo: {[targetPath: string]: FileData};
	sourceToTarget: {[sourcePath: string]: string};
	attachments: string[];
	shownInTree: string[];
	allFiles: string[];

	siteName: string;
	vaultName: string;
	createdTime: number;
	modifiedTime: number;
	pluginVersion: string;
	exportRoot: string;
	baseURL: string;

	themeName: string;
	bodyClasses: string;
	hasFavicon: boolean;
	featureOptions: WebsiteOptions;
}
