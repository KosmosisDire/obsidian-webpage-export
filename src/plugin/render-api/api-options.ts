
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
}
