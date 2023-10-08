import { __awaiter } from "tslib";
import { Component, Notice, MarkdownRenderer as ObsidianRenderer, loadMermaid } from "obsidian";
import { Utils } from "scripts/utils/utils";
import { AssetHandler } from "./asset-handler";
import { TabManager } from "scripts/utils/tab-manager";
import { RenderLog } from "./render-log";
export var MarkdownRenderer;
(function (MarkdownRenderer) {
    MarkdownRenderer.convertableExtensions = ["md", "canvas"];
    MarkdownRenderer.errorInBatch = false;
    MarkdownRenderer.cancelled = false;
    MarkdownRenderer.batchStarted = false;
    let logContainer;
    let loadingContainer;
    let infoColor = "var(--text-normal)";
    let warningColor = "var(--color-yellow)";
    let errorColor = "var(--color-red)";
    let infoBoxColor = "rgba(0,0,0,0.15)";
    let warningBoxColor = "rgba(var(--color-yellow-rgb), 0.15)";
    let errorBoxColor = "rgba(var(--color-red-rgb), 0.15)";
    function isConvertable(extention) {
        return MarkdownRenderer.convertableExtensions.contains(extention);
    }
    MarkdownRenderer.isConvertable = isConvertable;
    function checkCancelled() {
        if (MarkdownRenderer.cancelled || !MarkdownRenderer.renderLeaf) {
            RenderLog.log("cancelled");
            endBatch();
            return true;
        }
        return false;
    }
    MarkdownRenderer.checkCancelled = checkCancelled;
    function failRender(file, message) {
        if (checkCancelled())
            return undefined;
        RenderLog.error(message, `Rendering ${file.path} failed: `);
        return;
    }
    function renderFile(file, container) {
        return __awaiter(this, void 0, void 0, function* () {
            let loneFile = !MarkdownRenderer.batchStarted;
            if (loneFile) {
                RenderLog.log("beginning lone batch");
                yield MarkdownRenderer.beginBatch();
            }
            let success = yield Utils.waitUntil(() => MarkdownRenderer.renderLeaf != undefined || checkCancelled(), 2000, 10);
            if (!success || !MarkdownRenderer.renderLeaf)
                return failRender(file, "Failed to get leaf for rendering!");
            try {
                yield MarkdownRenderer.renderLeaf.openFile(file, { active: false });
            }
            catch (e) {
                return failRender(file, e);
            }
            let html;
            let view = MarkdownRenderer.renderLeaf.view;
            let viewType = view.getViewType();
            switch (viewType) {
                case "markdown":
                    // @ts-ignore
                    let preview = view.previewMode;
                    html = yield renderMarkdownView(preview, container);
                    break;
                case "kanban":
                    html = yield renderGeneric(view, container);
                    break;
                case "excalidraw":
                    html = yield renderExcalidraw(view, container);
                    break;
                case "canvas":
                    html = yield renderCanvas(view, container);
                    break;
                default:
                    html = yield renderGeneric(view, container);
                    break;
            }
            if (checkCancelled())
                return undefined;
            if (!html)
                return failRender(file, "Failed to render file!");
            yield postProcessHTML(html);
            yield AssetHandler.loadMathjaxStyles();
            if (loneFile)
                MarkdownRenderer.endBatch();
            return { contentEl: html, viewType: viewType };
        });
    }
    MarkdownRenderer.renderFile = renderFile;
    function renderMarkdownView(preview, container) {
        return __awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            let renderer = preview.renderer;
            yield renderer.unfoldAllHeadings();
            yield renderer.unfoldAllLists();
            yield renderer.parseSync();
            // @ts-ignore
            if (!window.mermaid) {
                yield loadMermaid();
            }
            let sections = renderer.sections;
            let viewEl = document.body.createDiv({ cls: "markdown-preview-view markdown-rendered" });
            let sizerEl = viewEl.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" });
            let pusherEl = sizerEl.createDiv({ cls: "markdown-preview-pusher" });
            pusherEl.style.height = "0.1px";
            pusherEl.style.marginBottom = "0px";
            pusherEl.style.width = "1px";
            // @ts-ignore
            let promises = [];
            for (let i = 0; i < sections.length; i++) {
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
                yield section.render();
                // @ts-ignore
                let success = yield Utils.waitUntil(() => (section.el && section.rendered == true) || checkCancelled(), 2000, 5);
                if (!success)
                    return failRender(preview.file, "Failed to render section!");
                section.el.querySelectorAll(".language-mermaid").forEach((element) => __awaiter(this, void 0, void 0, function* () {
                    let code = element.innerText;
                    // @ts-ignore
                    const { svg, bindFunctions } = yield mermaid.render("mermaid-" + preview.docId + "-" + i, code);
                    if (element.parentElement) {
                        element.parentElement.outerHTML = `<div class="mermaid">${svg}</div>`;
                        bindFunctions(element.parentElement);
                    }
                }));
                yield renderer.measureSection(section);
                success = yield Utils.waitUntil(() => section.computed == true || checkCancelled(), 2000, 5);
                if (!success)
                    return failRender(preview.file, "Failed to compute section!");
                // @ts-ignore
                yield preview.postProcess(section, promises, renderer.frontmatter);
            }
            // @ts-ignore
            yield Promise.all(promises);
            // move all of them back in since rendering can cause some sections to move themselves out of their container
            for (let i = 0; i < sections.length; i++) {
                let section = sections[i];
                sizerEl.appendChild(section.el);
            }
            container.appendChild(viewEl);
            yield AssetHandler.loadMathjaxStyles();
            return viewEl;
        });
    }
    MarkdownRenderer.renderMarkdownView = renderMarkdownView;
    function renderSingleLineMarkdown(markdown, container) {
        return __awaiter(this, void 0, void 0, function* () {
            let renderComp = new Component();
            renderComp.load();
            yield ObsidianRenderer.renderMarkdown(markdown, container, "/", renderComp);
            renderComp.unload();
            //remove rendered lists and replace them with plain text
            container.querySelectorAll("ol").forEach((listEl) => {
                var _a;
                if (listEl.parentElement) {
                    let start = (_a = listEl.getAttribute("start")) !== null && _a !== void 0 ? _a : "1";
                    listEl.parentElement.createSpan().outerHTML = `<p>${start}. ${listEl.innerText}</p>`;
                    listEl.remove();
                }
            });
            container.querySelectorAll("ul").forEach((listEl) => {
                if (listEl.parentElement) {
                    listEl.parentElement.createSpan().innerHTML = "- " + listEl.innerHTML;
                    listEl.remove();
                }
            });
            container.querySelectorAll("li").forEach((listEl) => {
                if (listEl.parentElement) {
                    listEl.parentElement.createSpan().innerHTML = listEl.innerHTML;
                    listEl.remove();
                }
            });
        });
    }
    MarkdownRenderer.renderSingleLineMarkdown = renderSingleLineMarkdown;
    function filterOutMarkdown(markdown) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let renderComp = new Component();
            renderComp.load();
            let container = document.createElement("div");
            yield ObsidianRenderer.renderMarkdown(markdown, container, "/", renderComp);
            renderComp.unload();
            //remove rendered lists and replace them with plain text
            container.querySelectorAll("ol").forEach((listEl) => {
                var _a;
                if (listEl.parentElement) {
                    let start = (_a = listEl.getAttribute("start")) !== null && _a !== void 0 ? _a : "1";
                    listEl.parentElement.createSpan().outerHTML = `<p>${start}. ${listEl.innerText}</p>`;
                    listEl.remove();
                }
            });
            container.querySelectorAll("ul").forEach((listEl) => {
                if (listEl.parentElement) {
                    listEl.parentElement.createSpan().innerHTML = "- " + listEl.innerHTML;
                    listEl.remove();
                }
            });
            container.querySelectorAll("li").forEach((listEl) => {
                if (listEl.parentElement) {
                    listEl.parentElement.createSpan().innerHTML = listEl.innerHTML;
                    listEl.remove();
                }
            });
            let text = (_a = container.textContent) !== null && _a !== void 0 ? _a : "";
            container.remove();
            return text;
        });
    }
    MarkdownRenderer.filterOutMarkdown = filterOutMarkdown;
    function renderGeneric(view, container) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Utils.delay(2000);
            if (checkCancelled())
                return undefined;
            // @ts-ignore
            let content = view.contentEl;
            container.appendChild(content);
            yield AssetHandler.loadMathjaxStyles();
            return content;
        });
    }
    function renderExcalidraw(view, container) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Utils.delay(500);
            // @ts-ignore
            let scene = view.excalidrawData.scene;
            // @ts-ignore
            let svg = yield view.svg(scene, "", false);
            // remove rect fill
            let isLight = !svg.getAttribute("filter");
            if (!isLight)
                svg.removeAttribute("filter");
            svg.classList.add(isLight ? "light" : "dark");
            let contentEl = document.createElement("div");
            contentEl.classList.add("view-content");
            let sizerEl = contentEl.createDiv();
            sizerEl.classList.add("excalidraw-plugin");
            sizerEl.appendChild(svg);
            yield AssetHandler.loadMathjaxStyles();
            if (checkCancelled())
                return undefined;
            container.appendChild(contentEl);
            return contentEl;
        });
    }
    function renderCanvas(view, container) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (checkCancelled())
                return undefined;
            let canvas = view.canvas;
            let nodes = canvas.nodes;
            let edges = canvas.edges;
            for (const node of nodes) {
                yield node[1].render();
            }
            for (const edge of edges) {
                yield edge[1].render();
            }
            canvas.zoomToFit();
            yield Utils.delay(500);
            let contentEl = view.contentEl;
            let canvasEl = contentEl.querySelector(".canvas");
            canvasEl.innerHTML = "";
            let edgeContainer = canvasEl.createEl("svg", { cls: "canvas-edges" });
            let edgeHeadContainer = canvasEl.createEl("svg", { cls: "canvas-edges" });
            for (const node of nodes) {
                let nodeEl = node[1].nodeEl;
                let childPreview = (_b = (_a = node[1]) === null || _a === void 0 ? void 0 : _a.child) === null || _b === void 0 ? void 0 : _b.previewMode;
                let embedEl = nodeEl.querySelector(".markdown-embed-content.node-insert-event");
                if (childPreview && embedEl) {
                    node[1].render();
                    embedEl.innerHTML = "";
                    yield renderMarkdownView(childPreview, embedEl);
                }
                canvasEl.appendChild(nodeEl);
            }
            for (const edge of edges) {
                let edgeEl = edge[1].lineGroupEl;
                let headEl = edge[1].lineEndGroupEl;
                edgeContainer.appendChild(edgeEl);
                edgeHeadContainer.appendChild(headEl);
                if (edge[1].label) {
                    let labelEl = edge[1].labelElement.wrapperEl;
                    canvasEl.appendChild(labelEl);
                }
            }
            if (checkCancelled())
                return undefined;
            container.appendChild(contentEl);
            return contentEl;
        });
    }
    function postProcessHTML(html) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // transclusions put a div inside a p tag, which is invalid html. Fix it here
            html.querySelectorAll("p:has(div)").forEach((element) => {
                // replace the p tag with a span
                let span = document.body.createEl("span");
                span.innerHTML = element.innerHTML;
                element.replaceWith(span);
            });
            // encode all text input values into attributes
            html.querySelectorAll("input[type=text]").forEach((element) => {
                // @ts-ignore
                element.setAttribute("value", element.value);
                // @ts-ignore
                element.value = "";
            });
            html.querySelectorAll("textarea").forEach((element) => {
                // @ts-ignore
                element.textContent = element.value;
            });
            // convert all hard coded image / media widths into max widths
            html.querySelectorAll("img, video, .media-embed:has( > :is(img, video))").forEach((element) => {
                let width = element.getAttribute("width");
                if (width) {
                    element.removeAttribute("width");
                    element.style.width = (width.trim() != "") ? (width + "px") : "";
                    element.style.maxWidth = "100%";
                }
            });
            // replace obsidian's pdf embeds with normal embeds
            // this has to happen before converting canvases because the pdf embeds use canvas elements
            html.querySelectorAll("span.internal-embed.pdf-embed").forEach((pdf) => {
                var _a, _b;
                let embed = document.createElement("embed");
                embed.setAttribute("src", (_a = pdf.getAttribute("src")) !== null && _a !== void 0 ? _a : "");
                embed.style.width = pdf.style.width || '100%';
                embed.style.maxWidth = "100%";
                embed.style.height = pdf.style.height || '800px';
                let container = (_b = pdf.parentElement) === null || _b === void 0 ? void 0 : _b.parentElement;
                container === null || container === void 0 ? void 0 : container.querySelectorAll("*").forEach((el) => el.remove());
                if (container)
                    container.appendChild(embed);
                RenderLog.log(container === null || container === void 0 ? void 0 : container.innerHTML);
            });
            // convert canvas elements into images
            html.querySelectorAll("canvas").forEach((canvas) => {
                let image = document.createElement("img");
                let data = canvas.toDataURL();
                RenderLog.log(canvas, data);
                image.src = data;
                image.style.width = canvas.style.width || "100%";
                image.style.maxWidth = "100%";
                canvas.replaceWith(image);
            });
            // if the dynamic table of contents plugin is included on this page
            // then parse each list item and render markdown for it
            let tocEls = Array.from(html.querySelectorAll(".block-language-toc.dynamic-toc li > a"));
            for (const element of tocEls) {
                let renderEl = document.body.createDiv();
                renderSingleLineMarkdown((_a = element.textContent) !== null && _a !== void 0 ? _a : "", renderEl);
                element.textContent = renderEl.textContent;
                renderEl.remove();
            }
        });
    }
    function beginBatch() {
        return __awaiter(this, void 0, void 0, function* () {
            if (MarkdownRenderer.batchStarted) {
                throw new Error("Cannot start a new batch while one is already running!");
            }
            MarkdownRenderer.errorInBatch = false;
            MarkdownRenderer.cancelled = false;
            MarkdownRenderer.batchStarted = true;
            loadingContainer = undefined;
            logContainer = undefined;
            MarkdownRenderer.renderLeaf = TabManager.openNewTab("window", "vertical");
            // @ts-ignore
            let parentFound = yield Utils.waitUntil(() => (MarkdownRenderer.renderLeaf && MarkdownRenderer.renderLeaf.parent) || checkCancelled(), 2000, 10);
            if (!parentFound) {
                try {
                    MarkdownRenderer.renderLeaf.detach();
                }
                catch (e) {
                    RenderLog.error(e, "Failed to detach render leaf: ");
                }
                if (!checkCancelled()) {
                    new Notice("Error: Failed to create leaf for rendering!");
                    throw new Error("Failed to create leaf for rendering!");
                }
                return;
            }
            // hide the leaf so we can render without intruding on the user
            // @ts-ignore
            MarkdownRenderer.renderLeaf.parent.containerEl.style.height = "0";
            // @ts-ignore
            MarkdownRenderer.renderLeaf.parent.parent.containerEl.querySelector(".clickable-icon, .workspace-tab-header-container-inner").style.display = "none";
            // @ts-ignore
            MarkdownRenderer.renderLeaf.parent.containerEl.style.maxHeight = "var(--header-height)";
            // @ts-ignore
            MarkdownRenderer.renderLeaf.parent.parent.containerEl.classList.remove("mod-vertical");
            // @ts-ignore
            MarkdownRenderer.renderLeaf.parent.parent.containerEl.classList.add("mod-horizontal");
            let newSize = { width: 800, height: 400 };
            MarkdownRenderer.renderLeaf.view.containerEl.win.resizeTo(newSize.width, newSize.height);
            let newPosition = { x: window.screen.width / 2 - 450, y: window.screen.height - 450 - 75 };
            MarkdownRenderer.renderLeaf.view.containerEl.win.moveTo(newPosition.x, newPosition.y);
            // @ts-ignore
            let renderBrowserWindow = MarkdownRenderer.renderLeaf.view.containerEl.win.electronWindow;
            if (!renderBrowserWindow) {
                new Notice("Failed to get the render window, please try again.");
                MarkdownRenderer.errorInBatch = false;
                MarkdownRenderer.cancelled = false;
                MarkdownRenderer.batchStarted = false;
                MarkdownRenderer.renderLeaf = undefined;
                return;
            }
            renderBrowserWindow.setAlwaysOnTop(true, "floating", 1);
            renderBrowserWindow.webContents.setFrameRate(120);
            renderBrowserWindow.on("close", () => {
                if (MarkdownRenderer.cancelled)
                    return;
                endBatch();
                MarkdownRenderer.cancelled = true;
            }, { once: true });
            // @ts-ignore
            let allWindows = window.electron.remote.BrowserWindow.getAllWindows();
            for (const win of allWindows) {
                win.webContents.setBackgroundThrottling(false);
            }
            createLoadingContainer();
        });
    }
    MarkdownRenderer.beginBatch = beginBatch;
    function endBatch() {
        if (!MarkdownRenderer.batchStarted)
            return;
        if (MarkdownRenderer.renderLeaf) {
            if (!MarkdownRenderer.errorInBatch) {
                RenderLog.log("detaching");
                MarkdownRenderer.renderLeaf.detach();
            }
            else
                RenderLog.log("error in batch, not detaching");
        }
        // @ts-ignore
        let allWindows = window.electron.remote.BrowserWindow.getAllWindows();
        for (const win of allWindows) {
            win.webContents.setBackgroundThrottling(false);
        }
        MarkdownRenderer.batchStarted = false;
    }
    MarkdownRenderer.endBatch = endBatch;
    function generateLogEl(title, message, textColor, backgroundColor) {
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
    MarkdownRenderer.generateLogEl = generateLogEl;
    function createLoadingContainer() {
        if (!loadingContainer) {
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
			`;
            // @ts-ignore
            MarkdownRenderer.renderLeaf.parent.parent.containerEl.appendChild(loadingContainer);
            let copyButton = loadingContainer.querySelector("button.html-render-log-copy-button");
            if (copyButton) {
                copyButton.addEventListener("click", () => {
                    navigator.clipboard.writeText(RenderLog.fullLog);
                    new Notice("Copied to clipboard! Please paste this into your github issue as is.");
                });
            }
        }
    }
    let logShowing = false;
    function appendLogEl(logEl) {
        if (!logContainer || !MarkdownRenderer.renderLeaf)
            return;
        if (!logShowing) {
            MarkdownRenderer.renderLeaf.view.containerEl.win.resizeTo(900, 500);
            logContainer.style.display = "flex";
            logShowing = true;
        }
        logContainer.appendChild(logEl);
    }
    function _reportProgress(complete, total, message, subMessage, progressColor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!MarkdownRenderer.batchStarted)
                return;
            // @ts-ignore
            if (!MarkdownRenderer.renderLeaf || !MarkdownRenderer.renderLeaf.parent || !MarkdownRenderer.renderLeaf.parent.parent)
                return;
            // @ts-ignore
            let loadingContainer = MarkdownRenderer.renderLeaf.parent.parent.containerEl.querySelector(`.html-render-progress-container`);
            let progress = complete / total;
            let progressBar = loadingContainer.querySelector("progress");
            if (progressBar) {
                progressBar.value = progress;
                progressBar.style.backgroundColor = "transparent";
                progressBar.style.color = progressColor;
            }
            let messageElement = loadingContainer.querySelector("h1");
            if (messageElement) {
                messageElement.innerText = message;
            }
            let subMessageElement = loadingContainer.querySelector("span.html-render-submessage");
            if (subMessageElement) {
                subMessageElement.innerText = subMessage;
            }
        });
    }
    MarkdownRenderer._reportProgress = _reportProgress;
    function _reportError(messageTitle, message, fatal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!MarkdownRenderer.batchStarted)
                return;
            MarkdownRenderer.errorInBatch = true;
            // @ts-ignore
            let found = yield Utils.waitUntil(() => MarkdownRenderer.renderLeaf && MarkdownRenderer.renderLeaf.parent && MarkdownRenderer.renderLeaf.parent.parent, 100, 10);
            if (!found)
                return;
            appendLogEl(generateLogEl(messageTitle, message, errorColor, errorBoxColor));
            if (fatal) {
                MarkdownRenderer.renderLeaf = undefined;
                loadingContainer = undefined;
                logContainer = undefined;
            }
        });
    }
    MarkdownRenderer._reportError = _reportError;
    function _reportWarning(messageTitle, message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!MarkdownRenderer.batchStarted)
                return;
            // @ts-ignore
            let found = yield Utils.waitUntil(() => MarkdownRenderer.renderLeaf && MarkdownRenderer.renderLeaf.parent && MarkdownRenderer.renderLeaf.parent.parent, 100, 10);
            if (!found)
                return;
            appendLogEl(generateLogEl(messageTitle, message, warningColor, warningBoxColor));
        });
    }
    MarkdownRenderer._reportWarning = _reportWarning;
    function _reportInfo(messageTitle, message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!MarkdownRenderer.batchStarted)
                return;
            // @ts-ignore
            let found = yield Utils.waitUntil(() => MarkdownRenderer.renderLeaf && MarkdownRenderer.renderLeaf.parent && MarkdownRenderer.renderLeaf.parent.parent, 100, 10);
            if (!found)
                return;
            appendLogEl(generateLogEl(messageTitle, message, infoColor, infoBoxColor));
        });
    }
    MarkdownRenderer._reportInfo = _reportInfo;
})(MarkdownRenderer || (MarkdownRenderer = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Rvd24tcmVuZGVyZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtYXJrZG93bi1yZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQWlCLGdCQUFnQixJQUFJLGdCQUFnQixFQUF1QixXQUFXLEVBQVMsTUFBTSxVQUFVLENBQUM7QUFDM0ksT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQzVDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDdkQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUV6QyxNQUFNLEtBQVcsZ0JBQWdCLENBaXRCaEM7QUFqdEJELFdBQWlCLGdCQUFnQjtJQUVyQixzQ0FBcUIsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUV0Qyw2QkFBWSxHQUFZLEtBQUssQ0FBQztJQUNqQywwQkFBUyxHQUFZLEtBQUssQ0FBQztJQUMzQiw2QkFBWSxHQUFZLEtBQUssQ0FBQztJQUN6QyxJQUFJLFlBQXFDLENBQUM7SUFDMUMsSUFBSSxnQkFBeUMsQ0FBQztJQUU5QyxJQUFJLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQztJQUNyQyxJQUFJLFlBQVksR0FBRyxxQkFBcUIsQ0FBQztJQUN6QyxJQUFJLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQztJQUNwQyxJQUFJLFlBQVksR0FBRyxrQkFBa0IsQ0FBQTtJQUNyQyxJQUFJLGVBQWUsR0FBRyxxQ0FBcUMsQ0FBQztJQUM1RCxJQUFJLGFBQWEsR0FBRyxrQ0FBa0MsQ0FBQztJQUV2RCxTQUFnQixhQUFhLENBQUMsU0FBaUI7UUFFOUMsT0FBTyxpQkFBQSxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUhlLDhCQUFh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RSxPQUFPO1lBRW5CLFdBQVcsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUNsRixDQUFDO0tBQUE7SUFUcUIsK0JBQWMsaUJBU25DLENBQUE7SUFFRSxTQUFzQixXQUFXLENBQUMsWUFBb0IsRUFBRSxPQUFlOztZQUV6RSxJQUFJLENBQUMsaUJBQUEsWUFBWTtnQkFBRSxPQUFPO1lBRTFCLGFBQWE7WUFDYixJQUFJLEtBQUssR0FBRyxNQUFNLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsaUJBQUEsVUFBVSxJQUFJLGlCQUFBLFVBQVUsQ0FBQyxNQUFNLElBQUksaUJBQUEsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlHLElBQUksQ0FBQyxLQUFLO2dCQUFFLE9BQU87WUFFbkIsV0FBVyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQzVFLENBQUM7S0FBQTtJQVR3Qiw0QkFBVyxjQVNuQyxDQUFBO0FBRUYsQ0FBQyxFQWp0QmdCLGdCQUFnQixLQUFoQixnQkFBZ0IsUUFpdEJoQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgTm90aWNlLCBXb3Jrc3BhY2VMZWFmLCBNYXJrZG93blJlbmRlcmVyIGFzIE9ic2lkaWFuUmVuZGVyZXIsIE1hcmtkb3duUHJldmlld1ZpZXcsIGxvYWRNZXJtYWlkLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL3V0aWxzXCI7XHJcbmltcG9ydCB7IEFzc2V0SGFuZGxlciB9IGZyb20gXCIuL2Fzc2V0LWhhbmRsZXJcIjtcclxuaW1wb3J0IHsgVGFiTWFuYWdlciB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL3RhYi1tYW5hZ2VyXCI7XHJcbmltcG9ydCB7IFJlbmRlckxvZyB9IGZyb20gXCIuL3JlbmRlci1sb2dcIjtcclxuXHJcbmV4cG9ydCBuYW1lc3BhY2UgTWFya2Rvd25SZW5kZXJlclxyXG57XHJcblx0ZXhwb3J0IGxldCBjb252ZXJ0YWJsZUV4dGVuc2lvbnMgPSBbXCJtZFwiLCBcImNhbnZhc1wiXTtcclxuXHRleHBvcnQgbGV0IHJlbmRlckxlYWY6IFdvcmtzcGFjZUxlYWYgfCB1bmRlZmluZWQ7XHJcbiAgICBleHBvcnQgbGV0IGVycm9ySW5CYXRjaDogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdGV4cG9ydCBsZXQgY2FuY2VsbGVkOiBib29sZWFuID0gZmFsc2U7XHJcblx0ZXhwb3J0IGxldCBiYXRjaFN0YXJ0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHRsZXQgbG9nQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcclxuXHRsZXQgbG9hZGluZ0NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XHJcblxyXG5cdGxldCBpbmZvQ29sb3IgPSBcInZhcigtLXRleHQtbm9ybWFsKVwiO1xyXG5cdGxldCB3YXJuaW5nQ29sb3IgPSBcInZhcigtLWNvbG9yLXllbGxvdylcIjtcclxuXHRsZXQgZXJyb3JDb2xvciA9IFwidmFyKC0tY29sb3ItcmVkKVwiO1xyXG5cdGxldCBpbmZvQm94Q29sb3IgPSBcInJnYmEoMCwwLDAsMC4xNSlcIlxyXG5cdGxldCB3YXJuaW5nQm94Q29sb3IgPSBcInJnYmEodmFyKC0tY29sb3IteWVsbG93LXJnYiksIDAuMTUpXCI7XHJcblx0bGV0IGVycm9yQm94Q29sb3IgPSBcInJnYmEodmFyKC0tY29sb3ItcmVkLXJnYiksIDAuMTUpXCI7XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBpc0NvbnZlcnRhYmxlKGV4dGVudGlvbjogc3RyaW5nKVxyXG5cdHtcclxuXHRcdHJldHVybiBjb252ZXJ0YWJsZUV4dGVuc2lvbnMuY29udGFpbnMoZXh0ZW50aW9uKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBjaGVja0NhbmNlbGxlZCgpOiBib29sZWFuXHJcblx0e1xyXG5cdFx0aWYgKE1hcmtkb3duUmVuZGVyZXIuY2FuY2VsbGVkIHx8ICFNYXJrZG93blJlbmRlcmVyLnJlbmRlckxlYWYpIFxyXG5cdFx0e1xyXG5cdFx0XHRSZW5kZXJMb2cubG9nKFwiY2FuY2VsbGVkXCIpO1xyXG5cdFx0XHRlbmRCYXRjaCgpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmYWlsUmVuZGVyKGZpbGU6IFRGaWxlLCBtZXNzYWdlOiBhbnkpOiB1bmRlZmluZWRcclxuXHR7XHJcblx0XHRpZiAoY2hlY2tDYW5jZWxsZWQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRSZW5kZXJMb2cuZXJyb3IobWVzc2FnZSwgYFJlbmRlcmluZyAke2ZpbGUucGF0aH0gZmFpbGVkOiBgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5kZXJGaWxlKGZpbGU6IFRGaWxlLCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx7Y29udGVudEVsOiBIVE1MRWxlbWVudCwgdmlld1R5cGU6IHN0cmluZ30gfCB1bmRlZmluZWQ+XHJcblx0e1xyXG5cdFx0bGV0IGxvbmVGaWxlID0gIWJhdGNoU3RhcnRlZDtcclxuXHRcdGlmIChsb25lRmlsZSkgXHJcblx0XHR7XHJcblx0XHRcdFJlbmRlckxvZy5sb2coXCJiZWdpbm5pbmcgbG9uZSBiYXRjaFwiKTtcclxuXHRcdFx0YXdhaXQgTWFya2Rvd25SZW5kZXJlci5iZWdpbkJhdGNoKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHN1Y2Nlc3MgPSBhd2FpdCBVdGlscy53YWl0VW50aWwoKCkgPT4gcmVuZGVyTGVhZiAhPSB1bmRlZmluZWQgfHwgY2hlY2tDYW5jZWxsZWQoKSwgMjAwMCwgMTApO1xyXG5cdFx0aWYgKCFzdWNjZXNzIHx8ICFyZW5kZXJMZWFmKSByZXR1cm4gZmFpbFJlbmRlcihmaWxlLCBcIkZhaWxlZCB0byBnZXQgbGVhZiBmb3IgcmVuZGVyaW5nIVwiKTtcclxuXHRcdFxyXG5cdFx0dHJ5XHJcblx0XHR7IFxyXG5cdFx0XHRhd2FpdCByZW5kZXJMZWFmLm9wZW5GaWxlKGZpbGUsIHsgYWN0aXZlOiBmYWxzZX0pO1xyXG5cdFx0fVxyXG5cdFx0Y2F0Y2ggKGUpXHJcblx0XHR7XHJcblx0XHRcdHJldHVybiBmYWlsUmVuZGVyKGZpbGUsIGUpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRsZXQgaHRtbDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XHJcblx0XHRsZXQgdmlldyA9IHJlbmRlckxlYWYudmlldztcclxuXHRcdGxldCB2aWV3VHlwZSA9IHZpZXcuZ2V0Vmlld1R5cGUoKTtcclxuXHJcblx0XHRzd2l0Y2godmlld1R5cGUpXHJcblx0XHR7XHJcblx0XHRcdGNhc2UgXCJtYXJrZG93blwiOlxyXG5cdFx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0XHRsZXQgcHJldmlldyA9IHZpZXcucHJldmlld01vZGU7XHJcblx0XHRcdFx0aHRtbCA9IGF3YWl0IHJlbmRlck1hcmtkb3duVmlldyhwcmV2aWV3LCBjb250YWluZXIpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlIFwia2FuYmFuXCI6XHJcblx0XHRcdFx0aHRtbCA9IGF3YWl0IHJlbmRlckdlbmVyaWModmlldywgY29udGFpbmVyKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSBcImV4Y2FsaWRyYXdcIjpcclxuXHRcdFx0XHRodG1sID0gYXdhaXQgcmVuZGVyRXhjYWxpZHJhdyh2aWV3LCBjb250YWluZXIpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlIFwiY2FudmFzXCI6XHJcblx0XHRcdFx0aHRtbCA9IGF3YWl0IHJlbmRlckNhbnZhcyh2aWV3LCBjb250YWluZXIpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdGh0bWwgPSBhd2FpdCByZW5kZXJHZW5lcmljKHZpZXcsIGNvbnRhaW5lcik7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYoY2hlY2tDYW5jZWxsZWQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHRcdGlmICghaHRtbCkgcmV0dXJuIGZhaWxSZW5kZXIoZmlsZSwgXCJGYWlsZWQgdG8gcmVuZGVyIGZpbGUhXCIpO1xyXG5cclxuXHRcdGF3YWl0IHBvc3RQcm9jZXNzSFRNTChodG1sKTtcclxuXHRcdGF3YWl0IEFzc2V0SGFuZGxlci5sb2FkTWF0aGpheFN0eWxlcygpO1xyXG5cclxuXHRcdGlmIChsb25lRmlsZSkgTWFya2Rvd25SZW5kZXJlci5lbmRCYXRjaCgpO1xyXG5cclxuXHRcdHJldHVybiB7Y29udGVudEVsOiBodG1sLCB2aWV3VHlwZTogdmlld1R5cGV9O1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbmRlck1hcmtkb3duVmlldyhwcmV2aWV3OiBNYXJrZG93blByZXZpZXdWaWV3LCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogUHJvbWlzZTxIVE1MRWxlbWVudCB8IHVuZGVmaW5lZD5cclxuXHR7XHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRsZXQgcmVuZGVyZXIgPSBwcmV2aWV3LnJlbmRlcmVyO1xyXG5cdFx0YXdhaXQgcmVuZGVyZXIudW5mb2xkQWxsSGVhZGluZ3MoKTtcclxuXHRcdGF3YWl0IHJlbmRlcmVyLnVuZm9sZEFsbExpc3RzKCk7XHJcblx0XHRhd2FpdCByZW5kZXJlci5wYXJzZVN5bmMoKTtcclxuXHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRpZiAoIXdpbmRvdy5tZXJtYWlkKVxyXG5cdFx0e1xyXG5cdFx0XHRhd2FpdCBsb2FkTWVybWFpZCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBzZWN0aW9ucyA9IHJlbmRlcmVyLnNlY3Rpb25zIGFzIHtcInJlbmRlcmVkXCI6IGJvb2xlYW4sIFwiaGVpZ2h0XCI6IG51bWJlciwgXCJjb21wdXRlZFwiOiBib29sZWFuLCBcImxpbmVzXCI6IG51bWJlciwgXCJsaW5lU3RhcnRcIjogbnVtYmVyLCBcImxpbmVFbmRcIjogbnVtYmVyLCBcInVzZWRcIjogYm9vbGVhbiwgXCJoaWdobGlnaHRSYW5nZXNcIjogbnVtYmVyLCBcImxldmVsXCI6IG51bWJlciwgXCJoZWFkaW5nQ29sbGFwc2VkXCI6IGJvb2xlYW4sIFwic2hvd25cIjogYm9vbGVhbiwgXCJ1c2VzRnJvbnRNYXR0ZXJcIjogYm9vbGVhbiwgXCJodG1sXCI6IHN0cmluZywgXCJlbFwiOiBIVE1MRWxlbWVudH1bXTtcclxuXHJcblx0XHRsZXQgdmlld0VsID0gZG9jdW1lbnQuYm9keS5jcmVhdGVEaXYoeyBjbHM6IFwibWFya2Rvd24tcHJldmlldy12aWV3IG1hcmtkb3duLXJlbmRlcmVkXCIgfSk7XHJcblx0XHRsZXQgc2l6ZXJFbCA9IHZpZXdFbC5jcmVhdGVEaXYoeyBjbHM6IFwibWFya2Rvd24tcHJldmlldy1zaXplciBtYXJrZG93bi1wcmV2aWV3LXNlY3Rpb25cIiB9KTtcclxuXHRcdGxldCBwdXNoZXJFbCA9IHNpemVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm1hcmtkb3duLXByZXZpZXctcHVzaGVyXCIgfSk7XHJcblx0XHRwdXNoZXJFbC5zdHlsZS5oZWlnaHQgPSBcIjAuMXB4XCI7XHJcblx0XHRwdXNoZXJFbC5zdHlsZS5tYXJnaW5Cb3R0b20gPSBcIjBweFwiO1xyXG5cdFx0cHVzaGVyRWwuc3R5bGUud2lkdGggPSBcIjFweFwiO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCBwcm9taXNlcyA9IFtdXHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZWN0aW9ucy5sZW5ndGg7IGkrKylcclxuXHRcdHtcclxuXHRcdFx0bGV0IHNlY3Rpb24gPSBzZWN0aW9uc1tpXTtcclxuXHJcblx0XHRcdHNlY3Rpb24uc2hvd24gPSB0cnVlO1xyXG5cdFx0XHRzZWN0aW9uLnJlbmRlcmVkID0gZmFsc2U7XHJcblx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0c2VjdGlvbi5yZXNldENvbXB1dGUoKTtcclxuXHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRzZWN0aW9uLnNldENvbGxhcHNlZChmYWxzZSk7XHJcblx0XHRcdHNlY3Rpb24uZWwuaW5uZXJIVE1MID0gXCJcIjtcclxuXHJcblx0XHRcdHNpemVyRWwuYXBwZW5kQ2hpbGQoc2VjdGlvbi5lbCk7XHJcblxyXG5cdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdGF3YWl0IHNlY3Rpb24ucmVuZGVyKCk7XHJcblxyXG5cdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdGxldCBzdWNjZXNzID0gYXdhaXQgVXRpbHMud2FpdFVudGlsKCgpID0+IChzZWN0aW9uLmVsICYmIHNlY3Rpb24ucmVuZGVyZWQgPT0gdHJ1ZSkgfHwgY2hlY2tDYW5jZWxsZWQoKSwgMjAwMCwgNSk7XHJcblx0XHRcdGlmICghc3VjY2VzcykgcmV0dXJuIGZhaWxSZW5kZXIocHJldmlldy5maWxlLCBcIkZhaWxlZCB0byByZW5kZXIgc2VjdGlvbiFcIik7XHJcblxyXG5cdFx0XHRzZWN0aW9uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoXCIubGFuZ3VhZ2UtbWVybWFpZFwiKS5mb3JFYWNoKGFzeW5jIChlbGVtZW50OiBIVE1MRWxlbWVudCkgPT5cclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBjb2RlID0gZWxlbWVudC5pbm5lclRleHQ7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRcdGNvbnN0IHsgc3ZnLCBiaW5kRnVuY3Rpb25zIH0gPSBhd2FpdCBtZXJtYWlkLnJlbmRlcihcIm1lcm1haWQtXCIgKyBwcmV2aWV3LmRvY0lkICsgXCItXCIgKyBpLCBjb2RlKTtcclxuXHJcblx0XHRcdFx0aWYoZWxlbWVudC5wYXJlbnRFbGVtZW50KVxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGVsZW1lbnQucGFyZW50RWxlbWVudC5vdXRlckhUTUwgPSBgPGRpdiBjbGFzcz1cIm1lcm1haWRcIj4ke3N2Z308L2Rpdj5gO1xyXG5cdFx0XHRcdFx0YmluZEZ1bmN0aW9ucyhlbGVtZW50LnBhcmVudEVsZW1lbnQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRhd2FpdCByZW5kZXJlci5tZWFzdXJlU2VjdGlvbihzZWN0aW9uKTtcclxuXHJcblx0XHRcdHN1Y2Nlc3MgPSBhd2FpdCBVdGlscy53YWl0VW50aWwoKCkgPT4gc2VjdGlvbi5jb21wdXRlZCA9PSB0cnVlIHx8IGNoZWNrQ2FuY2VsbGVkKCksIDIwMDAsIDUpO1xyXG5cdFx0XHRpZiAoIXN1Y2Nlc3MpIHJldHVybiBmYWlsUmVuZGVyKHByZXZpZXcuZmlsZSwgXCJGYWlsZWQgdG8gY29tcHV0ZSBzZWN0aW9uIVwiKTtcclxuXHJcblx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0YXdhaXQgcHJldmlldy5wb3N0UHJvY2VzcyhzZWN0aW9uLCBwcm9taXNlcywgcmVuZGVyZXIuZnJvbnRtYXR0ZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuXHJcblx0XHQvLyBtb3ZlIGFsbCBvZiB0aGVtIGJhY2sgaW4gc2luY2UgcmVuZGVyaW5nIGNhbiBjYXVzZSBzb21lIHNlY3Rpb25zIHRvIG1vdmUgdGhlbXNlbHZlcyBvdXQgb2YgdGhlaXIgY29udGFpbmVyXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNlY3Rpb25zLmxlbmd0aDsgaSsrKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgc2VjdGlvbiA9IHNlY3Rpb25zW2ldO1xyXG5cdFx0XHRzaXplckVsLmFwcGVuZENoaWxkKHNlY3Rpb24uZWwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh2aWV3RWwpO1xyXG5cdFx0YXdhaXQgQXNzZXRIYW5kbGVyLmxvYWRNYXRoamF4U3R5bGVzKCk7XHJcblxyXG5cdFx0cmV0dXJuIHZpZXdFbDtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5kZXJTaW5nbGVMaW5lTWFya2Rvd24obWFya2Rvd246IHN0cmluZywgY29udGFpbmVyOiBIVE1MRWxlbWVudClcclxuXHR7XHJcblx0XHRsZXQgcmVuZGVyQ29tcCA9IG5ldyBDb21wb25lbnQoKTtcclxuXHRcdHJlbmRlckNvbXAubG9hZCgpO1xyXG5cdFx0YXdhaXQgT2JzaWRpYW5SZW5kZXJlci5yZW5kZXJNYXJrZG93bihtYXJrZG93biwgY29udGFpbmVyLCBcIi9cIiwgcmVuZGVyQ29tcCk7XHJcblx0XHRyZW5kZXJDb21wLnVubG9hZCgpO1xyXG5cdFx0XHJcblx0XHQvL3JlbW92ZSByZW5kZXJlZCBsaXN0cyBhbmQgcmVwbGFjZSB0aGVtIHdpdGggcGxhaW4gdGV4dFxyXG5cdFx0Y29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCJvbFwiKS5mb3JFYWNoKChsaXN0RWw6IEhUTUxFbGVtZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRpZihsaXN0RWwucGFyZW50RWxlbWVudClcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBzdGFydCA9IGxpc3RFbC5nZXRBdHRyaWJ1dGUoXCJzdGFydFwiKSA/PyBcIjFcIjtcclxuXHRcdFx0XHRsaXN0RWwucGFyZW50RWxlbWVudC5jcmVhdGVTcGFuKCkub3V0ZXJIVE1MID0gYDxwPiR7c3RhcnR9LiAke2xpc3RFbC5pbm5lclRleHR9PC9wPmA7XHJcblx0XHRcdFx0bGlzdEVsLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKFwidWxcIikuZm9yRWFjaCgobGlzdEVsOiBIVE1MRWxlbWVudCkgPT5cclxuXHRcdHtcclxuXHRcdFx0aWYobGlzdEVsLnBhcmVudEVsZW1lbnQpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsaXN0RWwucGFyZW50RWxlbWVudC5jcmVhdGVTcGFuKCkuaW5uZXJIVE1MID0gXCItIFwiICsgbGlzdEVsLmlubmVySFRNTDtcclxuXHRcdFx0XHRsaXN0RWwucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdFx0Y29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCJsaVwiKS5mb3JFYWNoKChsaXN0RWw6IEhUTUxFbGVtZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRpZihsaXN0RWwucGFyZW50RWxlbWVudClcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxpc3RFbC5wYXJlbnRFbGVtZW50LmNyZWF0ZVNwYW4oKS5pbm5lckhUTUwgPSBsaXN0RWwuaW5uZXJIVE1MO1xyXG5cdFx0XHRcdGxpc3RFbC5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsdGVyT3V0TWFya2Rvd24obWFya2Rvd246IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPlxyXG5cdHtcclxuXHRcdGxldCByZW5kZXJDb21wID0gbmV3IENvbXBvbmVudCgpO1xyXG5cdFx0cmVuZGVyQ29tcC5sb2FkKCk7XHJcblx0XHRsZXQgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdGF3YWl0IE9ic2lkaWFuUmVuZGVyZXIucmVuZGVyTWFya2Rvd24obWFya2Rvd24sIGNvbnRhaW5lciwgXCIvXCIsIHJlbmRlckNvbXApO1xyXG5cdFx0cmVuZGVyQ29tcC51bmxvYWQoKTtcclxuXHRcdFxyXG5cdFx0Ly9yZW1vdmUgcmVuZGVyZWQgbGlzdHMgYW5kIHJlcGxhY2UgdGhlbSB3aXRoIHBsYWluIHRleHRcclxuXHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKFwib2xcIikuZm9yRWFjaCgobGlzdEVsOiBIVE1MRWxlbWVudCkgPT5cclxuXHRcdHtcclxuXHRcdFx0aWYobGlzdEVsLnBhcmVudEVsZW1lbnQpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgc3RhcnQgPSBsaXN0RWwuZ2V0QXR0cmlidXRlKFwic3RhcnRcIikgPz8gXCIxXCI7XHJcblx0XHRcdFx0bGlzdEVsLnBhcmVudEVsZW1lbnQuY3JlYXRlU3BhbigpLm91dGVySFRNTCA9IGA8cD4ke3N0YXJ0fS4gJHtsaXN0RWwuaW5uZXJUZXh0fTwvcD5gO1xyXG5cdFx0XHRcdGxpc3RFbC5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbChcInVsXCIpLmZvckVhY2goKGxpc3RFbDogSFRNTEVsZW1lbnQpID0+XHJcblx0XHR7XHJcblx0XHRcdGlmKGxpc3RFbC5wYXJlbnRFbGVtZW50KVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGlzdEVsLnBhcmVudEVsZW1lbnQuY3JlYXRlU3BhbigpLmlubmVySFRNTCA9IFwiLSBcIiArIGxpc3RFbC5pbm5lckhUTUw7XHJcblx0XHRcdFx0bGlzdEVsLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKFwibGlcIikuZm9yRWFjaCgobGlzdEVsOiBIVE1MRWxlbWVudCkgPT5cclxuXHRcdHtcclxuXHRcdFx0aWYobGlzdEVsLnBhcmVudEVsZW1lbnQpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsaXN0RWwucGFyZW50RWxlbWVudC5jcmVhdGVTcGFuKCkuaW5uZXJIVE1MID0gbGlzdEVsLmlubmVySFRNTDtcclxuXHRcdFx0XHRsaXN0RWwucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdGxldCB0ZXh0ID0gY29udGFpbmVyLnRleHRDb250ZW50ID8/IFwiXCI7XHJcblx0XHRjb250YWluZXIucmVtb3ZlKCk7XHJcblxyXG5cdFx0cmV0dXJuIHRleHQ7XHJcblx0fVxyXG5cclxuXHRhc3luYyBmdW5jdGlvbiByZW5kZXJHZW5lcmljKHZpZXc6IGFueSwgY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFByb21pc2U8SFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ+XHJcblx0e1xyXG5cdFx0YXdhaXQgVXRpbHMuZGVsYXkoMjAwMCk7XHJcblxyXG5cdFx0aWYgKGNoZWNrQ2FuY2VsbGVkKCkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0bGV0IGNvbnRlbnQgPSB2aWV3LmNvbnRlbnRFbDtcclxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChjb250ZW50KTtcclxuXHJcblx0XHRhd2FpdCBBc3NldEhhbmRsZXIubG9hZE1hdGhqYXhTdHlsZXMoKTtcclxuXHJcblx0XHRyZXR1cm4gY29udGVudDtcclxuXHR9XHJcblxyXG5cdGFzeW5jIGZ1bmN0aW9uIHJlbmRlckV4Y2FsaWRyYXcodmlldzogYW55LCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogUHJvbWlzZTxIVE1MRWxlbWVudCB8IHVuZGVmaW5lZD5cclxuXHR7XHJcblx0XHRhd2FpdCBVdGlscy5kZWxheSg1MDApO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCBzY2VuZSA9IHZpZXcuZXhjYWxpZHJhd0RhdGEuc2NlbmU7XHJcblxyXG5cdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0bGV0IHN2ZyA9IGF3YWl0IHZpZXcuc3ZnKHNjZW5lLCBcIlwiLCBmYWxzZSk7XHJcblxyXG5cdFx0Ly8gcmVtb3ZlIHJlY3QgZmlsbFxyXG5cdFx0bGV0IGlzTGlnaHQgPSAhc3ZnLmdldEF0dHJpYnV0ZShcImZpbHRlclwiKTtcclxuXHRcdGlmICghaXNMaWdodCkgc3ZnLnJlbW92ZUF0dHJpYnV0ZShcImZpbHRlclwiKTtcclxuXHRcdHN2Zy5jbGFzc0xpc3QuYWRkKGlzTGlnaHQgPyBcImxpZ2h0XCIgOiBcImRhcmtcIik7XHJcblxyXG5cdFx0bGV0IGNvbnRlbnRFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0XHRjb250ZW50RWwuY2xhc3NMaXN0LmFkZChcInZpZXctY29udGVudFwiKTtcclxuXHRcdGxldCBzaXplckVsID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xyXG5cdFx0c2l6ZXJFbC5jbGFzc0xpc3QuYWRkKFwiZXhjYWxpZHJhdy1wbHVnaW5cIik7XHJcblxyXG5cdFx0c2l6ZXJFbC5hcHBlbmRDaGlsZChzdmcpO1xyXG5cclxuXHRcdGF3YWl0IEFzc2V0SGFuZGxlci5sb2FkTWF0aGpheFN0eWxlcygpO1xyXG5cclxuXHRcdGlmIChjaGVja0NhbmNlbGxlZCgpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChjb250ZW50RWwpO1xyXG5cclxuXHRcdHJldHVybiBjb250ZW50RWw7XHJcblx0fVxyXG5cclxuXHRhc3luYyBmdW5jdGlvbiByZW5kZXJDYW52YXModmlldzogYW55LCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogUHJvbWlzZTxIVE1MRWxlbWVudCB8IHVuZGVmaW5lZD5cclxuXHR7XHJcblx0XHRpZiAoY2hlY2tDYW5jZWxsZWQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRsZXQgY2FudmFzID0gdmlldy5jYW52YXM7XHJcblxyXG5cdFx0bGV0IG5vZGVzID0gY2FudmFzLm5vZGVzO1xyXG5cdFx0bGV0IGVkZ2VzID0gY2FudmFzLmVkZ2VzO1xyXG5cclxuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBub2RlcylcclxuXHRcdHtcclxuXHRcdFx0YXdhaXQgbm9kZVsxXS5yZW5kZXIoKTtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKGNvbnN0IGVkZ2Ugb2YgZWRnZXMpXHJcblx0XHR7XHJcblx0XHRcdGF3YWl0IGVkZ2VbMV0ucmVuZGVyKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y2FudmFzLnpvb21Ub0ZpdCgpO1xyXG5cdFx0YXdhaXQgVXRpbHMuZGVsYXkoNTAwKTtcclxuXHJcblx0XHRsZXQgY29udGVudEVsID0gdmlldy5jb250ZW50RWw7XHJcblx0XHRsZXQgY2FudmFzRWwgPSBjb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5jYW52YXNcIik7XHJcblx0XHRjYW52YXNFbC5pbm5lckhUTUwgPSBcIlwiO1xyXG5cclxuXHRcdGxldCBlZGdlQ29udGFpbmVyID0gY2FudmFzRWwuY3JlYXRlRWwoXCJzdmdcIiwgeyBjbHM6IFwiY2FudmFzLWVkZ2VzXCIgfSk7XHJcblx0XHRsZXQgZWRnZUhlYWRDb250YWluZXIgPSBjYW52YXNFbC5jcmVhdGVFbChcInN2Z1wiLCB7IGNsczogXCJjYW52YXMtZWRnZXNcIiB9KTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpXHJcblx0XHR7XHJcblx0XHRcdGxldCBub2RlRWwgPSBub2RlWzFdLm5vZGVFbDtcclxuXHRcdFx0bGV0IGNoaWxkUHJldmlldyA9IG5vZGVbMV0/LmNoaWxkPy5wcmV2aWV3TW9kZTtcclxuXHRcdFx0bGV0IGVtYmVkRWwgPSBub2RlRWwucXVlcnlTZWxlY3RvcihcIi5tYXJrZG93bi1lbWJlZC1jb250ZW50Lm5vZGUtaW5zZXJ0LWV2ZW50XCIpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKGNoaWxkUHJldmlldyAmJiBlbWJlZEVsKSBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5vZGVbMV0ucmVuZGVyKCk7XHJcblx0XHRcdFx0ZW1iZWRFbC5pbm5lckhUTUwgPSBcIlwiO1xyXG5cdFx0XHRcdGF3YWl0IHJlbmRlck1hcmtkb3duVmlldyhjaGlsZFByZXZpZXcsIGVtYmVkRWwpO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHRjYW52YXNFbC5hcHBlbmRDaGlsZChub2RlRWwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoY29uc3QgZWRnZSBvZiBlZGdlcylcclxuXHRcdHtcclxuXHRcdFx0bGV0IGVkZ2VFbCA9IGVkZ2VbMV0ubGluZUdyb3VwRWw7XHJcblx0XHRcdGxldCBoZWFkRWwgPSBlZGdlWzFdLmxpbmVFbmRHcm91cEVsO1xyXG5cclxuXHRcdFx0ZWRnZUNvbnRhaW5lci5hcHBlbmRDaGlsZChlZGdlRWwpO1xyXG5cdFx0XHRlZGdlSGVhZENvbnRhaW5lci5hcHBlbmRDaGlsZChoZWFkRWwpO1xyXG5cclxuXHRcdFx0aWYoZWRnZVsxXS5sYWJlbClcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBsYWJlbEVsID0gZWRnZVsxXS5sYWJlbEVsZW1lbnQud3JhcHBlckVsO1xyXG5cdFx0XHRcdGNhbnZhc0VsLmFwcGVuZENoaWxkKGxhYmVsRWwpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGNoZWNrQ2FuY2VsbGVkKCkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGNvbnRlbnRFbCk7XHJcblxyXG5cdFx0cmV0dXJuIGNvbnRlbnRFbDtcclxuXHR9XHJcblxyXG5cdGFzeW5jIGZ1bmN0aW9uIHBvc3RQcm9jZXNzSFRNTChodG1sOiBIVE1MRWxlbWVudClcclxuXHR7XHJcblx0XHQvLyB0cmFuc2NsdXNpb25zIHB1dCBhIGRpdiBpbnNpZGUgYSBwIHRhZywgd2hpY2ggaXMgaW52YWxpZCBodG1sLiBGaXggaXQgaGVyZVxyXG5cdFx0aHRtbC5xdWVyeVNlbGVjdG9yQWxsKFwicDpoYXMoZGl2KVwiKS5mb3JFYWNoKChlbGVtZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHQvLyByZXBsYWNlIHRoZSBwIHRhZyB3aXRoIGEgc3BhblxyXG5cdFx0XHRsZXQgc3BhbiA9IGRvY3VtZW50LmJvZHkuY3JlYXRlRWwoXCJzcGFuXCIpO1xyXG5cdFx0XHRzcGFuLmlubmVySFRNTCA9IGVsZW1lbnQuaW5uZXJIVE1MO1xyXG5cdFx0XHRlbGVtZW50LnJlcGxhY2VXaXRoKHNwYW4pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gZW5jb2RlIGFsbCB0ZXh0IGlucHV0IHZhbHVlcyBpbnRvIGF0dHJpYnV0ZXNcclxuXHRcdGh0bWwucXVlcnlTZWxlY3RvckFsbChcImlucHV0W3R5cGU9dGV4dF1cIikuZm9yRWFjaCgoZWxlbWVudDogSFRNTEVsZW1lbnQpID0+XHJcblx0XHR7XHJcblx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiLCBlbGVtZW50LnZhbHVlKTtcclxuXHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRlbGVtZW50LnZhbHVlID0gXCJcIjtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGh0bWwucXVlcnlTZWxlY3RvckFsbChcInRleHRhcmVhXCIpLmZvckVhY2goKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdGVsZW1lbnQudGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gY29udmVydCBhbGwgaGFyZCBjb2RlZCBpbWFnZSAvIG1lZGlhIHdpZHRocyBpbnRvIG1heCB3aWR0aHNcclxuXHRcdGh0bWwucXVlcnlTZWxlY3RvckFsbChcImltZywgdmlkZW8sIC5tZWRpYS1lbWJlZDpoYXMoID4gOmlzKGltZywgdmlkZW8pKVwiKS5mb3JFYWNoKChlbGVtZW50OiBIVE1MRWxlbWVudCkgPT5cclxuXHRcdHtcclxuXHRcdFx0bGV0IHdpZHRoID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKTtcclxuXHRcdFx0aWYgKHdpZHRoKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoXCJ3aWR0aFwiKTtcclxuXHRcdFx0XHRlbGVtZW50LnN0eWxlLndpZHRoID0gKHdpZHRoLnRyaW0oKSAhPSBcIlwiKSA/ICh3aWR0aCArIFwicHhcIikgOiBcIlwiO1xyXG5cdFx0XHRcdGVsZW1lbnQuc3R5bGUubWF4V2lkdGggPSBcIjEwMCVcIjtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gcmVwbGFjZSBvYnNpZGlhbidzIHBkZiBlbWJlZHMgd2l0aCBub3JtYWwgZW1iZWRzXHJcblx0XHQvLyB0aGlzIGhhcyB0byBoYXBwZW4gYmVmb3JlIGNvbnZlcnRpbmcgY2FudmFzZXMgYmVjYXVzZSB0aGUgcGRmIGVtYmVkcyB1c2UgY2FudmFzIGVsZW1lbnRzXHJcblx0XHRodG1sLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzcGFuLmludGVybmFsLWVtYmVkLnBkZi1lbWJlZFwiKS5mb3JFYWNoKChwZGY6IEhUTUxFbGVtZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgZW1iZWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZW1iZWRcIik7XHJcblx0XHRcdGVtYmVkLnNldEF0dHJpYnV0ZShcInNyY1wiLCBwZGYuZ2V0QXR0cmlidXRlKFwic3JjXCIpID8/IFwiXCIpO1xyXG5cdFx0XHRlbWJlZC5zdHlsZS53aWR0aCA9IHBkZi5zdHlsZS53aWR0aCB8fCAnMTAwJSc7XHJcblx0XHRcdGVtYmVkLnN0eWxlLm1heFdpZHRoID0gXCIxMDAlXCI7XHJcblx0XHRcdGVtYmVkLnN0eWxlLmhlaWdodCA9IHBkZi5zdHlsZS5oZWlnaHQgfHwgJzgwMHB4JztcclxuXHJcblx0XHRcdGxldCBjb250YWluZXIgPSBwZGYucGFyZW50RWxlbWVudD8ucGFyZW50RWxlbWVudDtcclxuXHRcdFx0XHJcblx0XHRcdGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvckFsbChcIipcIikuZm9yRWFjaCgoZWwpID0+IGVsLnJlbW92ZSgpKTtcclxuXHJcblx0XHRcdGlmIChjb250YWluZXIpIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbWJlZCk7XHJcblxyXG5cdFx0XHRSZW5kZXJMb2cubG9nKGNvbnRhaW5lcj8uaW5uZXJIVE1MKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIGNvbnZlcnQgY2FudmFzIGVsZW1lbnRzIGludG8gaW1hZ2VzXHJcblx0XHRodG1sLnF1ZXJ5U2VsZWN0b3JBbGwoXCJjYW52YXNcIikuZm9yRWFjaCgoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCkgPT5cclxuXHRcdHtcclxuXHRcdFx0bGV0IGltYWdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcclxuXHRcdFx0bGV0IGRhdGEgPSBjYW52YXMudG9EYXRhVVJMKCk7XHJcblx0XHRcdFJlbmRlckxvZy5sb2coY2FudmFzLCBkYXRhKTtcclxuXHRcdFx0aW1hZ2Uuc3JjID0gZGF0YTtcclxuXHRcdFx0aW1hZ2Uuc3R5bGUud2lkdGggPSBjYW52YXMuc3R5bGUud2lkdGggfHwgXCIxMDAlXCI7XHJcblx0XHRcdGltYWdlLnN0eWxlLm1heFdpZHRoID0gXCIxMDAlXCI7XHJcblx0XHRcdGNhbnZhcy5yZXBsYWNlV2l0aChpbWFnZSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyBpZiB0aGUgZHluYW1pYyB0YWJsZSBvZiBjb250ZW50cyBwbHVnaW4gaXMgaW5jbHVkZWQgb24gdGhpcyBwYWdlXHJcblx0XHQvLyB0aGVuIHBhcnNlIGVhY2ggbGlzdCBpdGVtIGFuZCByZW5kZXIgbWFya2Rvd24gZm9yIGl0XHJcblx0XHRsZXQgdG9jRWxzID0gQXJyYXkuZnJvbShodG1sLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuYmxvY2stbGFuZ3VhZ2UtdG9jLmR5bmFtaWMtdG9jIGxpID4gYVwiKSk7XHJcblx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdG9jRWxzKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgcmVuZGVyRWwgPSBkb2N1bWVudC5ib2R5LmNyZWF0ZURpdigpO1xyXG5cdFx0XHRyZW5kZXJTaW5nbGVMaW5lTWFya2Rvd24oZWxlbWVudC50ZXh0Q29udGVudCA/PyBcIlwiLCByZW5kZXJFbCk7XHJcblx0XHRcdGVsZW1lbnQudGV4dENvbnRlbnQgPSByZW5kZXJFbC50ZXh0Q29udGVudDtcclxuXHRcdFx0cmVuZGVyRWwucmVtb3ZlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuICAgIGV4cG9ydCBhc3luYyBmdW5jdGlvbiBiZWdpbkJhdGNoKClcclxuXHR7XHJcblx0XHRpZihiYXRjaFN0YXJ0ZWQpXHJcblx0XHR7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBzdGFydCBhIG5ldyBiYXRjaCB3aGlsZSBvbmUgaXMgYWxyZWFkeSBydW5uaW5nIVwiKTtcclxuXHRcdH1cclxuXHJcbiAgICAgICAgZXJyb3JJbkJhdGNoID0gZmFsc2U7XHJcblx0XHRjYW5jZWxsZWQgPSBmYWxzZTtcclxuXHRcdGJhdGNoU3RhcnRlZCA9IHRydWU7XHJcblx0XHRsb2FkaW5nQ29udGFpbmVyID0gdW5kZWZpbmVkO1xyXG5cdFx0bG9nQ29udGFpbmVyID0gdW5kZWZpbmVkO1xyXG5cclxuXHRcdHJlbmRlckxlYWYgPSBUYWJNYW5hZ2VyLm9wZW5OZXdUYWIoXCJ3aW5kb3dcIiwgXCJ2ZXJ0aWNhbFwiKTtcclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCBwYXJlbnRGb3VuZCA9IGF3YWl0IFV0aWxzLndhaXRVbnRpbCgoKSA9PiAocmVuZGVyTGVhZiAmJiByZW5kZXJMZWFmLnBhcmVudCkgfHwgY2hlY2tDYW5jZWxsZWQoKSwgMjAwMCwgMTApO1xyXG5cdFx0aWYgKCFwYXJlbnRGb3VuZCkgXHJcblx0XHR7XHJcblx0XHRcdHRyeVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cmVuZGVyTGVhZi5kZXRhY2goKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXRjaCAoZSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdFJlbmRlckxvZy5lcnJvcihlLCBcIkZhaWxlZCB0byBkZXRhY2ggcmVuZGVyIGxlYWY6IFwiKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0aWYgKCFjaGVja0NhbmNlbGxlZCgpKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmV3IE5vdGljZShcIkVycm9yOiBGYWlsZWQgdG8gY3JlYXRlIGxlYWYgZm9yIHJlbmRlcmluZyFcIik7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIHRvIGNyZWF0ZSBsZWFmIGZvciByZW5kZXJpbmchXCIpO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gaGlkZSB0aGUgbGVhZiBzbyB3ZSBjYW4gcmVuZGVyIHdpdGhvdXQgaW50cnVkaW5nIG9uIHRoZSB1c2VyXHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRyZW5kZXJMZWFmLnBhcmVudC5jb250YWluZXJFbC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdHJlbmRlckxlYWYucGFyZW50LnBhcmVudC5jb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKFwiLmNsaWNrYWJsZS1pY29uLCAud29ya3NwYWNlLXRhYi1oZWFkZXItY29udGFpbmVyLWlubmVyXCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdHJlbmRlckxlYWYucGFyZW50LmNvbnRhaW5lckVsLnN0eWxlLm1heEhlaWdodCA9IFwidmFyKC0taGVhZGVyLWhlaWdodClcIjtcclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdHJlbmRlckxlYWYucGFyZW50LnBhcmVudC5jb250YWluZXJFbC5jbGFzc0xpc3QucmVtb3ZlKFwibW9kLXZlcnRpY2FsXCIpO1xyXG5cdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0cmVuZGVyTGVhZi5wYXJlbnQucGFyZW50LmNvbnRhaW5lckVsLmNsYXNzTGlzdC5hZGQoXCJtb2QtaG9yaXpvbnRhbFwiKTtcclxuXHJcblx0XHRsZXQgbmV3U2l6ZSA9IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA0MDAgfTtcclxuXHRcdHJlbmRlckxlYWYudmlldy5jb250YWluZXJFbC53aW4ucmVzaXplVG8obmV3U2l6ZS53aWR0aCwgbmV3U2l6ZS5oZWlnaHQpO1xyXG5cdFx0bGV0IG5ld1Bvc2l0aW9uID0ge3g6IHdpbmRvdy5zY3JlZW4ud2lkdGggLyAyIC0gNDUwLCB5OiB3aW5kb3cuc2NyZWVuLmhlaWdodCAtIDQ1MCAtIDc1fTtcclxuXHRcdHJlbmRlckxlYWYudmlldy5jb250YWluZXJFbC53aW4ubW92ZVRvKG5ld1Bvc2l0aW9uLngsIG5ld1Bvc2l0aW9uLnkpO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCByZW5kZXJCcm93c2VyV2luZG93ID0gcmVuZGVyTGVhZi52aWV3LmNvbnRhaW5lckVsLndpbi5lbGVjdHJvbldpbmRvdztcclxuXHJcblx0XHRpZiAoIXJlbmRlckJyb3dzZXJXaW5kb3cpIFxyXG5cdFx0e1xyXG5cdFx0XHRuZXcgTm90aWNlKFwiRmFpbGVkIHRvIGdldCB0aGUgcmVuZGVyIHdpbmRvdywgcGxlYXNlIHRyeSBhZ2Fpbi5cIik7XHJcblx0XHRcdGVycm9ySW5CYXRjaCA9IGZhbHNlO1xyXG5cdFx0XHRjYW5jZWxsZWQgPSBmYWxzZTtcclxuXHRcdFx0YmF0Y2hTdGFydGVkID0gZmFsc2U7XHJcblx0XHRcdHJlbmRlckxlYWYgPSB1bmRlZmluZWQ7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRyZW5kZXJCcm93c2VyV2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwiZmxvYXRpbmdcIiwgMSk7XHJcblx0XHRyZW5kZXJCcm93c2VyV2luZG93LndlYkNvbnRlbnRzLnNldEZyYW1lUmF0ZSgxMjApO1xyXG5cdFx0XHJcblx0XHRyZW5kZXJCcm93c2VyV2luZG93Lm9uKFwiY2xvc2VcIiwgKCkgPT5cclxuXHRcdHtcclxuXHRcdFx0aWYgKGNhbmNlbGxlZCkgcmV0dXJuO1xyXG5cdFx0XHRlbmRCYXRjaCgpO1xyXG5cdFx0XHRjYW5jZWxsZWQgPSB0cnVlO1xyXG5cdFx0fSwgeyBvbmNlOiB0cnVlIH0pO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCBhbGxXaW5kb3dzID0gd2luZG93LmVsZWN0cm9uLnJlbW90ZS5Ccm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKVxyXG5cdFx0Zm9yIChjb25zdCB3aW4gb2YgYWxsV2luZG93cylcclxuXHRcdHtcclxuXHRcdFx0d2luLndlYkNvbnRlbnRzLnNldEJhY2tncm91bmRUaHJvdHRsaW5nKGZhbHNlKTtcclxuXHRcdH1cclxuXHJcblx0XHRjcmVhdGVMb2FkaW5nQ29udGFpbmVyKCk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gZW5kQmF0Y2goKVxyXG5cdHtcclxuXHRcdGlmICghYmF0Y2hTdGFydGVkKSByZXR1cm47XHJcblxyXG5cdFx0aWYgKHJlbmRlckxlYWYpXHJcblx0XHR7XHJcbiAgICAgICAgICAgIGlmICghZXJyb3JJbkJhdGNoKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0UmVuZGVyTG9nLmxvZyhcImRldGFjaGluZ1wiKTtcclxuXHRcdFx0ICAgIHJlbmRlckxlYWYuZGV0YWNoKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFJlbmRlckxvZy5sb2coXCJlcnJvciBpbiBiYXRjaCwgbm90IGRldGFjaGluZ1wiKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRsZXQgYWxsV2luZG93cyA9IHdpbmRvdy5lbGVjdHJvbi5yZW1vdGUuQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcclxuXHRcdGZvciAoY29uc3Qgd2luIG9mIGFsbFdpbmRvd3MpXHJcblx0XHR7XHJcblx0XHRcdHdpbi53ZWJDb250ZW50cy5zZXRCYWNrZ3JvdW5kVGhyb3R0bGluZyhmYWxzZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0YmF0Y2hTdGFydGVkID0gZmFsc2U7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVMb2dFbCh0aXRsZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIHRleHRDb2xvcjogc3RyaW5nLCBiYWNrZ3JvdW5kQ29sb3I6IHN0cmluZyk6IEhUTUxFbGVtZW50XHJcblx0e1xyXG5cdFx0bGV0IGxvZ0VsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdGxvZ0VsLmNsYXNzTmFtZSA9IFwiaHRtbC1yZW5kZXItbG9nLWl0ZW1cIjtcclxuXHRcdGxvZ0VsLnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIjtcclxuXHRcdGxvZ0VsLnN0eWxlLmZsZXhEaXJlY3Rpb24gPSBcImNvbHVtblwiO1xyXG5cdFx0bG9nRWwuc3R5bGUubWFyZ2luQm90dG9tID0gXCIycHhcIjtcclxuXHRcdGxvZ0VsLnN0eWxlLmZvbnRTaXplID0gXCIxMnB4XCI7XHJcblx0XHRsb2dFbC5pbm5lckhUTUwgPVxyXG5cdFx0YFxyXG5cdFx0PGRpdiBjbGFzcz1cImh0bWwtcmVuZGVyLWxvZy10aXRsZVwiIHN0eWxlPVwiZm9udC13ZWlnaHQ6IGJvbGQ7IG1hcmdpbi1sZWZ0OiAxZW07XCI+JHt0aXRsZX08L2Rpdj5cclxuXHRcdDxkaXYgY2xhc3M9XCJodG1sLXJlbmRlci1sb2ctbWVzc2FnZVwiIHN0eWxlPVwibWFyZ2luLWxlZnQ6IDJlbTsgZm9udC1zaXplOiAwLjhlbTt3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XCI+JHttZXNzYWdlfTwvZGl2PlxyXG5cdFx0YDtcclxuXHJcblx0XHRsb2dFbC5zdHlsZS5jb2xvciA9IHRleHRDb2xvcjtcclxuXHRcdGxvZ0VsLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmRDb2xvcjtcclxuXHRcdGxvZ0VsLnN0eWxlLmJvcmRlckxlZnQgPSBgNXB4IHNvbGlkICR7dGV4dENvbG9yfWA7XHJcblx0XHRsb2dFbC5zdHlsZS5ib3JkZXJCb3R0b20gPSBcIjFweCBzb2xpZCB2YXIoLS1kaXZpZGVyLWNvbG9yKVwiO1xyXG5cdFx0bG9nRWwuc3R5bGUuYm9yZGVyVG9wID0gXCIxcHggc29saWQgdmFyKC0tZGl2aWRlci1jb2xvcilcIjtcclxuXHJcblx0XHRyZXR1cm4gbG9nRWw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjcmVhdGVMb2FkaW5nQ29udGFpbmVyKClcclxuXHR7XHJcblx0XHRpZiAoIWxvYWRpbmdDb250YWluZXIpIFxyXG5cdFx0e1xyXG5cdFx0XHRsb2FkaW5nQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdFx0bG9hZGluZ0NvbnRhaW5lci5jbGFzc05hbWUgPSBgaHRtbC1yZW5kZXItcHJvZ3Jlc3MtY29udGFpbmVyYDtcclxuXHRcdFx0bG9hZGluZ0NvbnRhaW5lci5zZXRBdHRyaWJ1dGUoXCJzdHlsZVwiLCBcImhlaWdodDogMTAwJTsgbWluLXdpZHRoOiAxMDAlOyBkaXNwbGF5OmZsZXg7IGZsZXgtZGlyZWN0aW9uOmNvbHVtbjsgYWxpZ24tY29udGVudDogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjsgYWxpZ24taXRlbXM6IGNlbnRlcjtcIik7XHJcblx0XHRcdGxvYWRpbmdDb250YWluZXIuaW5uZXJIVE1MID0gXHJcblx0XHRcdGBcclxuXHRcdFx0PGRpdiBjbGFzcz1cImh0bWwtcmVuZGVyLXByb2dyZXNzLWNvbnRhaW5lclwiIHN0eWxlPVwiaGVpZ2h0OiAxMDAlO21pbi13aWR0aDogMTAwJTtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO1wiPlxyXG5cdFx0XHRcdDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4O2hlaWdodDogMTAwJTtcIj5cclxuXHRcdFx0XHRcdDxkaXYgc3R5bGU9XCJmbGV4LWdyb3c6IDE7ZGlzcGxheTogZmxleDtmbGV4LWRpcmVjdGlvbjogY29sdW1uO2FsaWduLWl0ZW1zOiBjZW50ZXI7anVzdGlmeS1jb250ZW50OiBjZW50ZXI7XCI+XHJcblx0XHRcdFx0XHRcdDxoMSBzdHlsZT1cIlwiPkdlbmVyYXRpbmcgSFRNTDwvaDE+XHJcblx0XHRcdFx0XHRcdDxwcm9ncmVzcyBjbGFzcz1cImh0bWwtcmVuZGVyLXByb2dyZXNzYmFyXCIgdmFsdWU9XCIwXCIgbWluPVwiMFwiIG1heD1cIjFcIiBzdHlsZT1cIndpZHRoOiAzMDBweDsgaGVpZ2h0OiAxNXB4OyBiYWNrZ3JvdW5kLWNvbG9yOiB0cmFuc3BhcmVudDsgY29sb3I6IHZhcigtLWNvbG9yLWFjY2VudCk7XCI+PC9wcm9ncmVzcz5cclxuXHRcdFx0XHRcdFx0PHNwYW4gY2xhc3M9XCJodG1sLXJlbmRlci1zdWJtZXNzYWdlXCIgc3R5bGU9XCJtYXJnaW4tYmxvY2stc3RhcnQ6IDJlbTtcIj48L3NwYW4+XHJcblx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJodG1sLXJlbmRlci1sb2dcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgYm9yZGVyLWxlZnQ6IDFweCBzb2xpZCB2YXIoLS1kaXZpZGVyLWNvbG9yKTsgb3ZlcmZsb3cteTogYXV0bzsgd2lkdGg6IDMwMHB4OyBtYXgtd2lkdGg6IDMwMHB4OyBtaW4td2lkdGg6IDMwMHB4O1wiPlxyXG5cdFx0XHRcdFx0XHQ8aDEgc3R5bGU9XCJjb2xvcjogdmFyKC0tY29sb3IteWVsbG93KTtwYWRkaW5nOiAwLjNlbTtiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDEwMCwgNzAsIDIwLCAwLjEpO21hcmdpbjogMDtcIj5FeHBvcnQgUHJvYmxlbSBMb2c8L2gxPlxyXG5cdFx0XHRcdFx0XHQ8YnV0dG9uIGNsYXNzPVwiaHRtbC1yZW5kZXItbG9nLWNvcHktYnV0dG9uXCIgc3R5bGU9XCJtYXJnaW46IDEwcHg7d2lkdGg6IGZpdC1jb250ZW50O2FsaWduLXNlbGY6IGNlbnRlcjtcIj5Db3B5IExvZyB0byBDbGlwYm9hcmQ8L2J1dHRvbj5cclxuXHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdFx0YFxyXG5cclxuXHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRyZW5kZXJMZWFmLnBhcmVudC5wYXJlbnQuY29udGFpbmVyRWwuYXBwZW5kQ2hpbGQobG9hZGluZ0NvbnRhaW5lcik7XHJcblxyXG5cdFx0XHRsZXQgY29weUJ1dHRvbiA9IGxvYWRpbmdDb250YWluZXIucXVlcnlTZWxlY3RvcihcImJ1dHRvbi5odG1sLXJlbmRlci1sb2ctY29weS1idXR0b25cIik7XHJcblx0XHRcdGlmIChjb3B5QnV0dG9uKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0Y29weUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0bmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoUmVuZGVyTG9nLmZ1bGxMb2cpO1xyXG5cdFx0XHRcdFx0bmV3IE5vdGljZShcIkNvcGllZCB0byBjbGlwYm9hcmQhIFBsZWFzZSBwYXN0ZSB0aGlzIGludG8geW91ciBnaXRodWIgaXNzdWUgYXMgaXMuXCIpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRsZXQgbG9nU2hvd2luZyA9IGZhbHNlO1xyXG5cdGZ1bmN0aW9uIGFwcGVuZExvZ0VsKGxvZ0VsOiBIVE1MRWxlbWVudClcclxuXHR7XHJcblx0XHRpZighbG9nQ29udGFpbmVyIHx8ICFyZW5kZXJMZWFmKSByZXR1cm47XHJcblxyXG5cdFx0aWYgKCFsb2dTaG93aW5nKSBcclxuXHRcdHtcclxuXHRcdFx0cmVuZGVyTGVhZi52aWV3LmNvbnRhaW5lckVsLndpbi5yZXNpemVUbyg5MDAsIDUwMCk7XHJcblx0XHRcdGxvZ0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCI7XHJcblx0XHRcdGxvZ1Nob3dpbmcgPSB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxvZ0NvbnRhaW5lci5hcHBlbmRDaGlsZChsb2dFbCk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gX3JlcG9ydFByb2dyZXNzKGNvbXBsZXRlOiBudW1iZXIsIHRvdGFsOm51bWJlciwgbWVzc2FnZTogc3RyaW5nLCBzdWJNZXNzYWdlOiBzdHJpbmcsIHByb2dyZXNzQ29sb3I6IHN0cmluZylcclxuXHR7XHJcblx0XHRpZiAoIWJhdGNoU3RhcnRlZCkgcmV0dXJuO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGlmICghcmVuZGVyTGVhZiB8fCAhcmVuZGVyTGVhZi5wYXJlbnQgfHwgIXJlbmRlckxlYWYucGFyZW50LnBhcmVudCkgcmV0dXJuO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCBsb2FkaW5nQ29udGFpbmVyID0gcmVuZGVyTGVhZi5wYXJlbnQucGFyZW50LmNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoYC5odG1sLXJlbmRlci1wcm9ncmVzcy1jb250YWluZXJgKTtcclxuXHRcdFxyXG5cclxuXHRcdGxldCBwcm9ncmVzcyA9IGNvbXBsZXRlIC8gdG90YWw7XHJcblxyXG5cdFx0bGV0IHByb2dyZXNzQmFyID0gbG9hZGluZ0NvbnRhaW5lci5xdWVyeVNlbGVjdG9yKFwicHJvZ3Jlc3NcIik7XHJcblx0XHRpZiAocHJvZ3Jlc3NCYXIpXHJcblx0XHR7XHJcblx0XHRcdHByb2dyZXNzQmFyLnZhbHVlID0gcHJvZ3Jlc3M7XHJcblx0XHRcdHByb2dyZXNzQmFyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwidHJhbnNwYXJlbnRcIjtcclxuXHRcdFx0cHJvZ3Jlc3NCYXIuc3R5bGUuY29sb3IgPSBwcm9ncmVzc0NvbG9yO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRsZXQgbWVzc2FnZUVsZW1lbnQgPSBsb2FkaW5nQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoXCJoMVwiKTtcclxuXHRcdGlmIChtZXNzYWdlRWxlbWVudClcclxuXHRcdHtcclxuXHRcdFx0bWVzc2FnZUVsZW1lbnQuaW5uZXJUZXh0ID0gbWVzc2FnZTtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgc3ViTWVzc2FnZUVsZW1lbnQgPSBsb2FkaW5nQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoXCJzcGFuLmh0bWwtcmVuZGVyLXN1Ym1lc3NhZ2VcIikgYXMgSFRNTEVsZW1lbnQ7XHJcblx0XHRpZiAoc3ViTWVzc2FnZUVsZW1lbnQpXHJcblx0XHR7XHJcblx0XHRcdHN1Yk1lc3NhZ2VFbGVtZW50LmlubmVyVGV4dCA9IHN1Yk1lc3NhZ2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gX3JlcG9ydEVycm9yKG1lc3NhZ2VUaXRsZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGZhdGFsOiBib29sZWFuKVxyXG5cdHtcclxuXHRcdGlmICghYmF0Y2hTdGFydGVkKSByZXR1cm47XHJcblxyXG5cdFx0ZXJyb3JJbkJhdGNoID0gdHJ1ZTtcclxuXHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRsZXQgZm91bmQgPSBhd2FpdCBVdGlscy53YWl0VW50aWwoKCkgPT4gcmVuZGVyTGVhZiAmJiByZW5kZXJMZWFmLnBhcmVudCAmJiByZW5kZXJMZWFmLnBhcmVudC5wYXJlbnQsIDEwMCwgMTApO1xyXG5cdFx0aWYgKCFmb3VuZCkgcmV0dXJuO1xyXG5cclxuXHRcdGFwcGVuZExvZ0VsKGdlbmVyYXRlTG9nRWwobWVzc2FnZVRpdGxlLCBtZXNzYWdlLCBlcnJvckNvbG9yLCBlcnJvckJveENvbG9yKSk7XHJcblxyXG5cdFx0aWYgKGZhdGFsKVxyXG4gICAgICAgIHtcclxuXHRcdFx0cmVuZGVyTGVhZiA9IHVuZGVmaW5lZDtcclxuXHRcdFx0bG9hZGluZ0NvbnRhaW5lciA9IHVuZGVmaW5lZDtcclxuXHRcdFx0bG9nQ29udGFpbmVyID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiBfcmVwb3J0V2FybmluZyhtZXNzYWdlVGl0bGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKVxyXG5cdHtcclxuXHRcdGlmICghYmF0Y2hTdGFydGVkKSByZXR1cm47XHJcblxyXG5cdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0bGV0IGZvdW5kID0gYXdhaXQgVXRpbHMud2FpdFVudGlsKCgpID0+IHJlbmRlckxlYWYgJiYgcmVuZGVyTGVhZi5wYXJlbnQgJiYgcmVuZGVyTGVhZi5wYXJlbnQucGFyZW50LCAxMDAsIDEwKTtcclxuXHRcdGlmICghZm91bmQpIHJldHVybjtcclxuXHJcblx0XHRhcHBlbmRMb2dFbChnZW5lcmF0ZUxvZ0VsKG1lc3NhZ2VUaXRsZSwgbWVzc2FnZSwgd2FybmluZ0NvbG9yLCB3YXJuaW5nQm94Q29sb3IpKTtcclxuXHR9XHJcblxyXG4gICAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9yZXBvcnRJbmZvKG1lc3NhZ2VUaXRsZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpXHJcblx0e1xyXG5cdFx0aWYgKCFiYXRjaFN0YXJ0ZWQpIHJldHVybjtcclxuXHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRsZXQgZm91bmQgPSBhd2FpdCBVdGlscy53YWl0VW50aWwoKCkgPT4gcmVuZGVyTGVhZiAmJiByZW5kZXJMZWFmLnBhcmVudCAmJiByZW5kZXJMZWFmLnBhcmVudC5wYXJlbnQsIDEwMCwgMTApO1xyXG5cdFx0aWYgKCFmb3VuZCkgcmV0dXJuO1xyXG5cclxuXHRcdGFwcGVuZExvZ0VsKGdlbmVyYXRlTG9nRWwobWVzc2FnZVRpdGxlLCBtZXNzYWdlLCBpbmZvQ29sb3IsIGluZm9Cb3hDb2xvcikpO1xyXG5cdH1cclxuXHJcbn1cclxuIl19