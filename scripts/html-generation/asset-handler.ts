import graphViewJS from "assets/graph-view.txt.js";
import graphWASMJS from "assets/graph-wasm.txt.js";
import renderWorkerJS from "assets/graph-render-worker.txt.js";
import graphWASM from "assets/graph-wasm.wasm";
import websiteJS from "assets/website.txt.js";
import webpageStyles from "assets/plugin-styles.txt.css";
import deferredJS from "assets/deferred.txt.js";
import deferredCSS from "assets/deferred.txt.css";
import themeLoadJS from "assets/theme-load.txt.js";

import tinyColorJS from "assets/tinycolor.txt.js";
import pixiJS from "assets/pixi.txt.js";
import minisearchJS from "assets/minisearch.txt.js";

import { Path } from "scripts/utils/path.js";
import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./assets/asset.js";
import { ObsidianStyles } from "./assets/obsidian-styles.js";
import { OtherPluginStyles } from "./assets/other-plugin-styles.js";
import { ThemeStyles } from "./assets/theme-styles.js";
import { SnippetStyles } from "./assets/snippet-styles.js";
import { MathjaxStyles } from "./assets/mathjax-styles.js";
import { CustomHeadContent } from "./assets/custom-head-content.js";
import { Settings, SettingsPage } from "scripts/settings/settings.js";
import { GlobalVariableStyles } from "./assets/global-variable-styles.js";
import { Favicon } from "./assets/favicon.js";
import { FetchBuffer } from "./assets/local-fetch-buffer.js";
import { ExportLog } from "./render-log.js";
import { SupportedPluginStyles } from "./assets/supported-plugin-styles.js";
import { fileTypeFromBuffer } from "file-type";
import { MarkdownWebpageRendererAPIOptions } from "scripts/api-options.js";
const mime = require('mime');


export class AssetHandler
{
	public static vaultPluginsPath: Path;

	public static staticAssets: Asset[] = [];
	public static dynamicAssets: Asset[] = [];
	public static allAssets: Asset[] = [];
	public static temporaryAssets: Asset[] = [];

	// this path is used to generate the relative path to the images folder, likewise for the other paths
    private static libraryFolder: Path;
	private static mediaFolder: Path;
	private static jsFolder: Path;
	private static cssFolder: Path;
	private static fontFolder: Path;
	private static htmlFolder: Path;

	public static exportOptions: MarkdownWebpageRendererAPIOptions = new MarkdownWebpageRendererAPIOptions();

    public static get libraryPath(): Path
    {
		if (!this.libraryFolder) this.initialize();
        return AssetHandler.libraryFolder.copy.makeWebStyle(this.exportOptions.webStylePaths);
    }
    public static get mediaPath(): Path
    {
		if (!this.mediaFolder) this.initialize();
		return AssetHandler.mediaFolder.copy.makeWebStyle(this.exportOptions.webStylePaths);
    }
    public static get jsPath(): Path
    {
		if (!this.jsFolder) this.initialize();
        return AssetHandler.jsFolder.copy.makeWebStyle(this.exportOptions.webStylePaths);
    }
    public static get cssPath(): Path
    {
		if (!this.cssFolder) this.initialize();
		return AssetHandler.cssFolder.copy.makeWebStyle(this.exportOptions.webStylePaths);
    }
	public static get fontPath(): Path
	{
		if (!this.fontFolder) this.initialize();
		return AssetHandler.fontFolder.copy.makeWebStyle(this.exportOptions.webStylePaths);
	}
    public static get htmlPath(): Path
    {
		if (!this.htmlFolder) this.initialize();
		return AssetHandler.htmlFolder.copy.makeWebStyle(this.exportOptions.webStylePaths);
    }

	// styles
	public static obsidianStyles: ObsidianStyles = new ObsidianStyles();
	public static otherPluginStyles: OtherPluginStyles = new OtherPluginStyles();
	public static themeStyles: ThemeStyles = new ThemeStyles();
	public static snippetStyles: SnippetStyles = new SnippetStyles();
	public static mathjaxStyles: MathjaxStyles = new MathjaxStyles();
	public static globalDataStyles: GlobalVariableStyles = new GlobalVariableStyles();
	public static supportedPluginStyles: SupportedPluginStyles = new SupportedPluginStyles();
	public static websiteStyles: Asset = new Asset("main-styles.css", webpageStyles, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 4);
	public static deferredCSS: Asset = new Asset("deferred.css", deferredCSS, AssetType.Style, InlinePolicy.InlineHead, true, Mutability.Static, LoadMethod.Defer);

	// scripts
	public static websiteJS: Asset = new Asset("webpage.js", websiteJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async);
	public static graphViewJS: Asset = new Asset("graph-view.js", graphViewJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static graphWASMJS: Asset = new Asset("graph-wasm.js", graphWASMJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static graphWASM: Asset = new Asset("graph-wasm.wasm", Buffer.from(graphWASM), AssetType.Script, InlinePolicy.Download, false, Mutability.Static);
	public static renderWorkerJS: Asset = new Asset("graph-render-worker.js", renderWorkerJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static deferredJS: Asset = new Asset("deferred.js", deferredJS, AssetType.Script, InlinePolicy.InlineHead, true, Mutability.Static, LoadMethod.Defer);
	public static themeLoadJS: Asset = new Asset("theme-load.js", themeLoadJS, AssetType.Script, InlinePolicy.Inline, true, Mutability.Static, LoadMethod.Defer);

	public static tinyColorJS: Asset = new Asset("tinycolor.js", tinyColorJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static pixiJS: Asset = new Asset("pixi.js", pixiJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 100, "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.4.0/pixi.min.js");
	public static minisearchJS: Asset = new Asset("minisearch.js", minisearchJS, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 100, "https://cdn.jsdelivr.net/npm/minisearch@6.3.0/dist/umd/index.min.js");
	 
	// other
	public static favicon: Favicon = new Favicon();
	public static externalLinkIcon: Asset;
	public static customHeadContent: CustomHeadContent = new CustomHeadContent();
	public static mainJsModTime: number = 0;

	public static async initialize()
	{
		this.libraryFolder = new Path("lib").makeUnixStyle();
		this.mediaFolder = this.libraryFolder.joinString("media").makeUnixStyle();
		this.jsFolder = this.libraryFolder.joinString("scripts").makeUnixStyle(); 
		this.cssFolder = this.libraryFolder.joinString("styles").makeUnixStyle();
		this.fontFolder = this.libraryFolder.joinString("fonts").makeUnixStyle();
		this.htmlFolder = this.libraryFolder.joinString("html").makeUnixStyle();
		this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").makeAbsolute();
		
		// by default all static assets have a modified time the same as main.js
		this.mainJsModTime = this.vaultPluginsPath.joinString("webpage-html-export/main.js").stat?.mtimeMs ?? 0;
		this.staticAssets.forEach(asset => asset.modifiedTime = this.mainJsModTime);

		this.allAssets.sort((a, b) => a.loadPriority - b.loadPriority);
		
		let loadPromises = []
		for (let asset of this.allAssets)
		{
			loadPromises.push(asset.load(this.exportOptions));
		}
		await Promise.all(loadPromises);
		
		let graphViewJSPath = this.graphViewJS.getAssetPath();
		this.graphViewJS.getHTML = () => `<script type="module" async id="graph-view-script" src="${graphViewJSPath}"></script>`;
	}

	public static async reloadAssets()
	{
		// remove all temporary assets from allAssets
		this.allAssets = this.allAssets.filter(asset => asset.mutability != Mutability.Temporary);
		this.temporaryAssets = [];

		let i = 0;

		let loadPromises = []
		for (let asset of this.dynamicAssets)
		{
			let loadPromise = asset.load(this.exportOptions);
			loadPromise.then(() =>
			{
				i++;
				ExportLog.progress(i, this.dynamicAssets.length, "Initialize Export", "Loading asset: " + asset.filename, "var(--color-yellow)");
			});
			loadPromises.push(loadPromise);
		}
		await Promise.all(loadPromises);
	}

	public static getAssetsOfType(type: AssetType): Asset[]
	{
		let assets = this.allAssets.filter(asset => asset.type == type);
		assets = assets.concat(this.allAssets.map(asset => asset.childAssets).flat().filter(asset => asset.type == type));
		return assets;
	}

	public static getAssetsOfInlinePolicy(inlinePolicy: InlinePolicy): Asset[]
	{
		let assets = this.allAssets.filter(asset => asset.inlinePolicy == inlinePolicy);
		assets = assets.concat(this.allAssets.map(asset => asset.childAssets).flat().filter(asset => asset.inlinePolicy == inlinePolicy));
		return assets;
	}

	private static filterDownloads(downloads: Asset[], options: MarkdownWebpageRendererAPIOptions): Asset[]
	{
		if (!options.addGraphView || !options.addSidebars)
		{
			downloads = downloads.filter(asset => ![this.graphViewJS, this.graphWASMJS, this.graphWASM, this.renderWorkerJS, this.tinyColorJS, this.pixiJS].includes(asset));
		}

		if (!options.addSearch || !options.addSidebars)
		{
			downloads = downloads.filter(asset => ![this.minisearchJS].includes(asset));
		}

		if (!options.includeCSS) 
		{
			downloads = downloads.filter(asset => asset.type != AssetType.Style);
		}

		if (!options.includeJS) 
		{
			downloads = downloads.filter(asset => asset.type != AssetType.Script);
		}

		// remove duplicates
		downloads = downloads.filter((asset, index, self) => self.findIndex((t) => t.relativePath.asString == asset.relativePath.asString) === index);

		// remove assets with no content
		downloads = downloads.filter(asset => asset.content && asset.content.length > 0);

		return downloads;
	}

	public static getDownloads(options: MarkdownWebpageRendererAPIOptions): Asset[]
	{
		let downloads = this.getAssetsOfInlinePolicy(InlinePolicy.Download)
						    .concat(this.getAssetsOfInlinePolicy(InlinePolicy.DownloadHead));

		if (!options.inlineMedia) 
		{
			downloads = downloads.concat(this.getAssetsOfInlinePolicy(InlinePolicy.Auto));
			downloads = downloads.concat(this.getAssetsOfInlinePolicy(InlinePolicy.AutoHead));
		}

		downloads = this.filterDownloads(downloads, options);
		downloads.sort((a, b) => b.loadPriority - a.loadPriority);

		return downloads;
	}

	public static getHeadReferences(options: MarkdownWebpageRendererAPIOptions): string
	{
		let head = "";

		let referenceAssets = this.getAssetsOfInlinePolicy(InlinePolicy.DownloadHead)
								  .concat(this.getAssetsOfInlinePolicy(InlinePolicy.AutoHead))
								  .concat(this.getAssetsOfInlinePolicy(InlinePolicy.InlineHead));

		referenceAssets = this.filterDownloads(referenceAssets, options);
		referenceAssets.sort((a, b) => b.loadPriority - a.loadPriority);

		for (let asset of referenceAssets)
		{
			head += asset.getHTML(options);
		}

		return head;
	}

	/*Takes a style sheet string and creates assets from every font or image url embedded in it*/
	public static async getStyleChildAssets(asset: Asset, makeBase64External: boolean = false): Promise<string>
	{
		if (typeof asset.content != "string") throw new Error("Asset content is not a string");

		let content = asset.content.replaceAll("app://obsidian.md/", "");

		let urls = Array.from(content.matchAll(/url\("([^"]+)"\)|url\('([^']+)'\)/g));

		// remove duplicates
		urls = urls.filter((url, index, self) => self.findIndex((t) => t[0] === url[0]) === index);

		// use this mutability for child assets
        let promises = [];
		for (let urlObj of urls)
		{
			let url = urlObj[1] || urlObj[2];
			url = url.trim();

			// we don't need to download online assets if we are not making the page offline compatible
			if (!this.exportOptions.offlineResources && url.startsWith("http")) continue;

			if (url == "") continue;

			if (url.startsWith("data:"))
			{
				if (!this.exportOptions.inlineMedia && makeBase64External)
				{
					// decode the base64 data and create an Asset from it
					// then replace the url with the relative path to the asset

					function hash(str:string, seed = 0) // taken from https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
					{
						let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
						for(let i = 0, ch; i < str.length; i++) {
							ch = str.charCodeAt(i);
							h1 = Math.imul(h1 ^ ch, 2654435761);
							h2 = Math.imul(h2 ^ ch, 1597334677);
						}
						h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
						h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
						h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
						h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
						
						return 4294967296 * (2097151 & h2) + (h1 >>> 0);
					}

					let splitData = url.split(",")
					let data = splitData.slice(1).join(",");
					let extension = Asset.mimeToExtention(splitData[0].split(":")[1].split(";")[0]);
					let buffer = Buffer.from(data, "base64");
					let dataHash = hash(data);
					let filename = `${dataHash}.${extension}`;
					if (extension == '') 
					{
						let type = await fileTypeFromBuffer(buffer);
						if (type) extension = type.ext;
						filename = `${dataHash}.${extension}`;						
					}
					let type = Asset.extentionToType(extension);

					let childAsset = new Asset(filename, buffer, type, InlinePolicy.Download, false, Mutability.Child);
					asset.childAssets.push(childAsset);
					let loadPromise = childAsset.load(this.exportOptions);
					promises.push(loadPromise);
					loadPromise.then(() =>
					{
						if (childAsset.content == undefined || childAsset.content == null || childAsset.content.length == 0)
						{
							return;
						}

						let newPath = childAsset.getAssetPath(asset.getAssetPath());
						content = content.replaceAll(url, newPath.asString);
					});
				}
				continue;
			} 

			let path = new Path(url);
			let type = Asset.extentionToType(path.extension);
			let childAsset = new FetchBuffer(path.fullName, url, type, InlinePolicy.Download, false, Mutability.Child);
			asset.childAssets.push(childAsset);

			let loadPromise = childAsset.load(this.exportOptions);
			promises.push(loadPromise);
			loadPromise.then(() => 
			{
				if (childAsset.content == undefined || childAsset.content == null || childAsset.content.length == 0)
				{
					return;
				}

				if (this.exportOptions.inlineMedia)
				{
					let base64 = childAsset.content.toString("base64");
					content = content.replaceAll(url, `data:${mime.getType(url)};base64,${base64}`);
				}
				else
				{
					childAsset.relativeDirectory.makeWebStyle(this.exportOptions.webStylePaths);
					if (this.exportOptions.webStylePaths) childAsset.filename = Path.toWebStyle(childAsset.filename);

					let newPath = childAsset.getAssetPath(asset.getAssetPath());
					content = content.replaceAll(url, newPath.asString);
				}
			});
		}

		await Promise.all(promises);

		return content;
	}
}
