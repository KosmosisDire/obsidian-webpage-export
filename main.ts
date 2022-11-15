import { createWriteStream, open, readdirSync, readFile, write, writeFile, WriteFileOptions, existsSync, mkdirSync } from 'fs';
var JSZip = require("jszip");
import { MarkdownView, Plugin, TAbstractFile, TFile, PaneType, OpenViewState, SplitDirection, FileSystemAdapter, WorkspaceLeaf, Notice, View, FileView, MarkdownEditView, TextFileView, TFolder } from 'obsidian';
import {  ExportSettings } from './settings';
import { saveAs, FileSaverOptions } from 'file-saver';
import { NewWindowEvent } from 'electron';

import jQuery from 'jquery';
const $ = jQuery;

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;
declare const window: any;

export default class HTMLExportPlugin extends Plugin {

	pluginPath : string = Utils.getVaultPath() + "/.obsidian/plugins/obsidian-webpage-export";
	configPath : string = Utils.getVaultPath() + "/.obsidian";
	leafHandler : LeafHandler = new LeafHandler();

	imagesToDownload : {original_path: string, destination_path_rel: string}[] = [];

	appStyles :string = "";
	mathStylesLoaded : boolean = false;
	

	autoDownloadExtras = true;

	webpagejsURL : string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/webpage.js";
	pluginStylesURL : string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/plugin-styles.css";
	obsidianStylesURL : string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/obsidian-styles.css";
	async downloadExtras()
	{
		//Download webpage.js
		let webpagejs = await fetch(this.webpagejsURL);
		let webpagejsText = await webpagejs.text();
		await writeFile(this.pluginPath + "/webpage.js", webpagejsText, function(err) {
			if(err) {
				return console.log(err);
			}
			console.log("webpage.js file downloaded successfully");
		});

		//Download plugin-styles.css
		let pluginStyles = await fetch(this.pluginStylesURL);
		let pluginStylesText = await pluginStyles.text();
		await writeFile(this.pluginPath + "/plugin-styles.css", pluginStylesText, function(err) {
			if(err) {
				return console.log(err);
			}
			console.log("plugin-styles.css file downloaded successfully");
		});

		//Download obsidian-styles.css
		let obsidianStyles = await fetch(this.obsidianStylesURL);
		let obsidianStylesText = await obsidianStyles.text();
		await writeFile(this.pluginPath + "/obsidian-styles.css", obsidianStylesText, function(err) {
			if(err) {
				return console.log(err);
			}
			console.log("obsidian-styles.css file downloaded successfully");
		});

	}


	darkModeToggle =
	`\n\n
	<div>
	<label class="theme-toggle-inline" for="theme_toggle">
		<input class="toggle__input" type="checkbox" id="theme_toggle">
		<div class="toggle__fill"></div>
	</label>
	</div>
	\n\n`

	addTogglePostprocessor() 
	{
		this.registerMarkdownCodeBlockProcessor("theme-toggle", (source, el, ctx) => 
		{
			let parent = el.createEl('div');
			parent.innerHTML = this.darkModeToggle;
		});

		//also replace `theme-toggle` and ```theme-toggle``` for better inline toggles, or in places you couldn't use a normal code block
		this.registerMarkdownPostProcessor((element, context) => 
		{
			let codeBlocks = element.querySelectorAll('code');
			codeBlocks.forEach((codeBlock) => 
			{
				if (codeBlock.innerText == "theme-toggle")
				{
					codeBlock.outerHTML = this.darkModeToggle;
				}
			});
		});
	}

	async onload() 
	{
		console.log('loading obsidian-webpage-export plugin');

		await Utils.delay(1000);

		this.appStyles = "";
		var appSheet = document.styleSheets[1];
		let stylesheets = document.styleSheets;
		for (let i = 0; i < stylesheets.length; i++)
		{
			if (stylesheets[i].href && stylesheets[i].href?.includes("app.css"))
			{
				appSheet = stylesheets[i];
				break;
			}
		}

		this.appStyles += await Utils.getText(this.pluginPath + "/obsidian-styles.css");

		for (var i = 0; i < appSheet.cssRules.length; i++)
		{
			var rule = appSheet.cssRules[i];
			if (rule)
			{
				if (rule.cssText.startsWith("@font-face")) continue;
				if (rule.cssText.startsWith(".CodeMirror")) continue;
				if (rule.cssText.startsWith(".cm-")) continue;

				this.appStyles += rule.cssText + "\n";
			}
		}

		// await writeFile(this.pluginPath + "/app-styles.css", this.appStyles, function(err) {
		// 	if(err) {
		// 		return console.log(err);
		// 	}
		// 	console.log("app-styles.css file downloaded successfully");
		// });


		console.log("loaded app styles");

		if(this.autoDownloadExtras)
			await this.downloadExtras();


		new ExportSettings(this);
		ExportSettings.loadSettings();

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source) => {
				menu.addItem((item) => {item
					.setTitle("Export to HTML")
					.setIcon("document")
					.onClick(async () => 
					{
						if(Utils.getFileNameFromFilePath(file.path).contains("."))
							this.exportFile(file);

						else
							this.exportFolder(file.path);
					});
				});
			})
		);

		this.addRibbonIcon("folder-up", "Export Vault to HTML", async () =>
		{
			this.exportFolder("");
		});

		this.addTogglePostprocessor();
	}

	onunload() 
	{
		console.log('unloading obsidian-webpage-export plugin');
	}

	async exportFile(file: TAbstractFile, fullPath: string = "", showSettings: boolean = true)
	{
		this.leafHandler.switchToLeafWithFile(file as TFile, true);
						
		// Open the settings modal and wait until it's closed
		if (showSettings)
		{
			var exportCanceled = !await new ExportSettings(this).open();
			if (exportCanceled) return;
		}

		var html = await this.GetCurrentFileHTML();
		if (!html) return;
		
		var toDownload = [];

		if(!ExportSettings.settings.inlineCSS)
		{
			let appcss = this.appStyles;
			let plugincss = await Utils.getText(this.pluginPath + "/plugin-styles.css");
			let themecss = await Utils.getThemeContent(Utils.getCurrentTheme());

			let snippetsList = await Utils.getStyleSnippetsContent();
			let snippetsNames = await Utils.getEnabledSnippets();
			var snippets = "";

			for (var i = 0; i < snippetsList.length; i++)
			{
				snippets += `/* --- ${snippetsNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
			}

			// load 3rd party plugin css
			let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("/n");
			for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
			{
				if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;
				let path = this.pluginPath.replace("obsidian-webpage-export", thirdPartyPluginStyleNames[i].replace("\n", "")) + "/styles.css";
				let style = await Utils.getText(path);
				if (style) plugincss += "\n" + style + "\n";
			}

			let appcssDownload = { filename: "obsidian-styles.css", data: appcss, type: "text/css" };
			let plugincssDownload = { filename: "plugin-styles.css", data: plugincss, type: "text/css" };
			let themecssDownload = { filename: "theme.css", data: themecss, type: "text/css" };
			let snippetsDownload = { filename: "snippets.css", data: snippets, type: "text/css" };

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if(!ExportSettings.settings.inlineJS)
		{
			var webpagejs = await Utils.getText(this.pluginPath + "/webpage.js");
			var webpagejsDownload = { filename: "webpage.js", data: webpagejs, type: "text/javascript" };
			toDownload.push(webpagejsDownload);
		}

		// let imagesDownload : {path: string, data: string}[] = [];

		if(!ExportSettings.settings.inlineImages)
		{
			for (var i = 0; i < this.imagesToDownload.length; i++)
			{
				var image = this.imagesToDownload[i];
				var data = await Utils.getTextBase64(image.original_path);
				var imageDownload = 
				{ 
					filename: Utils.getFileNameFromFilePath(image.destination_path_rel), 
					data: data, 
					type: "image/png", 
					relativePath: Utils.getDirectoryFromFilePath(image.destination_path_rel),
					unicode: false
				};
				toDownload.push(imageDownload);
			}
		}

		var htmlDownload = { filename: file.name.replace(".md", ".html"), data: html, type: "text/html" };
		toDownload.push(htmlDownload);

		// Download file
		var htmlPath : string | null = fullPath;
		if (htmlPath == "")
			htmlPath = await Utils.showSaveDialog(Utils.idealDefaultPath(), file.name.replace(".md", ".html"), false);

		if (!htmlPath) return;

		let filename = Utils.getFileNameFromFilePath(htmlPath);
		let folderPath = Utils.getDirectoryFromFilePath(htmlPath);

		toDownload[toDownload.length - 1].filename = filename;

		Utils.downloadFiles(toDownload, folderPath);
	}

	async exportFolder(folderPath : string)
	{
		// folder path is the path relative to the vault that we are exporting

		// Open the settings modal and wait until it's closed
		var exportCanceled = !await new ExportSettings(this).open();
		if (exportCanceled) return;

		let htmlPath = await Utils.showSelectFolderDialog(Utils.idealDefaultPath());

		var files = this.app.vault.getFiles();

		for (var i = 0; i < files.length; i++)
		{
			var file = files[i];
			if(file.path.startsWith(folderPath) && file.extension == "md")
			{
				var fullPath = htmlPath + "/" + file.path.replace(".md", ".html");
				await this.exportFile(file, fullPath, false);
			}
		}
	}

	//#region General HTML
	
	async GetCurrentFileHTML(): Promise<string | null>
	{
		await Utils.delay(200);

		let view = await Utils.getActiveView();
		if (!view) return null;

		Utils.setLineWidth(ExportSettings.settings.customLineWidth);

		if (view instanceof MarkdownView)
			await Utils.viewEnableFullRender(view);

		var head = await this.generateHead(view);
		var html = this.generateBodyHTML();
		html = this.fixLinks(html);
		html = this.repairOnClick(html); //replace data-onlick with onclick

		if (ExportSettings.settings.inlineImages) 
			html = await this.inlineImages(html);
		else
			html = await this.outlineImages(html, view);
	
		// inject darkmode toggle
		if (ExportSettings.settings.addDarkModeToggle)
		{
			html = await this.injectToggle(html);
		}

		if (ExportSettings.settings.includeOutline)
		{
			var headers = this.getHeaderList(html);
			if (headers)
			{
				var outline = this.generateOutline(headers);
				// put side bars on either side of content and put them in a flex container
				let el = document.createElement("html");
				el.innerHTML = html;
				let body = el.querySelector("body");
				if (body)
				{
					html = `<div class="flex-container"><div id="sidebar" class="sidebar-left"></div>${body.innerHTML}<div id="sidebar" class="sidebar-right">${outline}</div></div>`;
					body.innerHTML = html;
					html = body?.outerHTML;
				}
				else
				{
					console.error("Could not find body element in html");
				}
				
				el.remove();
			}
		}

		html = head + html;

		// enclose in <html> tags
		html = "<!DOCTYPE html>\n<html>\n" + html + "\n</html>";

		return html;
	}

	generateBodyHTML() : string
	{
		var bodyClasses = document.body.getAttribute("class") ?? "";
		var bodyStyle = document.body.getAttribute("style") ?? "";
		/*@ts-ignore*/
		bodyClasses = bodyClasses.replaceAll("\"", "'");
		/*@ts-ignore*/
		bodyStyle = bodyStyle.replaceAll("\"", "'");

		var htmlEl = (document.querySelector(".workspace-leaf.mod-active .markdown-reading-view") as HTMLElement)
		if (!htmlEl) htmlEl = (document.querySelector(".workspace-leaf.mod-active .view-content") as HTMLElement);

		htmlEl.style.flexBasis = (htmlEl.querySelector("markdown-preview-sizer markdown-preview-section") as HTMLElement)?.style.width ?? "1000px";
		var html = htmlEl.outerHTML;

		html = "\n<body class=\"" + bodyClasses + "\" style=\"" + bodyStyle + "\">\n" + html + "\n</body>\n";

		return html;
	}

	async generateHead(view: TextFileView) : Promise<string>
	{
		let pluginStyles = await Utils.getText(this.pluginPath +"/plugin-styles.css");
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		let snippets = await Utils.getStyleSnippetsContent();
		let snippetNames = Utils.getEnabledSnippets();
		let theme = await Utils.getThemeContent(Utils.getCurrentTheme());

		let scripts = "\n\n<script src='https://code.jquery.com/jquery-3.6.0.js'></script>"
					+ ((ExportSettings.settings.inlineJS ? ("<script>\n" + await Utils.getText(this.pluginPath + "/webpage.js"))
					: "<script src='webpage.js'></script>\n") + "\n</script>\n");

		var height = 0;
		// @ts-ignore
		let sections = (view.currentMode?.renderer?.sections) ?? [];
		for (let i = 0; i < sections.length; i++)
		{
			height += sections[i].height;
		}

		let sizer = document.getElementsByClassName("markdown-preview-sizer markdown-preview-section");
		var width = "1000px"
		if (sizer) width = (sizer[0] as HTMLElement)?.style?.maxWidth?.replace("px", "");

		if (!this.mathStylesLoaded)
		{
			let mathStyles = document.styleSheets[document.styleSheets.length-1];
			var mathStylesString = "";

			var success = true;
			for (var i = 0; i < mathStyles.cssRules.length; i++)
			{
				var rule = mathStyles.cssRules[i];
				
				if (rule)
				{
					if (i == 0 && !rule.cssText.startsWith(".mjx"))
					{
						success = false;
						break;
					}

					if (rule.cssText.startsWith("@font-face")) continue;

					mathStylesString += rule.cssText + "\n";
				}
			}

			if (success)
			{
				this.appStyles += mathStylesString;
				this.mathStylesLoaded = true;
			}
		}

		let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("/n");
		for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
		{
			if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;

			let path = this.pluginPath.replace("obsidian-webpage-export", thirdPartyPluginStyleNames[i].replace("\n", "")) + "/styles.css";
			let style = await Utils.getText(path);
			if (style) pluginStyles += "\n" + style + "\n";
		}
		
					
		let meta = 
		`
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="mobile-web-app-capable" content="yes">
		<title>${view.file.basename}</title>
		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		<meta name="data-width" data-width="${width}"></meta>
		<meta name="data-height" data-height="${height}"></meta>
		`

		

		if (ExportSettings.settings.inlineCSS)
		{
			var header = 
			`
			<head>

			${meta}
			
			<!-- Theme Styles ( ${Utils.getCurrentTheme()} ) -->
			<style> ${theme} </style>

			<!-- Snippets: ${snippetNames.join(", ")} -->
			<style> ${snippets.join("</style><style>")} </style>
		
			<!-- Plugin Styles -->
			<style> ${pluginStyles} </style>

			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${this.appStyles} </style>
			<style> ${cssSettings} </style>

			${scripts}

			</head>
			`;
		}
		else
		{
			header = 
			`
			<head>

			${meta}

			<link rel="stylesheet" href="obsidian-styles.css">
			<link rel="stylesheet" href="plugin-styles.css">
			<link rel="stylesheet" href="theme.css">
			<link rel="stylesheet" href="snippets.css">

			<style> ${cssSettings} </style>

			${scripts}

			</head>
			`;
		}

		return header;
	}

	//#endregion

	//#region Links and Images

	fixLinks(html: string): string
	{
		let el = document.createElement('html');
		el.innerHTML = html;

		let query = jQuery(el);
		query.find("a.internal-link").each(function () 
		{
			$(this).attr("target", "_self");
			
			let finalHref = "";
			let href = $(this).attr("href")?.split("#");

			if(!href) return;

			// if the file doesn't start with #, then it links to a file, or a header in another file.
			if(!(href[0] == ""))
			{
				if(href.length == 1)
				{
					finalHref = href[0] + ".html";
				}

				if(href.length == 2)
				{
					var filePath = "";
					if(!href[0].contains("/") && !href[0].contains("\\"))
					{
						filePath = Utils.getDirectoryFromFilePath(Utils.getFirstFileByName(href[0])?.path ?? "") + "/";
					}

					finalHref = filePath + href[0] + ".html#" + href[1].replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}

				if(href.length > 2)
				{
					let first = href.shift() ?? "";

					var filePath = "";
					if(!first.contains("/") && !first.contains("\\"))
					{
						filePath = Utils.getDirectoryFromFilePath(Utils.getFirstFileByName(first)?.path ?? "") + "/";
					}

					finalHref = filePath + first + ".html#" + href.join("#").replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}
			}
			else // if the file starts with #, then it links to an internal header.
			{
				href.shift();
				if(href.length == 1)
				{
					finalHref = "#"+href[0].replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}

				if(href.length > 1)
				{
					finalHref = href.join("#").replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}
			}

			$(this).attr("href", finalHref);
		});

		query.find("h1, h2, h3, h4, h5, h6").each(function ()
		{
			// use the headers inner text as the id
			$(this).attr("id", $(this).text().replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_"));
		});

		let result = el.innerHTML;
		el.remove();
		return result;
	}

	async inlineImages(html: string): Promise<string>
	{
		let el = document.createElement('html');
		el.innerHTML = html;

		let query = jQuery(el);
		let images = query.find("img").toArray();
		
		for (let i = 0; i < images.length; i++)
		{
			let img = images[i];
			if ($(img).attr("src")?.startsWith("app://local/"))
			{
				let path = $(img).attr("src")?.replace("app://local/", "").replaceAll("%20", " ").split("?")[0];

				if (path)
				{
					var base64 = "";
					try
					{
						base64 = await Utils.getTextBase64(path);
					}
					catch (e)
					{
						console.error(e);
						console.warn("Failed to inline image: " + path);
						new Notice("Failed to inline image: " + path, 5000);
						continue;
					}

					$(img).attr("src", "data:image/png;base64," + base64);
				}
			}
		}

		let result = el.innerHTML;
		el.remove();
		return result;
	}

	async outlineImages(html: string, view: TextFileView): Promise<string>
	{
		let el = document.createElement('html');
		el.innerHTML = html;

		let query = jQuery(el);

		this.imagesToDownload = [];

		let img2Download : {original_path: string, destination_path_rel: string}[] = [];
		let vaultPath = Utils.getVaultPath();

		query.find("img").each(function ()
		{
			if (!$(this).attr("src")?.startsWith("app://local/")) return;
			
			let originalPath = $(this).attr("src")?.replaceAll("\\", "/").replaceAll("%20", " ").replace("app://local/", "");

			console.log("originalPath: " + originalPath);

			if (!originalPath) 
			{
				new Notice("Failed to outline image: " + originalPath + ". Couldn't find image src", 5000);
				return;
			}

			if (originalPath.startsWith("data:image/png;base64,") || originalPath.startsWith("data:image/jpeg;base64,")) return;

			let relPath = originalPath.split(Utils.getDirectoryFromFilePath(vaultPath + "/" + view.file.path.replaceAll("\\", "/")) + "/")[1];

			console.log(originalPath, "vs.", Utils.getDirectoryFromFilePath(vaultPath + "/" + view.file.path.replaceAll("\\", "/")) + "/");
			
			if (!relPath)
				relPath = ("images/" + Utils.getFileNameFromFilePath($(this).attr("src")?.replaceAll("\\", "/").replaceAll("%20", " ") ?? "")) ?? "img.png";
			
			console.log("relPath: " + relPath);

			$(this).attr("src", relPath);

			img2Download.push({original_path: originalPath, destination_path_rel: relPath});
			
		});

		this.imagesToDownload = img2Download;

		let result = el.innerHTML;
		el.remove();
		return result;
	}

	//#endregion

	//#region Special Features
	
	async injectToggle(html: string) : Promise<string>
	{
		if (!html.contains(this.darkModeToggle.split("\n")[1]))
		{
			//insert fixed toggle in corner
			html = this.darkModeToggle.replace("theme-toggle-inline", "theme-toggle") + html;
		}

		return html;
	}

	repairOnClick(html: string) : string
	{
		html = html.replaceAll("data-onclick", "onclick");
		return html;
	}

	getHeaderList(html: string) : {size: number, title: string, href: string}[] | null
	{
		var headers = [];

		var el = document.createElement( 'html' );
		el.innerHTML = html;

		var headerElements = el.querySelectorAll("h1, h2, h3, h4, h5, h6");

		for (var i = 0; i < headerElements.length; i++)
		{
			var header = headerElements[i];
			var size = parseInt(header.tagName[1]);
			var title = (header as HTMLElement).innerText;
			var href = (header as HTMLHeadingElement).id;
			headers.push({size, title, href});
		}

		el.remove();

		return headers;
	}

	generateOutline(headers: {size: number, title: string, href:string}[]) : string
	{
		var outline = 
		`
		<div class="outline-container" data-size="0">
		    
			<div class="outline-header">
				<svg viewBox="0 0 100 100" class="bullet-list" width="18" height="18"><path fill="var(--h6-color)" stroke="var(--h6-color)" d="M16.4,16.4c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,16.4,16.4,16.4z M16.4,19.6 c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2C13.2,21,14.6,19.6,16.4,19.6z M29.2,21.2v3.2H90v-3.2H29.2z M16.4,43.6c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,43.6,16.4,43.6z M16.4,46.8c1.8,0,3.2,1.4,3.2,3.2 s-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2S14.6,46.8,16.4,46.8z M29.2,48.4v3.2H90v-3.2H29.2z M16.4,70.8c-3.5,0-6.4,2.9-6.4,6.4 c0,3.5,2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4C22.8,73.7,19.9,70.8,16.4,70.8z M16.4,74c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2 s-3.2-1.4-3.2-3.2C13.2,75.4,14.6,74,16.4,74z M29.2,75.6v3.2H90v-3.2H29.2z"></path></svg>
				<h6 style="margin: 1em"> Table of Contents </h6>
			</div>
		
		</div>
		`;

		var builderRoot = document.createElement( 'html' );
		builderRoot.innerHTML = outline;

		var outlineEl = builderRoot.querySelector(".outline-container");

		if (!outlineEl) return "";

		var listItemTemplate = 
		`
		
		<div class="outline-item" data-size="{size}">
			
			<div class="outline-item-contents">
				<div class="tree-item-icon collapse-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path>
					</svg>
				</div>

				<a class="outline-item-title" href="#{href}">{title}</a>
			</div>

			<div class="outline-item-children">

			</div>
		</div>
		`;


		var listStack = [outlineEl];

		// function to get the data-size of the previous list item as a number
		function getLastStackSize() : number
		{
			return parseInt(listStack[listStack.length - 1].getAttribute("data-size") ?? "0");
		}


		for (var i = 0; i < headers.length; i++)
		{
			var header = headers[i];
			var listItem = listItemTemplate.replace("{size}", header.size.toString()).replace("{href}", header.href).replace("{title}", header.title);

			while (getLastStackSize() >= header.size && listStack.length > 1)
			{
				listStack.pop();
			}

			var builditemRoot = document.createElement( 'div' );
			builditemRoot.innerHTML = listItem;
			var newOutlineItem = builditemRoot.querySelector(".outline-item");

			if (!newOutlineItem) continue;
			
			var childContainer = listStack.last()?.querySelector(".outline-item-children");
			if (getLastStackSize() == 0) childContainer = listStack.last();

			if (!childContainer) continue;
			
			childContainer.appendChild(newOutlineItem);
			listStack.push(newOutlineItem);

			builditemRoot.remove();
		}

		var result = builderRoot.innerHTML;
		builderRoot.remove();

		return result;
	}

	//#endregion

	
}

export class Utils
{
	static async delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}


	static async getText(path: string): Promise<string>
	{
		return new Promise((resolve, reject) => {
			open(path, 'r', (err, fd) => {
				if (err) {
					reject(err);
				} else {
					readFile(fd, { encoding: 'utf8' }, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				}
			});
		});
	}

	static async getTextBase64(path: string): Promise<string>
	{
		return new Promise((resolve, reject) => {
			open(path, 'r', (err, fd) => {
				if (err) {
					reject(err);
				} else {
					readFile(fd, { encoding: 'base64' }, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				}
			});
		});
	}

	static changeViewMode(view: MarkdownView, modeName: "preview" | "source")
	{
		/*@ts-ignore*/
		const mode = view.modes[modeName]; 
		/*@ts-ignore*/
		mode && view.setMode(mode);
	};

	static createUnicodeArray(content: string) : Uint8Array
	{
		var charCode, byteArray = [];

		// BE BOM
		byteArray.push(254, 255);

		// LE BOM
		// byteArray.push(255, 254);

		for (var i = 0; i < content.length; ++i) {

		charCode = content.charCodeAt(i);

		// BE Bytes
		byteArray.push((charCode & 0xFF00) >>> 8);
		byteArray.push(charCode & 0xFF);

		// LE Bytes
		// byteArray.push(charCode & 0xff);
		// byteArray.push(charCode / 256 >>> 0);
		}

		return new Uint8Array(byteArray);
	}

	static async showSaveDialog(defaultPath: string, defaultFileName: string, showAllFilesOption: boolean = true): Promise<string | null>
	{
		let type = (defaultFileName.split(".").pop() ?? "txt");

		var filters = [{
			name: type.toUpperCase() + " Files",
			extensions: [type]
		}];

		if (showAllFilesOption)
		{
			filters.push({
				name: "All Files",
				extensions: ["*"]
			});
		}

		let picker = await dialog.showSaveDialog({
			defaultPath: (defaultPath + "/" + defaultFileName).replaceAll("\\", "/").replaceAll("//", "/"),
			filters: filters,
			properties: ["showOverwriteConfirmation"]
		})

		if (picker.canceled) return null;
		
		let path = picker.filePath ?? "";

		if (path != "")
		{
			ExportSettings.settings.lastExportPath = path;
			ExportSettings.saveSettings();
		}
		
		return path;
	}

	static async showSelectFolderDialog(defaultPath: string): Promise<string | null>
	{
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath,
			properties: ["openDirectory"]
		});

		if (picker.canceled) return null;

		let path = picker.filePaths[0] ?? "";

		if (path != "")
		{
			ExportSettings.settings.lastExportPath = path;
			ExportSettings.saveSettings();
		}

		return path;
	}

	static idealDefaultPath() : string
	{
		return ExportSettings.settings.lastExportPath == "" ? (Utils.getVaultPath() ?? "") : ExportSettings.settings.lastExportPath;
	}

	static async downloadFile(data: string, filename: string, path: string = "")
	{
		if (path == "")
		{
			path = await Utils.showSaveDialog(Utils.idealDefaultPath(), filename) ?? "";

			if (path == "") return;
		}

		var array = Utils.createUnicodeArray(data);

		writeFile(path, array, (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	}

	static async downloadFilesAsZip(files: {filename: string, data: string, type: string, relativePath?: string}[], zipFileName: string)
	{
		var blobs = files.map(file => new Blob([file.data], {type: file.type}));
		var zip = new JSZip();
		for (var i = 0; i < files.length; i++)
		{
			let path = ((files[i].relativePath ?? "") + "/" + files[i].filename).replaceAll("//", "/");
			zip.file(path, blobs[i]);
		}

		var zipBlob = await zip.generateAsync({type: "uint8array"});
		
		var path = await Utils.showSaveDialog(Utils.idealDefaultPath(), zipFileName, false) ?? "";

		if (path == "") return;

		writeFile(path, zipBlob, (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	}

	static async downloadFiles(files: {filename: string, data: string, type?: string, relativePath?: string, unicode?: boolean}[], folderPath: string)
	{
		for (var i = 0; i < files.length; i++)
		{
			var array = (files[i].unicode ?? true) ? Utils.createUnicodeArray(files[i].data) : Buffer.from(files[i].data, 'base64');

			let path = (folderPath + "/" + (files[i].relativePath ?? "") + "/" + files[i].filename).replaceAll("\\", "/").replaceAll("//", "/").replaceAll("//", "/");
			
			let dir = Utils.getDirectoryFromFilePath(path);
			if (!existsSync(dir))
			{
				mkdirSync(dir, { recursive: true });
			}
			
			writeFile(path, array, (err) => {
				if (err) throw err;
				console.log('The file has been saved!');
			});
		}
	}

	static getDirectoryFromFilePath(path: string): string
	{
		var forwardIndex = path.lastIndexOf("/");
		var backwardIndex = path.lastIndexOf("\\");
		
		var index = forwardIndex > backwardIndex ? forwardIndex : backwardIndex;

		if (index == -1) return "";

		return path.substring(0, index);
	}

	static getFileNameFromFilePath(path: string): string
	{
		var forwardIndex = path.lastIndexOf("/");
		var backwardIndex = path.lastIndexOf("\\");

		var index = forwardIndex > backwardIndex ? forwardIndex : backwardIndex;

		if (index == -1) return path;

		return path.substring(index + 1);
	}

	static getVaultPath(): string | null
	{
		let adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath().replaceAll("\\", "/");
		}

		return null;
	}

	//async function that awaits until a condition is met
	static async waitUntil(condition: () => boolean, timeout: number = 1000, interval: number = 100): Promise<void>
	{
		return new Promise((resolve, reject) => {
			let timer = 0;
			let intervalId = setInterval(() => {
				if (condition()) {
					clearInterval(intervalId);
					resolve();
				} else {
					timer += interval;
					if (timer >= timeout) {
						clearInterval(intervalId);
						reject();
					}
				}
			}, interval);
		});
	}

	static async getThemeContent(themeName: string): Promise<string>
	{
		let themePath = this.getVaultPath() + "/.obsidian/themes/" + themeName + "/theme.css";
		let themeContent = await Utils.getText(themePath);
		return themeContent;
	}

	static getCurrentTheme(): string
	{
		/*@ts-ignore*/ // config does exist
		return app.vault.config?.cssTheme ?? "Default";
	}

	static getEnabledSnippets(): string[]
	{
		/*@ts-ignore*/
		return app.vault.config?.enabledCssSnippets ?? [];
	}

	static async getStyleSnippetsContent(): Promise<string[]>
	{
		let snippetContents : string[] = [];
		let enabledSnippets = this.getEnabledSnippets();

		for (var i = 0; i < enabledSnippets.length; i++)
		{
			snippetContents.push(await Utils.getText(Utils.getVaultPath() + "/.obsidian/snippets/" + enabledSnippets[i] + ".css"));
		}

		return snippetContents;
	}

	static async viewEnableFullRender(view: MarkdownView)
	{
		Utils.changeViewMode(view, "preview");
		await this.delay(200);
		/*@ts-ignore*/
		view.previewMode.renderer.showAll = true;
		/*@ts-ignore*/
		await view.previewMode.renderer.unfoldAllHeadings();
		await Utils.delay(300);
		/*@ts-ignore*/
		await view.previewMode.renderer.rerender();
	}

	static async getActiveView(): Promise<TextFileView | null>
	{
		let view = app.workspace.getActiveViewOfType(TextFileView);
		if (!view)
		{
			console.log("Failed to find active view");
			return null;
		}

		return view;
	}

	static getFirstFileByName(name: string): TFile | undefined
	{
		return app.vault.getFiles().find(file =>
		{
			if(!name) return false;
			return file.basename == name;
		});
	}

	static setLineWidth(width: number) : void
	{
		if (width != 0)
		{
			let sizers = document.getElementsByClassName("markdown-preview-sizer markdown-preview-section");
			if (sizers.length > 0)
				sizers[0].setAttribute("style", "max-width: " + width + "px");
		}
	}
}

export class LeafHandler
{
	// from obsidian-switcher-plus by darlal: https://github.com/darlal/obsidian-switcher-plus/blob/27d337039883008bcbf40ca13ea2f9287469dde4/src/Handlers/handler.ts#L388
	// only some functions are used and have been packaged into this class for easy use.

	isMainPanelLeaf(leaf: WorkspaceLeaf): boolean 
	{
		const { workspace } = app;
		const root = leaf?.getRoot();
		/*@ts-ignore*/
		return root === workspace.rootSplit || root === workspace.floatingSplit;
	}

	getOpenLeaves(excludeMainPanelViewTypes?: string[], includeSidePanelViewTypes?: string[]): WorkspaceLeaf[] 
	{
		const leaves: WorkspaceLeaf[] = [];

		const saveLeaf = (l: WorkspaceLeaf) => {
		const viewType = l.view?.getViewType();

		if (this.isMainPanelLeaf(l)) {
			if (!excludeMainPanelViewTypes?.includes(viewType)) {
			leaves.push(l);
			}
		} else if (includeSidePanelViewTypes?.includes(viewType)) {
			leaves.push(l);
		}
		};

		app.workspace.iterateAllLeaves(saveLeaf);
		return leaves;
	}

	openFileInNewLeaf( 
		file: TFile,
		navType: PaneType | boolean,
		openState?: OpenViewState,
		errorContext?: string,
		splitDirection: SplitDirection = 'vertical',
	): void 
	{
		const { workspace } = app;
		errorContext = errorContext ?? '';
		const message = `Switcher++: error opening file. ${errorContext}`;

		const getLeaf = () => {
			return navType === 'split'
				? workspace.getLeaf(navType, splitDirection)
				: workspace.getLeaf(navType);
		};

		try {
			getLeaf()
				.openFile(file, openState)
				.catch((reason) => {
					console.log(message, reason);
				});
		} catch (error) {
			console.log(message, error);
		}
	}

	getLeafByFile(file: TFile): WorkspaceLeaf | null
	{
		const leaves = this.getOpenLeaves();
		for (let leaf of leaves) {
			if (leaf.view instanceof MarkdownView) 
			{
				if (leaf.view.file.path === file.path) {
					return leaf;
				}
			}
		}

		return null;
	}

	switchToLeafWithFile(file: TFile, openNewIfNotOpen: boolean): void
	{
		const { workspace } = app;
		const leaf = this.getLeafByFile(file);

		if (leaf) 
		{
			workspace.setActiveLeaf(leaf);
		}
		else if (openNewIfNotOpen)
		{
			this.openFileInNewLeaf(file, true, { active: true }, "Failed to open file to new tab after it was found to not be open yet.");
		}
	}
}

