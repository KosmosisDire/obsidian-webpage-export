import { Attachment } from "scripts/utils/downloadable";
import { Webpage } from "./webpage";
import { FileTree } from "../component-generators/file-tree";
import { AssetHandler } from "scripts/assets-system/asset-handler";
import {  TAbstractFile, TFile, TFolder } from "obsidian";
import {  Settings } from "scripts/settings/settings";
import { GraphView } from "../component-generators/graph-view";
import { Path } from "scripts/utils/path";
import { ExportLog, MarkdownRendererAPI } from "scripts/render-api/render-api";
import { WebAsset } from "scripts/assets-system/base-asset";
import { AssetType, InlinePolicy, Mutability } from "scripts/assets-system/asset-types.js";
import { HTMLGeneration } from "scripts/render-api/html-generation-helpers";
import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options";
import { Index, WebpageData } from "scripts/website/index";

export class Website
{
	public progress: number = 0;
	public destination: Path;
	public index: Index;
	
	private sourceFiles: TFile[] = [];

	public globalGraph: GraphView;
	public fileTree: FileTree;
	public fileTreeAsset: WebAsset;
	private graphAsset: WebAsset;
	
	public bodyClasses: string;
	public exportOptions: MarkdownWebpageRendererAPIOptions;

	constructor(destination: Path | string, options?: MarkdownWebpageRendererAPIOptions)
	{
		if (typeof destination == "string") destination = new Path(destination);
		this.exportOptions = Object.assign(new MarkdownWebpageRendererAPIOptions(), options);
		if (destination.isFile) throw new Error("Website destination must be a folder: " + destination.path);
		this.destination = destination;
	}

	public async load(files?: TFile[]): Promise<this>
	{
		this.sourceFiles = files?.filter((file) => file) ?? [];
		this.bodyClasses = await HTMLGeneration.getValidBodyClasses(true);

		// Find root path
		if (this.exportOptions.exportRoot == "" && files)
		{
			if (this.sourceFiles.length > 1)
			{ 
				let commonPath = "";
				let paths = this.sourceFiles.map((file) => file.path.split("/"));
				while (paths.every((path) => path[0] == paths[0][0]))
				{
					commonPath += paths[0][0] + "/";
					paths = paths.map((path) => path.slice(1));
					
					let anyEmpty = paths.some((path) => path.length == 1);
					if (anyEmpty) break;
				}
				console.log("Export root path: " + commonPath);
				this.exportOptions.exportRoot = new Path(commonPath).path + "/";
			}
			else this.exportOptions.exportRoot = this.sourceFiles[0].parent?.path ?? "";
		}

		await AssetHandler.reloadAssets(this.exportOptions);
		this.index = new Index();
		await this.index.load(this, this.exportOptions);

		// create webpages
		for (let file of this.sourceFiles)
		{
			let attachment: Webpage | Attachment | undefined = undefined;

			if (MarkdownRendererAPI.isConvertable(file.extension))
			{
				attachment = new Webpage(file, file.name, this, this.exportOptions);
			}
			else
			{
				let data = Buffer.from(await app.vault.readBinary(file));
				let path = this.getTargetPathForFile(file);
				attachment = new Attachment(data, path, file, this.exportOptions);
			}

			attachment.showInTree = true;
			await this.index.addFile(attachment);
		}

		// create file tree asset
		if (this.exportOptions.addFileNavigation)
		{
			let paths = this.index.attachmentsShownInTree.map((file) => new Path(file.sourcePathRootRelative ?? ""));
			this.fileTree = new FileTree(paths, false, true);
			this.fileTree.makeLinksWebStyle = this.exportOptions.slugifyPaths ?? true;
			this.fileTree.showNestingIndicator = true;
			this.fileTree.generateWithItemsClosed = true;
			this.fileTree.showFileExtentionTags = true;
			this.fileTree.hideFileExtentionTags = ["md"];
			this.fileTree.title = this.exportOptions.siteName ?? app.vault.getName();
			this.fileTree.class = "nav-files-container";
			let tempContainer = document.createElement("div");
			await this.fileTree.insert(tempContainer);
			let data = tempContainer.innerHTML;
			tempContainer.remove();
			this.fileTreeAsset = new WebAsset("file-tree.html", data, null, AssetType.HTML, InlinePolicy.Auto, true, Mutability.Temporary);
		}

		// create graph view asset
		if (this.exportOptions.addGraphView)
		{
			this.globalGraph = new GraphView();
			let convertableFiles = this.sourceFiles.filter((file) => MarkdownRendererAPI.isConvertable(file.extension));
			await this.globalGraph.init(convertableFiles, this.exportOptions);
			this.graphAsset = new WebAsset("graph-data.js", this.globalGraph.getExportData(), null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Temporary);
		}

		return this;
	}
	
	/**
	 * Create a new website with the given files and options.
	 * @param files The files to include in the website.
	 * @param destination The folder to export the website to.
	 * @param options The api options to use for the export.
	 * @returns The website object.
	 */
	public async build(files?: TFile[]): Promise<Website | undefined>
	{ 
		if (files) this.load(files);

		console.log("Creating website with files: ", this.sourceFiles);

		// if body classes have changed write new body classes to existing files
		if (this.bodyClasses != (this.index.oldWebsiteData?.bodyClasses ?? this.bodyClasses))
		{
			this.index.applyToOldWebpages(async (document: Document, oldData: WebpageData) => 
			{
				document.body.className = this.bodyClasses;
				ExportLog.progress(0, "Updating Body Classes", oldData.sourcePath);
			});
		}

		await MarkdownRendererAPI.beginBatch(this.exportOptions);
		this.giveWarnings();

		// render the documents with bare html
		let webpages = this.index.webpages;
		// only render the updated and new files
		webpages = webpages.filter((webpage) => 
		{
			return this.index.updatedFiles.includes(webpage) || this.index.newFiles.includes(webpage)
		});

		let progress = 0;
		for (let webpage of webpages)
		{
			ExportLog.progress(progress, "Rendering Documents", webpage.source.path);
			await webpage.populateDocument();
			progress += 1 / (webpages.length * 1.5);
		}

		// create attachments from the webpages if we are not inlining media
		if (!this.exportOptions.inlineMedia)
		{
			for (let webpage of webpages)
			{
				ExportLog.progress(progress, "Creating Attachments", webpage.source.path);
				let attachments = await webpage.getAttachments();
				this.index.addFiles(attachments);
				progress += 1 / (webpages.length * 6);
			}
		}

		this.index.addFiles(AssetHandler.getDownloads(this.destination, this.exportOptions));

		for (let webpage of webpages)
		{
			ExportLog.progress(progress, "Building Website", webpage.source.path);
			let page = await webpage.build();
			
			if (page)
			{
				await this.index.addFile(webpage);
			}
			else
			{
				this.index.removeFile(webpage);
			}

			progress += 1 / (webpages.length * 6);
		}

		if (this.exportOptions.addRSS)
		{
			this.index.createRSSFeed();
		}

		console.log("Website created: ", this);
		
		await this.index.finalize();

		return this;
	}

	private giveWarnings()
	{
		// if iconize plugin is installed, warn if note icons are not enabled
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-icon-folder"))
		{
			// @ts-ignore
			let fileToIconName = app.plugins.plugins['obsidian-icon-folder'].data;
			let noteIconsEnabled = fileToIconName.settings.iconsInNotesEnabled ?? false;
			if (!noteIconsEnabled)
			{
				ExportLog.warning("For Iconize plugin support, enable \"Toggle icons while editing notes\" in the Iconize plugin settings.");
			}
		}

		// if excalidraw installed and the embed mode is not set to Native SVG, warn
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-excalidraw-plugin"))
		{
			// @ts-ignore
			let embedMode = app.plugins.plugins['obsidian-excalidraw-plugin']?.settings['previewImageType'] ?? "";		
			if (embedMode != "SVG")
			{
				ExportLog.warning("For Excalidraw embed support, set the embed mode to \"Native SVG\" in the Excalidraw plugin settings.");
			}
		}

		// the plugin only supports the banner plugin above version 2.0.5
		// @ts-ignore
		if (app.plugins.enabledPlugins.has("obsidian-banners"))
		{
			// @ts-ignore
			let bannerPlugin = app.plugins.plugins['obsidian-banners'];
			let version = bannerPlugin?.manifest?.version ?? "0.0.0";
			version = version.substring(0, 5);
			if (version < "2.0.5")
			{
				ExportLog.warning("The Banner plugin version 2.0.5 or higher is required for full support. You have version " + version + ".");
			}
		}

		// warn the user if they are trying to create an rss feed without a site url
		if (this.exportOptions.addRSS && (this.exportOptions.siteURL == "" || this.exportOptions.siteURL == undefined))
		{
			ExportLog.warning("Creating an RSS feed requires a site url to be set in the export settings.");
		}

	}

	public getTargetPathForFile(file: TFile, filename?: string): Path
	{
		let targetPath = new Path(file.path);
		if (filename) targetPath.fullName = filename;
		targetPath.setWorkingDirectory((this.destination ?? Path.vaultPath.joinString("Web Export")).path);
		targetPath.slugify(this.exportOptions.slugifyPaths);
		return targetPath;
	}

	// TODO: Seperate the icon and title into seperate functions
	public static async getTitleAndIcon(file: TAbstractFile, skipIcon:boolean = false): Promise<{ title: string; icon: string; isDefaultIcon: boolean; isDefaultTitle: boolean }>
	{
		if (!file) return { title: "", icon: "", isDefaultIcon: true, isDefaultTitle: true };

		let iconOutput = "";
		let iconProperty: string | undefined = "";
		let title = file.name;
		let isDefaultTitle = true;
		let useDefaultIcon = false;
		if (file instanceof TFile)
		{
			const fileCache = app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			const titleFromFrontmatter = frontmatter?.[Settings.titleProperty] ?? frontmatter?.["banner_header"]; // banner plugin support
			title = titleFromFrontmatter ?? file.basename ?? "";
			if (title != file.basename) isDefaultTitle = false;
			if (title.endsWith(".excalidraw")) title = title.substring(0, title.length - 11);
			
			iconProperty = frontmatter?.icon ?? frontmatter?.sticker ?? frontmatter?.banner_icon; // banner plugin support
			if (!iconProperty && Settings.showDefaultTreeIcons) 
			{
				useDefaultIcon = true;
				let isMedia = WebAsset.extentionToType(file.extension) == AssetType.Media;
				iconProperty = isMedia ? Settings.defaultMediaIcon : Settings.defaultFileIcon;
				if (file.extension == "canvas") iconProperty = "lucide//layout-dashboard";
			}
		}

		if (skipIcon) return { title: title, icon: "", isDefaultIcon: true, isDefaultTitle: isDefaultTitle };

		if (file instanceof TFolder && Settings.showDefaultTreeIcons)
		{
			iconProperty = Settings.defaultFolderIcon;
			useDefaultIcon = true;
		}

		iconOutput = await HTMLGeneration.getIcon(iconProperty ?? "");

		// add iconize icon as frontmatter if iconize exists
		let isUnchangedNotEmojiNotHTML = (iconProperty == iconOutput && iconOutput.length < 40) && !/\p{Emoji}/u.test(iconOutput) && !iconOutput.includes("<") && !iconOutput.includes(">");
		let parsedAsIconize = false;

		//@ts-ignore
		if ((useDefaultIcon || !iconProperty || isUnchangedNotEmojiNotHTML) && app.plugins.enabledPlugins.has("obsidian-icon-folder"))
		{
			//@ts-ignore
			let fileToIconName = app.plugins.plugins['obsidian-icon-folder'].data;
			let noteIconsEnabled = fileToIconName.settings.iconsInNotesEnabled ?? false;
			
			// only add icon if rendering note icons is enabled
			// because that is what we rely on to get the icon
			if (noteIconsEnabled)
			{
				let iconIdentifier = fileToIconName.settings.iconIdentifier ?? ":";
				let iconProperty = fileToIconName[file.path];

				if (iconProperty && typeof iconProperty != "string")
				{
					iconProperty = iconProperty.iconName ?? "";
				}

				if (iconProperty && typeof iconProperty == "string" && iconProperty.trim() != "")
				{
					if (file instanceof TFile)
						app.fileManager.processFrontMatter(file, (frontmatter) =>
						{
							frontmatter.icon = iconProperty;
						});

					iconOutput = iconIdentifier + iconProperty + iconIdentifier;
					parsedAsIconize = true;
				}
			}
		}

		if (!parsedAsIconize && isUnchangedNotEmojiNotHTML) iconOutput = "";

		return { title: title, icon: iconOutput, isDefaultIcon: useDefaultIcon, isDefaultTitle: isDefaultTitle };
	}

	public async createAttachmentFromSrc(src: string, sourceFile: TFile): Promise<Attachment | undefined>
	{
		let attachedFile = this.getFilePathFromSrc(src, sourceFile.path);
		if (attachedFile.isDirectory) return;

		let file = app.vault.getFileByPath(attachedFile.pathname);
		let path = file?.path ?? "";
		if (!file) path = AssetHandler.mediaPath.joinString(attachedFile.fullName).path;
		let data: Buffer | undefined = await attachedFile.readAsBuffer();

		if (!data) return;

		let target = new Path(path, this.destination.path)
							.slugify(this.exportOptions.slugifyPaths);

		let attachment = new Attachment(data, target, file, this.exportOptions);
		if (!attachment.sourcePath) attachment.sourcePath = attachedFile.pathname;
		return attachment;
	}

	public getFilePathFromSrc(src: string, exportingFilePath: string): Path
	{
		// @ts-ignore
		let pathString = "";
		if (src.startsWith("app://"))
		{
			let fail = false;
			try
			{
				// @ts-ignore
				pathString = app.vault.resolveFileUrl(src)?.path ?? "";
				if (pathString == "") fail = true;
			}
			catch
			{
				fail = true;
			}

			if(fail)
			{
				pathString = src.replaceAll("app://", "").replaceAll("\\", "/");
				pathString = pathString.replaceAll(pathString.split("/")[0] + "/", "");
				pathString = Path.getRelativePathFromVault(new Path(pathString), true).path;
				ExportLog.log(pathString, "Fallback path parsing:");
			}
		}
		else
		{
			let split = src.split("#");

			let hash = split[1]?.trim();
			let path = split[0];
			pathString = app.metadataCache.getFirstLinkpathDest(path, exportingFilePath)?.path ?? "";
			if (hash) 
			{
				pathString += "#" + hash;
			}
		}

		pathString = pathString ?? "";

		return new Path(pathString);
	}


}
