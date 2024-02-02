import graphViewJS from "assets/graph-view.txt.js";
import graphWASMJS from "assets/graph-wasm.txt.js";
import renderWorkerJS from "assets/graph-render-worker.txt.js";
import graphWASM from "assets/graph-wasm.wasm";
import tinyColorJS from "assets/tinycolor.txt.js";
import pixiJS from "assets/pixi.txt.js";
import websiteJS from "assets/website.txt.js";
import webpageStyles from "assets/plugin-styles.txt.css";
import deferredJS from "assets/deferred.txt.js";
import deferredCSS from "assets/deferred.txt.css";

import { Path } from "scripts/utils/path.js";
import { Asset, AssetType, InlinePolicy, LoadMethod, Mutability } from "./assets/asset.js";
import { ObsidianStyles } from "./assets/obsidian-styles.js";
import { OtherPluginStyles } from "./assets/other-plugin-styles.js";
import { ThemeStyles } from "./assets/theme-styles.js";
import { SnippetStyles } from "./assets/snippet-styles.js";
import { MathjaxStyles } from "./assets/mathjax-styles.js";
import { CustomHeadContent } from "./assets/custom-head-content.js";
import { Settings } from "scripts/settings/settings.js";
import { GlobalVariableStyles } from "./assets/global-variable-styles.js";
import { Favicon } from "./assets/favicon.js";
import { FetchBuffer } from "./assets/local-fetch-buffer.js";
import { RenderLog } from "./render-log.js";
import { SupportedPluginStyles } from "./assets/supported-plugin-styles.js";
const mime = require('mime');


export class AssetHandler
{
	public static vaultPluginsPath: Path;

	public static staticAssets: Asset[] = [];
	public static dynamicAssets: Asset[] = [];
	public static allAssets: Asset[] = [];
	public static temporaryAssets: Asset[] = [];

	// styles
	public static obsidianStyles: ObsidianStyles = new ObsidianStyles();
	public static otherPluginStyles: OtherPluginStyles = new OtherPluginStyles();
	public static themeStyles: ThemeStyles = new ThemeStyles();
	public static snippetStyles: SnippetStyles = new SnippetStyles();
	public static mathjaxStyles: MathjaxStyles = new MathjaxStyles();
	public static globalDataStyles: GlobalVariableStyles = new GlobalVariableStyles();
	public static supportedPluginStyles: SupportedPluginStyles = new SupportedPluginStyles();
	public static websiteStyles: Asset = new Asset("main-styles.css", webpageStyles, AssetType.Style, InlinePolicy.Auto, true, Mutability.Static, LoadMethod.Async, 4);
	public static deferredCSS: Asset = new Asset("deferred.css", deferredCSS, AssetType.Style, InlinePolicy.AlwaysInline, true, Mutability.Static, LoadMethod.Defer);

	// scripts
	public static websiteJS: Asset = new Asset("webpage.js", websiteJS, AssetType.Script, InlinePolicy.Auto, true, Mutability.Static, LoadMethod.Async);
	public static graphViewJS: Asset = new Asset("graph-view.js", graphViewJS, AssetType.Script, InlinePolicy.Auto, true, Mutability.Static);
	public static graphWASMJS: Asset = new Asset("graph-wasm.js", graphWASMJS, AssetType.Script, InlinePolicy.Auto, true, Mutability.Static);
	public static graphWASM: Asset = new Asset("graph-wasm.wasm", Buffer.from(graphWASM), AssetType.Script, InlinePolicy.None, false, Mutability.Static);
	public static renderWorkerJS: Asset = new Asset("graph-render-worker.js", renderWorkerJS, AssetType.Script, InlinePolicy.Auto, true, Mutability.Static);
	public static tinyColorJS: Asset = new Asset("tinycolor.js", tinyColorJS, AssetType.Script, InlinePolicy.Auto, true, Mutability.Static);
	public static pixiJS: Asset = new Asset("pixi.js", pixiJS, AssetType.Script, InlinePolicy.Auto, true, Mutability.Static);
	public static deferredJS: Asset = new Asset("deferred.js", deferredJS, AssetType.Script, InlinePolicy.AlwaysInline, true, Mutability.Static, LoadMethod.Defer);

	// other
	public static favicon: Favicon = new Favicon();
	public static externalLinkIcon: Asset;
	public static customHeadContent: CustomHeadContent;
	public static mainJsModTime: number = 0;

	public static async initialize()
	{
		this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").makeAbsolute();
		
		this.customHeadContent = new CustomHeadContent();
		
		this.allAssets.sort((a, b) => a.loadMethod - b.loadMethod);
		
		// by default all static assets have a modified time the same as main.js
		this.mainJsModTime = this.vaultPluginsPath.joinString("webpage-html-export/main.js").stat?.mtimeMs ?? 0;
		this.staticAssets.forEach(asset => asset.modifiedTime = this.mainJsModTime);
		
		this.allAssets.forEach(async (asset) => await asset.load());
		
		let graphViewPath = this.graphViewJS.getAssetPath();
		this.graphViewJS.getHTMLInclude = () => `<script type="module" async id="graph-view-script" src="${graphViewPath}"></script>`;
	}

	public static async reloadAssets()
	{
		// remove all temporary assets from allAssets
		this.allAssets = this.allAssets.filter(asset => asset.mutability != Mutability.Temporary);
		this.temporaryAssets = [];

		let loadPromises = []
		for (let i = 0; i < this.dynamicAssets.length; i++)
		{
			loadPromises.push(this.dynamicAssets[i].load());
		}
		await Promise.all(loadPromises);
	}

	public static getAssetsOfType(type: AssetType): Asset[]
	{
		return this.allAssets.filter(asset => asset.type == type);
	}

	public static getAssetDownloads(bypassInlineCheck: boolean = false): Asset[]
	{
		if(!bypassInlineCheck && Settings.settings.inlineAssets) return [];

		let downloadAssets = this.allAssets;

		if (!Settings.settings.includeGraphView)
		{
			downloadAssets = downloadAssets.filter(asset => ![this.graphViewJS, this.graphWASMJS, this.graphWASM, this.renderWorkerJS, this.tinyColorJS].includes(asset));
		}

		// remove assets that are always inlined
		downloadAssets = downloadAssets.filter(asset => asset.inlinePolicy != InlinePolicy.AlwaysInline);

		// remove duplicates
		downloadAssets = downloadAssets.filter((asset, index, self) => self.findIndex((t) => t.relativeDownloadPath.asString == asset.relativeDownloadPath.asString) === index);

		// remove assets with no content
		downloadAssets = downloadAssets.filter(asset => asset.content && asset.content.length > 0);

		downloadAssets.sort((a, b) => b.loadPriority - a.loadPriority);
		return downloadAssets;
	}

	/*Takes a style sheet string and creates assets from every font or image url embedded in it*/
	public static async createAssetsFromStyles(asset: Asset, makeBase64External: boolean = false): Promise<string>
	{
		if (typeof asset.content != "string") throw new Error("Asset content is not a string");

		let content = asset.content.replaceAll("app://obsidian.md/", "");

		let urls = Array.from(content.matchAll(/url\("([^"]+)"\)|url\('([^']+)'\)/g));

		// remove duplicates
		urls = urls.filter((url, index, self) => self.findIndex((t) => t[0] === url[0]) === index);

		// use this mutability for child assets
		let mut = asset.mutability == Mutability.Static ? Mutability.Static : Mutability.Temporary;
            
		for (let urlObj of urls)
		{
			let url = urlObj[1] || urlObj[2];
			url = url.trim();

			if (url == "") continue;

			if (url.startsWith("data:"))
			{
				if (!Settings.settings.inlineAssets && makeBase64External)
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
					let type = Asset.extentionToType(extension);

					let childAsset = new Asset(filename, buffer, type, InlinePolicy.None, false, mut);
					await childAsset.load();

					if (childAsset.content == undefined || childAsset.content == null || childAsset.content.length == 0)
					{
						RenderLog.error(`Failed to load ${url}`);
						continue;
					}

					let newPath = childAsset.getAssetPath(asset.getAssetPath());
					content = content.replaceAll(url, newPath.asString);
				}
				continue;
			} 

			let path = new Path(url);
			let type = Asset.extentionToType(path.extension);
			let childAsset = new FetchBuffer(path.fullName, url, type, InlinePolicy.None, false, mut);
			await childAsset.load();
			
			if (childAsset.content == undefined || childAsset.content == null || childAsset.content.length == 0)
			{
				RenderLog.error(`Failed to load ${url}`);
				continue;
			}

			if (Settings.settings.inlineAssets)
			{
				let base64 = childAsset.content.toString("base64");
				content = content.replaceAll(url, `data:${mime.getType(url)};base64,${base64}`);
			}
			else
			{
				childAsset.setRelativeDownloadDirectory(childAsset.relativeDownloadDirectory.makeWebStyle(Settings.settings.makeNamesWebStyle));
				if (Settings.settings.makeNamesWebStyle) childAsset.setFilename(Path.toWebStyle(childAsset.filename));

				let newPath = childAsset.getAssetPath(asset.getAssetPath());
				content = content.replaceAll(url, newPath.asString);
			}
		}


		return content;
	}
}
