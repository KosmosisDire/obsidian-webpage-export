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

export interface FeatureOptions
{
	enabled: boolean;
}

export enum RelationType
{
	Before = "before",
	After = "after",
	Child = "child",
}

export interface InsertedFeatureOptions extends FeatureOptions
{
	displayTitle: string;
	relationSelector: string;
	relationType: RelationType;
	insertOrder?: number;
}

export interface FetchedFeatureOptions extends InsertedFeatureOptions
{
	includePath: string;
}

export interface GraphViewOptions extends InsertedFeatureOptions
{
	attractionForce: number;
	linkLength: number;
	repulsionForce: number;
	centralForce: number;
	edgePruning: number;
	minNodeRadius: number;
	maxNodeRadius: number;
}

export interface OutlineOptions extends InsertedFeatureOptions
{
	startCollapsed: boolean;
	minCollapseDepth: number;
}

export interface FileNavigationOptions extends FetchedFeatureOptions
{
	showDefaultFolderIcons: boolean;
	showDefaultFileIcons: boolean;
	defaultFolderIcon: string;
	defaultFileIcon: string;
	defaultMediaIcon: string;
	exposeStartingPath: boolean;
}

export interface SidebarOptions extends FeatureOptions
{
	allowResizing: boolean;
	allowCollapsing: boolean;
	rightDefaultWidth: string;
	leftDefaultWidth: string;
}

export interface PropertiesOptions extends InsertedFeatureOptions
{
	hideProperties: string[];
}

export interface TagsOptions extends InsertedFeatureOptions
{
	showInlineTags: boolean;
	showFrontmatterTags: boolean;
}

export interface FileOptions 
{
	/**
	 * Allows lists with sub-items to be folded / collpased.
	 */
	allowFoldingLists: boolean;

	/**
	 * Allows headings to be folded / collapsed.
	 */
	allowFoldingHeadings: boolean;

	/**
	 * The width of the document
	 */
	documentWidth: string;
}



export interface WebsiteOptions
{
	/**
	 * The options for the backlinks feature.
	 */
	backlinks: InsertedFeatureOptions;

	/**
	 * The options for the tags feature.
	 */
	tags: TagsOptions;

	/**
	 * The options for the aliases feature.
	 */
	alias: InsertedFeatureOptions;

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
	search: InsertedFeatureOptions;

	/**
	 * The options for the outline feature.
	 */
	outline: OutlineOptions;

	/**
	 * The options for the theme toggle feature.
	 */
	themeToggle: InsertedFeatureOptions;

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
	customHead: FetchedFeatureOptions;
}

export interface WebsiteData
{
	webpages: {[targetPath: string]: WebpageData},
	fileInfo: {[targetPath: string]: FileData},
	sourceToTarget: {[sourcePath: string]: string},
	attachments: string[];
	shownInTree: string[];
	allFiles: string[];

	siteName: string,
	vaultName: string,
	createdTime: number;
	modifiedTime: number;
	pluginVersion: string,
	exportRoot: string,
	baseURL: string,

	themeName: string,
	bodyClasses: string,
	hasFavicon: boolean,
	featureOptions: WebsiteOptions,
}
