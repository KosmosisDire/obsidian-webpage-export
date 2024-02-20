import { MarkdownRendererAPIOptions, MarkdownWebpageRendererAPIOptions } from "./api-options";
import { Component, Notice, WorkspaceLeaf, MarkdownRenderer as ObsidianRenderer, MarkdownPreviewView, loadMermaid, TFile, MarkdownView, View } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { TabManager } from "scripts/utils/tab-manager";
import { Webpage } from "scripts/objects/webpage";
import * as electron from 'electron';
import { ExportLog } from "./html-generation/render-log";
import { AssetHandler } from "./html-generation/asset-handler";

export namespace MarkdownRendererAPI
{
	export let convertableExtensions = ["md", "canvas", "drawing", "excalidraw"]; // drawing is an alias for excalidraw

	function makeHeadingsTrees(html: HTMLElement)
	{

		// make headers into format:
		/*
		- .heading-wrapper
			- h1.heading
				- .heading-collapse-indicator.collapse-indicator.collapse-icon
				- "Text"
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

					// if we reached the footer then break
					if (possibleChildHeader.querySelector(":has(section.footnotes)") || possibleChildHeader.classList.contains("mod-footer"))
					{
						break;
					}
				}

				let nextEl = possibleChild.nextElementSibling;
				childrenContainer.appendChild(possibleChild);
				possibleChild = nextEl;
			}
		}

		html.querySelectorAll("div:has(> :is(h1, h2, h3, h4, h5, h6):not([class^='block-language-'] *)):not(.markdown-preview-sizer)").forEach(function (header: HTMLDivElement)
		{
			header.classList.add("heading-wrapper");

			let hEl = getHeaderEl(header) as HTMLHeadingElement;

			if (!hEl || hEl.classList.contains("heading")) return;

			hEl.classList.add("heading");

			let collapseIcon = hEl.querySelector(".heading-collapse-indicator");
			if (!collapseIcon)
			{
				collapseIcon = hEl.createDiv({ cls: "heading-collapse-indicator collapse-indicator collapse-icon" });
				collapseIcon.innerHTML = _MarkdownRendererInternal.arrowHTML;
				hEl.prepend(collapseIcon);
			}

			let children = header.createDiv({ cls: "heading-children" });

			makeHeaderTree(header, children);
		});

		// add "heading" class to all headers that don't have it
		html.querySelectorAll(":is(h1, h2, h3, h4, h5, h6):not(.heading)").forEach((el) => el.classList.add("heading"));

		// remove collapsible arrows from h1 and inline titles
		html.querySelectorAll("div h1, div .inline-title").forEach((element) =>
		{
			element.querySelector(".heading-collapse-indicator")?.remove();
		});

		// remove all new lines from header elements which cause spacing issues
		html.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", ""));
	}

	export async function renderMarkdownToString(markdown: string, options?: MarkdownRendererAPIOptions): Promise<string | undefined>
	{
		options = Object.assign(new MarkdownRendererAPIOptions(), options);
		let html = await _MarkdownRendererInternal.renderMarkdown(markdown, options);
		if (!html) return;
		if(options.postProcess) await _MarkdownRendererInternal.postProcessHTML(html, options);
		if (options.makeHeadersTrees) makeHeadingsTrees(html);
		let text = html.innerHTML;
		if (!options.container) html.remove();
		return text;
	}

	export async function renderMarkdownToElement(markdown: string, options?: MarkdownRendererAPIOptions): Promise<HTMLElement | undefined>
	{
		options = Object.assign(new MarkdownRendererAPIOptions(), options);
		let html = await _MarkdownRendererInternal.renderMarkdown(markdown, options);
		if (!html) return;
		if(options.postProcess) await _MarkdownRendererInternal.postProcessHTML(html, options);
		if (options.makeHeadersTrees) makeHeadingsTrees(html);
		return html;
	}

	// export async function renderMarkdownsToStrings(markdowns: string[], options?: MarkdownRendererAPIOptions): Promise<(string | undefined)[]>
	// {
	// 	options = Object.assign(new MarkdownRendererAPIOptions(), options);
	// 	await _MarkdownRendererInternal.beginBatch(options);
	// 	let results = await Promise.all(markdowns.map(markdown => this.renderMarkdownToString(markdown, options)));
	// 	_MarkdownRendererInternal.endBatch();
	// 	return results;
	// }

	// export async function renderMarkdownsToElements(markdowns: string[], options?: MarkdownRendererAPIOptions): Promise<(HTMLElement | undefined)[]>
	// {
	// 	options = Object.assign(new MarkdownRendererAPIOptions(), options);
	// 	await _MarkdownRendererInternal.beginBatch(options);
	// 	let results = await Promise.all(markdowns.map(markdown => this.renderMarkdownToElement(markdown, options)));
	// 	_MarkdownRendererInternal.endBatch();
	// 	return results;
	// }

	export async function renderFile(file: TFile, options?: MarkdownRendererAPIOptions): Promise<{contentEl: HTMLElement; viewType: string;} | undefined>
	{
		options = Object.assign(new MarkdownRendererAPIOptions(), options);
		let result = await _MarkdownRendererInternal.renderFile(file, options);
		if (!result) return;


		if (options.postProcess) await _MarkdownRendererInternal.postProcessHTML(result.contentEl, options);
		if (options.makeHeadersTrees) makeHeadingsTrees(result.contentEl);


		return result;
	}

	export async function renderFileToString(file: TFile, options?: MarkdownRendererAPIOptions): Promise<string | undefined>
	{
		options = Object.assign(new MarkdownRendererAPIOptions(), options);
		let result = await this.renderFile(file, options);
		if (!result) return;
		let text = result.contentEl.innerHTML;
		if (!options.container) result.contentEl.remove();
		return text;
	}

	export async function renderFileToWebpage(file: TFile, options?: MarkdownWebpageRendererAPIOptions): Promise<Webpage | undefined>
	{
		options = Object.assign(new MarkdownWebpageRendererAPIOptions(), options);
		this.beginBatch(options);
		let webpage : Webpage | undefined = new Webpage(file, undefined, file.basename, undefined, options);
		webpage = await webpage.create();
		
		if (!webpage)
		{
			ExportLog.error("Failed to create webpage for file " + file.path);
			return;
		}

		this.endBatch();

		return webpage;
	}

	export async function renderMarkdownSimple(markdown: string): Promise<string | undefined>
	{
		let container = document.body.createDiv();
		await _MarkdownRendererInternal.renderSimpleMarkdown(markdown, container);
		let text = container.innerHTML;
		container.remove();
		return text;
	}

	export async function renderMarkdownSimpleEl(markdown: string, container: HTMLElement)
	{
		await _MarkdownRendererInternal.renderSimpleMarkdown(markdown, container);
	}

	export function isConvertable(extention: string)
	{
		if (extention.startsWith(".")) extention = extention.substring(1);
		return this.convertableExtensions.contains(extention);
	}

	export function checkCancelled(): boolean
	{
		return _MarkdownRendererInternal.checkCancelled();
	}

	export async function beginBatch(options?: MarkdownRendererAPIOptions)
	{
		options = Object.assign(new MarkdownRendererAPIOptions(), options);
		await _MarkdownRendererInternal.beginBatch(options);
	}

	export function endBatch()
	{
		_MarkdownRendererInternal.endBatch();
	}

}

export namespace _MarkdownRendererInternal
{
	export let renderLeaf: WorkspaceLeaf | undefined;
	export let electronWindow: electron.BrowserWindow | undefined;
    export let errorInBatch: boolean = false;
	export let cancelled: boolean = false;
	export let batchStarted: boolean = false;
	let logContainer: HTMLElement | undefined;
	let loadingContainer: HTMLElement | undefined;

	const infoColor = "var(--text-normal)";
	const warningColor = "var(--color-yellow)";
	const errorColor = "var(--color-red)";
	const infoBoxColor = "rgba(0,0,0,0.15)"
	const warningBoxColor = "rgba(var(--color-yellow-rgb), 0.15)";
	const errorBoxColor = "rgba(var(--color-red-rgb), 0.15)";
	export const arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";

	export function checkCancelled(): boolean
	{
		if (_MarkdownRendererInternal.cancelled || !_MarkdownRendererInternal.renderLeaf) 
		{
			ExportLog.log("cancelled");
			_MarkdownRendererInternal.endBatch();
			return true;
		}

		return false;
	}

	function failRender(file: TFile | undefined, message: any): undefined
	{
		if (checkCancelled()) return undefined;

		ExportLog.error(message, `Rendering ${file?.path ?? " custom markdown "} failed: `);
		return;
	}

	export async function renderFile(file: TFile, options: MarkdownRendererAPIOptions): Promise<{contentEl: HTMLElement, viewType: string} | undefined>
	{
		let loneFile = !batchStarted;
		if (loneFile) 
		{
			ExportLog.log("Exporting single file, starting batch");
			await _MarkdownRendererInternal.beginBatch(options);
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
				html = await renderMarkdownView(preview, options);
				break;
			case "kanban":
				html = await renderGeneric(view, options);
				break;
			case "excalidraw":
				html = await renderExcalidraw(view, options);
				break;
			case "canvas":
				html = await renderCanvas(view, options);
				break;
			default:
				html = await renderGeneric(view, options);
				break;
		}

		if(checkCancelled()) return undefined;
		if (!html) return failRender(file, "Failed to render file!");

		if (loneFile) _MarkdownRendererInternal.endBatch();

		return {contentEl: html, viewType: viewType};
	}

	export async function renderMarkdown(markdown: string, options: MarkdownRendererAPIOptions): Promise<HTMLElement | undefined>
	{
		let loneFile = !batchStarted;
		if (loneFile) 
		{
			ExportLog.log("Exporting single file, starting batch");
			await _MarkdownRendererInternal.beginBatch(options);
		}

		let success = await Utils.waitUntil(() => renderLeaf != undefined || checkCancelled(), 2000, 1);
		if (!success || !renderLeaf) return failRender(undefined, "Failed to get leaf for rendering!");
		

		let view = new MarkdownView(renderLeaf);
		renderLeaf.view = view;

		try
		{ 
			view.setViewData(markdown, true);
		}
		catch (e)
		{
			return failRender(undefined, e);
		}


		let html: HTMLElement | undefined;

		// @ts-ignore
		let preview = view.previewMode;
		html = await renderMarkdownView(preview, options);

		if(checkCancelled()) return undefined;
		if (!html) return failRender(undefined, "Failed to render file!");

		if (loneFile) _MarkdownRendererInternal.endBatch();

		return html;
	}

	export async function renderMarkdownView(preview: MarkdownPreviewView, options: MarkdownRendererAPIOptions): Promise<HTMLElement | undefined>
	{
		preview.load();
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


		let newMarkdownEl = document.body.createDiv({ cls: "markdown-preview-view markdown-rendered" });
		let newSizerEl = newMarkdownEl.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" });

		if (!newMarkdownEl || !newSizerEl) return failRender(preview.file, "Please specify a container element, or enable keepViewContainer!");

		preview.containerEl = newSizerEl;

		// @ts-ignore
		let promises: Promise<any>[] = [];
		let foldedCallouts: HTMLElement[] = [];
		for (let i = 0; i < sections.length; i++)
		{
			let section = sections[i];

			section.shown = true;
			section.rendered = false;
			// @ts-ignore
			section.resetCompute();
			// @ts-ignore
			section.setCollapsed(false);
			section.el.empty();

			newSizerEl.appendChild(section.el);

			// @ts-ignore
			await section.render();

			// @ts-ignore
			let success = await Utils.waitUntil(() => (section.el && section.rendered) || checkCancelled(), 2000, 1);
			if (!success) return failRender(preview.file, "Failed to render section!");

			await renderer.measureSection(section);
			success = await Utils.waitUntil(() => section.computed || checkCancelled(), 2000, 1);
			if (!success) return failRender(preview.file, "Failed to compute section!");

			// @ts-ignore
			await preview.postProcess(section, promises, renderer.frontmatter);

			// unfold callouts
			let folded = Array.from(section.el.querySelectorAll(".callout-content[style*='display: none']")) as HTMLElement[];
			for (let callout of folded)
			{
				callout.style.display = "";
			}
			foldedCallouts.push(...folded);

			// dataview support
			// @ts-ignore
			let dataview = app.plugins.plugins["dataview"];
			if (dataview)
			{
				let jsKeyword = dataview.settings?.dataviewJsKeyword ?? "dataviewjs";
				let emptyDataviewSelector = `:is(.block-language-dataview, .block-language-${jsKeyword}):not(.node-insert-event), :is(.block-language-dataview, .block-language-${jsKeyword}):empty`
				await Utils.waitUntil(() => !section.el.querySelector(emptyDataviewSelector) || checkCancelled(), 4000, 1);
				if (checkCancelled()) return undefined;

				if (section.el.querySelector(emptyDataviewSelector))
				{
					ExportLog.warning("Dataview plugin elements were not rendered correctly in file " + preview.file.name + "!");
				}
			}

			// wait for transclusions
			await Utils.waitUntil(() => !section.el.querySelector(".markdown-preview-sizer:empty") || checkCancelled(), 500, 1);
			if (checkCancelled()) return undefined;

			if (section.el.querySelector(".markdown-preview-sizer:empty"))
			{
				ExportLog.warning("Transclusions were not rendered correctly in file " + preview.file.name + "!");
			}

			// wait for generic plugins
			await Utils.waitUntil(() => !section.el.querySelector("[class^='block-language-']:empty") || checkCancelled(), 500, 1);
			if (checkCancelled()) return undefined;

			// convert canvas elements into images here because otherwise they will lose their data when moved
			let canvases = Array.from(section.el.querySelectorAll("canvas:not(.pdf-embed canvas)")) as HTMLCanvasElement[];
			for (let canvas of canvases)
			{
				let data = canvas.toDataURL();
				if (data.length < 100) 
				{
					ExportLog.log(canvas.outerHTML, "Failed to render canvas based plugin element in file " + preview.file.name + ":");
					canvas.remove();
					continue;
				}

				let image = document.createElement("img");
				image.src = data;
				image.style.width = canvas.style.width || "100%";
				image.style.maxWidth = "100%";
				canvas.replaceWith(image);
			};

			console.debug(section.el.outerHTML); // for some reason adding this line here fixes an issue where some plugins wouldn't render

			let invalidPluginBlocks = Array.from(section.el.querySelectorAll("[class^='block-language-']:empty"));
			for (let block of invalidPluginBlocks)
			{
				ExportLog.warning(`Plugin element ${block.className || block.parentElement?.className || "unknown"} from ${preview.file.name} not rendered correctly!`);
			}
		}

		// @ts-ignore
		await Promise.all(promises);

		// refold callouts
		for (let callout of foldedCallouts)
		{
			callout.style.display = "none";
		}

		newSizerEl.empty();
		// move all of them back in since rendering can cause some sections to move themselves out of their container
		for (let i = 0; i < sections.length; i++)
		{
			let section = sections[i];
			newSizerEl.appendChild(section.el.cloneNode(true));
		}

		// get banner plugin banner and insert it before the sizer element
		let banner = preview.containerEl.querySelector(".obsidian-banner-wrapper");
		if (banner)
		{
			newSizerEl.before(banner);
		}

		// if we aren't kepping the view element then only keep the content of the sizer element
		if (options.keepViewContainer === false) 
		{
			newMarkdownEl.outerHTML = newSizerEl.innerHTML;
			console.log("keeping only sizer content");
		}

		options.container?.appendChild(newMarkdownEl);

		return newMarkdownEl;
	}

	export async function renderSimpleMarkdown(markdown: string, container: HTMLElement)
	{
		let renderComp = new Component();
		renderComp.load();
		await ObsidianRenderer.render(app, markdown, container, "/", renderComp);
		renderComp.unload();

		let renderedEl = container.children[container.children.length - 1];
		if (renderedEl && renderedEl.tagName == "P")
		{
			renderedEl.outerHTML = renderedEl.innerHTML; // remove the outer <p> tag
		}

		// remove tags
		container.querySelectorAll("a.tag").forEach((element: HTMLAnchorElement) =>
		{
			element.remove();
		});
		
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

	async function renderGeneric(view: View, options: MarkdownRendererAPIOptions): Promise<HTMLElement | undefined>
	{
		await Utils.delay(2000);

		if (checkCancelled()) return undefined;

		// @ts-ignore
		let contentEl = view.containerEl;
		options.container?.appendChild(contentEl);

		return contentEl;
	}

	async function renderExcalidraw(view: any, options: MarkdownRendererAPIOptions): Promise<HTMLElement | undefined>
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

		if (checkCancelled()) return undefined;

		if (options.keepViewContainer === false)
		{
			contentEl = svg;
		}

		options.container?.appendChild(contentEl);

		return contentEl;
	}

	export async function renderCanvas(view: any, options: MarkdownRendererAPIOptions): Promise<HTMLElement | undefined>
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
				let optionsCopy = Object.assign({}, options);
				optionsCopy.container = embedEl;
				await renderMarkdownView(childPreview, optionsCopy);
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
		
		if (options.keepViewContainer === false)
		{
			contentEl = canvasEl;
		}

		options.container?.appendChild(contentEl);

		return contentEl;
	}

	export async function postProcessHTML(html: HTMLElement, options: MarkdownRendererAPIOptions)
	{
		// remove the extra elements if they are not wanted
		if (options.keepViewContainer === false)
		{
			html.querySelectorAll(".mod-header, .mod-footer").forEach((e: HTMLElement) => e.remove());
		}

		// transclusions put a div inside a p tag, which is invalid html. Fix it here
		html.querySelectorAll("p:has(div)").forEach((element) =>
		{
			// replace the p tag with a span
			let span = document.body.createEl("span");
			span.innerHTML = element.innerHTML;
			element.replaceWith(span);
			span.style.display = "block";
			span.style.marginBlockStart = "var(--p-spacing)";
			span.style.marginBlockEnd = "var(--p-spacing)";
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

		// move frontmatter before markdown-preview-sizer
		let frontmatter = html.querySelector(".frontmatter");
		if (frontmatter)
		{
			let frontmatterParent = frontmatter.parentElement;
			let sizer = html.querySelector(".markdown-preview-sizer");
			if (sizer)
			{
				sizer.before(frontmatter);
			}
			frontmatterParent?.remove();
		}

		// add lazy loading to iframe elements
		html.querySelectorAll("iframe").forEach((element: HTMLIFrameElement) =>
		{
			element.setAttribute("loading", "lazy");
		});

		// add collapse icons to lists if they don't already have them
		var collapsableListItems = Array.from(html.querySelectorAll("li:has(ul), li:has(ol)"));
		for (const item of collapsableListItems)
		{
			let collapseIcon = item.querySelector(".collapse-icon");
			if (!collapseIcon)
			{
				collapseIcon = item.createDiv({ cls: "list-collapse-indicator collapse-indicator collapse-icon" });
				collapseIcon.innerHTML = this.arrowHTML;
				item.prepend(collapseIcon);
			}
		}

		// if the dynamic table of contents plugin is included on this page
		// then parse each list item and render markdown for it
		let tocEls = Array.from(html.querySelectorAll(".block-language-toc.dynamic-toc li > a"));
		for (const element of tocEls)
		{
			let renderEl = document.body.createDiv();
			renderSimpleMarkdown(element.textContent ?? "", renderEl);
			element.textContent = renderEl.textContent;
			renderEl.remove();
		}
	}

    export async function beginBatch(options: MarkdownRendererAPIOptions | MarkdownWebpageRendererAPIOptions)
	{
		if(batchStarted) return;

        errorInBatch = false;
		cancelled = false;
		batchStarted = true;
		loadingContainer = undefined;
		logContainer = undefined;
		logShowing = false;
		AssetHandler.exportOptions = options;

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
				ExportLog.error(e, "Failed to detach render leaf: ");
			}
			
			if (!checkCancelled())
			{
				new Notice("Error: Failed to create leaf for rendering!");
				throw new Error("Failed to create leaf for rendering!");
			}
			
			return;
		}

		let obsidianWindow = renderLeaf.view.containerEl.win;
		// @ts-ignore
		electronWindow = obsidianWindow.electronWindow as electron.BrowserWindow;

		if (!electronWindow) 
		{
			new Notice("Failed to get the render window, please try again.");
			errorInBatch = false;
			cancelled = false;
			batchStarted = false;
			renderLeaf = undefined;
			electronWindow = undefined;
			return;
		}

		if (options.displayProgress === false) 
		{
			let newPosition = {x: 0, y: window.screen.height};
			obsidianWindow.moveTo(newPosition.x, newPosition.y);
			electronWindow.hide();
		}
		else
		{
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
			obsidianWindow.resizeTo(newSize.width, newSize.height);
			let newPosition = {x: window.screen.width / 2 - 450, y: window.screen.height - 450 - 75};
			obsidianWindow.moveTo(newPosition.x, newPosition.y);
		}

		electronWindow.setAlwaysOnTop(true, "floating", 1);
		electronWindow.webContents.setBackgroundThrottling(false);

		function windowClosed()
		{
			if (cancelled) return;
			endBatch();
			cancelled = true;
			electronWindow?.off("close", windowClosed);
		}

		electronWindow.on("close", windowClosed);


		createLoadingContainer();
	}

	export function endBatch()
	{
		if (!batchStarted) return;

		if (renderLeaf)
		{
            if (!errorInBatch)
			{
				ExportLog.log("Closing render window");
			    renderLeaf.detach();
			}
			else
			{
				ExportLog.warning("Error in batch, leaving render window open");
				_reportProgress(1, 1, "Completed with errors", "Please see the log for more details.", errorColor);
			}
		}

		electronWindow = undefined;
		renderLeaf = undefined;

		batchStarted = false;
	}

	function generateLogEl(title: string, message: any, textColor: string, backgroundColor: string): HTMLElement
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
						<progress class="html-render-progressbar" value="0" min="0" max="1" style="width: 300px; height: 15px; background-color: transparent; color: var(--interactive-accent);"></progress>
						<span class="html-render-submessage" style="margin-block-start: 2em;"></span>
					</div>
					<div class="html-render-log" style="display:none; flex-direction: column; border-left: 1px solid var(--divider-color); overflow-y: auto; width: 300px; max-width: 300px; min-width: 300px;">
						<h1 style="color: var(--color-yellow);padding: 0.3em;background-color: rgba(100, 70, 20, 0.1);margin: 0;">Export Log</h1>
					</div>
				</div>
			</div>
			`

			// @ts-ignore
			renderLeaf.parent.parent.containerEl.appendChild(loadingContainer);
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
		if (!loadingContainer) return;
		

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

		electronWindow?.setProgressBar(progress);
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
