import { Component, MarkdownView, Notice, WorkspaceLeaf, MarkdownRenderer as ObsidianRenderer, FileView, View, MarkdownPreviewRenderer, MarkdownPreviewView, loadMermaid, TFile } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { Webpage } from "../objects/webpage";
import { AssetHandler } from "./asset-handler";
import { TabManager } from "scripts/utils/tab-manager";
import { RenderLog } from "./render-log";
import { MainSettings } from "scripts/settings/main-settings";
import { GenHelper } from "./html-generator";
import { get } from "http";

export namespace MarkdownRenderer
{
	export var convertableExtensions = ["md", "canvas"];
	export let problemLog: string = "";
	export let renderLeaf: WorkspaceLeaf | undefined;
    export let errorInBatch: boolean = false;
	export let cancelled: boolean = false;
	export let batchStarted: boolean = false;

	export function isConvertable(extention: string)
	{
		return convertableExtensions.contains(extention);
	}

	export function checkCancelled(): boolean
	{
		if (MarkdownRenderer.cancelled || !MarkdownRenderer.renderLeaf) 
		{
			console.log("cancelled");
			endBatch();
			return true;
		}

		return false;
	}

	function failRender(file: TFile, message: any): undefined
	{
		if (checkCancelled()) return undefined;

		RenderLog.error(`Rendering ${file.path} failed: `, message);
		return;
	}

	export async function renderFile(file: Webpage): Promise<HTMLElement | undefined>
	{
		let loneFile = !batchStarted;
		if (loneFile) 
		{
			console.log("beginning lone batch");
			await MarkdownRenderer.beginBatch();
		}

		let success = await Utils.waitUntil(() => renderLeaf != undefined || checkCancelled(), 2000, 10);
		if (!success || !renderLeaf) return failRender(file.source, "Failed to create leaf for rendering!");
		
		try
		{ 
			await renderLeaf.openFile(file.source, { active: false}); 
		}
		catch (e)
		{
			return failRender(file.source, e);
		}

		let html: HTMLElement | undefined;

		if(renderLeaf.view instanceof MarkdownView) html = await renderMarkdownFile(file.source, renderLeaf.view);
		else
		{
			file.isCustomView = true;

			// @ts-ignore
			let view = renderLeaf.view;
			let viewType = view.getViewType();

			switch(viewType)
			{
				case "kanban":
					html = await renderGeneric(file, view);
					break;
				case "excalidraw":
					html = await renderExcalidraw(file, view);
					break;
				case "canvas":
					html = await renderCanvas(file, view);
					break;
				default:
					html = await renderGeneric(file, view);
			}
		}

		if (!html) return failRender(file.source, "Failed to render file!");

		await postProcessHTML(html);
		makeHeadingsTrees(html);
		await AssetHandler.loadMathjaxStyles();

		if (loneFile) MarkdownRenderer.endBatch();

		return html;
	}

	export async function renderMarkdownView(preview: MarkdownPreviewView): Promise<HTMLElement | undefined>
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

		// @ts-ignore
		let promises = []

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

			// @ts-ignore
			await section.render();

			// @ts-ignore
			let success = await Utils.waitUntil(() => (section.el && section.rendered == true) || checkCancelled(), 2000, 5);
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

			success = await Utils.waitUntil(() => section.computed == true || checkCancelled(), 2000, 5);
			if (!success) return failRender(preview.file, "Failed to compute section!");

			// @ts-ignore
			await preview.postProcess(section, promises, renderer.frontmatter);
		}

		await Utils.delay(100);
		// @ts-ignore
		await Promise.all(promises);
		await Utils.delay(100);


		let container = renderer.sizerEl;
		if (!container) container = document.body.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" });
		container.innerHTML = `<div class="markdown-preview-pusher" style="width: 1px; height: 0.1px; margin-bottom: 0px;"></div>`

		for (let i = 0; i < sections.length; i++)
		{
			let section = sections[i];
			container.innerHTML += section.el.outerHTML;
		}
		
		//@ts-ignore
		let htmlRoot = renderer.previewEl;
		if (!htmlRoot) 
		{
			htmlRoot = document.body.createDiv({ cls: "markdown-preview-view markdown-rendered" });
		}

		htmlRoot.innerHTML = container.outerHTML;

		await postProcessHTML(htmlRoot);
		await AssetHandler.loadMathjaxStyles();

		return htmlRoot;
	}

	export async function renderSingleLineMarkdown(markdown: string, container: HTMLElement)
	{
		let renderComp = new Component();
		renderComp.load();
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

    async function renderMarkdownFile(file: TFile, view: MarkdownView): Promise<HTMLElement | undefined>
	{
		// @ts-ignore
		let previewModeFound = await Utils.waitUntil(() => view.previewMode || checkCancelled(), 2000, 10);
		if (!previewModeFound) return failRender(file, "Failed to open preview mode!");

		Utils.changeViewMode(view, "preview");

		return await renderMarkdownView(view.previewMode);
	}

	async function renderGeneric(file:Webpage, view: any): Promise<HTMLElement | undefined>
	{
		await Utils.delay(2000);

		if (checkCancelled()) return undefined;

		// @ts-ignore
		let container = view.contentEl;

		await postProcessHTML(container);
		await AssetHandler.loadMathjaxStyles();

		return container;
	}

	async function renderExcalidraw(file:Webpage, view: any): Promise<HTMLElement | undefined>
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

		await postProcessHTML(contentEl);
		await AssetHandler.loadMathjaxStyles();

		if (checkCancelled()) return undefined;

		return contentEl;
	}

	async function renderCanvas(file:Webpage, view: any): Promise<HTMLElement | undefined>
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

		let container = view.contentEl.cloneNode(true);
		let canvasEl = container.querySelector(".canvas");
		canvasEl.innerHTML = "";

		let edgeContainer = canvasEl.createEl("svg", { cls: "canvas-edges" });
		let edgeHeadContainer = canvasEl.createEl("svg", { cls: "canvas-edges" });

		for (const node of nodes)
		{
			let nodeEl = node[1].nodeEl.cloneNode(true);
			let view = node[1]?.child?.previewMode;
			
			if (view) 
			{
				let embedEl = nodeEl.querySelector(".markdown-embed-content.node-insert-event");
				
				let html = "";
				node[1].render();

				if (node[1].child.file)
				{
					let results = await GenHelper.getViewHTML(view, node[1].child.file.path);
					if (!results) continue;
					html = results.html;
					file.downloads.push(...results.downloads);
				}
				else
				{
					let results = await GenHelper.getViewHTML(view, file.source.path);
					if (!results) continue;
					html = results.html;
					file.downloads.push(...results.downloads);
				}
				
				if(embedEl) 
				{
					embedEl.innerHTML = html;
				}
			}
			
			canvasEl.appendChild(nodeEl);
		}

		for (const edge of edges)
		{
			let edgeEl = edge[1].lineGroupEl.cloneNode(true);
			let headEl = edge[1].lineEndGroupEl.cloneNode(true);

			edgeContainer.appendChild(edgeEl);
			edgeHeadContainer.appendChild(headEl);

			if(edge[1].label)
			{
				let labelEl = edge[1].labelElement.wrapperEl.cloneNode(true);
				canvasEl.appendChild(labelEl);
			}
		}

		if (checkCancelled()) return undefined;

		return container;
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

		html.querySelectorAll("textarea").forEach((element: HTMLElement) =>
		{
			// @ts-ignore
			element.textContent = element.value;
		});

		// convert all hard coded image / media widths into max widths
		html.querySelectorAll("img, video, svg").forEach((element: HTMLElement) =>
		{
			let width = element.getAttribute("width");
			if (width)
			{
				element.style.width = width || "100%";
				element.style.maxWidth = "100%";
				element.removeAttribute("width");
			}
		});

		// convert canvas elements into images
		html.querySelectorAll("canvas").forEach((canvas: HTMLCanvasElement) =>
		{
			let image = document.createElement("img");
			let data = canvas.toDataURL();
			console.log(canvas, data);
			image.src = data;
			image.style.width = canvas.style.width || "100%";
			image.style.maxWidth = "100%";
			canvas.replaceWith(image);
		});

		// replace obsidian's pdf embeds with normal embeds
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

			console.log(container?.innerHTML);
		});

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

		makeHeadingsTrees(html);
	}
	
	function makeHeadingsTrees(html: HTMLElement)
	{
		// make headers into formet:
		/*
		- .heading-wrapper
			- h1.heading
				- .heading-before
				- .heading-collapse-indicator.collapse-indicator.collapse-icon
				- "Text"
				- .heading-after
			- .heading-children
		*/

		function getHeaderEl(headingContainer: HTMLDivElement)
		{
			let first = headingContainer.firstElementChild;
			if (first && /[Hh][1-6]/g.test(first.tagName)) return first;
			else return;
		}
		
		function makeHeaderTree(headerDiv: HTMLDivElement, childrenContainer: HTMLElement)
		{
			let headerEl = getHeaderEl(headerDiv);

			if (!headerEl) return;

			let possibleChild = headerDiv.nextElementSibling;

			while (possibleChild != null)
			{
				let possibleChildHeader = getHeaderEl(possibleChild as HTMLDivElement);

				if(possibleChildHeader)
				{
					// if header is a sibling of this header then break
					if (possibleChildHeader.tagName <= headerEl.tagName)
					{
						break;
					}
				}

				let nextEl = possibleChild.nextElementSibling;
				childrenContainer.appendChild(possibleChild);
				possibleChild = nextEl;
			}
		}

		const arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";

		html.querySelectorAll("div:has(> :is(h1, h2, h3, h4, h5, h6))").forEach(function (header: HTMLDivElement)
		{
			header.classList.add("heading-wrapper");

			let hEl = getHeaderEl(header) as HTMLHeadingElement;

			if (!hEl || hEl.classList.contains("heading")) return;

			hEl.classList.add("heading");

			let collapseIcon = hEl.querySelector(".heading-collapse-indicator");
			if (!collapseIcon)
			{
				collapseIcon = hEl.createDiv({ cls: "heading-collapse-indicator collapse-indicator collapse-icon" });
				collapseIcon.innerHTML = arrowHTML;
				hEl.prepend(collapseIcon);
			}

			if (!hEl.querySelector(".heading-after")) 
			{
				let afterEl = hEl.createDiv({ cls: "heading-after" });
				afterEl.textContent = "...";
			}

			// the before element is for future styling
			if (!hEl.querySelector(".heading-before")) 
			{
				let beforeEl = hEl.createDiv({ cls: "heading-before" });
				hEl.prepend(beforeEl);
				beforeEl.textContent = "";
			}

			let children = header.createDiv({ cls: "heading-children" });

			makeHeaderTree(header, children);
		});

		// remove collapsible arrows from h1 and inline titles
		html.querySelectorAll("div h1, div .inline-title").forEach((element) =>
		{
			element.querySelector(".heading-collapse-indicator")?.remove();
		});

		// remove all new lines from header elements which cause spacing issues
		html.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", "")); 
	}

    export async function beginBatch()
	{
		if(batchStarted)
		{
			throw new Error("Cannot start a new batch while one is already running!");
		}

		problemLog = "";
        errorInBatch = false;
		cancelled = false;
		batchStarted = true;

		renderLeaf = TabManager.openNewTab("window", "vertical");
		// @ts-ignore
		let parentFound = await Utils.waitUntil(() => (renderLeaf && renderLeaf.parent) || checkCancelled(), 2000, 10);
		if (!parentFound) 
		{
			try
			{
				renderLeaf.detach();
			}
			catch (e)
			{
				RenderLog.error("Failed to detach render leaf: ", e);
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

		let renderBrowserWindow = undefined;
		// @ts-ignore
		let windows = window.electron.remote.BrowserWindow.getAllWindows()
		for (const win of windows)
		{
			let bounds = win.getBounds();
			if (bounds.x == newPosition.x && bounds.y == newPosition.y && bounds.width == newSize.width && bounds.height == newSize.height)
			{
				renderBrowserWindow = win;
				break;
			}
		}

		if (!renderBrowserWindow) 
		{
			new Notice("Failed to get the render window, please try again.");
			problemLog = "";
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
	}

	export function endBatch()
	{
		if (!batchStarted) return;

		if (renderLeaf)
		{
            if (!errorInBatch)
			    renderLeaf.detach();
			else
				console.log("error in batch, not detaching");
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
		if (!found)
		{
			console.log("failed to find render leaf");
			return;
		}

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
					navigator.clipboard.writeText(problemLog);
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


	

}
