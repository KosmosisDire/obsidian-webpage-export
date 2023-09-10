import { Downloadable } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "./file-tree";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { TFile } from "obsidian";
import { MainSettings } from "scripts/settings/main-settings";
import { GraphView } from "./graph-view";
import { Path } from "scripts/utils/path";
import { RenderLog } from "scripts/html-generation/render-log";
import { Utils } from "scripts/utils/utils";

const removeBodyClasses: string[] = ["mod-windows", "is-frameless", "is-maximized", "is-hidden-frameless", "obsidian-app", 
								"show-view-header", "css-settings-manager", "Heading", "minimal-theme", "minimal-default-dark", 
								"minimal-default-light", "links-int-on", "links-ext-on", "full-width-media", "minimal-folding", 
								"minimal-readable", "minimal-light", "minimal-dark", "chart-default-width", "table-default-width", 
								"img-default-width", "iframe-default-width", "map-default-width", "sizing-readable", 
								"sidebar-float-bottom", "check-color", "check-bg"];

export class Website
{
	public webpages: Webpage[] = [];
	public dependencies: Downloadable[] = [];
	public batchFiles: TFile[] = [];
	public progress: number = 0;

	public static globalGraph: GraphView;
	public fileTree: FileTree;
	public fileTreeHtml: string = "";

	private globalFileTreeChanged = true;
	private globalFileTreeUnchangedTime = 0;
	private globalBodyClassesChanged = true;
	private globalBodyClassesUnchangedTime = 0;
	private globalGraphChanged = true;
	private globalGraphUnchangedTime = 0;


	public static getValidBodyClasses(): string
	{
		let bodyClasses = document.body.classList;
		let validClasses = "";

		bodyClasses.forEach((className) =>
		{
			if (!removeBodyClasses.includes(className)) validClasses += className + " ";
		});

		if (MainSettings.settings.sidebarsAlwaysCollapsible) validClasses += " sidebars-always-collapsible";

		validClasses += "loading";

		return validClasses;
	}

	private async updateGlobalsInExistingFile(webpage: Webpage)
	{
		// if the file was from a previous export then recheck if the global data has changed
		let modTime = webpage.exportPathAbsolute.stat?.mtimeMs ?? 0;
		let timeThreshold = 1000 * 60 * 5; // 5 minutes
		if (modTime && (modTime < this.globalFileTreeUnchangedTime - timeThreshold || modTime > this.globalFileTreeUnchangedTime + timeThreshold))
		{
			console.log("File tree changed");
			this.globalFileTreeChanged = true;
			this.globalGraphUnchangedTime = modTime;
		}
		if (modTime && (modTime < this.globalBodyClassesUnchangedTime - timeThreshold || modTime > this.globalBodyClassesUnchangedTime + timeThreshold))
		{
			console.log("Body classes changed");
			this.globalBodyClassesChanged = true;
			this.globalBodyClassesUnchangedTime = modTime;

		}
		if (modTime && (modTime < this.globalGraphUnchangedTime - timeThreshold || modTime > this.globalGraphUnchangedTime + timeThreshold))
		{
			console.log("Graph changed");
			this.globalGraphChanged = true;
			this.globalGraphUnchangedTime = modTime;
		}

		if ((!this.globalBodyClassesChanged && !this.globalFileTreeChanged && !this.globalGraphChanged) || !webpage.document)
		{
			RenderLog.progress(this.progress, this.batchFiles.length, "Unmodified File", "Unchanged Global Data: " + webpage.source.path, "var(--color-yellow)");
			await Utils.delay(1);
			return;
		}

		RenderLog.progress(this.progress, this.batchFiles.length, "Unmodified File", "Updating Global Data: " + webpage.source.path, "var(--color-blue)");


		let pageString = await webpage.exportPathAbsolute.readFileString();
		if (!pageString) return;

		webpage.document.close();
		webpage.document.open();
		webpage.document.write(pageString);

		if (webpage.document.head.children.length == 0)
		{
			RenderLog.warning("Could not update global data in file: " + webpage.source.path, "File is missing a head element");
			return;
		}

		if(this.globalBodyClassesChanged)
		{
			let newBodyClass = Website.getValidBodyClasses();
			if (newBodyClass == webpage.document.body.getAttribute("class")) 
			{
				this.globalBodyClassesChanged = false;
				this.globalBodyClassesUnchangedTime = modTime;
			}
			webpage.document.body.setAttribute("class", newBodyClass);
		}

		if (this.globalFileTreeChanged)
		{
			let fileTree = webpage.document.querySelector(".tree-container.file-tree");
			if (this.fileTreeHtml == fileTree?.outerHTML ?? "") 
			{
				this.globalFileTreeChanged = false;
				this.globalFileTreeUnchangedTime = modTime;
			}
			if(fileTree) fileTree.outerHTML = this.fileTreeHtml;
		}

		if (this.globalGraphChanged)
		{
			let graph = webpage.document.querySelector(".graph-view-wrapper");
			if (graph && !MainSettings.settings.includeGraphView) graph.remove();
			else if (!graph && MainSettings.settings.includeGraphView)
			{
				let rightSidebar = webpage.document.querySelector(".right-sidebar") as HTMLElement;
				if (rightSidebar)
				{
					let graphEl = GraphView.generateGraphEl(rightSidebar);
					rightSidebar.prepend(graphEl);
				}
			}
			else if (graph && MainSettings.settings.includeGraphView || !graph && !MainSettings.settings.includeGraphView)
			{
				this.globalGraphChanged = false;
				this.globalGraphUnchangedTime = modTime;
			}
		}

		// write the new html to the file
		await webpage.exportPathAbsolute.writeFile(await webpage.getHTML());

		webpage.document.close();

		delete webpage.document;
	}

	private async checkIncrementalExport(webpage: Webpage): Promise<boolean>
	{		
		if (!MainSettings.settings.incrementalExport || webpage.isFileModified) // don't skip the file if it's modified
		{
			return true;
		}
		else if (webpage.isConvertable) // Skip the file if it's unchanged since last export
		{
			// if file was not modified then copy over any global changes to the html file
			await this.updateGlobalsInExistingFile(webpage);
		}

		return false;
	}

	public async createWithFiles(files: TFile[], destination: Path): Promise<Website>
	{
		this.batchFiles = files;

		if (MainSettings.settings.includeGraphView)
		{
			let convertableFiles = this.batchFiles.filter((file) => MarkdownRenderer.isConvertable(file.extension));
			Website.globalGraph = new GraphView(convertableFiles, MainSettings.settings.graphMinNodeSize, MainSettings.settings.graphMaxNodeSize);
		}
		
		if (MainSettings.settings.includeFileTree)
		{
			this.fileTree = new FileTree(this.batchFiles, false, true);
			this.fileTree.makeLinksWebStyle = MainSettings.settings.makeNamesWebStyle;
			this.fileTree.showNestingIndicator = true;
			this.fileTree.generateWithItemsClosed = true;
			this.fileTree.title = app.vault.getName();
			this.fileTree.class = "file-tree";

			let tempTreeContainer = document.body.createDiv();
			await this.fileTree.generateTreeWithContainer(tempTreeContainer);
			this.fileTreeHtml = tempTreeContainer.innerHTML;
			tempTreeContainer.remove();
		}

		await AssetHandler.updateAssetCache();
		await MarkdownRenderer.beginBatch();

		RenderLog.progress(0, files.length, "Generating HTML", "...", "var(--color-accent)");

		this.progress = 0;

		for (let file of files)
		{			
			this.progress++;

			try
			{
				let filename = new Path(file.path).basename;
				let webpage = new Webpage(file, this, destination, this.batchFiles.length > 1, filename);

				if (await this.checkIncrementalExport(webpage)) // Skip creating the webpage if it's unchanged since last export
				{
					RenderLog.progress(this.progress, this.batchFiles.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");
					if (!webpage.isConvertable) webpage.downloads.push(await webpage.getSelfDownloadable());
					await webpage.create();
				}

				this.webpages.push(webpage);
			}
			catch (e)
			{
				RenderLog.error("Could not export file: " + file.name, e);
				continue;
			}

			if (MarkdownRenderer.cancelled)
			{
				throw new Error("Export cancelled");
			}
		}

		return this;
	}

}
