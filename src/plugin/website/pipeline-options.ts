import { BacklinksOptions } from "src/shared/features/backlinks";
import { TagsOptions } from "src/shared/features/tags";
import { AliasesOptions } from "src/shared/features/aliases";
import { PropertiesOptions } from "src/shared/features/properties";
import { FileNavigationOptions } from "src/shared/features/file-navigation";
import { OutlineOptions } from "src/shared/features/outline";
import { ThemeToggleOptions } from "src/shared/features/theme-toggle";
import { GraphViewOptions } from "src/shared/features/graph-view";
import { SidebarOptions } from "src/shared/features/sidebar";
import { DocumentOptions } from "src/shared/features/document";
import { EmojiStyle } from "src/shared/website-data";
import { SearchOptions } from "src/shared/features/search";
import { CustomHeadOptions } from "src/shared/features/custom-head";
import { MarkdownRendererOptions } from "src/plugin/render-api/api-options";
import { RssOptions } from "src/shared/features/rss";
import { LinkPreviewOptions } from "src/shared/features/link-preview";

export class ExportPipelineOptions extends MarkdownRendererOptions
{
	// Features that can be toggled on or off

	/**
	 * Transfer body classes from obsidian to the exported document.
	 */
	addBodyClasses: boolean = true;

	/**
	 * Add mathjax styles to the document
	 */
	addMathjaxStyles: boolean = true;

	/**
	 * Add a <head> tag with metadata, scripts, and styles.
	 */
	addHeadTag: boolean = true;

	// Options for the features
	/**
	 * The options for the backlinks feature.
	 */
	backlinkOptions: BacklinksOptions = new BacklinksOptions();

	/**
	 * The options for the tags feature.
	 */
	tagOptions: TagsOptions = new TagsOptions();

	/**
	 * The options for the aliases feature.
	 */
	aliasOptions: AliasesOptions = new AliasesOptions();

	/**
	 * The options for the properties feature.
	 */
	propertiesOptions: PropertiesOptions = new PropertiesOptions();

	/**
	 * The options for the file navigation feature.
	 */
	fileNavigationOptions: FileNavigationOptions = new FileNavigationOptions();

	/**
	 * The options for the search feature.
	 */
	searchOptions: SearchOptions = new SearchOptions();

	/**
	 * The options for the outline feature.
	 */
	outlineOptions: OutlineOptions = new OutlineOptions();

	/**
	 * The options for the theme toggle feature.
	 */
	themeToggleOptions: ThemeToggleOptions = new ThemeToggleOptions();

	/**
	 * The options for the graph view feature.
	 */
	graphViewOptions: GraphViewOptions = new GraphViewOptions();

	/**
	 * The options for the sidebar feature.
	 */
	sidebarOptions: SidebarOptions = new SidebarOptions();

	/**
	 * Custom head content options
	 */
	customHeadOptions: CustomHeadOptions = new CustomHeadOptions();

	/**
	 * Document section options
	 */
	documentOptions: DocumentOptions = new DocumentOptions();

	/**
	 * Document section options
	 */
	rssOptions: RssOptions = new RssOptions();

	/**
	 * The options for the link preview feature.
	 */
	linkPreviewOptions: LinkPreviewOptions = new LinkPreviewOptions();

	/**
	 * Make outline links relative instead of absolute.
	 * This will break the ability to copy the header links from the outline
	 * But allows you to move the file and still have the links work.
	 */
	relativeHeaderLinks: boolean = false;

	/**
	 * Include javascript in the export (both inline or external)
	 */
	includeJS: boolean = true;

	/**
	 * Include CSS in the export (both inline or external)
	 */
	includeCSS: boolean = true;

	/**
	 * Inline / embed media items (images, video, audio) directly into the HTML.
	 */
	inlineMedia: boolean = false;

	/**
	 * Inline / embed the css styles directly into the HTML.
	 */
	inlineCSS: boolean = false;

	/**
	 * Inline / embed the javascript directly into the HTML.
	 */
	inlineJS: boolean = false;

	/**
	 * Inline / embed fonts directly into the HTML.
	 */
	inlineFonts: boolean = false;

	/**
	 * Inline / embed other files directly into the HTML.
	 */
	inlineOther: boolean = false;

	/**
	 * Combine the whole export into a single .html file.
	 */
	combineAsSingleFile: boolean = false;

	/**
	 * Do not leave any online urls, download them and embed them into the HTML.
	 */
	offlineResources: boolean = false;

	/**
	 * The name of the theme to use for the export.
	 * If the theme does not exist, the default theme will be used.
	*/
	themeName: string =  "";

	/**
	 * Make all paths and file names web style (lowercase, no spaces).
	 * For example: "My File.md" -> "my-file.html"
	 */
	slugifyPaths: boolean = true;

	/**
	 * Flatten all export paths so that all HTML files are exported to the same root directory without the normal folder structure.
	 */
	flattenExportPaths: boolean = false;

	/**
	 * Fix all links to be relative and direct to other files or media included in the export.
	 */
	fixLinks: boolean = true;
	
	/**
	 * The local path to the favicon for the site.
	 */
	faviconPath: string = '';

	/**
	 * The name of the site.
	 */
	siteName: string = app?.vault?.getName() ?? '';

	/**
	 * The style of emoji to use for custom icons.
	 */
	iconEmojiStyle: EmojiStyle = EmojiStyle.Native;

	/**
	 * The relative path in the vault that will be considered the root of the export. Anything outside of this path will either be moved or not included.
	 */
	exportRoot: string = '';

	/**
	 * Include CSS from the plugins with these ids.
	 */
	includePluginCss: string[] = [];

	/**
	 * Include CSS from the style elements with these ids.
	 */
	includeStyleCssIds: string[] = [];

	/**
	 * Auto dispose webpage documents and elements after each one is rendered.
	 */
	autoDisposeWebpages: boolean = true;

	/**
	 * Reconstructs feature option instances to ensure constructor-set properties are preserved
	 * after loading from JSON. This is necessary because deepAssign overwrites instance properties.
	 */
	reconstructFeatureOptions(): void {
		// Iterate through all properties of this instance
		for (const [propertyName, propertyValue] of Object.entries(this)) {
			// Check if this property is a feature options instance (has featureId)
			if (propertyValue && 
				typeof propertyValue === 'object' && 
				'featureId' in propertyValue &&
				propertyValue.constructor !== Object) {
				
				// Get the original constructor function
				const ConstructorClass = propertyValue.constructor as new() => any;
				
				// Create a fresh instance with constructor-set defaults
				const freshInstance = new ConstructorClass();
				
				// Apply the loaded JSON data on top of the constructor defaults
				(this as any)[propertyName] = Object.assign(freshInstance, propertyValue);
			}
		}
	}
}


