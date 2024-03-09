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
import { WebAsset } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { ObsidianStyles } from "./obsidian-styles.js";
import { OtherPluginStyles } from "./other-plugin-styles.js";
import { ThemeStyles } from "./theme-styles.js";
import { SnippetStyles } from "./snippet-styles.js";
import { MathjaxStyles } from "./mathjax-styles.js";
import { CustomHeadContent } from "./custom-head-content.js";
import { GlobalVariableStyles } from "./global-variable-styles.js";
import { Favicon } from "./favicon.js";
import { FetchBuffer } from "./local-fetch-buffer.js";
import { SupportedPluginStyles } from "./supported-plugin-styles.js";
import { fileTypeFromBuffer } from "file-type";
import { MarkdownWebpageRendererAPIOptions } from "scripts/render-api/api-options.js";
import { ExportLog } from "scripts/render-api/render-api.js";
const mime = require('mime');


export class AssetHandler
{
	public static vaultPluginsPath: Path;

	public static staticAssets: WebAsset[] = [];
	public static dynamicAssets: WebAsset[] = [];
	public static allAssets: WebAsset[] = [];
	public static temporaryAssets: WebAsset[] = [];

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
		if (!this.libraryFolder) this.initPaths();
        return AssetHandler.libraryFolder.slugified(this.exportOptions.slugifyPaths);
    }
    public static get mediaPath(): Path
    {
		if (!this.mediaFolder) this.initPaths();
		return AssetHandler.mediaFolder.slugified(this.exportOptions.slugifyPaths);
    }
    public static get jsPath(): Path
    {
		if (!this.jsFolder) this.initPaths();
        return AssetHandler.jsFolder.slugified(this.exportOptions.slugifyPaths);
    }
    public static get cssPath(): Path
    {
		if (!this.cssFolder) this.initPaths();
		return AssetHandler.cssFolder.slugified(this.exportOptions.slugifyPaths);
    }
	public static get fontPath(): Path
	{
		if (!this.fontFolder) this.initPaths();
		return AssetHandler.fontFolder.slugified(this.exportOptions.slugifyPaths);
	}
    public static get htmlPath(): Path
    {
		if (!this.htmlFolder) this.initPaths();
		return AssetHandler.htmlFolder.slugified(this.exportOptions.slugifyPaths);
    }

	public static generateSavePath(filename: string, type: AssetType, destinationDir: Path)
	{
		return WebAsset.typeToDir(type).joinString(filename).setWorkingDirectory(destinationDir.path).slugified(this.exportOptions.slugifyPaths);
	}

	// styles
	public static obsidianStyles: ObsidianStyles = new ObsidianStyles();
	public static otherPluginStyles: OtherPluginStyles = new OtherPluginStyles();
	public static themeStyles: ThemeStyles = new ThemeStyles();
	public static snippetStyles: SnippetStyles = new SnippetStyles();
	public static mathjaxStyles: MathjaxStyles = new MathjaxStyles();
	public static globalDataStyles: GlobalVariableStyles = new GlobalVariableStyles();
	public static supportedPluginStyles: SupportedPluginStyles = new SupportedPluginStyles();
	public static websiteStyles: WebAsset = new WebAsset("main-styles.css", webpageStyles, null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 4);
	public static deferredCSS: WebAsset = new WebAsset("deferred.css", deferredCSS, null, AssetType.Style, InlinePolicy.InlineHead, true, Mutability.Static, LoadMethod.Defer, -1000);

	// scripts
	public static websiteJS: WebAsset = new WebAsset("webpage.js", websiteJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async);
	public static graphViewJS: WebAsset = new WebAsset("graph-view.js", graphViewJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static graphWASMJS: WebAsset = new WebAsset("graph-wasm.js", graphWASMJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static graphWASM: WebAsset = new WebAsset("graph-wasm.wasm", Buffer.from(graphWASM), null, AssetType.Script, InlinePolicy.Download, false, Mutability.Static);
	public static renderWorkerJS: WebAsset = new WebAsset("graph-render-worker.js", renderWorkerJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static deferredJS: WebAsset = new WebAsset("deferred.js", deferredJS, null, AssetType.Script, InlinePolicy.InlineHead, true, Mutability.Static, LoadMethod.Defer, -1000);
	public static themeLoadJS: WebAsset = new WebAsset("theme-load.js", themeLoadJS, null, AssetType.Script, InlinePolicy.Inline, true, Mutability.Static, LoadMethod.Defer);

	public static tinyColorJS: WebAsset = new WebAsset("tinycolor.js", tinyColorJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
	public static pixiJS: WebAsset = new WebAsset("pixi.js", pixiJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 100, "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.4.0/pixi.min.js");
	public static minisearchJS: WebAsset = new WebAsset("minisearch.js", minisearchJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 100, "https://cdn.jsdelivr.net/npm/minisearch@6.3.0/dist/umd/index.min.js");
	 
	// other
	public static favicon: Favicon = new Favicon();
	public static externalLinkIcon: WebAsset;
	public static customHeadContent: CustomHeadContent = new CustomHeadContent();
	public static mainJsModTime: number = 0;

	private static initPaths()
	{
		this.libraryFolder = new Path("lib");
		this.mediaFolder = this.libraryFolder.joinString("media");
		this.jsFolder = this.libraryFolder.joinString("scripts"); 
		this.cssFolder = this.libraryFolder.joinString("styles");
		this.fontFolder = this.libraryFolder.joinString("fonts");
		this.htmlFolder = this.libraryFolder.joinString("html");
		this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").absolute();
	}

	public static async initialize()
	{
		this.initPaths();
		// by default all static assets have a modified time the same as main.js
		this.mainJsModTime = this.vaultPluginsPath.joinString("webpage-html-export/main.js").stat?.mtimeMs ?? 0;
		this.staticAssets.forEach(asset => asset.sourceStat.mtime = this.mainJsModTime);

		this.allAssets.sort((a, b) => a.loadPriority - b.loadPriority);
		
		let loadPromises = []
		for (let asset of this.allAssets)
		{
			loadPromises.push(asset.load());
		}
		await Promise.all(loadPromises);

		let graphViewJSPath = this.graphViewJS.getAssetPath();
		this.graphViewJS.getHTML = () => `<script type="module" async id="graph-view-script" src="${graphViewJSPath}"></script>`;
	}

	public static async reloadAssets(options: MarkdownWebpageRendererAPIOptions)
	{
		this.exportOptions = options;

		// remove all temporary assets from allAssets
		this.allAssets = this.allAssets.filter(asset => asset.mutability != Mutability.Temporary);
		this.temporaryAssets = [];

		let i = 0;

		let loadPromises = []
		for (let asset of this.dynamicAssets)
		{
			let loadPromise = asset.load();
			loadPromise.then(() =>
			{
				i++;
				ExportLog.progress(i / this.dynamicAssets.length, "Initialize Export", "Loading asset: " + asset.filename, "var(--color-yellow)");
			});
			loadPromises.push(loadPromise);
		}
		await Promise.all(loadPromises);
	}

	public static getAssetsOfType(type: AssetType): WebAsset[]
	{
		let assets = this.allAssets.filter(asset => asset.type == type);
		assets = assets.concat(this.allAssets.map(asset => asset.childAssets).flat().filter(asset => asset.type == type));
		return assets;
	}

	public static getAssetsOfInlinePolicy(inlinePolicy: InlinePolicy): WebAsset[]
	{
		let assets = this.allAssets.filter(asset => asset.inlinePolicy == inlinePolicy);
		assets = assets.concat(this.allAssets.map(asset => asset.childAssets).flat().filter(asset => asset.inlinePolicy == inlinePolicy));
		return assets;
	}

	private static filterDownloads(downloads: WebAsset[], options: MarkdownWebpageRendererAPIOptions): WebAsset[]
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
		downloads = downloads.filter((asset, index, self) => self.findIndex((t) => t.targetPath.path == asset.targetPath.path) === index);

		// remove assets with no content
		downloads = downloads.filter(asset => asset.data && asset.data.length > 0);

		return downloads;
	}

	public static getDownloads(destination: Path, options: MarkdownWebpageRendererAPIOptions): WebAsset[]
	{
		let downloads = this.getAssetsOfInlinePolicy(InlinePolicy.Download)
						    .concat(this.getAssetsOfInlinePolicy(InlinePolicy.DownloadHead));

		downloads = downloads.concat(this.getAssetsOfInlinePolicy(InlinePolicy.Auto));
		downloads = downloads.concat(this.getAssetsOfInlinePolicy(InlinePolicy.AutoHead));

		downloads = this.filterDownloads(downloads, options);
		downloads.sort((a, b) => b.loadPriority - a.loadPriority);
		downloads.forEach(asset => asset.targetPath.setWorkingDirectory(destination.path));

		if (options.inlineMedia)
			downloads = downloads.filter(asset => asset.type != AssetType.Media);
		if (options.inlineFonts)
			downloads = downloads.filter(asset => asset.type != AssetType.Font);
		if (options.inlineJS)
			downloads = downloads.filter(asset => asset.type != AssetType.Script);
		if (options.inlineCSS)
			downloads = downloads.filter(asset => asset.type != AssetType.Style);
		if (options.inlineHTML)
			downloads = downloads.filter(asset => asset.type != AssetType.HTML);

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
	public static async getStyleChildAssets(asset: WebAsset, makeBase64External: boolean = false): Promise<string>
	{
		if (typeof asset.data != "string") throw new Error("Asset content is not a string");

		let content = asset.data.replaceAll("app://obsidian.md/", "");

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
					let extension = WebAsset.mimeToExtention(splitData[0].split(":")[1].split(";")[0]);
					let buffer = Buffer.from(data, "base64");
					let dataHash = hash(data);
					let filename = `${dataHash}.${extension}`;
					if (extension == '') 
					{
						let type = await fileTypeFromBuffer(buffer);
						if (type) extension = type.ext;
						filename = `${dataHash}.${extension}`;						
					}
					let type = WebAsset.extentionToType(extension);

					let childAsset = new WebAsset(filename, buffer, null, type, InlinePolicy.Download, false, Mutability.Child);
					asset.childAssets.push(childAsset);
					let loadPromise = childAsset.load();
					promises.push(loadPromise);
					loadPromise.then(() =>
					{
						if (childAsset.data == undefined || childAsset.data == null || childAsset.data.length == 0)
						{
							return;
						}

						let newPath = childAsset.getAssetPath(asset.getAssetPath());
						content = content.replaceAll(url, newPath.path);
					});
				}
				continue;
			} 

			let path = new Path(url);
			let type = WebAsset.extentionToType(path.extension);
			let childAsset = new FetchBuffer(path.fullName, url, type, InlinePolicy.Download, false, Mutability.Child);
			asset.childAssets.push(childAsset);

			let loadPromise = childAsset.load();
			promises.push(loadPromise);
			loadPromise.then(() => 
			{
				if (childAsset.data == undefined || childAsset.data == null || childAsset.data.length == 0)
				{
					return;
				}

				function addAsBase64()
				{
					let base64 = childAsset.data.toString("base64");
					content = content.replaceAll(url, `data:${mime.getType(url)};base64,${base64}`);
				}

				if ((this.exportOptions.inlineMedia && type == AssetType.Media) ||
					(this.exportOptions.inlineFonts && type == AssetType.Font) ||
					(this.exportOptions.inlineCSS && type == AssetType.Style) ||
					(this.exportOptions.inlineJS && type == AssetType.Script) ||
					(this.exportOptions.inlineHTML && type == AssetType.HTML))
					addAsBase64();
				else
				{
					let newPath = childAsset.getAssetPath(asset.getAssetPath());
					content = content.replaceAll(url, newPath.path);
				}
			});
		}

		await Promise.all(promises);

		return content;
	}

	public static filterStyleRules(appSheet: CSSStyleSheet, discard: string[], keep: string[]): string
	{
		let result = "";
		let cssRules = Array.from(appSheet.cssRules);
		for (const element of cssRules)
		{
			let rule = element;
			let selectors = rule.cssText.split("{")[0].split(",");
			selectors = selectors.map((selector) => selector.trim());
			selectors = selectors.filter((selector) => keep.some((keep) => selector.includes(keep)) || !discard.some((filter) => selector.includes(filter)));

			if (selectors.length == 0)
			{
				continue;
			}

			result += rule.cssText + "\n";
		}

		return result;
	}
}
