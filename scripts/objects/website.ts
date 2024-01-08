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
import { Asset, AssetType, InlinePolicy, Mutability } from "scripts/html-generation/assets/asset";
import { ExportModal } from "scripts/settings/export-modal";

export class Website
{
	public webpages: Webpage[] = [];
	public dependencies: Downloadable[] = [];
	public downloads: Downloadable[] = [];
	public batchFiles: TFile[] = [];
	public progress: number = 0;
	public destination: Path;

	private globalGraph: GraphView;
	private fileTree: FileTree;
	private fileTreeHtml: string = "";

	public graphDataAsset: Asset;
	public fileTreeAsset: Asset;

	private created = false;


	private static _validBodyClasses: string | undefined = undefined;
	public static getValidBodyClasses(): string
	{
		if (this._validBodyClasses) return this._validBodyClasses;

		let bodyClasses = document.body.classList;
		let validClasses = "";

		// validClasses += bodyClasses.contains("theme-light") ? " theme-light " : " theme-dark ";
		if (MainSettings.settings.sidebarsAlwaysCollapsible) validClasses += " sidebars-always-collapsible ";
		if (MainSettings.settings.inlineAssets) validClasses += " inlined-assets ";
		// validClasses += " css-settings-manager ";
		validClasses += " loading ";
		
		// keep body classes that are referenced in the styles
		for (var style of AssetHandler.getAssetsOfType(AssetType.Style))
		{
			if (typeof(style.content) != "string") continue;

			let matches = style.content.matchAll(/\.[^\s1234567890\.]{1,} /gm);
			for (var match of matches)
			{
				let className = match[0].replace(".", "").trim();
				if (bodyClasses.contains(className)) validClasses += " " + className + " ";
			}
		}

		this._validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates\
		this._validBodyClasses = this._validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ");

		RenderLog.log("Valid body classes: " + this._validBodyClasses);
		
		return this._validBodyClasses;
	}

	private async checkIncrementalExport(webpage: Webpage): Promise<boolean>
	{		
		if(MarkdownRenderer.checkCancelled()) return false;

		if (!MainSettings.settings.incrementalExport || webpage.isFileModified) // don't skip the file if it's modified
		{
			return true;
		}

		return false;
	}

	public async createWithFiles(files: TFile[], destination: Path): Promise<Website | undefined>
	{
		this.batchFiles = files;
		this.destination = destination;
		Website._validBodyClasses = undefined;

		await MarkdownRenderer.beginBatch();

		if (MainSettings.settings.includeGraphView)
		{
			let convertableFiles = this.batchFiles.filter((file) => MarkdownRenderer.isConvertable(file.extension));
			this.globalGraph = new GraphView(convertableFiles, MainSettings.settings.graphMinNodeSize, MainSettings.settings.graphMaxNodeSize);
		}
		
		if (MainSettings.settings.includeFileTree)
		{
			this.fileTree = new FileTree(this.batchFiles, false, true);
			this.fileTree.makeLinksWebStyle = MainSettings.settings.makeNamesWebStyle;
			this.fileTree.showNestingIndicator = true;
			this.fileTree.generateWithItemsClosed = true;
			this.fileTree.showFileExtentionTags = true;
			this.fileTree.hideFileExtentionTags = ["md"]
			this.fileTree.title = app.vault.getName();
			this.fileTree.class = "file-tree";

			let tempTreeContainer = document.body.createDiv();
			await this.fileTree.generateTreeWithContainer(tempTreeContainer);
			this.fileTreeHtml = tempTreeContainer.innerHTML;
			tempTreeContainer.remove();
		}

		await AssetHandler.reloadAssets();

		if (MainSettings.settings.includeGraphView)
		{
			this.graphDataAsset = new Asset("graph-data.js", this.globalGraph.getExportData(), AssetType.Script, InlinePolicy.Auto, true, Mutability.Temporary, 0);
			this.graphDataAsset.load();
		}

		if (MainSettings.settings.includeFileTree)
		{
			this.fileTreeAsset = new Asset("file-tree.html", this.fileTreeHtml, AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary, 0);
			this.fileTreeAsset.load();
		}

		RenderLog.progress(0, files.length, "Generating HTML", "...", "var(--color-accent)");

		this.progress = 0;

		for (let file of files)
		{			
			if(MarkdownRenderer.checkCancelled()) return undefined;

			this.progress++;

			try
			{
				let filename = new Path(file.path).basename;
				let webpage = new Webpage(file, this, destination, this.batchFiles.length > 1, filename, MainSettings.settings.inlineAssets && this.batchFiles.length == 1);

				if (await this.checkIncrementalExport(webpage)) // Skip creating the webpage if it's unchanged since last export
				{
					RenderLog.progress(this.progress, this.batchFiles.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");
					if (!webpage.isConvertable) webpage.downloads.push(await webpage.getSelfDownloadable());
					let createdPage = await webpage.create();
					if(!createdPage) 
					{
						if (MarkdownRenderer.cancelled) return undefined;
						
						continue;
					}
				}

				this.webpages.push(webpage);
				this.dependencies.push(...webpage.dependencies);
				this.downloads.push(...webpage.downloads);
			}
			catch (e)
			{
				RenderLog.error(e, "Could not export file: " + file.name);
				continue;
			}

			if(MarkdownRenderer.checkCancelled()) return undefined;
		}

		// remove duplicates from the dependencies and downloads
		this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativeDownloadDirectory == file.relativeDownloadDirectory && f.filename === file.filename) == index);
		this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativeDownloadDirectory == file.relativeDownloadDirectory && f.filename === file.filename) == index);

		this.created = true;

		return this;
	}

	// saves a .json file with all the data needed to recreate the website
	public async saveAsDatabase()
	{
		if (!this.created) throw new Error("Cannot save website database before generating the website.");

		// data is a dictionary mapping a file path to file data
		let data: { [path: string] : string; } = {};
		
		for (let webpage of this.webpages)
		{
			let webpageData: string = await webpage.getHTML();
			let path = encodeURI(webpage.exportPath.copy.makeUnixStyle().asString);
			data[path] = webpageData;
		}

		for (let file of this.dependencies)
		{
			let fileData: string | Buffer = file.content;
			if (fileData instanceof Buffer) fileData = fileData.toString("base64");
			let path = encodeURI(file.relativeDownloadDirectory.joinString(file.filename).makeUnixStyle().asString);

			if(fileData == "")
			{
				RenderLog.log(file.content);
			}

			data[path] = fileData;
		}

		let json = JSON.stringify(data);
		let databasePath = this.destination.directory.joinString("database.json");
		await databasePath.writeFile(json);
	}

}
