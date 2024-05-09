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
	tags: string[];
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
	displayTitle: string;
	show: boolean;
	parentSelector: string;
	insertOrder?: number;
	includePath?: string;
}

export interface GraphViewOptions
{
	attractionForce: number;
	linkLength: number;
	repulsionForce: number;
	centralForce: number;
	edgePruning: number;
	minNodeRadius: number;
	maxNodeRadius: number;
}

export const DEFAULT_GRAPH_VIEW_OPTIONS: GraphViewOptions = 
{
	attractionForce: 1,
	linkLength: 10,
	repulsionForce: 150,
	centralForce: 3,
	edgePruning: 100,
	minNodeRadius: 3,
	maxNodeRadius: 7
}

export interface GraphViewFeatureOptions extends FeatureOptions
{
	graphViewSettings: GraphViewOptions;
}

export interface WebsiteOptions
{
	backlinks: FeatureOptions,
	tags: FeatureOptions,
	alias: FeatureOptions,
	properties: FeatureOptions,
	graphView: GraphViewFeatureOptions,
	fileNavigation: FeatureOptions,
	search: FeatureOptions,
	outline: FeatureOptions,
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
	hasCustomHead: boolean,
	hasFavicon: boolean,
	featureOptions: WebsiteOptions,
}
