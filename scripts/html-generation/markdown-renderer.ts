import { Component, Notice, WorkspaceLeaf, MarkdownRenderer as ObsidianRenderer, MarkdownPreviewView, loadMermaid, TFile } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { AssetHandler } from "./asset-handler";
import { TabManager } from "scripts/utils/tab-manager";
import { RenderLog } from "./render-log";

export namespace MarkdownRenderer
{
	export let convertableExtensions = ["md", "canvas"];
	export let renderLeaf: WorkspaceLeaf | undefined;
    export let errorInBatch: boolean = false;
	export let cancelled: boolean = false;
	export let batchStarted: boolean = false;
	let logContainer: HTMLElement | undefined;
	let loadingContainer: HTMLElement | undefined;

	let infoColor = "var(--text-normal)";
	let warningColor = "var(--color-yellow)";
	let errorColor = "var(--color-red)";
	let infoBoxColor = "rgba(0,0,0,0.15)"
	let warningBoxColor = "rgba(var(--color-yellow-rgb), 0.15)";
	let errorBoxColor = "rgba(var(--color-red-rgb), 0.15)";

	export function isConvertable(extention: string)
	{
		return convertableExtensions.contains(extention);
	}

	export function checkCancelled(): boolean
	{
		if (MarkdownRenderer.cancelled || !MarkdownRenderer.renderLeaf) 
		{
			RenderLog.log("cancelled");
			endBatch();
			return true;
		}

		return false;
	}

	function failRender(file: TFile, message: any): undefined
	{
		if (checkCancelled()) return undefined;

		RenderLog.error(message, `Rendering ${file.path} failed: `);
		return;
	}

	export async function renderFile(file: TFile, container: HTMLElement): Promise<{contentEl: HTMLElement, viewType: string} | undefined>
	{
		let loneFile = !batchStarted;
		if (loneFile) 
		{
			RenderLog.log("Exporting single file, starting batch");
			await MarkdownRenderer.beginBatch();
		}

		let success = await Utils.waitUntil(() => renderLeaf != undefined || checkCancelled(), 2000, 1);
		if (!success || !renderLeaf) return failRender(file, "Failed to get leaf for rendering!");
		
		try
		{ 
			await renderLeaf.openFile(file, { active: false});
		}
		catch (e)
		{
			return failRender(file, e);
		}


		let html: HTMLElement | undefined;
		let view = renderLeaf.view;
		let viewType = view.getViewType();

		switch(viewType)
		{
			case "markdown":
				// @ts-ignore
				let preview = view.previewMode;
				html = await renderMarkdownView(preview, container);
				break;
			case "kanban":
				html = await renderGeneric(view, container);
				break;
			case "excalidraw":
				html = await renderExcalidraw(view, container);
				break;
			case "canvas":
				html = await renderCanvas(view, container);
				break;
			default:
				html = await renderGeneric(view, container);
				break;
		}

		if(checkCancelled()) return undefined;
		if (!html) return failRender(file, "Failed to render file!");

		await postProcessHTML(html);
		// await AssetHandler.mathjaxStyles.load();

		if (loneFile) MarkdownRenderer.endBatch();

		return {contentEl: html, viewType: viewType};
	}

	export async function renderMarkdownView(preview: MarkdownPreviewView, container: HTMLElement): Promise<HTMLElement | undefined>
	{
		// @ts-ignore
		let renderer = preview.renderer;
		await renderer.unfoldAllHeadings();
		await renderer.unfoldAllLists();
		await renderer.parseSync();

		// @ts-ignore
		if (!window.mermaid)
		{
			await loadMermaid();
		}

		let sections = renderer.sections as {"rendered": boolean, "height": number, "computed": boolean, "lines": number, "lineStart": number, "lineEnd": number, "used": boolean, "highlightRanges": number, "level": number, "headingCollapsed": boolean, "shown": boolean, "usesFrontMatter": boolean, "html": string, "el": HTMLElement}[];

		let viewEl = document.body.createDiv({ cls: "markdown-preview-view markdown-rendered" });
		let sizerEl = viewEl.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" });
		let pusherEl = sizerEl.createDiv({ cls: "markdown-preview-pusher" });
		pusherEl.style.height = "0.1px";
		pusherEl.style.marginBottom = "0px";
		pusherEl.style.width = "1px";

		// @ts-ignore
		let promises: Promise<any>[] = [];

		for (let i = 0; i < sections.length; i++)
		{
			let section = sections[i];

			section.shown = true;
			section.rendered = false;
			// @ts-ignore
			section.resetCompute();
			// @ts-ignore
			section.setCollapsed(false);
			section.el.innerHTML = "";

			sizerEl.appendChild(section.el);

			// @ts-ignore
			await section.render();

			// @ts-ignore
			let success = await Utils.waitUntil(() => (section.el && section.rendered) || checkCancelled(), 2000, 1);
			if (!success) return failRender(preview.file, "Failed to render section!");

			section.el.querySelectorAll(".language-mermaid").forEach(async (element: HTMLElement) =>
			{
				let code = element.innerText;
				
				// @ts-ignore
				const { svg, bindFunctions } = await mermaid.render("mermaid-" + preview.docId + "-" + i, code);

				if(element.parentElement)
				{
					element.parentElement.outerHTML = `<div class="mermaid">${svg}</div>`;
					bindFunctions(element.parentElement);
				}
			});

			await renderer.measureSection(section);

			success = await Utils.waitUntil(() => section.computed || checkCancelled(), 2000, 1);
			if (!success) return failRender(preview.file, "Failed to compute section!");
			
			// @ts-ignore
			await preview.postProcess(section, promises, renderer.frontmatter);

			await Utils.delay(0);
		}

		// @ts-ignore
		await Promise.all(promises);

		// move all of them back in since rendering can cause some sections to move themselves out of their container
		for (let i = 0; i < sections.length; i++)
		{
			let section = sections[i];
			sizerEl.appendChild(section.el);
		}

		container.appendChild(viewEl);
		// await AssetHandler.mathjaxStyles.load();

		return viewEl;
	}

	export async function renderSingleLineMarkdown(markdown: string, container: HTMLElement)
	{
		let renderComp = new Component();
		renderComp.load();
		await ObsidianRenderer.renderMarkdown(markdown, container, "/", renderComp);
		renderComp.unload();

		let renderedEl = container.children[container.children.length - 1];
		if (renderedEl && renderedEl.tagName == "P")
		{
			renderedEl.outerHTML = renderedEl.innerHTML; // remove the outer <p> tag
		}
		
		//remove rendered lists and replace them with plain text
		container.querySelectorAll("ol").forEach((listEl: HTMLElement) =>
		{
			if(listEl.parentElement)
			{
				let start = listEl.getAttribute("start") ?? "1";
				listEl.parentElement.createSpan().outerHTML = `${start}. ${listEl.innerText}`;
				listEl.remove();
			}
		});
		container.querySelectorAll("ul").forEach((listEl: HTMLElement) =>
		{
			if(listEl.parentElement)
			{
				listEl.parentElement.createSpan().innerHTML = "- " + listEl.innerHTML;
				listEl.remove();
			}
		});
		container.querySelectorAll("li").forEach((listEl: HTMLElement) =>
		{
			if(listEl.parentElement)
			{
				listEl.parentElement.createSpan().innerHTML = listEl.innerHTML;
				listEl.remove();
			}
		});
	}

	export async function filterOutMarkdown(markdown: string): Promise<string>
	{
		let renderComp = new Component();
		renderComp.load();
		let container = document.createElement("div");
		await ObsidianRenderer.renderMarkdown(markdown, container, "/", renderComp);
		renderComp.unload();
		
		//remove rendered lists and replace them with plain text
		container.querySelectorAll("ol").forEach((listEl: HTMLElement) =>
		{
			if(listEl.parentElement)
			{
				let start = listEl.getAttribute("start") ?? "1";
				listEl.parentElement.createSpan().outerHTML = `<p>${start}. ${listEl.innerText}</p>`;
				listEl.remove();
			}
		});
		container.querySelectorAll("ul").forEach((listEl: HTMLElement) =>
		{
			if(listEl.parentElement)
			{
				listEl.parentElement.createSpan().innerHTML = "- " + listEl.innerHTML;
				listEl.remove();
			}
		});
		container.querySelectorAll("li").forEach((listEl: HTMLElement) =>
		{
			if(listEl.parentElement)
			{
				listEl.parentElement.createSpan().innerHTML = listEl.innerHTML;
				listEl.remove();
			}
		});

		let text = container.textContent ?? "";
		container.remove();

		return text;
	}

	async function renderGeneric(view: any, container: HTMLElement): Promise<HTMLElement | undefined>
	{
		await Utils.delay(2000);

		if (checkCancelled()) return undefined;

		// @ts-ignore
		let content = view.contentEl;
		container.appendChild(content);

		// await AssetHandler.mathjaxStyles.load();

		return content;
	}

	async function renderExcalidraw(view: any, container: HTMLElement): Promise<HTMLElement | undefined>
	{
		await Utils.delay(500);

		// @ts-ignore
		let scene = view.excalidrawData.scene;

		// @ts-ignore
		let svg = await view.svg(scene, "", false);

		// remove rect fill
		let isLight = !svg.getAttribute("filter");
		if (!isLight) svg.removeAttribute("filter");
		svg.classList.add(isLight ? "light" : "dark");

		let contentEl = document.createElement("div");
		contentEl.classList.add("view-content");
		let sizerEl = contentEl.createDiv();
		sizerEl.classList.add("excalidraw-plugin");

		sizerEl.appendChild(svg);

		// await AssetHandler.mathjaxStyles.load();

		if (checkCancelled()) return undefined;

		container.appendChild(contentEl);

		return contentEl;
	}

	async function renderCanvas(view: any, container: HTMLElement): Promise<HTMLElement | undefined>
	{
		if (checkCancelled()) return undefined;

		let canvas = view.canvas;

		let nodes = canvas.nodes;
		let edges = canvas.edges;

		for (const node of nodes)
		{
			await node[1].render();
		}

		for (const edge of edges)
		{
			await edge[1].render();
		}

		canvas.zoomToFit();
		await Utils.delay(500);

		let contentEl = view.contentEl;
		let canvasEl = contentEl.querySelector(".canvas");
		canvasEl.innerHTML = "";

		let edgeContainer = canvasEl.createEl("svg", { cls: "canvas-edges" });
		let edgeHeadContainer = canvasEl.createEl("svg", { cls: "canvas-edges" });

		for (const node of nodes)
		{
			let nodeEl = node[1].nodeEl;
			let childPreview = node[1]?.child?.previewMode;
			let embedEl = nodeEl.querySelector(".markdown-embed-content.node-insert-event");
			
			if (childPreview && embedEl) 
			{
				node[1].render();
				embedEl.innerHTML = "";
				await renderMarkdownView(childPreview, embedEl);
			}
			
			canvasEl.appendChild(nodeEl);
		}

		for (const edge of edges)
		{
			let edgeEl = edge[1].lineGroupEl;
			let headEl = edge[1].lineEndGroupEl;

			edgeContainer.appendChild(edgeEl);
			edgeHeadContainer.appendChild(headEl);

			if(edge[1].label)
			{
				let labelEl = edge[1].labelElement.wrapperEl;
				canvasEl.appendChild(labelEl);
			}
		}

		if (checkCancelled()) return undefined;

		container.appendChild(contentEl);

		return contentEl;
	}

	async function postProcessHTML(html: HTMLElement)
	{
		// transclusions put a div inside a p tag, which is invalid html. Fix it here
		html.querySelectorAll("p:has(div)").forEach((element) =>
		{
			// replace the p tag with a span
			let span = document.body.createEl("span");
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

		// encode all text area values into text content
		html.querySelectorAll("textarea").forEach((element: HTMLElement) =>
		{
			// @ts-ignore
			element.textContent = element.value;
		});
		
		// convert tag href to search query
		html.querySelectorAll("a.tag").forEach((element: HTMLAnchorElement) =>
		{
			let split = element.href.split("#");
			let tag = split[1] ?? element.href.substring(1); // remove the #
			element.setAttribute("href", `?query=tag:${tag}`);
		});

		// convert all hard coded image / media widths into max widths
		html.querySelectorAll("img, video, .media-embed:has( > :is(img, video))").forEach((element: HTMLElement) =>
		{
			let width = element.getAttribute("width");
			if (width)
			{
				element.removeAttribute("width");
				element.style.width = (width.trim() != "") ? (width + "px") : "";
				element.style.maxWidth = "100%";
			}
		});

		// replace obsidian's pdf embeds with normal embeds
		// this has to happen before converting canvases because the pdf embeds use canvas elements
		html.querySelectorAll("span.internal-embed.pdf-embed").forEach((pdf: HTMLElement) =>
		{
			let embed = document.createElement("embed");
			embed.setAttribute("src", pdf.getAttribute("src") ?? "");
			embed.style.width = pdf.style.width || '100%';
			embed.style.maxWidth = "100%";
			embed.style.height = pdf.style.height || '800px';

			let container = pdf.parentElement?.parentElement;
			
			container?.querySelectorAll("*").forEach((el) => el.remove());

			if (container) container.appendChild(embed);
		});

		// remove all MAKE.md elements
		html.querySelectorAll("div[class^='mk-']").forEach((element: HTMLElement) =>
		{
			element.remove();
		});

		// convert canvas elements into images
		html.querySelectorAll("canvas").forEach((canvas: HTMLCanvasElement) =>
		{
			let image = document.createElement("img");
			let data = canvas.toDataURL();
			image.src = data;
			image.style.width = canvas.style.width || "100%";
			image.style.maxWidth = "100%";
			canvas.replaceWith(image);
		});

		// add space after inline math
		html.querySelectorAll("math-inline").forEach((element: HTMLElement) =>
		{
			element.style.marginRight = "0.5em";
		});

		// move frontmatter before markdown-preview-sizer
		let frontmatter = html.querySelector(".frontmatter");
		if (frontmatter)
		{
			let sizer = html.querySelector(".markdown-preview-sizer");
			if (sizer)
			{
				sizer.before(frontmatter);
			}
		}


		// if the dynamic table of contents plugin is included on this page
		// then parse each list item and render markdown for it
		let tocEls = Array.from(html.querySelectorAll(".block-language-toc.dynamic-toc li > a"));
		for (const element of tocEls)
		{
			let renderEl = document.body.createDiv();
			renderSingleLineMarkdown(element.textContent ?? "", renderEl);
			element.textContent = renderEl.textContent;
			renderEl.remove();
		}
	}






    export async function beginBatch()
	{
		if(batchStarted)
		{
			throw new Error("Cannot start a new batch while one is already running!");
		}

        errorInBatch = false;
		cancelled = false;
		batchStarted = true;
		loadingContainer = undefined;
		logContainer = undefined;
		logShowing = false;

		renderLeaf = TabManager.openNewTab("window", "vertical");
		// @ts-ignore
		let parentFound = await Utils.waitUntil(() => (renderLeaf && renderLeaf.parent) || checkCancelled(), 2000, 1);
		if (!parentFound) 
		{
			try
			{
				renderLeaf.detach();
			}
			catch (e)
			{
				RenderLog.error(e, "Failed to detach render leaf: ");
			}
			
			if (!checkCancelled())
			{
				new Notice("Error: Failed to create leaf for rendering!");
				throw new Error("Failed to create leaf for rendering!");
			}
			
			return;
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

		let newSize = { width: 800, height: 400 };
		renderLeaf.view.containerEl.win.resizeTo(newSize.width, newSize.height);
		let newPosition = {x: window.screen.width / 2 - 450, y: window.screen.height - 450 - 75};
		renderLeaf.view.containerEl.win.moveTo(newPosition.x, newPosition.y);

		// @ts-ignore
		let renderBrowserWindow = renderLeaf.view.containerEl.win.electronWindow;

		if (!renderBrowserWindow) 
		{
			new Notice("Failed to get the render window, please try again.");
			errorInBatch = false;
			cancelled = false;
			batchStarted = false;
			renderLeaf = undefined;
			return;
		}

		renderBrowserWindow.setAlwaysOnTop(true, "floating", 1);
		renderBrowserWindow.webContents.setFrameRate(120);
		
		renderBrowserWindow.on("close", () =>
		{
			if (cancelled) return;
			endBatch();
			cancelled = true;
		}, { once: true });

		// @ts-ignore
		let allWindows = window.electron.remote.BrowserWindow.getAllWindows()
		for (const win of allWindows)
		{
			win.webContents.setBackgroundThrottling(false);
		}

		createLoadingContainer();
	}

	export function endBatch()
	{
		if (!batchStarted) return;

		if (renderLeaf)
		{
            if (!errorInBatch)
			{
				RenderLog.log("Closing render window");
			    renderLeaf.detach();
			}
			else
			{
				RenderLog.warning("Error in batch, leaving render window open");
				_reportProgress(1, 1, "Completed with errors", "Please see the log for more details.", errorColor);
			}
		}

		// @ts-ignore
		let allWindows = window.electron.remote.BrowserWindow.getAllWindows()
		for (const win of allWindows)
		{
			win.webContents.setBackgroundThrottling(false);
		}

		batchStarted = false;
	}

	export function generateLogEl(title: string, message: any, textColor: string, backgroundColor: string): HTMLElement
	{
		let logEl = document.createElement("div");
		logEl.className = "html-render-log-item";
		logEl.style.display = "flex";
		logEl.style.flexDirection = "column";
		logEl.style.marginBottom = "2px";
		logEl.style.fontSize = "12px";
		logEl.innerHTML =
		`
		<div class="html-render-log-title" style="font-weight: bold; margin-left: 1em;"></div>
		<div class="html-render-log-message" style="margin-left: 2em; font-size: 0.8em;white-space: pre-wrap;"></div>
		`;
		logEl.querySelector(".html-render-log-title")!.textContent = title;
		logEl.querySelector(".html-render-log-message")!.textContent = message.toString();

		logEl.style.color = textColor;
		logEl.style.backgroundColor = backgroundColor;
		logEl.style.borderLeft = `5px solid ${textColor}`;
		logEl.style.borderBottom = "1px solid var(--divider-color)";
		logEl.style.borderTop = "1px solid var(--divider-color)";

		return logEl;
	}

	function createLoadingContainer()
	{
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
					navigator.clipboard.writeText(RenderLog.fullLog);
					new Notice("Copied to clipboard! Please paste this into your github issue as is.");
				});
			}
		}
	}

	let logShowing = false;
	function appendLogEl(logEl: HTMLElement)
	{
		logContainer = loadingContainer?.querySelector(".html-render-log") ?? undefined;

		if(!logContainer || !renderLeaf)
		{
			console.error("Failed to append log element, log container or render leaf is undefined!");
			return;
		}

		if (!logShowing) 
		{
			renderLeaf.view.containerEl.win.resizeTo(900, 500);
			logContainer.style.display = "flex";
			logShowing = true;
		}

		logContainer.appendChild(logEl);
		// @ts-ignore
		logEl.scrollIntoView({ behavior: "instant", block: "end", inline: "end" });	
	}

	export async function _reportProgress(complete: number, total:number, message: string, subMessage: string, progressColor: string)
	{
		if (!batchStarted) return;

		// @ts-ignore
		if (!renderLeaf || !renderLeaf.parent || !renderLeaf.parent.parent) return;

		// @ts-ignore
		let loadingContainer = renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
		

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

	export async function _reportError(messageTitle: string, message: any, fatal: boolean)
	{
		if (!batchStarted) return;

		errorInBatch = true;

		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		appendLogEl(generateLogEl(messageTitle, message, errorColor, errorBoxColor));

		if (fatal)
        {
			renderLeaf = undefined;
			loadingContainer = undefined;
			logContainer = undefined;
        }
	}

	export async function _reportWarning(messageTitle: string, message: any)
	{
		if (!batchStarted) return;

		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		appendLogEl(generateLogEl(messageTitle, message, warningColor, warningBoxColor));
	}

    export async function _reportInfo(messageTitle: string, message: any)
	{
		if (!batchStarted) return;

		// @ts-ignore
		let found = await Utils.waitUntil(() => renderLeaf && renderLeaf.parent && renderLeaf.parent.parent, 100, 10);
		if (!found) return;

		appendLogEl(generateLogEl(messageTitle, message, infoColor, infoBoxColor));
	}

}
