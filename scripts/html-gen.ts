import { writeFile } from "fs/promises";
import { MarkdownView, Notice, TextFileView } from "obsidian";
import { ExportSettings } from "./settings";
import { Utils } from "./utils";
import { existsSync, mkdirSync } from "fs";
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
	private outlinedImages: { original_path: string, destination_path_rel: string }[] = [];

	// this is a string containing the filtered app.css file. It is populated on load. 
	// The math styles are attempted to load on every export until they are succesfully loaded. 
	// This is because they only load when a file containing latex is opened.
	appStyles: string = "";

	public generateDarkmodeToggle(inline : boolean = true) : HTMLElement
	{
		// programatically generates the above html snippet
		let toggle = document.createElement("div");
		let label = document.createElement("label");
		label.classList.add(inline ? "theme-toggle-inline" : "theme-toggle");
		label.setAttribute("for", "theme_toggle");
		let input = document.createElement("input");
		input.classList.add("toggle__input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");
		let div = document.createElement("div");
		div.classList.add("toggle__fill");
		label.appendChild(input);
		label.appendChild(div);
		toggle.appendChild(label);
		return toggle;
	}

	// the raw github urls for the extra files
	private webpagejsURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/webpage.js";
	private pluginStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/plugin-styles.css";
	private obsidianStylesURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/obsidian-styles.css";
	
	private async downloadExtras()
	{
		if (!existsSync(this.assetsPath))
		{
			console.log("Creating assets folder as it does not exist.");
			mkdirSync(this.assetsPath);
		}

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
		let appSheet = document.styleSheets[1];
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

		for (let i = 0; i < appSheet.cssRules.length; i++)
		{
			let rule = appSheet.cssRules[i];
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
		let toDownload: {filename: string, data: string, type: string, relativePath?: string, unicode?: boolean}[] = [];

		if (!ExportSettings.settings.inlineCSS)
		{
			let appcss = this.appStyles;
			let plugincss = await Utils.getText(this.assetsPath + "/plugin-styles.css");
			let themecss = await Utils.getThemeContent(Utils.getCurrentTheme());

			let snippetsList = await Utils.getStyleSnippetsContent();
			let snippetsNames = await Utils.getEnabledSnippets();
			let snippets = "";

			for (let i = 0; i < snippetsList.length; i++)
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
			let webpagejs = await Utils.getText(this.assetsPath + "/webpage.js");
			let webpagejsDownload = { filename: "webpage.js", data: webpagejs, type: "text/javascript" };
			toDownload.push(webpagejsDownload);
		}

		if (!ExportSettings.settings.inlineImages)
		{
			for (let i = 0; i < this.outlinedImages.length; i++)
			{
				let image = this.outlinedImages[i];
				let data = await Utils.getTextBase64(image.original_path);
				let imageDownload =
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

	public async getCurrentFileHTML(): Promise<HTMLHtmlElement | null>
	{
		await Utils.delay(200);

		let view = await Utils.getActiveView();
		if (!view) return null;

		Utils.setLineWidth(ExportSettings.settings.customLineWidth);
		if (view instanceof MarkdownView)
			await Utils.viewEnableFullRender(view);
		
		let contentEl : HTMLElement = this.generateBodyContents();

		this.fixLinks(contentEl); // modify links to work outside of obsidian (including relative links)
		this.repairOnClick(contentEl); // replace data-onlick with onclick

		// inline / outline images
		if (ExportSettings.settings.inlineImages)
		{
			await this.inlineImages(contentEl);
		}
		else
		{
			await this.outlineImages(contentEl, view);
		}

		// inject darkmode toggle
		let toggle : HTMLElement | null = null;
		if (ExportSettings.settings.addDarkModeToggle)
		{
			toggle = this.generateFixedToggle(contentEl, view.file.extension != "md");
		}

		let outline : HTMLElement | null = null;
		if (ExportSettings.settings.includeOutline)
		{
			let headers = this.getHeaderList(contentEl);
			if (headers)
			{
				outline = this.generateOutline(headers);
			}
		}

		let htmlEl : HTMLHtmlElement = document.createElement("html");
		let headEl: HTMLHeadElement = await this.generateHead(view);
		let bodyRootEl : HTMLBodyElement = this.generateBodyRoot();
		let sidebars = this.generateSideBars(contentEl, toggle ?? document.createElement("div"), outline ?? document.createElement("div"));
		
		let finalContent : HTMLElement = sidebars;
		if(toggle == null && outline == null) finalContent = contentEl;

		bodyRootEl.appendChild(finalContent);
		htmlEl.appendChild(headEl);
		htmlEl.appendChild(bodyRootEl);

		return htmlEl;
	}

	private generateSideBars(middleContent: HTMLElement, leftContent: HTMLElement, rightContent: HTMLElement): HTMLDivElement
	{
		let flexContainer = document.createElement("div");
		flexContainer.setAttribute("class", "flex-container");

		let leftBar = document.createElement("div");
		leftBar.setAttribute("id", "sidebar");
		leftBar.setAttribute("class", "sidebar-left");
		leftBar.appendChild(leftContent);

		let rightBar = document.createElement("div");
		rightBar.setAttribute("id", "sidebar");
		rightBar.setAttribute("class", "sidebar-right");
		rightBar.appendChild(rightContent);

		flexContainer.appendChild(leftBar);
		flexContainer.appendChild(middleContent);
		flexContainer.appendChild(rightBar);

		return flexContainer;
	}

	private generateBodyContents(): HTMLElement
	{
		let obsidianDocEl = (document.querySelector(".workspace-leaf.mod-active .markdown-reading-view") as HTMLElement);
		if (!obsidianDocEl) obsidianDocEl = (document.querySelector(".workspace-leaf.mod-active .view-content") as HTMLElement);

		let width = "1000px";
		if (ExportSettings.settings.customLineWidth > 0)
			width = ExportSettings.settings.customLineWidth + "px";
		else
		{
			let sizer = (obsidianDocEl.querySelector(".markdown-preview-sizer.markdown-preview-section") as HTMLElement);
			if (sizer)
			{
				width = sizer.style.width;
			}
		}

		let contentEl = document.createElement("div");
		contentEl.setAttribute("class", obsidianDocEl.getAttribute("class") ?? "");
		contentEl.innerHTML = obsidianDocEl.innerHTML;
		contentEl.style.flexBasis = width;
		contentEl.style.height = "100%";
		contentEl.style.width = "unset";

		return contentEl;
	}

	private generateBodyRoot(): HTMLBodyElement
	{
		let bodyClasses = document.body.getAttribute("class") ?? "";
		let bodyStyle = document.body.getAttribute("style") ?? "";
		bodyClasses = bodyClasses.replaceAll("\"", "'");
		bodyStyle = bodyStyle.replaceAll("\"", "'");

		let bodyEl = document.createElement("body");
		bodyEl.setAttribute("class", bodyClasses);
		bodyEl.setAttribute("style", bodyStyle);

		return bodyEl;
	}

	private getMathStyles(): string
	{
		let mathStyles = document.styleSheets[document.styleSheets.length - 1];
		let mathStylesString = "";

		let success = true;
		for (let i = 0; i < mathStyles.cssRules.length; i++)
		{
			let rule = mathStyles.cssRules[i];

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

	private async generateHead(view: TextFileView): Promise<HTMLHeadElement>
	{
		let meta =
		`
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="mobile-web-app-capable" content="yes">
		<title>${view.file.basename}</title>

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		<script src='https://code.jquery.com/jquery-3.6.0.js'></script>
		`

		let mathStyles = this.getMathStyles();
		let cssSettings = document.getElementById("css-settings-manager")?.innerHTML ?? "";
		let scripts = `\n<script>\n ${await Utils.getText(this.assetsPath + "/webpage.js")} \n</script>\n`;
		if (!ExportSettings.settings.inlineJS) scripts = "<script src='webpage.js'></script>\n";

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
			`;
		}
		else
		{
			header =
			`
			${meta}

			<link rel="stylesheet" href="obsidian-styles.css">
			<link rel="stylesheet" href="plugin-styles.css">
			<link rel="stylesheet" href="theme.css">
			<link rel="stylesheet" href="snippets.css">

			<style> ${cssSettings} </style>
			<style> ${mathStyles} </style>

			${scripts}
			`;
		}

		let headerEl = document.createElement("head");
		headerEl.innerHTML = header;

		return headerEl;
	}

	//#endregion

	//#region Links and Images

	private fixLinks(page: HTMLElement)
	{
		let query = jQuery(page);
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
					let filePath = "";
					if (!href[0].contains("/") && !href[0].contains("\\"))
					{
						filePath = Utils.getDirectoryFromFilePath(Utils.getFirstFileByName(href[0])?.path ?? "") + "/";
					}

					finalHref = filePath + href[0] + ".html#" + href[1].replaceAll(" ", "_").replaceAll("#", "").replaceAll("__", "_");
				}

				if (href.length > 2)
				{
					let first = href.shift() ?? "";

					let filePath = "";
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
	}

	private async inlineImages(page: HTMLElement)
	{
		let query = jQuery(page);
		let images = query.find("img").toArray();

		for (let i = 0; i < images.length; i++)
		{
			let img = images[i];
			if ($(img).attr("src")?.startsWith("app://local/"))
			{
				let path = $(img).attr("src")?.replace("app://local/", "file:///").split("?")[0];

				if (path)
				{
					let base64 = "";
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
	}

	private async outlineImages(page: HTMLElement, view: TextFileView)
	{
		let query = jQuery(page);

		this.outlinedImages = [];

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

		this.outlinedImages = img2Download;
	}

	//#endregion

	//#region Special Features

	private generateFixedToggle(page: HTMLElement, alwaysInject : boolean = false) : HTMLElement
	{
		if (!alwaysInject && page.querySelector(".theme-toggle-inline, .theme-toggle")) return document.createElement("div");

		if(ExportSettings.settings.addDarkModeToggle)
		{
			//insert fixed toggle in corner
			return this.generateDarkmodeToggle(false);
		}

		return document.createElement("div");
	}

	private repairOnClick(page: HTMLElement)
	{
		page.innerHTML = page.innerHTML.replaceAll("data-onclick", "onclick");
	}

	private getHeaderList(page: HTMLElement): { size: number, title: string, href: string }[] | null
	{
		let headers = [];

		let headerElements = page.querySelectorAll("h1, h2, h3, h4, h5, h6");

		for (let i = 0; i < headerElements.length; i++)
		{
			let header = headerElements[i];
			let size = parseInt(header.tagName[1]);
			let title = (header as HTMLElement).innerText;
			let href = (header as HTMLHeadingElement).id;
			headers.push({ size, title, href });
		}

		return headers;
	}

	private generateOutlineItem(header: { size: number, title: string, href: string }): HTMLDivElement
	{
		let arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path>`;

		let outlineItemEl = document.createElement('div');
		outlineItemEl.classList.add("outline-item");
		outlineItemEl.setAttribute("data-size", header.size.toString());

		let outlineItemContentsEl = document.createElement('a');
		outlineItemContentsEl.classList.add("outline-item-contents");
		outlineItemContentsEl.setAttribute("href", "#" + header.href);
		
		let outlineItemIconEl = document.createElement('div');
		outlineItemIconEl.classList.add("tree-item-icon");
		outlineItemIconEl.classList.add("collapse-icon");
		
		let outlineItemIconSvgEl = document.createElement('svg');
		outlineItemIconSvgEl.innerHTML = arrowIcon;
		outlineItemIconSvgEl = outlineItemIconSvgEl.firstChild as HTMLElement;
		
		let outlineItemTitleEl = document.createElement('span');
		outlineItemTitleEl.classList.add("outline-item-title");
		outlineItemTitleEl.innerText = header.title;

		let outlineItemChildrenEl = document.createElement('div');
		outlineItemChildrenEl.classList.add("outline-item-children");

		outlineItemIconEl.appendChild(outlineItemIconSvgEl);
		outlineItemContentsEl.appendChild(outlineItemIconEl);
		outlineItemContentsEl.appendChild(outlineItemTitleEl);
		outlineItemEl.appendChild(outlineItemContentsEl);
		outlineItemEl.appendChild(outlineItemChildrenEl);

		return outlineItemEl;
	}

	private generateOutline(headers: { size: number, title: string, href: string }[]): HTMLDivElement
	{
		if(headers.length <= 1) return document.createElement("div");

		let outlineEl = document.createElement('div');
		outlineEl.classList.add("outline-container");
		outlineEl.setAttribute("data-size", "0");

		let outlineHeader = document.createElement('div');
		outlineHeader.classList.add("outline-header");

		let headerIconEl = document.createElement('svg');
		headerIconEl.setAttribute("viewBox", "0 0 100 100");
		headerIconEl.classList.add("bullet-list");
		headerIconEl.setAttribute("width", "18");
		headerIconEl.setAttribute("height", "18");

		let headerIconPathEl = document.createElement('path');
		let headerPathData = "M16.4,16.4c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,16.4,16.4,16.4z M16.4,19.6 c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2C13.2,21,14.6,19.6,16.4,19.6z M29.2,21.2v3.2H90v-3.2H29.2z M16.4,43.6c-3.5,0-6.4,2.9-6.4,6.4s2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4S19.9,43.6,16.4,43.6z M16.4,46.8c1.8,0,3.2,1.4,3.2,3.2 s-1.4,3.2-3.2,3.2s-3.2-1.4-3.2-3.2S14.6,46.8,16.4,46.8z M29.2,48.4v3.2H90v-3.2H29.2z M16.4,70.8c-3.5,0-6.4,2.9-6.4,6.4 c0,3.5,2.9,6.4,6.4,6.4s6.4-2.9,6.4-6.4C22.8,73.7,19.9,70.8,16.4,70.8z M16.4,74c1.8,0,3.2,1.4,3.2,3.2c0,1.8-1.4,3.2-3.2,3.2 s-3.2-1.4-3.2-3.2C13.2,75.4,14.6,74,16.4,74z M29.2,75.6v3.2H90v-3.2H29.2z";
		headerIconPathEl.setAttribute("fill", "var(--h6-color)");
		headerIconPathEl.setAttribute("stroke", "var(--h6-color)");
		headerIconPathEl.setAttribute("d", headerPathData);

		let headerLabelEl = document.createElement('h6');
		headerLabelEl.style.margin = "1em";
		headerLabelEl.innerText = "Table of Contents";

		headerIconEl.appendChild(headerIconPathEl);
		outlineHeader.appendChild(headerIconEl);
		outlineHeader.appendChild(headerLabelEl);
		outlineEl.appendChild(outlineHeader);

		let listStack = [outlineEl];
		
		// function to get the data-size of the previous list item as a number
		function getLastStackSize(): number
		{
			return parseInt(listStack[listStack.length - 1].getAttribute("data-size") ?? "0");
		}

		for (let i = 0; i < headers.length; i++)
		{
			let header = headers[i];
			let listItem : HTMLDivElement = this.generateOutlineItem(header);

			while (getLastStackSize() >= header.size && listStack.length > 1)
			{
				listStack.pop();
			}

			let childContainer = listStack.last()?.querySelector(".outline-item-children");
			if (getLastStackSize() == 0) childContainer = listStack.last();
			if (!childContainer) continue;

			childContainer.appendChild(listItem);
			listStack.push(listItem);
		}

		return outlineEl;
	}

	//#endregion
}
