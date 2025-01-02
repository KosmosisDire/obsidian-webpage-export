
/**
 * General options for the MarkdownRendererAPI
 */
export class MarkdownRendererOptions
{
	/**
	 * The container to render the HTML into.
	 */
	container: HTMLElement | undefined = undefined;

	/**
	 * Create a .obsidian-document container element.
	 */
	createDocumentContainer: boolean = true;

	/**
	 * Keep mod-header and mod-footer elements.
	 */
	keepModHeaderFooter: boolean = false;

	/**
	 * Add the file's icon to the page header
	 */
	addPageIcon: boolean = true;

	/**
	 * Modify the title to a unified format.
	 */
	unifyTitleFormat: boolean = true;

	/**
	 * Create the markdown-preview-pusher element.
	 */
	createPusherElement: boolean = true;

	/**
	 * Convert the headers into a tree structure with all children of a header being in their own container.
	 */
	makeHeadersTrees: boolean = true;

	/**
	 * Run post processing on the html to clean up various obsidian specific elements.
	 */
	postProcess: boolean = true;

	/**
	 * Display a window with a log and progress bar.
	 */
	displayProgress: boolean = true;

	/**
	 * Inline / embed other HTML directly into the HTML.
	 */
	inlineHTML: boolean = false;

	/**
	 * The path to export the files to.
	 */
	exportPath: string = "";
	
	/**
	 * A list of files to export. If empty, all files will be exported.
	 */
	filesToExport: string[] = [];

	/**
	 * Should the usage of the fallback rendering method which iterates all document sections be forced?
	 */
	useFallbackRenderer: boolean = false;
}

