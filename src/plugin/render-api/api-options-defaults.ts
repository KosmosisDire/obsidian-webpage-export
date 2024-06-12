import { EmojiStyle, FetchedFeatureOptions, FileNavigationOptions, FileOptions, GraphViewOptions, InsertedFeatureOptions, OutlineOptions, PropertiesOptions, RelationType, SidebarOptions, TagsOptions } from "shared/website-data";

export const DEFAULT_SIDEBAR_OPTIONS: SidebarOptions =
{
	enabled: true,
	allowResizing: true,
	allowCollapsing: true,
	rightDefaultWidth: "20em",
	leftDefaultWidth: "20em",
}

export const DEFAULT_GRAPH_VIEW_FEATURE_OPTIONS: GraphViewOptions =
{
	enabled: true,
	displayTitle: "Graph View",
	relationSelector: "#right-sidebar-content",
	relationType: RelationType.Child,
	attractionForce: 1,
	linkLength: 10,
	repulsionForce: 150,
	centralForce: 3,
	edgePruning: 100,
	minNodeRadius: 3,
	maxNodeRadius: 7
}

export const DEFAULT_OUTLINE_OPTIONS: OutlineOptions =
{
	enabled: true,
	displayTitle: "Outline",
	relationSelector: "#right-sidebar-content",
	relationType: RelationType.Child,
	startCollapsed: false,
	minCollapseDepth: 0
}

export const DEFAULT_FILE_NAVIGATION_OPTIONS: FileNavigationOptions =
{
	enabled: true,
	displayTitle: "File Navigation",
	includePath: "lib/html/file-tree.html",
	relationSelector: "#left-sidebar-content",
	relationType: RelationType.Child,
	showDefaultFolderIcons: false,
	showDefaultFileIcons: false,
	defaultFolderIcon: "lucide//folder",
	defaultFileIcon: "lucide//file",
	defaultMediaIcon: "lucide//file-image",
	exposeStartingPath: true
}

export const DEFAULT_FILE_OPTIONS: FileOptions =
{
	allowFoldingHeadings: true,
	allowFoldingLists: true,
	documentWidth: "40em",
}


export const DEFAULT_BACKLINK_OPTIONS: InsertedFeatureOptions =
{
	enabled: true,
	displayTitle: "Backlinks",
	relationSelector: ".footer",
	relationType: RelationType.Child
}

export const DEFAULT_TAG_OPTIONS: TagsOptions =
{
	enabled: true,
	displayTitle: "Tags",
	relationSelector: ".header",
	relationType: RelationType.Child,
	showInlineTags: false,
	showFrontmatterTags: true
}

export const DEFAULT_ALIAS_OPTIONS: InsertedFeatureOptions =
{
	enabled: true,
	displayTitle: "Aliases",
	relationSelector: ".header",
	relationType: RelationType.Child
}

export const DEFAULT_PROPERTIES_OPTIONS: PropertiesOptions =
{
	enabled: true,
	displayTitle: "Properties",
	relationSelector: ".header",
	relationType: RelationType.Child,
	hideProperties: []
}

export const DEFAULT_SEARCH_OPTIONS: InsertedFeatureOptions =	
{
	enabled: true,
	displayTitle: "Search",
	relationSelector: "#left-sidebar-content",
	relationType: RelationType.Child
}

export const DEFAULT_THEME_TOGGLE_OPTIONS: InsertedFeatureOptions =
{
	enabled: true,
	displayTitle: "Theme Toggle",
	relationSelector: "#left-sidebar .topbar-content",
	relationType: RelationType.Child
}

export const DEFAULT_CUSTOM_HEAD_OPTIONS: FetchedFeatureOptions =
{
	enabled: true,
	displayTitle: "Custom Head",
	relationSelector: "head",
	relationType: RelationType.Child,
	includePath: "lib/html/custom-head-content.html"
}

export const DEFAULT_MARKDOWN_RENDERER_API_OPTIONS = 
{
	container: undefined,
	createDocumentContainer: true,
	makeHeadersTrees: true,
	postProcess: true,
	displayProgress: true,
	inlineHTML: false,
	exportPath: "",
	filesToExport: []
};


export const DEFAULT_MARKDOWN_WEBPAGE_RENDERER_API_OPTIONS =
{
	...DEFAULT_MARKDOWN_RENDERER_API_OPTIONS,
	addBodyClasses: true,
	addMathjaxStyles: true,
	addHeadTag: true,
	addRSS: true,
	addTitle: true,
	backlinkOptions: DEFAULT_BACKLINK_OPTIONS,
	tagOptions: DEFAULT_TAG_OPTIONS,
	aliasOptions: DEFAULT_ALIAS_OPTIONS,
	propertiesOptions: DEFAULT_PROPERTIES_OPTIONS,
	fileNavigationOptions: DEFAULT_FILE_NAVIGATION_OPTIONS,
	searchOptions: DEFAULT_SEARCH_OPTIONS,
	outlineOptions: DEFAULT_OUTLINE_OPTIONS,
	themeToggleOptions: DEFAULT_THEME_TOGGLE_OPTIONS,
	graphViewOptions: DEFAULT_GRAPH_VIEW_FEATURE_OPTIONS,
	sidebarOptions: DEFAULT_SIDEBAR_OPTIONS,
	customHead: DEFAULT_CUSTOM_HEAD_OPTIONS,
	fileOptions: DEFAULT_FILE_OPTIONS,
	relativeHeaderLinks: false,
	includeJS: true,
	includeCSS: true,
	inlineMedia: false,
	inlineCSS: false,
	inlineJS: false,
	inlineFonts: false,
	inlineOther: false,
	combineAsSingleFile: false,
	offlineResources: false,
	themeName: "Default",
	slugifyPaths: true,
	flattenExportPaths: false,
	fixLinks: true,
	siteURL: '',
	siteName: app.vault.getName(),
	faviconPath: '',
	customHeadPath: '',
	iconEmojiStyle: EmojiStyle.Native,
	authorName: '',
	exportRoot: '',
	includePluginCSS: [],
	includeSvelteCSS: true,
}
