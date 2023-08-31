import { MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { ExportFile } from "./export-file";
import { AssetHandler } from "./asset-handler";
import { TabManager } from "scripts/utils/tab-manager";
const { clipboard } = require('electron')
import { RenderLog } from "./render-log";
import { MainSettings } from "scripts/settings/main-settings";
import { html_beautify } from "js-beautify";


export namespace MarkdownRenderer
{
	export let problemLog: string = "";
	export let renderLeaf: WorkspaceLeaf | undefined;
    export let errorInBatch: boolean = false;
	export let cancelled: boolean = false;
	export let batchStarted: boolean = false;

    export async function renderMarkdown(file: ExportFile): Promise<string>
	{
		if (!renderLeaf)
		{
			throw new Error("Cannot render document without a render leaf! Please call beginBatch() before calling this function, and endBatch() after you are done exporting all files.");
		}

		try
		{
			await renderLeaf.openFile(file.file, { active: false});
		}
		catch (e)
		{
			let message = "Failed to open file! File: " + file.file.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		if (cancelled) throw new Error("Markdown rendering cancelled");

		if(!(renderLeaf.view instanceof MarkdownView))
		{
			let message = "This file was not a normal markdown file! File: " + file.file.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		// @ts-ignore
		let previewModeFound = await Utils.waitUntil(() => (renderLeaf != undefined && renderLeaf.view.previewMode) || cancelled, 2000, 10);
		
		if (cancelled) throw new Error("Markdown rendering cancelled");

		if (!previewModeFound)
		{
			let message = "Failed to open preview mode! File: " + file.file.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		let preview = renderLeaf.view.previewMode;

		await Utils.changeViewMode(renderLeaf.view, "preview");
		if (cancelled) throw new Error("Markdown rendering cancelled");


		// @ts-ignore
		preview.renderer.showAll = true;
		// @ts-ignore
		await preview.renderer.unfoldAllHeadings();
		if (cancelled) throw new Error("Markdown rendering cancelled");

		// @ts-ignore
		let lastRender = preview.renderer.lastRender;
		// @ts-ignore
		preview.renderer.rerender(true);

		let isRendered = false;
		// @ts-ignore
		preview.renderer.onRendered(() => 
		{
			isRendered = true;
		});

		// @ts-ignore
		let renderfinished = await Utils.waitUntil(() => (preview.renderer.lastRender != lastRender && isRendered) || cancelled, 30000, 50);

		if (cancelled) throw new Error("Markdown rendering cancelled");

		if (!renderfinished)
		{
			let message = "Failed to render file within 30 seconds! File: " + file.file.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		// wait for dataview blocks to render
		let text = renderLeaf.view.data;
		let dataviews = text.matchAll(/```(dataview|dataviewjs)/g);
		let dataviewCount = Array.from(dataviews).length;

		if (dataviewCount > 0)
		{
			await Utils.delay(MainSettings.settings.dataviewBlockWaitTime * dataviewCount);
		}

		if (cancelled) throw new Error("Markdown rendering cancelled");

		// If everything worked then do a bit of postprocessing
		let container = preview.containerEl;
		if (container)
		{
			postProcessHTML(file, container);

			AssetHandler.loadMathjaxStyles();

			return container.innerHTML;
		}

		let message = "Could not find container with rendered content! File: " + file.file.path;
		RenderLog.warning("Cannot render file: ", message);
		return generateFailDocument();
	}

	function postProcessHTML(file: ExportFile, html: HTMLElement)
	{
		// transclusions put a div inside a p tag, which is invalid html. Fix it here
		html.querySelectorAll("p:has(div)").forEach((element) =>
		{
			// replace the p tag with a span
			let span = file.document.createElement("span");
			span.innerHTML = element.innerHTML;
			element.replaceWith(span);
		});

		// encode all text input values into attributes
		html.querySelectorAll("input[type=text]").forEach((element: HTMLElement) =>
		{
			// @ts-ignore
			element.setAttribute("value", element.value);
			// @ts-ignore
			element.value = "";
		});

		html.querySelectorAll("textarea").forEach((element: HTMLElement) =>
		{
			// @ts-ignore
			element.textContent = element.value;
		});

		// convert all hard coded image / media widths into max widths
		html.querySelectorAll("img, video").forEach((element: HTMLElement) =>
		{
			let width = element.getAttribute("width");
			if (width)
			{
				element.style.maxWidth = width;
				element.removeAttribute("width");
			}
		});

		if (MainSettings.settings.beautifyHTML) 
		{
			file.document.documentElement.outerHTML = html_beautify(file.document.documentElement.outerHTML, { indent_size: 2 });
		
			// remove all new lines from header elements which cause spacing issues
			document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", "")); 
		}
	}
	
    export async function beginBatch()
	{
		if(batchStarted) return;

		problemLog = "";
        errorInBatch = false;
		cancelled = false;
		batchStarted = true;

		renderLeaf = TabManager.openNewTab("window", "vertical");
		// @ts-ignore
		let parentFound = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent, 2000, 10);
		if (!parentFound) 
		{
			try
			{
				renderLeaf.detach();
			}
			catch (e)
			{
				console.log(e);
			}
			
			new Notice("Error: Failed to create leaf for rendering!");
			throw new Error("Failed to create leaf for rendering!");
		}

		// hide the leaf so we can render without intruding on the user
		// @ts-ignore
		renderLeaf.parent.containerEl.style.height = "0";
		// @ts-ignore
		renderLeaf.parent.parent.containerEl.querySelector(".clickable-icon, .workspace-tab-header-container-inner").style.display = "none";
		// @ts-ignore
		renderLeaf.parent.containerEl.style.maxHeight = "var(--header-height)";
		// @ts-ignore
		renderLeaf.parent.parent.containerEl.classList.remove("mod-vertical");
		// @ts-ignore
		renderLeaf.parent.parent.containerEl.classList.add("mod-horizontal");
		renderLeaf.view.containerEl.win.resizeTo(600, 300);
		renderLeaf.view.containerEl.win.moveTo(window.screen.width / 2 - 450, window.screen.height - 450 - 75);

		// @ts-ignore
		let renderBrowserWindow = window.electron.remote.BrowserWindow.getFocusedWindow();
		renderBrowserWindow.setAlwaysOnTop(true, "floating", 1);
		renderBrowserWindow.webContents.setFrameRate(120);
		renderBrowserWindow.on("close", () =>
		{
			cancelled = true;
			console.log("cancelled");
		});

		// @ts-ignore
		let allWindows = window.electron.remote.BrowserWindow.getAllWindows()
		for (const win of allWindows)
		{
			win.webContents.setBackgroundThrottling(false);
		}
	}

	export function endBatch()
	{
		if (!batchStarted) return;

		if (renderLeaf)
		{
            if (!errorInBatch)
			    renderLeaf.detach();
		}

		// @ts-ignore
		let allWindows = window.electron.remote.BrowserWindow.getAllWindows()
		for (const win of allWindows)
		{
			win.webContents.setBackgroundThrottling(false);
		}

		batchStarted = false;
	}

	export function generateLogEl(title: string, message: string, textColor: string, backgroundColor: string): HTMLElement
	{
		let logEl = document.createElement("div");
		logEl.className = "html-render-log-item";
		logEl.style.display = "flex";
		logEl.style.flexDirection = "column";
		logEl.style.marginBottom = "2px";
		logEl.style.fontSize = "12px";
		logEl.innerHTML =
		`
		<div class="html-render-log-title" style="font-weight: bold; margin-left: 1em;">${title}</div>
		<div class="html-render-log-message" style="margin-left: 2em; font-size: 0.8em;white-space: pre-wrap;">${message}</div>
		`;

		logEl.style.color = textColor;
		logEl.style.backgroundColor = backgroundColor;
		logEl.style.borderLeft = `5px solid ${textColor}`;
		logEl.style.borderBottom = "1px solid var(--divider-color)";
		logEl.style.borderTop = "1px solid var(--divider-color)";

		return logEl;
	}

	export async function _reportProgress(complete: number, total:number, message: string, subMessage: string, progressColor: string)
	{
		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		// @ts-ignore
		let loadingContainer = renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		if (!loadingContainer) 
		{
			loadingContainer = document.createElement("div");
			loadingContainer.className = `html-render-progress-container`;
			loadingContainer.setAttribute("style", "height: 100%; min-width: 100%; display:flex; flex-direction:column; align-content: center; justify-content: center; align-items: center;");
			loadingContainer.innerHTML = 
			`
			<div class="html-render-progress-container" style="height: 100%;min-width: 100%;display:flex;flex-direction:column;">
				<div style="display: flex;height: 100%;">
					<div style="flex-grow: 1;display: flex;flex-direction: column;align-items: center;justify-content: center;">
						<h1 style="">Generating HTML</h1>
						<progress class="html-render-progressbar" value="0" min="0" max="1" style="width: 300px; height: 15px; background-color: transparent; color: var(--color-accent);"></progress>
						<span class="html-render-submessage" style="margin-block-start: 2em;"></span>
					</div>
					<div class="html-render-log" style="display:none; flex-direction: column; border-left: 1px solid var(--divider-color); overflow-y: auto; width: 300px; max-width: 300px; min-width: 300px;">
						<h1 style="color: var(--color-yellow);padding: 0.3em;background-color: rgba(100, 70, 20, 0.1);margin: 0;">Export Problem Log</h1>
						<button class="html-render-log-copy-button" style="margin: 10px;width: fit-content;align-self: center;">Copy Log to Clipboard</button>
					</div>
				</div>
			</div>
			`

			// @ts-ignore
			renderLeaf.parent.parent.containerEl.appendChild(loadingContainer);

			let copyButton = loadingContainer.querySelector("button.html-render-log-copy-button");
			if (copyButton)
			{
				copyButton.addEventListener("click", () => 
				{
					console.log(problemLog);
					clipboard.writeText(problemLog);
					new Notice("Copied to clipboard! Please paste this into your github issue as is.");
				});
			}
		}

		let progress = complete / total;

		let progressBar = loadingContainer.querySelector("progress");
		if (progressBar)
		{
			progressBar.value = progress;
			progressBar.style.backgroundColor = "transparent";
			progressBar.style.color = progressColor;
		}


		let messageElement = loadingContainer.querySelector("h1");
		if (messageElement)
		{
			messageElement.innerText = message;
		}

		let subMessageElement = loadingContainer.querySelector("span.html-render-submessage") as HTMLElement;
		if (subMessageElement)
		{
			subMessageElement.innerText = subMessage;
		}
	}

	export async function _reportError(messageTitle: string, message: string, fatal: boolean)
	{
		let firstLog = problemLog == "";
        messageTitle = (fatal ? "[Fatal Error] " : "[Error] ") + messageTitle;
		problemLog += "\n\n##### " + messageTitle + "\n```\n" + message + "\n```";

		errorInBatch = true;

		// Return if log levels do not match
		if (!fatal && !["error", "warning", "all"].contains(MainSettings.settings.logLevel))
		{
			return;
		}

		if(firstLog)
		{
			this.renderLeaf.view.containerEl.win.resizeTo(900, 500);
		}

		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		// @ts-ignore
		let loadingContainer = renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		if (!loadingContainer) return;

		let titleElement = loadingContainer.querySelector("h1");
		if (titleElement)
		{
			titleElement.innerText = "⚠️ " + messageTitle;
			titleElement.style.color = "var(--color-red) !important";
		}

		let messageElement = loadingContainer.querySelector("span.html-render-submessage");
		if (messageElement)
		{
			messageElement.innerText = messageElement.innerText + "\n\n" + "See the problem log ⟶\nConsider copying the log and reporting an issue on github.";
		}

		let logContainer = loadingContainer.querySelector(".html-render-log");
		if (logContainer)
		{
			logContainer.style.display = "flex";
			let logEl = generateLogEl(messageTitle, message, "var(--color-red)", "rgba(170, 10, 30, 0.1)");
			logContainer.appendChild(logEl);
		}

		if (fatal)
        {
			renderLeaf = undefined;
        }
	}

	export async function _reportWarning(messageTitle: string, message: string)
	{
		let firstLog = problemLog == "";
		messageTitle = "[Warning] " + messageTitle;
		problemLog += "\n\n##### " + messageTitle + "\n```\n" + message + "\n```";

		// return if log level does not include warnings
		if(!["warning", "all"].contains(MainSettings.settings.logLevel)) return;

		if(firstLog)
		{
			this.renderLeaf.view.containerEl.win.resizeTo(900, 300);
		}

		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		// @ts-ignore
		let loadingContainer = renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		if (!loadingContainer) return;

		let logContainer = loadingContainer.querySelector(".html-render-log");
		if (logContainer)
		{
			logContainer.style.display = "flex";
			let logEl = generateLogEl(messageTitle, message, "var(--color-yellow)", "rgba(170, 170, 10, 0.1)");
			logContainer.appendChild(logEl);
		}

	}

    export async function _reportInfo(messageTitle: string, message: string)
	{
		let firstLog = problemLog == "";
        messageTitle = "[Info] " + messageTitle;
		problemLog += "\n\n##### " + messageTitle + "\n```\n" + message + "\n```";

		if(!(MainSettings.settings.logLevel == "all")) return;

		if(firstLog)
		{
			this.renderLeaf.view.containerEl.win.resizeTo(900, 300);
		}

		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		// @ts-ignore
		let loadingContainer = renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		if (!loadingContainer) return;

		let logContainer = loadingContainer.querySelector(".html-render-log");
		if (logContainer)
		{
			logContainer.style.display = "flex";
			let logEl = generateLogEl(messageTitle, message, "var(--text-normal)", "rgba(0, 0, 0, 0.15)");
			logContainer.appendChild(logEl);
		}
	}
    
    export function generateFailDocument(message: string = "Page Not Found"): string
	{
		return `
		<div class="markdown-preview-view markdown-rendered">
			<div class="markdown-preview-sizer" style="width: 100%; height: 100%; margin: 0px; padding: 0px; max-width: 100%; min-height: 100%;">
				<div>
					<center style='position: relative; transform: translateY(20vh); width: 100%; text-align: center;'>
						<h1 style>${message}</h1>
					</center>
				</div>
			</div>
		</div>
		`;
	}
}
