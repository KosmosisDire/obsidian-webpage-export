import graphWASMJS from "src/frontend/graph-view/graph-wasm.txt.js";
import renderWorkerJS from "src/frontend/graph-view/graph-render-worker.txt.js";
import graphWASM from "src/frontend/graph-view/graph-wasm.wasm";
import webpageStyles from "src/assets/plugin-styles.txt.css";
import deferredJS from "src/assets/deferred.txt.js";
import deferredCSS from "src/assets/deferred.txt.css";
import themeLoadJS from "src/assets/theme-load.txt.js";

import minisearchJS from "src/assets/minisearch.txt.js";

import { Path } from "src/plugin/utils/path.js";
import { AssetLoader } from "./base-asset.js";
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
import { ExportLog } from "src/plugin/render-api/render-api.js";
import { fileTypeFromBuffer } from "file-type";
import { ExportPipelineOptions } from "src/plugin/website/pipeline-options.js";
import { Shared } from "src/shared/shared.js";
import { WebsiteJS } from "./website-js.js";
import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';
const mime = require('mime');


export class AssetHandler
{
	public static vaultPluginsPath: Path;

	public static staticAssets: AssetLoader[] = [];
	public static dynamicAssets: AssetLoader[] = [];
	public static allAssets: AssetLoader[] = [];
	public static temporaryAssets: AssetLoader[] = [];

	// this path is used to generate the relative path to the images folder, likewise for the other paths
    private static libraryFolder: Path;
	private static mediaFolder: Path;
	private static jsFolder: Path;
	private static cssFolder: Path;
	private static fontFolder: Path;
	private static htmlFolder: Path;

	public static exportOptions: ExportPipelineOptions = new ExportPipelineOptions();

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
		return AssetLoader.typeToDir(type).joinString(filename).setWorkingDirectory(destinationDir.path).slugified(this.exportOptions.slugifyPaths);
	}

	// styles
	public static obsidianStyles: ObsidianStyles;
	public static otherPluginStyles: OtherPluginStyles;
	public static themeStyles: ThemeStyles;
	public static snippetStyles: SnippetStyles;
	public static mathjaxStyles: MathjaxStyles;
	public static globalDataStyles: GlobalVariableStyles;
	public static supportedPluginStyles: SupportedPluginStyles;
	public static websiteStyles: AssetLoader;
	public static deferredCSS: AssetLoader;

	// scripts
	public static websiteJS: WebsiteJS;
	public static graphWASMJS: AssetLoader;
	public static graphWASM: AssetLoader;
	public static renderWorkerJS: AssetLoader;
	public static deferredJS: AssetLoader;
	public static themeLoadJS: AssetLoader;
	 
	// other
	public static favicon: Favicon;
	public static customHeadContent: CustomHeadContent;
	public static mainJsModTime: number = 0;
	public static mainJsPath: Path;

	private static initPaths()
	{
		this.libraryFolder = new Path(Shared.libFolderName);
		this.mediaFolder = this.libraryFolder.joinString(Shared.mediaFolderName);
		this.jsFolder = this.libraryFolder.joinString(Shared.scriptsFolderName); 
		this.cssFolder = this.libraryFolder.joinString(Shared.cssFolderName);
		this.fontFolder = this.libraryFolder.joinString(Shared.fontFolderName);
		this.htmlFolder = this.libraryFolder.joinString(Shared.htmlFolderName);
		this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").absolute();
	}

	public static async initialize()
	{
		this.obsidianStyles = new ObsidianStyles();
		this.otherPluginStyles = new OtherPluginStyles();
		this.themeStyles = new ThemeStyles();
		this.snippetStyles = new SnippetStyles();
		this.mathjaxStyles = new MathjaxStyles();
		this.globalDataStyles = new GlobalVariableStyles();
		this.supportedPluginStyles = new SupportedPluginStyles();
		this.websiteJS = new WebsiteJS();
		this.websiteStyles = new AssetLoader("main-styles.css", webpageStyles, null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Static, LoadMethod.Async, 4);
		this.deferredCSS = new AssetLoader("deferred.css", deferredCSS, null, AssetType.Style, InlinePolicy.InlineHead, true, Mutability.Static, LoadMethod.Defer, -1000);
		this.graphWASMJS = new AssetLoader("graph-wasm.js", graphWASMJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
		this.graphWASM = new AssetLoader("graph-wasm.wasm", Buffer.from(graphWASM), null, AssetType.Script, InlinePolicy.Download, false, Mutability.Static);
		this.renderWorkerJS = new AssetLoader("graph-render-worker.js", renderWorkerJS, null, AssetType.Script, InlinePolicy.AutoHead, true, Mutability.Static);
		this.deferredJS = new AssetLoader("deferred.js", deferredJS, null, AssetType.Script, InlinePolicy.InlineHead, true, Mutability.Static, LoadMethod.Defer, -1000);
		this.themeLoadJS = new AssetLoader("theme-load.js", themeLoadJS, null, AssetType.Script, InlinePolicy.Inline, true, Mutability.Static, LoadMethod.Defer);
		this.favicon = new Favicon();
		this.customHeadContent = new CustomHeadContent();


		this.initPaths();
		// by default all static assets have a modified time the same as main.js
		this.mainJsPath = this.vaultPluginsPath.joinString("webpage-html-export/main.js");
		this.mainJsModTime = this.mainJsPath.stat?.mtimeMs ?? 0;
		this.staticAssets.forEach(asset => asset.sourceStat.mtime = this.mainJsModTime);

		this.allAssets.sort((a, b) => a.loadPriority - b.loadPriority);
		
		const loadPromises = []
		for (const asset of this.allAssets)
		{
			loadPromises.push(asset.load());
		}
		await Promise.all(loadPromises);
	}

	public static async reloadAssets(options: ExportPipelineOptions)
	{
		this.exportOptions = options;

		// remove all temporary assets from allAssets
		this.allAssets = this.allAssets.filter(asset => asset.mutability != Mutability.Temporary);
		this.temporaryAssets = [];

		let i = 0;

		const loadPromises = []
		ExportLog.addToProgressCap(this.dynamicAssets.length / 4);
		for (const asset of this.dynamicAssets)
		{
			const loadPromise = asset.load();
			loadPromise.then(() =>
			{
				i++;
				ExportLog.progress(0.25, "Initialize Export", "Loading asset: " + asset.filename, "var(--color-yellow)");
			});
			loadPromises.push(loadPromise);
		}
		await Promise.all(loadPromises);
	}

	public static getAssetsOfType(type: AssetType): AssetLoader[]
	{
		let assets = this.allAssets.filter(asset => asset.type == type);
		assets = assets.concat(this.allAssets.map(asset => asset.childAssets).flat().filter(asset => asset.type == type));
		return assets;
	}

	public static getAssetsOfInlinePolicy(inlinePolicy: InlinePolicy): AssetLoader[]
	{
		let assets = this.allAssets.filter(asset => asset.inlinePolicy == inlinePolicy);
		assets = assets.concat(this.allAssets.map(asset => asset.childAssets).flat().filter(asset => asset.inlinePolicy == inlinePolicy));
		return assets;
	}

	private static filterDownloads(downloads: AssetLoader[], options: ExportPipelineOptions): AssetLoader[]
	{
		if (!options.graphViewOptions.enabled)
		{
			downloads = downloads.filter(asset => ![this.graphWASMJS, this.graphWASM, this.renderWorkerJS].includes(asset));
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

	public static getDownloads(destination: Path, options: ExportPipelineOptions): AssetLoader[]
	{
		let downloads = this.getAssetsOfInlinePolicy(InlinePolicy.Download)
						    .concat(this.getAssetsOfInlinePolicy(InlinePolicy.DownloadHead))
							.concat(this.getAssetsOfInlinePolicy(InlinePolicy.Auto))
							.concat(this.getAssetsOfInlinePolicy(InlinePolicy.AutoHead));

		downloads = this.filterDownloads(downloads, options);
		downloads.sort((a, b) => b.loadPriority - a.loadPriority);
		downloads.forEach(asset => asset.targetPath.setWorkingDirectory(destination.path));

		if (options.inlineMedia)
		{
			downloads = downloads.filter(asset => asset.type != AssetType.Media);
		}
		if (options.inlineFonts)
		{
			downloads = downloads.filter(asset => asset.type != AssetType.Font);
		}
		if (options.inlineJS)
		{
			// keep wasm and render worker as downloaded always (they cannot be inlined)
			downloads = downloads.filter(asset => asset.type != AssetType.Script || (asset.extensionName == "wasm" || asset.filename == this.renderWorkerJS.filename));
		}
		if (options.inlineCSS)
		{
			downloads = downloads.filter(asset => asset.type != AssetType.Style);
		}
		if (options.inlineHTML)
		{
			downloads = downloads.filter(asset => asset.type != AssetType.HTML);
		}

		return downloads;
	}

	public static getHeadReferences(options: ExportPipelineOptions): string
	{
		let head = "";

		let referenceAssets = this.getAssetsOfInlinePolicy(InlinePolicy.DownloadHead)
								  .concat(this.getAssetsOfInlinePolicy(InlinePolicy.AutoHead))
								  .concat(this.getAssetsOfInlinePolicy(InlinePolicy.InlineHead));

		referenceAssets = this.filterDownloads(referenceAssets, options);
		referenceAssets.sort((a, b) => b.loadPriority - a.loadPriority);

		for (const asset of referenceAssets)
		{
			head += asset.getHTML(options);
		}

		return head;
	}

	/*Takes a style sheet string and creates assets from every font or image url embedded in it*/
	public static async getStyleChildAssets(asset: AssetLoader, makeBase64External: boolean = false): Promise<string>
	{
		if (typeof asset.data != "string") throw new Error("Asset content is not a string");

		let content = asset.data.replaceAll("app://obsidian.md/", "");

		let urls = Array.from(content.matchAll(/url\("([^"]+)"\)|url\('([^']+)'\)/g));

		// remove duplicates
		urls = urls.filter((url, index, self) => self.findIndex((t) => t[0] === url[0]) === index);

		// use this mutability for child assets
        const promises = [];
		for (const urlObj of urls)
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

					const splitData = url.split(",")
					const data = splitData.slice(1).join(",");
					let extension = AssetLoader.mimeToExtention(splitData[0].split(":")[1].split(";")[0]);
					const buffer = Buffer.from(data, "base64");
					const dataHash = hash(data);
					let filename = `${dataHash}.${extension}`;
					if (extension == '') 
					{
						const type = await fileTypeFromBuffer(buffer);
						if (type) extension = type.ext;
						filename = `${dataHash}.${extension}`;						
					}
					const type = AssetLoader.extentionToType(extension);

					const childAsset = new AssetLoader(filename, buffer, null, type, InlinePolicy.Download, false, Mutability.Child);
					asset.childAssets.push(childAsset);
					const loadPromise = childAsset.load();
					promises.push(loadPromise);
					loadPromise.then(() =>
					{
						if (childAsset.data == undefined || childAsset.data == null || childAsset.data.length == 0)
						{
							return;
						}

						const newPath = childAsset.getAssetPath(asset.getAssetPath());
						content = content.replaceAll(url, newPath.path);
					});
				}
				continue;
			} 

			const path = new Path(url);
			if (path.isDirectory || path.isEmpty)
			{
				continue;	
			}
			const type = AssetLoader.extentionToType(path.extension);
			const childAsset = new FetchBuffer(path.fullName, url, type, InlinePolicy.Download, false, Mutability.Child);
			asset.childAssets.push(childAsset);

			const loadPromise = childAsset.load();
			promises.push(loadPromise);
			loadPromise.then(() => 
			{
				if (childAsset.data == undefined || childAsset.data == null || childAsset.data.length == 0)
				{
					return;
				}

				function addAsBase64()
				{
					const base64 = childAsset.data.toString("base64");
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
					const newPath = childAsset.getAssetPath(asset.getAssetPath());
					content = content.replaceAll(url, newPath.path);
				}
			});
		}

		await Promise.all(promises);

		return content;
	}

	private static async filterStyleRulesCore(
        cssContent: string,
        alwaysDiscard: string[],
        discard: string[],
        keep: string[]
    ): Promise<string> {
        const result = await postcss([
            (root: postcss.Root) => {
                root.walkRules((rule: postcss.Rule) => {
                    const filteredSelectors = rule.selectors.filter((selector: string) => {
                        const selectorParts = selector.split(/[\s.#:>+~]+/).filter(Boolean);
                        
                        if (selectorParts.some(part => alwaysDiscard.some(d => part.includes(d)))) {
                            return false;
                        }
                        
                        if (selectorParts.some(part => keep.some(k => part.includes(k)))) {
                            return true;
                        }
                        
                        return !selectorParts.some(part => discard.some(d => part.includes(d)));
                    });

                    if (filteredSelectors.length === 0) {
                        rule.remove();
                    } else if (filteredSelectors.length !== rule.selectors.length) {
                        rule.selectors = filteredSelectors;
                    }
                });
            }
        ]).process(cssContent, { 
            from: undefined,
            parser: safeParser
        });

        return result.css;
    }

    public static async filterStyleRules(
        input: CSSStyleSheet | string,
        alwaysDiscard: string[],
        discard: string[],
        keep: string[]
    ): Promise<string> {
        let cssContent: string;

        if (typeof input === 'string') {
            cssContent = input;
        } else {
            const cssRules: CSSRule[] = Array.from(input.cssRules);
            cssContent = cssRules.map(rule => rule.cssText).join('\n');
        }

        return this.filterStyleRulesCore(cssContent, alwaysDiscard, discard, keep);
    }

}
