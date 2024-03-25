export enum DocumentType
{
	Markdown,
	Canvas,
	Embed,
	Excalidraw,
	Kanban,
	Other
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
	addCustomHead: boolean,
	addFavicon: boolean
}
