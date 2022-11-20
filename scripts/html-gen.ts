import { writeFile } from "fs/promises";
import { MarkdownView, Notice, TextFileView } from "obsidian";
import { ExportSettings } from "./settings";
import { Utils } from "./utils";
import jQuery from 'jquery';
const $ = jQuery;

export class HTMLGenerator
{
	// When this is enabled the plugin will download the extra .css and .js files from github.
	autoDownloadExtras = true;

	private vaultPluginsPath: string = Utils.getVaultPath() + "/.obsidian/plugins";
	private thisPluginPath: string = this.vaultPluginsPath + "/obsidian-webpage-export";
	private assetsPath: string = this.thisPluginPath + "/assets";

	// this is a list of images that is populated during generation and then downloaded upon export
	// I am sure there is a better way to handle this data flow but I am not sure what to do.
	private imagesToDownload: { original_path: string, destination_path_rel: string }[] = [];

	// this is a string containing the filtered app.css file. It is populated on load. 
	// The math styles are attempted to load on every export until they are succesfully loaded. 
	// This is because they only load when a file containing latex is opened.
	appStyles: string = "";

	// short html snippet for a dark mode toggle
	darkModeToggle =
		`\n\n
	<div>
	<label class="theme-toggle-inline" for="theme_toggle">
		<input class="toggle__input" type="checkbox" id="theme_toggle">
		<div class="toggle__fill"></div>
	</label>
	</div>
	\n\n`

	// the raw github urls for the extra files
	private webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/webpage.js";
	private pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/plugin-styles.css";
	private obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/obsidian-styles.css";
	private async downloadExtras()
	{
		//Download webpage.js
		let webpagejs = await fetch(this.webpagejsURL);
		let webpagejsText = await webpagejs.text();
		await writeFile(this.assetsPath + "/webpage.js", webpagejsText).catch((err) => { console.log(err); });

		//Download plugin-styles.css
		let pluginStyles = await fetch(this.pluginStylesURL);
		let pluginStylesText = await pluginStyles.text();
		await writeFile(this.assetsPath + "/plugin-styles.css", pluginStylesText).catch((err) => { console.log(err); });

		//Download obsidian-styles.css
		let obsidianStyles = await fetch(this.obsidianStylesURL);
		let obsidianStylesText = await obsidianStyles.text();
		await writeFile(this.assetsPath + "/obsidian-styles.css", obsidianStylesText).catch((err) => { console.log(err); });
	}

	private async loadAppStyles()
	{
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

		this.appStyles += await Utils.getText(this.assetsPath + "/obsidian-styles.css");

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
	}

	public async initialize()
	{
		await this.downloadExtras();
		await this.loadAppStyles();
	}

	private async getThirdPartyPluginCSS() : Promise<string>
	{
		// load 3rd party plugin css
		let pluginCSS = "";

		let thirdPartyPluginStyleNames = ExportSettings.settings.includePluginCSS.split("\n");
		for (let i = 0; i < thirdPartyPluginStyleNames.length; i++)
		{
			if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i])))) continue;

			let path = this.vaultPluginsPath + "/" + thirdPartyPluginStyleNames[i].replace("\n", "") + "/styles.css";
			let style = await Utils.getText(path);
			if (style)
			{
				pluginCSS += style;
			}
		}

		return pluginCSS;
	}

	async getSeperateFilesToDownload() : Promise<{filename: string, data: string, type: string, relativePath?: string, unicode?: boolean}[]>
	{
		var toDownload: {filename: string, data: string, type: string, relativePath?: string, unicode?: boolean}[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			let appcss = this.appStyles;
			let plugincss = await Utils.getText(this.assetsPath + "/plugin-styles.css");
			let themecss = await Utils.getThemeContent(Utils.getCurrentTheme());

			let snippetsList = await Utils.getStyleSnippetsContent();
			let snippetsNames = await Utils.getEnabledSnippets();
			var snippets = "";

			for (var i = 0; i < snippetsList.length; i++)
			{
				snippets += `/* --- ${snippetsNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
			}

			let thirdPartyPluginCSS = await this.getThirdPartyPluginCSS();
			plugincss += "\n" + thirdPartyPluginCSS + "\n";

			let appcssDownload = { filename: "obsidian-styles.css", data: appcss, type: "text/css" };
			let plugincssDownload = { filename: "plugin-styles.css", data: plugincss, type: "text/css" };
			let themecssDownload = { filename: "theme.css", data: themecss, type: "text/css" };
			let snippetsDownload = { filename: "snippets.css", data: snippets, type: "text/css" };

			toDownload.push(appcssDownload);
			toDownload.push(plugincssDownload);
			toDownload.push(themecssDownload);
			toDownload.push(snippetsDownload);
		}

		if (!ExportSettings.settings.inlineJS)
		{
			var webpagejs = await Utils.getText(this.assetsPath + "/webpage.js");
			var webpagejsDownload = { filename: "webpage.js", data: webpagejs, type: "text/javascript" };
			toDownload.push(webpagejsDownload);
		}

		// let imagesDownload : {path: string, data: string}[] = [];
		if (!ExportSettings.settings.inlineImages)
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

		return toDownload;
	}

	//#region General HTML

	public async GetCurrentFileHTML(): Promise<string | null>
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

	private generateBodyHTML(): string
	{
		var bodyClasses = document.body.getAttribute("class") ?? "";
		var bodyStyle = document.body.getAttribute("style") ?? "";
		/*@ts-ignore*/
		bodyClasses = bodyClasses.replaceAll("\"", "'");
		/*@ts-ignore*/
		bodyStyle = bodyStyle.replaceAll("\"", "'");

		var htmlEl = (document.querySelector(".workspace-leaf.mod-active .markdown-reading-view") as HTMLElement)
		if (!htmlEl) htmlEl = (document.querySelector(".workspace-leaf.mod-active .view-content") as HTMLElement);

		let width = "1000px";
		if (ExportSettings.settings.customLineWidth > 0)
			width = ExportSettings.settings.customLineWidth + "px";
		else
		{
			let sizer = (htmlEl.querySelector(".markdown-preview-sizer.markdown-preview-section") as HTMLElement);
			if (sizer)
			{
				width = sizer.style.width;
			}
		}

		htmlEl.style.flexBasis = width;
		htmlEl.style.width = "unset";
		var html = htmlEl.outerHTML;

		html = "\n<body class=\"" + bodyClasses + "\" style=\"" + bodyStyle + "\">\n" + html + "\n</body>\n";

		return html;
	}

	private getMathStyles(): string
	{
		let mathStyles = document.styleSheets[document.styleSheets.length - 1];
		var mathStylesString = "";

		var success = true;
		for (var i = 0; i < mathStyles.cssRules.length; i++)
		{
			var rule = mathStyles.cssRules[i];

			if (rule)
			{
				if (i == 0 && !rule.cssText.startsWith("mjx"))
				{
					success = false;
					break;
				}

				if (rule.cssText.startsWith("@font-face")) continue;

				mathStylesString += rule.cssText + "\n";
			}
		}

		return success ? mathStylesString : "";
	}

	private async generateHead(view: TextFileView): Promise<string>
	{
		let meta =
		`
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="mobile-web-app-capable" content="yes">
		<title>${view.file.basename}</title>
		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		`

		let mathStyles = this.getMathStyles();
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		let scripts = "\n\n<script src='https://code.jquery.com/jquery-3.6.0.js'></script>"
			+ ((ExportSettings.settings.inlineJS ? ("<script>\n" + await Utils.getText(this.assetsPath + "/webpage.js"))
				: "<script src='webpage.js'></script>\n") + "\n</script>\n");

		if (ExportSettings.settings.inlineCSS)
		{
			let pluginStyles = await Utils.getText(this.assetsPath + "/plugin-styles.css");
			let snippets = await Utils.getStyleSnippetsContent();
			let snippetNames = Utils.getEnabledSnippets();
			let theme = await Utils.getThemeContent(Utils.getCurrentTheme());

			let thirdPartyPluginStyles = await this.getThirdPartyPluginCSS();
			pluginStyles += thirdPartyPluginStyles;
			
			var header =
				`
			<head>

			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${this.appStyles} </style>
			<style> ${mathStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Plugin Styles -->
			<style> ${pluginStyles} </style>

			<!-- Theme Styles ( ${Utils.getCurrentTheme()} ) -->
			<style> ${theme} </style>

			<!-- Snippets: ${snippetNames.join(", ")} -->
			<style> ${snippets.join("</style><style>")} </style>
		
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
			<style> ${mathStyles} </style>

			${scripts}

			</head>
			`;
		}

		return header;
	}

	//#endregion

	//#region Links and Images

	private fixLinks(html: string): string
	{
		let el = document.createElement('html');
		el.innerHTML = html;

		let query = jQuery(el);
		query.find("a.internal-link").each(function ()
		{
			$(this).attr("target", "_self");

			let finalHref = "";
			let href = $(this).attr("href")?.split("#");

			if (!href) return;

			// if the file doesn't start with #, then it links to a file, or a header in another file.
			if (!(href[0] == ""))
			{
				if (href.length == 1)
				{
					finalHref = href[0] + ".html";
				}

				if (href.length == 2)
				{
					var filePath = "";
					if (!href[0].contains("/") && !href[0].contains("\\"))
					{
						filePath = Utils.getDirectoryFromFilePath(Utils.getFirstFileByName(href[0])?.path ?? "") + "/";
					}

					finalHref = filePath + href[0] + ".html#" + href[1].replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}

				if (href.length > 2)
				{
					let first = href.shift() ?? "";

					var filePath = "";
					if (!first.contains("/") && !first.contains("\\"))
					{
						filePath = Utils.getDirectoryFromFilePath(Utils.getFirstFileByName(first)?.path ?? "") + "/";
					}

					finalHref = filePath + first + ".html#" + href.join("#").replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}
			}
			else // if the file starts with #, then it links to an internal header.
			{
				href.shift();
				if (href.length == 1)
				{
					finalHref = "#" + href[0].replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}

				if (href.length > 1)
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

	private async inlineImages(html: string): Promise<string>
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

	private async outlineImages(html: string, view: TextFileView): Promise<string>
	{
		let el = document.createElement('html');
		el.innerHTML = html;

		let query = jQuery(el);

		this.imagesToDownload = [];

		let img2Download: { original_path: string, destination_path_rel: string }[] = [];
		let vaultPath = Utils.getVaultPath();

		query.find("img").each(function ()
		{
			if (!$(this).attr("src")?.startsWith("app://local/")) return;

			let originalPath = $(this).attr("src")?.replaceAll("\\", "/").replaceAll("%20", " ").replace("app://local/", "");

			// console.log("originalPath: " + originalPath);

			if (!originalPath)
			{
				new Notice("Failed to outline image: " + originalPath + ". Couldn't find image src", 5000);
				return;
			}

			if (originalPath.startsWith("data:image/png;base64,") || originalPath.startsWith("data:image/jpeg;base64,")) return;

			let relPath = originalPath.split(Utils.getDirectoryFromFilePath(vaultPath + "/" + view.file.path.replaceAll("\\", "/")) + "/")[1];

			// console.log(originalPath, "vs.", Utils.getDirectoryFromFilePath(vaultPath + "/" + view.file.path.replaceAll("\\", "/")) + "/");

			if (!relPath)
				relPath = ("images/" + Utils.getFileNameFromFilePath($(this).attr("src")?.replaceAll("\\", "/").replaceAll("%20", " ") ?? "")) ?? "img.png";

			// console.log("relPath: " + relPath);

			$(this).attr("src", relPath);

			img2Download.push({ original_path: originalPath, destination_path_rel: relPath });

		});

		this.imagesToDownload = img2Download;

		let result = el.innerHTML;
		el.remove();
		return result;
	}

	//#endregion

	//#region Special Features

	private async injectToggle(html: string): Promise<string>
	{
		if (!html.contains(this.darkModeToggle.split("\n")[4]))
		{
			//insert fixed toggle in corner
			console.log("Injecting toggle");
			html = this.darkModeToggle.replace("theme-toggle-inline", "theme-toggle") + html;
		}

		return html;
	}

	private repairOnClick(html: string): string
	{
		html = html.replaceAll("data-onclick", "onclick");
		return html;
	}

	private getHeaderList(html: string): { size: number, title: string, href: string }[] | null
	{
		var headers = [];

		var el = document.createElement('html');
		el.innerHTML = html;

		var headerElements = el.querySelectorAll("h1, h2, h3, h4, h5, h6");

		for (var i = 0; i < headerElements.length; i++)
		{
			var header = headerElements[i];
			var size = parseInt(header.tagName[1]);
			var title = (header as HTMLElement).innerText;
			var href = (header as HTMLHeadingElement).id;
			headers.push({ size, title, href });
		}

		el.remove();

		return headers;
	}

	private generateOutline(headers: { size: number, title: string, href: string }[]): string
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

		var builderRoot = document.createElement('html');
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
		function getLastStackSize(): number
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

			var builditemRoot = document.createElement('div');
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
