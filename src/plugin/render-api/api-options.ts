import { InsertedFeatureOptions, GraphViewOptions, SidebarOptions, FileNavigationOptions, OutlineOptions, FetchedFeatureOptions, EmojiStyle, FileOptions, PropertiesOptions, TagsOptions } from "shared/website-data";
import { DEFAULT_MARKDOWN_RENDERER_API_OPTIONS, DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS } from "./api-options-defaults";

/**
 * General options for the MarkdownRendererAPI
 */
export class MarkdownRendererAPIOptions
{
	/**
	 * The container to render the HTML into.
	 */
	container: HTMLElement | undefined = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.container;

	/**
	 * Create a .document container element.
	 */
	createDocumentContainer: boolean = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.createDocumentContainer;

	/**
	 * Convert the headers into a tree structure with all children of a header being in their own container.
	 */
	makeHeadersTrees: boolean = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.makeHeadersTrees;

	/**
	 * Run post processing on the html to clean up various obsidian specific elements.
	 */
	postProcess: boolean = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.postProcess;

	/**
	 * Display a window with a log and progress bar.
	 */
	displayProgress: boolean = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.displayProgress;

	/**
	 * Inline / embed other HTML directly into the HTML.
	 */
	inlineHTML: boolean = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.inlineHTML;

	/**
	 * The path to export the files to.
	 */
	exportPath: string = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.exportPath;
	
	/**
	 * A list of files to export. If empty, all files will be exported.
	 */
	filesToExport: string[] = DEFAULT_MARKDOWN_RENDERER_API_OPTIONS.filesToExport;
}

/**
 * Options for the MarkdownWebpageRendererAPI when export a webpage object.
 */
export class MarkdownWebpageRendererAPIOptions extends MarkdownRendererAPIOptions
{
	// Features that can be toggled on or off

	/**
	 * Transfer body classes from obsidian to the exported document.
	 */
	addBodyClasses: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.addBodyClasses;

	/**
	 * Add mathjax styles to the document
	 */
	addMathjaxStyles: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.addMathjaxStyles;

	/**
	 * Add a <head> tag with metadata, scripts, and styles.
	 */
	addHeadTag: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.addHeadTag;

	/**
	 * Create an RSS feed for the site
	 */
	addRSS: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.addRSS;

	/**
	 * Add a title to the top of each page. (Makes sure there are no duplicate titles)
	 */
	addTitle: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.addTitle;

	// Options for the features
	/**
	 * The options for the backlinks feature.
	 */
	backlinkOptions: InsertedFeatureOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.backlinkOptions;

	/**
	 * The options for the tags feature.
	 */
	tagOptions: TagsOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.tagOptions;

	/**
	 * The options for the aliases feature.
	 */
	aliasOptions: InsertedFeatureOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.aliasOptions;

	/**
	 * The options for the properties feature.
	 */
	propertiesOptions: PropertiesOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.propertiesOptions;

	/**
	 * The options for the file navigation feature.
	 */
	fileNavigationOptions: FileNavigationOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.fileNavigationOptions;

	/**
	 * The options for the search feature.
	 */
	searchOptions: InsertedFeatureOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.searchOptions;

	/**
	 * The options for the outline feature.
	 */
	outlineOptions: OutlineOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.outlineOptions;

	/**
	 * The options for the theme toggle feature.
	 */
	themeToggleOptions: InsertedFeatureOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.themeToggleOptions;

	/**
	 * The options for the graph view feature.
	 */
	graphViewOptions: GraphViewOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.graphViewOptions;

	/**
	 * The options for the sidebar feature.
	 */
	sidebarOptions: SidebarOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.sidebarOptions;

	/**
	 * Custom head content options
	 */
	customHead: FetchedFeatureOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.customHead;

	/**
	 * Document section options
	 */
	fileOptions: FileOptions = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.fileOptions;

	/**
	 * Make outline links relative instead of absolute.
	 * This will break the ability to copy the header links from the outline
	 * But allows you to move the file and still have the links work.
	 */
	relativeHeaderLinks: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.relativeHeaderLinks;

	/**
	 * Include javascript in the export (both inline or external)
	 */
	includeJS: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.includeJS;

	/**
	 * Include CSS in the export (both inline or external)
	 */
	includeCSS: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.includeCSS;

	/**
	 * Inline / embed media items (images, video, audio) directly into the HTML.
	 */
	inlineMedia: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.inlineMedia;

	/**
	 * Inline / embed the css styles directly into the HTML.
	 */
	inlineCSS: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.inlineCSS;

	/**
	 * Inline / embed the javascript directly into the HTML.
	 */
	inlineJS: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.inlineJS;

	/**
	 * Inline / embed fonts directly into the HTML.
	 */
	inlineFonts: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.inlineFonts;

	/**
	 * Inline / embed other files directly into the HTML.
	 */
	inlineOther: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.inlineOther;

	/**
	 * Combine the whole export into a single .html file.
	 */
	combineAsSingleFile: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.combineAsSingleFile;

	/**
	 * Do not leave any online urls, download them and embed them into the HTML.
	 */
	offlineResources: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.offlineResources;

	/**
	 * The name of the theme to use for the export.
	 * If the theme does not exist, the default theme will be used.
	*/
	themeName: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.themeName; 

	/**
	 * Make all paths and file names web style (lowercase, no spaces).
	 * For example: "My File.md" -> "my-file.html"
	 */
	slugifyPaths: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.slugifyPaths;

	/**
	 * Flatten all export paths so that all HTML files are exported to the same root directory without the normal folder structure.
	 */
	flattenExportPaths: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.flattenExportPaths;

	/**
	 * Fix all links to be relative and direct to other files or media included in the export.
	 */
	fixLinks: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.fixLinks;

	/**
	 * The url that this site will be hosted at. This is used for the rss feed data.
	 */
	siteURL: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.siteURL;

	/**
	 * The name of the vault displayed above the file navigation.
	 */
	siteName: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.siteName;
	
	/**
	 * The local path to the favicon for the site.
	 */
	faviconPath: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.faviconPath;

	/**
	 * The local path to the custom head content to embbed on the site.
	 */
	customHeadPath: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.customHeadPath;

	/**
	 * The style of emoji to use for custom icons.
	 */
	iconEmojiStyle: EmojiStyle;

	/**
	 * The name of the author of the site.
	 */
	authorName: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.authorName;

	/**
	 * The relative path in the vault that will be considered the root of the export. Anything outside of this path will either be moved or not included.
	 */
	exportRoot: string = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.exportRoot;

	/**
	 * Include CSS from the plugins with these ids.
	 */
	includePluginCSS: string[] = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.includePluginCSS;

	/**
	 * Include CSS from all svelte components in the export.
	 */
	includeSvelteCSS: boolean = DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS.includeSvelteCSS;
}


