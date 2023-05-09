import { Component, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import { ExportSettings } from "scripts/export-settings";
import { GlobalDataGenerator } from "scripts/html-generation/global-gen";
import { Utils } from "scripts/utils/utils";
import { ExportFile } from "./export-file";
import { AssetHandler } from "./asset-handler";
import { TabManager } from "scripts/utils/tab-manager";
const { clipboard } = require('electron')
import jQuery from 'jquery';
import { RenderLog } from "./render-log";
const $ = jQuery;


export namespace MarkdownRenderer
{
	export let problemLog: string = "";
	export let renderLeaf: WorkspaceLeaf | undefined;
    export let errorInBatch: boolean = false;

    export async function renderMarkdown(file: ExportFile): Promise<string>
	{
		if (!renderLeaf)
		{
			throw new Error("Cannot render document without a render leaf! Please call beginBatch() before calling this function, and endBatch() after you are done exporting all files.");
		}

		try
		{
			await renderLeaf.openFile(file.markdownFile, { active: false});
		}
		catch (e)
		{
			let message = "Failed to open file! File: " + file.markdownFile.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		if(!(renderLeaf.view instanceof MarkdownView))
		{
			let message = "This file was not a normal markdown file! File: " + file.markdownFile.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		// @ts-ignore
		let previewModeFound = await Utils.waitUntil(() => renderLeaf != undefined && renderLeaf.view.previewMode, 2000, 10);
		if (!previewModeFound)
		{
			let message = "Failed to open preview mode! File: " + file.markdownFile.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}

		let preview = renderLeaf.view.previewMode;

		await Utils.changeViewMode(renderLeaf.view, "preview");

		// @ts-ignore
		preview.renderer.showAll = true;
		// @ts-ignore
		await preview.renderer.unfoldAllHeadings();

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
		let renderfinished = await Utils.waitUntil(() => (preview.renderer.lastRender != lastRender && isRendered) || renderLeaf == undefined, 10000, 10);
		if (!renderfinished)
		{
			let message = "Failed to render file within 10 seconds! File: " + file.markdownFile.path;
			RenderLog.warning("Cannot render file: ", message);
			return generateFailDocument();
		}
		if (renderLeaf == undefined)
		{
			RenderLog.warning("Render cancelled! On file: ", file.markdownFile.path);
			return generateFailDocument();
		}

		// wait for dataview blocks to render
		let text = renderLeaf.view.data;
		let dataviews = text.matchAll(/```(dataview|dataviewjs)/g);
		let dataviewCount = Array.from(dataviews).length;

		if (dataviewCount > 0)
		{
			// HTMLGenerator.reportWarning("Dataview Blocks Detected", "Detected " + dataviewCount + " dataview blocks. Waiting " + ExportSettings.settings.dataviewBlockWaitTime * dataviewCount + "ms for render.");
			await Utils.delay(ExportSettings.settings.dataviewBlockWaitTime * dataviewCount);
		}

		// If everything worked then do a bit of postprocessing
		let container = preview.containerEl;
		if (container)
		{
			// load stylesheet for mathjax
			let stylesheet = document.getElementById("MJX-CHTML-styles");
			if (stylesheet)
			{
				AssetHandler.mathStyles = stylesheet.innerHTML.replaceAll("app://obsidian.md/", "https://publish.obsidian.md/").trim();
			}

			return container.innerHTML;
		}

		let message = "Could not find container with rendered content! File: " + file.markdownFile.path;
		RenderLog.warning("Cannot render file: ", message);
		return generateFailDocument();
	}

    export async function beginBatch()
	{
		problemLog = "";
        errorInBatch = false;

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
		$(renderLeaf.parent.parent.containerEl).find(".clickable-icon, .workspace-tab-header-container-inner").css("display", "none");
		// @ts-ignore
		$(renderLeaf.parent.containerEl).css("max-height", "var(--header-height)");
		// @ts-ignore
		$(renderLeaf.parent.parent.containerEl).removeClass("mod-vertical");
		// @ts-ignore
		$(renderLeaf.parent.parent.containerEl).addClass("mod-horizontal");
		renderLeaf.view.containerEl.win.resizeTo(900, 450);
		renderLeaf.view.containerEl.win.moveTo(window.screen.width / 2 - 450, window.screen.height - 450 - 75);
		

		console.log(renderLeaf);

		await Utils.delay(1000);
	}

	export function endBatch()
	{
		if (renderLeaf)
		{
            if (!errorInBatch)
			    renderLeaf.detach();
		}
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

	export function _reportProgress(complete: number, total:number, message: string, subMessage: string, progressColor: string)
	{
		if(!renderLeaf) return;
		// @ts-ignore
		let found = Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 2000, 10);
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

	export function _reportError(messageTitle: string, message: string, fatal: boolean)
	{
        messageTitle = (fatal ? "[Fatal Error] " : "[Error] ") + messageTitle;
		problemLog += "\n\n##### " + messageTitle + "\n```\n" + message + "\n```";

		if(!renderLeaf) return;

        errorInBatch = true;

		// @ts-ignore
		let found = Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 2000, 10);
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

	export function _reportWarning(messageTitle: string, message: string)
	{
        messageTitle = "[Warning] " + messageTitle;
		problemLog += "\n\n##### " + messageTitle + "\n```\n" + message + "\n```";

		if(!ExportSettings.settings.showWarningsInExportLog) return;

		if(!renderLeaf) return;
		// @ts-ignore
		let found = Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 2000, 10);
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

    export function _reportInfo(messageTitle: string, message: string)
	{
        messageTitle = "[Info] " + messageTitle;
		problemLog += "\n\n##### " + messageTitle + "\n```\n" + message + "\n```";

		if(!ExportSettings.settings.showWarningsInExportLog) return;

		if(!renderLeaf) return;
		// @ts-ignore
		let found = Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 2000, 10);
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