import { __awaiter } from "tslib";
import { Path } from "scripts/utils/path";
import { Downloadable } from "scripts/utils/downloadable";
import { MainSettings } from "scripts/settings/main-settings";
import { OutlineTree } from "./outline-tree";
import { GraphView } from "./graph-view";
import { Website } from "./website";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { HTMLGeneration } from "scripts/html-generation/html-generator";
import { RenderLog } from "scripts/html-generation/render-log";
const { minify } = require('html-minifier-terser');
export class Webpage {
    /**
     * @param file The original markdown file to export
     * @param destination The absolute path to the FOLDER we are exporting to
     * @param source The relative path from the vault root to the FOLDER being exported
     * @param partOfBatch Is this file part of a batch export, or is it being exported independently?
     * @param fileName The name of the file being exported without the extension
     * @param forceExportToRoot Force the file to be saved directly int eh export folder rather than in it's subfolder.
     */
    constructor(file, website, destination, partOfBatch, fileName, forceExportToRoot = false) {
        /**
         * The external files that need to be downloaded for this file to work including the file itself.
         */
        this.downloads = [];
        /**
         * The external files that need to be downloaded for this file to work NOT including the file itself.
         */
        this.dependencies = [];
        this.viewType = "markdown";
        this.isConvertable = false;
        if (!destination.isAbsolute)
            throw new Error("exportToFolder must be an absolute path" + destination.asString);
        this.source = file;
        this.website = website;
        this.destinationFolder = destination.directory;
        this.sourceFolder = new Path(file.path).directory;
        this.partOfBatch = partOfBatch;
        this.name = fileName;
        this.isConvertable = MarkdownRenderer.isConvertable(file.extension);
        this.name += this.isConvertable ? ".html" : "." + file.extension;
        if (this.isConvertable)
            this.document = document.implementation.createHTMLDocument(this.source.basename);
        let parentPath = file.parent.path;
        if (parentPath.trim() == "/" || parentPath.trim() == "\\")
            parentPath = "";
        this.exportPath = Path.joinStrings(parentPath, this.name);
        if (forceExportToRoot)
            this.exportPath.reparse(this.name);
        this.exportPath.setWorkingDirectory(this.destinationFolder.asString);
        if (MainSettings.settings.makeNamesWebStyle) {
            this.name = Path.toWebStyle(this.name);
            this.exportPath.makeWebStyle();
        }
    }
    /**
     * The HTML string for the file
     */
    getHTML() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let htmlString = "<!DOCTYPE html>\n" + ((_a = this.document) === null || _a === void 0 ? void 0 : _a.documentElement.outerHTML);
            if (MainSettings.settings.minifyHTML)
                htmlString = yield minify(htmlString, { collapseBooleanAttributes: true, collapseWhitespace: true, minifyCSS: true, minifyJS: true, removeComments: true, removeEmptyAttributes: true, removeRedundantAttributes: true, removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true });
            return htmlString;
        });
    }
    /**
     * The element that contains the content of the document, aka the markdown-preview-view
     */
    get contentElement() {
        var _a, _b, _c, _d;
        if (this.viewType != "markdown")
            return (_a = this.document) === null || _a === void 0 ? void 0 : _a.querySelector(".view-content");
        return (_c = (_b = this.document) === null || _b === void 0 ? void 0 : _b.querySelector(".markdown-preview-view")) !== null && _c !== void 0 ? _c : (_d = this.document) === null || _d === void 0 ? void 0 : _d.querySelector(".view-content");
    }
    /**
     * The element that determines the size of the document, aka the markdown-preview-sizer
     */
    get sizerElement() {
        var _a, _b, _c;
        if (this.viewType != "markdown")
            return (_b = (_a = this.document) === null || _a === void 0 ? void 0 : _a.querySelector(".view-content")) === null || _b === void 0 ? void 0 : _b.firstChild;
        return (_c = this.document) === null || _c === void 0 ? void 0 : _c.querySelector(".markdown-preview-sizer");
    }
    /**
     * The absolute path that the file will be saved to
     */
    get exportPathAbsolute() {
        return this.destinationFolder.join(this.exportPath);
    }
    /**
     * The relative path from exportPath to rootFolder
     */
    get pathToRoot() {
        return Path.getRelativePath(this.exportPath, new Path(this.exportPath.workingDirectory), true).makeUnixStyle();
    }
    get isFileModified() {
        var _a, _b;
        return this.source.stat.mtime > ((_b = (_a = this.exportPathAbsolute.stat) === null || _a === void 0 ? void 0 : _a.mtime.getTime()) !== null && _b !== void 0 ? _b : Number.NEGATIVE_INFINITY);
    }
    /**
     * Returns a downloadable object to download the .html file to the current path with the current html contents.
     */
    getSelfDownloadable() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let content = (_a = (this.isConvertable ? yield this.getHTML() : yield new Path(this.source.path).readFileBuffer())) !== null && _a !== void 0 ? _a : "";
            return new Downloadable(this.name, content, this.exportPath.directory.makeForceFolder());
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConvertable || !this.document)
                return this;
            if (!(yield this.getDocumentHTML()))
                return;
            let layout = this.generateWebpageLayout(this.contentElement);
            this.document.body.appendChild(layout.container);
            layout.center.classList.add("show");
            if (MainSettings.settings.exportPreset != "raw-documents") {
                let rightSidebar = layout.right;
                let leftSidebar = layout.left;
                // inject graph view
                if (MainSettings.settings.includeGraphView) {
                    GraphView.generateGraphEl(rightSidebar);
                }
                // inject outline
                if (MainSettings.settings.includeOutline) {
                    let headerTree = new OutlineTree(this.source, 1);
                    headerTree.class = "outline-tree";
                    headerTree.title = "Table Of Contents";
                    headerTree.showNestingIndicator = false;
                    headerTree.generateWithItemsClosed = MainSettings.settings.startOutlineCollapsed;
                    yield headerTree.generateTreeWithContainer(rightSidebar);
                }
                // inject darkmode toggle
                if (MainSettings.settings.addDarkModeToggle) {
                    HTMLGeneration.createThemeToggle(leftSidebar);
                }
                // inject file tree
                if (MainSettings.settings.includeFileTree) {
                    leftSidebar.createDiv().outerHTML = this.website.fileTreeHtml;
                }
            }
            else {
                layout.container.querySelectorAll(".sidebar").forEach((el) => el.remove());
            }
            yield this.addMetadata();
            this.downloads.unshift(yield this.getSelfDownloadable());
            return this;
        });
    }
    getDocumentHTML() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConvertable || !this.document)
                return this;
            // set custom line width on body
            let body = this.document.body;
            body.setAttribute("class", Website.getValidBodyClasses());
            // create obsidian document containers
            let renderInfo = yield MarkdownRenderer.renderFile(this.source, body);
            let contentEl = renderInfo === null || renderInfo === void 0 ? void 0 : renderInfo.contentEl;
            this.viewType = (_a = renderInfo === null || renderInfo === void 0 ? void 0 : renderInfo.viewType) !== null && _a !== void 0 ? _a : "markdown";
            if (!contentEl)
                return undefined;
            if (MarkdownRenderer.checkCancelled())
                return undefined;
            if (this.viewType == "markdown") {
                contentEl.classList.toggle("allow-fold-headings", MainSettings.settings.allowFoldingHeadings);
                if (MainSettings.settings.addFilenameTitle)
                    this.addTitle();
            }
            if (this.sizerElement)
                this.sizerElement.style.paddingBottom = "";
            // move banner plugin's wrapper above the sizer
            let bannerWrapper = this.document.querySelector(".obsidian-banner-wrapper");
            let sizerParent = bannerWrapper === null || bannerWrapper === void 0 ? void 0 : bannerWrapper.closest(".markdown-preview-sizer");
            let contentParent = bannerWrapper === null || bannerWrapper === void 0 ? void 0 : bannerWrapper.closest(".markdown-preview-view");
            if (sizerParent && contentParent && bannerWrapper) {
                if (bannerWrapper)
                    contentParent.appendChild(bannerWrapper);
                if (sizerParent)
                    contentParent.appendChild(sizerParent);
            }
            // convert headings from linear to trees
            HTMLGeneration.makeHeadingsTrees(contentEl);
            // modify links to work outside of obsidian (including relative links)
            this.convertLinks();
            // inline / outline images
            let outlinedImages = [];
            if (MainSettings.settings.inlineImages)
                yield this.inlineMedia();
            else
                outlinedImages = yield this.exportMedia();
            // add math styles to the document. They are here and not in <head> because they are unique to each document
            let mathStyleEl = document.createElement("style");
            mathStyleEl.id = "MJX-CHTML-styles";
            mathStyleEl.innerHTML = AssetHandler.mathStyles;
            this.contentElement.prepend(mathStyleEl);
            let dependencies_temp = yield AssetHandler.getDownloads();
            dependencies_temp.push(...outlinedImages);
            this.downloads.push(...dependencies_temp);
            if (MainSettings.settings.makeNamesWebStyle) {
                this.downloads.forEach((file) => {
                    var _a;
                    file.filename = Path.toWebStyle(file.filename);
                    file.relativeDownloadPath = (_a = file.relativeDownloadPath) === null || _a === void 0 ? void 0 : _a.makeWebStyle();
                });
            }
            this.dependencies.push(...this.downloads);
            return this;
        });
    }
    generateWebpageLayout(middleContent) {
        if (!this.document)
            return { container: middleContent, left: middleContent, right: middleContent, center: middleContent };
        /*
        - div.webpage-container

            - div.sidebar.sidebar-left
                - div.sidebar-container
                    - div.sidebar-sizer
                        - div.sidebar-content-positioner
                            - div.sidebar-content
                - div.sidebar-gutter
                    - div.clickable-icon.sidebar-collapse-icon
                        - svg

            - div.document-container

            - div.sidebar.sidebar-right
                - div.sidebar-gutter
                        - div.clickable-icon.sidebar-collapse-icon
                            - svg
                - div.sidebar-container
                    - div.sidebar-sizer
                        - div.sidebar-content-positioner
                            - div.sidebar-content
        */
        let iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`;
        let pageContainer = this.document.createElement("div");
        let leftSidebar = this.document.createElement("div");
        let leftSidebarContainer = this.document.createElement("div");
        let leftSidebarSizer = this.document.createElement("div");
        let leftSidebarContentPositioner = this.document.createElement("div");
        let leftContent = this.document.createElement("div");
        let leftGutter = this.document.createElement("div");
        let leftGutterIcon = this.document.createElement("div");
        let documentContainer = this.document.createElement("div");
        let rightSidebar = this.document.createElement("div");
        let rightSidebarContainer = this.document.createElement("div");
        let rightSidebarSizer = this.document.createElement("div");
        let rightSidebarContentPositioner = this.document.createElement("div");
        let rightContent = this.document.createElement("div");
        let rightGutter = this.document.createElement("div");
        let rightGutterIcon = this.document.createElement("div");
        pageContainer.setAttribute("class", "webpage-container");
        leftSidebar.setAttribute("class", "sidebar-left sidebar");
        leftSidebarContainer.setAttribute("class", "sidebar-container");
        leftSidebarSizer.setAttribute("class", "sidebar-sizer");
        leftSidebarContentPositioner.setAttribute("class", "sidebar-content-positioner");
        leftContent.setAttribute("class", "sidebar-content");
        leftGutter.setAttribute("class", "sidebar-gutter");
        leftGutterIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");
        documentContainer.setAttribute("class", "document-container");
        rightSidebar.setAttribute("class", "sidebar-right sidebar");
        rightSidebarContainer.setAttribute("class", "sidebar-container");
        rightSidebarSizer.setAttribute("class", "sidebar-sizer");
        rightSidebarContentPositioner.setAttribute("class", "sidebar-content-positioner");
        rightContent.setAttribute("class", "sidebar-content");
        rightGutter.setAttribute("class", "sidebar-gutter");
        rightGutterIcon.setAttribute("class", "clickable-icon sidebar-collapse-icon");
        pageContainer.appendChild(leftSidebar);
        pageContainer.appendChild(documentContainer);
        pageContainer.appendChild(rightSidebar);
        leftSidebar.appendChild(leftSidebarContainer);
        leftSidebarContainer.appendChild(leftSidebarSizer);
        leftSidebarSizer.appendChild(leftSidebarContentPositioner);
        leftSidebarContentPositioner.appendChild(leftContent);
        leftSidebar.appendChild(leftGutter);
        leftGutter.appendChild(leftGutterIcon);
        leftGutterIcon.innerHTML = iconSVG;
        documentContainer.appendChild(middleContent);
        rightSidebar.appendChild(rightGutter);
        rightGutter.appendChild(rightGutterIcon);
        rightGutterIcon.innerHTML = iconSVG;
        rightSidebar.appendChild(rightSidebarContainer);
        rightSidebarContainer.appendChild(rightSidebarSizer);
        rightSidebarSizer.appendChild(rightSidebarContentPositioner);
        rightSidebarContentPositioner.appendChild(rightContent);
        return { container: pageContainer, left: leftContent, right: rightContent, center: documentContainer };
    }
    addTitle() {
        var _a;
        if (!this.document)
            return;
        let inlineTitle = this.document.querySelector(".inline-title");
        let title = (_a = inlineTitle === null || inlineTitle === void 0 ? void 0 : inlineTitle.textContent) !== null && _a !== void 0 ? _a : this.source.basename;
        inlineTitle === null || inlineTitle === void 0 ? void 0 : inlineTitle.remove();
        let titleEl = this.sizerElement.createEl("h1");
        titleEl.setAttribute("data-heading", title);
        titleEl.id = this.source.basename.replaceAll(" ", "_");
    }
    addMetadata() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.document)
                return;
            let relativePaths = this.getRelativePaths();
            let meta = `
		<title>${this.source.basename}</title>
		<base href="${relativePaths.rootPath}/">
		<meta id="root-path" root-path="${relativePaths.rootPath}/">

		<link rel="icon" sizes="96x96" href="https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/favicon-96x96.png">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">
		<meta charset="UTF-8">
		`;
            // --- JS ---
            let scripts = "";
            if (MainSettings.settings.includeGraphView) {
                scripts += `\n<script type='module' src='${relativePaths.jsPath}/graph_view.js'></script>\n`;
                scripts += `\n<script src='${relativePaths.jsPath}/graph_wasm.js'></script>\n`;
                scripts += `\n<script src="${relativePaths.jsPath}/tinycolor.js"></script>\n`;
                scripts += `\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js" integrity="sha512-Ch/O6kL8BqUwAfCF7Ie5SX1Hin+BJgYH4pNjRqXdTEqMsis1TUYg+j6nnI9uduPjGaj7DN4UKCZgpvoExt6dkw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>\n`;
            }
            if (MainSettings.settings.inlineJS) {
                scripts += `\n<script>\n${AssetHandler.webpageJS}\n</script>\n`;
                scripts += `\n<script>\n${AssetHandler.generatedJS}\n</script>\n`;
            }
            else {
                scripts += `\n<script src='${relativePaths.jsPath}/webpage.js'></script>\n`;
                scripts += `\n<script src='${relativePaths.jsPath}/generated.js'></script>\n`;
            }
            // --- CSS ---
            let cssSettings = (_b = (_a = document.getElementById("css-settings-manager")) === null || _a === void 0 ? void 0 : _a.innerHTML) !== null && _b !== void 0 ? _b : "";
            if (MainSettings.settings.inlineCSS) {
                let pluginCSS = AssetHandler.webpageStyles;
                let thirdPartyPluginStyles = AssetHandler.pluginStyles;
                pluginCSS += thirdPartyPluginStyles;
                var header = `
			${meta}
			
			<!-- Obsidian App Styles / Other Built-in Styles -->
			<style> ${AssetHandler.appStyles} </style>
			<style> ${cssSettings} </style>

			<!-- Theme Styles -->
			<style> ${AssetHandler.themeStyles} </style>

			<!-- Plugin Styles -->
			<style> ${pluginCSS} </style>

			<!-- Snippets -->
			<style> ${AssetHandler.snippetStyles} </style>

			<!-- Generated Styles -->
			<style> ${AssetHandler.generatedStyles} </style>
		
			${scripts}
			`;
            }
            else {
                header =
                    `
			${meta}

			<link rel="stylesheet" href="${relativePaths.cssPath}/obsidian-styles.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/theme.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/plugin-styles.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/snippets.css">
			<link rel="stylesheet" href="${relativePaths.cssPath}/generated-styles.css">
			<style> ${cssSettings} </style>

			${scripts}
			`;
            }
            header += "\n<!-- Custom Head Content -->\n" + AssetHandler.customHeadContent + "\n";
            this.document.head.innerHTML = header;
        });
    }
    getRelativePaths() {
        let rootPath = this.pathToRoot;
        let imagePath = AssetHandler.mediaFolderName.makeUnixStyle();
        let jsPath = AssetHandler.jsFolderName.makeUnixStyle();
        let cssPath = AssetHandler.cssFolderName.makeUnixStyle();
        if (MainSettings.settings.makeNamesWebStyle) {
            imagePath = imagePath.makeWebStyle();
            jsPath = jsPath.makeWebStyle();
            cssPath = cssPath.makeWebStyle();
            rootPath = rootPath.makeWebStyle();
        }
        return { mediaPath: imagePath, jsPath: jsPath, cssPath: cssPath, rootPath: rootPath };
    }
    convertLinks() {
        if (!this.document)
            return;
        this.document.querySelectorAll("a.internal-link").forEach((linkEl) => {
            linkEl.setAttribute("target", "_self");
            let href = linkEl.getAttribute("href");
            if (!href)
                return;
            if (href.startsWith("#")) // link pointing to header of this document
             {
                linkEl.setAttribute("href", href.replaceAll(" ", "_"));
            }
            else // if it doesn't start with #, it's a link to another document
             {
                let targetHeader = href.split("#").length > 1 ? "#" + href.split("#")[1] : "";
                let target = href.split("#")[0];
                let targetFile = app.metadataCache.getFirstLinkpathDest(target, this.source.path);
                if (!targetFile)
                    return;
                let targetPath = new Path(targetFile.path);
                if (MarkdownRenderer.isConvertable(targetPath.extensionName))
                    targetPath.setExtension("html");
                if (MainSettings.settings.makeNamesWebStyle)
                    targetPath.makeWebStyle();
                let finalHref = targetPath.makeUnixStyle() + targetHeader.replaceAll(" ", "_");
                linkEl.setAttribute("href", finalHref);
            }
        });
        this.document.querySelectorAll("a.footnote-link").forEach((linkEl) => {
            linkEl.setAttribute("target", "_self");
        });
        this.document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((headerEl) => {
            var _a, _b, _c;
            // convert the data-heading to the id
            headerEl.setAttribute("id", (_c = (_b = ((_a = headerEl.getAttribute("data-heading")) !== null && _a !== void 0 ? _a : headerEl.textContent)) === null || _b === void 0 ? void 0 : _b.replaceAll(" ", "_")) !== null && _c !== void 0 ? _c : "");
        });
    }
    inlineMedia() {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.document)
                return;
            let elements = Array.from(this.document.querySelectorAll("[src]:not(head [src])"));
            for (let mediaEl of elements) {
                let rawSrc = (_a = mediaEl.getAttribute("src")) !== null && _a !== void 0 ? _a : "";
                let filePath = Webpage.getMediaPath(rawSrc, this.source.path);
                if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute)
                    continue;
                let base64 = (_b = yield filePath.readFileString("base64")) !== null && _b !== void 0 ? _b : "";
                if (base64 === "")
                    return;
                let ext = filePath.extensionName;
                //@ts-ignore
                let type = (_c = app.viewRegistry.typeByExtension[ext]) !== null && _c !== void 0 ? _c : "audio";
                if (ext === "svg")
                    ext += "+xml";
                mediaEl.setAttribute("src", `data:${type}/${ext};base64,${base64}`);
            }
            ;
        });
    }
    exportMedia() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.document)
                return [];
            let downloads = [];
            let elements = Array.from(this.document.querySelectorAll("[src]:not(head [src])"));
            for (let mediaEl of elements) {
                let rawSrc = (_a = mediaEl.getAttribute("src")) !== null && _a !== void 0 ? _a : "";
                let filePath = Webpage.getMediaPath(rawSrc, this.source.path);
                if (filePath.isEmpty || filePath.isDirectory || filePath.isAbsolute)
                    continue;
                let exportLocation = filePath.copy;
                // if the media is inside the exported folder then keep it in the same place
                let mediaPathInExport = Path.getRelativePath(this.sourceFolder, filePath);
                if (mediaPathInExport.asString.startsWith("..")) {
                    // if path is outside of the vault, outline it into the media folder
                    exportLocation = AssetHandler.mediaFolderName.joinString(filePath.fullName);
                }
                // let relativeImagePath = Path.getRelativePath(this.exportPath, exportLocation)
                if (MainSettings.settings.makeNamesWebStyle) {
                    // relativeImagePath.makeWebStyle();
                    exportLocation.makeWebStyle();
                }
                mediaEl.setAttribute("src", exportLocation.asString);
                let data = (_b = yield filePath.readFileBuffer()) !== null && _b !== void 0 ? _b : Buffer.from([]);
                let imageDownload = new Downloadable(exportLocation.fullName, data, exportLocation.directory.makeForceFolder());
                if (data.length == 0)
                    RenderLog.log(filePath, "No data for file: ");
                downloads.push(imageDownload);
            }
            ;
            return downloads;
        });
    }
    static getMediaPath(src, exportingFilePath) {
        var _a, _b, _c, _d;
        // @ts-ignore
        let pathString = "";
        if (src.startsWith("app://")) {
            let fail = false;
            try {
                // @ts-ignore
                pathString = (_b = (_a = app.vault.resolveFileUrl(src)) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "";
                if (pathString == "")
                    fail = true;
            }
            catch (_e) {
                fail = true;
            }
            if (fail) {
                pathString = src.replaceAll("app://", "").replaceAll("\\", "/");
                pathString = pathString.replaceAll(pathString.split("/")[0] + "/", "");
                pathString = Path.getRelativePathFromVault(new Path(pathString), true).asString;
                RenderLog.log(pathString, "Fallback path parsing:");
            }
        }
        else {
            pathString = (_d = (_c = app.metadataCache.getFirstLinkpathDest(src, exportingFilePath)) === null || _c === void 0 ? void 0 : _c.path) !== null && _d !== void 0 ? _d : "";
        }
        pathString = pathString !== null && pathString !== void 0 ? pathString : "";
        return new Path(pathString);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIndlYnBhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUM3QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDcEMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDL0QsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRW5ELE1BQU0sT0FBTyxPQUFPO0lBdURuQjs7Ozs7OztPQU9HO0lBQ0gsWUFBWSxJQUFXLEVBQUUsT0FBZ0IsRUFBRSxXQUFpQixFQUFFLFdBQW9CLEVBQUUsUUFBZ0IsRUFBRSxvQkFBNkIsS0FBSztRQXhCeEk7O1dBRUc7UUFDSSxjQUFTLEdBQW1CLEVBQUUsQ0FBQztRQUV0Qzs7V0FFRztRQUNJLGlCQUFZLEdBQW1CLEVBQUUsQ0FBQztRQUdsQyxhQUFRLEdBQVcsVUFBVSxDQUFDO1FBRTlCLGtCQUFhLEdBQVksS0FBSyxDQUFDO1FBYXJDLElBQUcsQ0FBQyxXQUFXLENBQUMsVUFBVTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLEdBQUcsV0FB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Z0JBQ0MsSUFBSSxHQUFHLElBQUksQ0FBQzthQUNaO1lBRUQsSUFBRyxJQUFJLEVBQ1A7Z0JBQ0MsVUFBVSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2hFLFVBQVUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUN2RSxVQUFVLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDaEYsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsd0JBQXdCLENBQUMsQ0FBQzthQUNwRDtTQUNEO2FBRUQ7WUFDQyxVQUFVLEdBQUcsTUFBQSxNQUFBLEdBQUcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLDBDQUFFLElBQUksbUNBQUksRUFBRSxDQUFDO1NBQ3hGO1FBRUQsVUFBVSxHQUFHLFVBQVUsYUFBVixVQUFVLGNBQVYsVUFBVSxHQUFJLEVBQUUsQ0FBQztRQUU5QixPQUFPLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzdCLENBQUM7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IFBhdGggfSBmcm9tIFwic2NyaXB0cy91dGlscy9wYXRoXCI7XHJcbmltcG9ydCB7IERvd25sb2FkYWJsZSB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL2Rvd25sb2FkYWJsZVwiO1xyXG5pbXBvcnQgeyBNYWluU2V0dGluZ3MgfSBmcm9tIFwic2NyaXB0cy9zZXR0aW5ncy9tYWluLXNldHRpbmdzXCI7XHJcbmltcG9ydCB7IE91dGxpbmVUcmVlIH0gZnJvbSBcIi4vb3V0bGluZS10cmVlXCI7XHJcbmltcG9ydCB7IEdyYXBoVmlldyB9IGZyb20gXCIuL2dyYXBoLXZpZXdcIjtcclxuaW1wb3J0IHsgV2Vic2l0ZSB9IGZyb20gXCIuL3dlYnNpdGVcIjtcclxuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gXCJzY3JpcHRzL2h0bWwtZ2VuZXJhdGlvbi9tYXJrZG93bi1yZW5kZXJlclwiO1xyXG5pbXBvcnQgeyBBc3NldEhhbmRsZXIgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vYXNzZXQtaGFuZGxlclwiO1xyXG5pbXBvcnQgeyBIVE1MR2VuZXJhdGlvbiB9IGZyb20gXCJzY3JpcHRzL2h0bWwtZ2VuZXJhdGlvbi9odG1sLWdlbmVyYXRvclwiO1xyXG5pbXBvcnQgeyBSZW5kZXJMb2cgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vcmVuZGVyLWxvZ1wiO1xyXG5jb25zdCB7IG1pbmlmeSB9ID0gcmVxdWlyZSgnaHRtbC1taW5pZmllci10ZXJzZXInKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBXZWJwYWdlXHJcbntcclxuXHRwdWJsaWMgd2Vic2l0ZTogV2Vic2l0ZTtcclxuXHRcclxuXHQvKipcclxuXHQgKiBUaGUgb3JpZ2luYWwgZmlsZSB0aGlzIHdlYnBhZ2Ugd2FzIGV4cG9ydGVkIGZyb21cclxuXHQgKi9cclxuXHRwdWJsaWMgc291cmNlOiBURmlsZTtcclxuXHJcblx0LyoqXHJcblx0ICogVGhlIGFic29sdXRlIHBhdGggdG8gdGhlIEZPTERFUiB3ZSBhcmUgZXhwb3J0aW5nIHRvXHJcblx0ICovXHJcblx0cHVibGljIGRlc3RpbmF0aW9uRm9sZGVyOiBQYXRoO1xyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgcmVsYXRpdmUgcGF0aCBmcm9tIHRoZSB2YXVsdCByb290IHRvIHRoZSBGT0xERVIgdGhpcyB3ZWJzaXRlJ3Mgc291cmNlIGZpbGUgd2FzIGluXHJcblx0ICovXHJcblx0cHVibGljIHNvdXJjZUZvbGRlcjogUGF0aDtcclxuXHJcblx0LyoqXHJcblx0ICogSXMgdGhpcyBmaWxlIHBhcnQgb2YgYSBiYXRjaCBleHBvcnQsIG9yIGlzIGl0IGJlaW5nIGV4cG9ydGVkIGluZGVwZW5kZW50bHk/XHJcblx0ICovXHJcblx0cHVibGljIHBhcnRPZkJhdGNoOiBib29sZWFuO1xyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgbmFtZSBvZiB0aGUgc291cmNlIGZpbGUsIHdpdGggdGhlIGV4dGVuc2lvblxyXG5cdCAqL1xyXG5cdHB1YmxpYyBuYW1lOiBzdHJpbmc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSByZWxhdGl2ZSBwYXRoIGZyb20gdGhlIGRlc3RpbmF0aW9uIGZvbGRlciB0byB0aGUgZXhwb3J0ZWQgZmlsZTsgaW5jbHVkZXMgdGhlIGZpbGUgbmFtZSBhbmQgZXh0ZW5zaW9uLlxyXG5cdCAqL1xyXG5cdHB1YmxpYyBleHBvcnRQYXRoOiBQYXRoO1xyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgZG9jdW1lbnQgY29udGFpbmluZyB0aGlzIHdlYnBhZ2UncyBIVE1MXHJcblx0ICovXHJcblx0cHVibGljIGRvY3VtZW50PzogRG9jdW1lbnQ7XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBleHRlcm5hbCBmaWxlcyB0aGF0IG5lZWQgdG8gYmUgZG93bmxvYWRlZCBmb3IgdGhpcyBmaWxlIHRvIHdvcmsgaW5jbHVkaW5nIHRoZSBmaWxlIGl0c2VsZi5cclxuXHQgKi9cclxuXHRwdWJsaWMgZG93bmxvYWRzOiBEb3dubG9hZGFibGVbXSA9IFtdO1xyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgZXh0ZXJuYWwgZmlsZXMgdGhhdCBuZWVkIHRvIGJlIGRvd25sb2FkZWQgZm9yIHRoaXMgZmlsZSB0byB3b3JrIE5PVCBpbmNsdWRpbmcgdGhlIGZpbGUgaXRzZWxmLlxyXG5cdCAqL1xyXG5cdHB1YmxpYyBkZXBlbmRlbmNpZXM6IERvd25sb2FkYWJsZVtdID0gW107XHJcblxyXG5cclxuXHRwdWJsaWMgdmlld1R5cGU6IHN0cmluZyA9IFwibWFya2Rvd25cIjtcclxuXHJcblx0cHVibGljIGlzQ29udmVydGFibGU6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEBwYXJhbSBmaWxlIFRoZSBvcmlnaW5hbCBtYXJrZG93biBmaWxlIHRvIGV4cG9ydFxyXG5cdCAqIEBwYXJhbSBkZXN0aW5hdGlvbiBUaGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgRk9MREVSIHdlIGFyZSBleHBvcnRpbmcgdG9cclxuXHQgKiBAcGFyYW0gc291cmNlIFRoZSByZWxhdGl2ZSBwYXRoIGZyb20gdGhlIHZhdWx0IHJvb3QgdG8gdGhlIEZPTERFUiBiZWluZyBleHBvcnRlZFxyXG5cdCAqIEBwYXJhbSBwYXJ0T2ZCYXRjaCBJcyB0aGlzIGZpbGUgcGFydCBvZiBhIGJhdGNoIGV4cG9ydCwgb3IgaXMgaXQgYmVpbmcgZXhwb3J0ZWQgaW5kZXBlbmRlbnRseT9cclxuXHQgKiBAcGFyYW0gZmlsZU5hbWUgVGhlIG5hbWUgb2YgdGhlIGZpbGUgYmVpbmcgZXhwb3J0ZWQgd2l0aG91dCB0aGUgZXh0ZW5zaW9uXHJcblx0ICogQHBhcmFtIGZvcmNlRXhwb3J0VG9Sb290IEZvcmNlIHRoZSBmaWxlIHRvIGJlIHNhdmVkIGRpcmVjdGx5IGludCBlaCBleHBvcnQgZm9sZGVyIHJhdGhlciB0aGFuIGluIGl0J3Mgc3ViZm9sZGVyLlxyXG5cdCAqL1xyXG5cdGNvbnN0cnVjdG9yKGZpbGU6IFRGaWxlLCB3ZWJzaXRlOiBXZWJzaXRlLCBkZXN0aW5hdGlvbjogUGF0aCwgcGFydE9mQmF0Y2g6IGJvb2xlYW4sIGZpbGVOYW1lOiBzdHJpbmcsIGZvcmNlRXhwb3J0VG9Sb290OiBib29sZWFuID0gZmFsc2UpXHJcblx0e1xyXG5cdFx0aWYoIWRlc3RpbmF0aW9uLmlzQWJzb2x1dGUpIHRocm93IG5ldyBFcnJvcihcImV4cG9ydFRvRm9sZGVyIG11c3QgYmUgYW4gYWJzb2x1dGUgcGF0aFwiICsgZGVzdGluYXRpb24uYXNTdHJpbmcpO1xyXG5cdFx0XHJcblx0XHR0aGlzLnNvdXJjZSA9IGZpbGU7XHJcblx0XHR0aGlzLndlYnNpdGUgPSB3ZWJzaXRlO1xyXG5cdFx0dGhpcy5kZXN0aW5hdGlvbkZvbGRlciA9IGRlc3RpbmF0aW9uLmRpcmVjdG9yeTtcclxuXHRcdHRoaXMuc291cmNlRm9sZGVyID0gbmV3IFBhdGgoZmlsZS5wYXRoKS5kaXJlY3Rvcnk7XHJcblx0XHR0aGlzLnBhcnRPZkJhdGNoID0gcGFydE9mQmF0Y2g7XHJcblx0XHR0aGlzLm5hbWUgPSBmaWxlTmFtZTtcclxuXHJcblx0XHR0aGlzLmlzQ29udmVydGFibGUgPSBNYXJrZG93blJlbmRlcmVyLmlzQ29udmVydGFibGUoZmlsZS5leHRlbnNpb24pO1xyXG5cdFx0dGhpcy5uYW1lICs9IHRoaXMuaXNDb252ZXJ0YWJsZSA/IFwiLmh0bWxcIiA6IFwiLlwiICsgZmlsZS5leHRlbnNpb247XHJcblx0XHRpZiAodGhpcy5pc0NvbnZlcnRhYmxlKSB0aGlzLmRvY3VtZW50ID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KHRoaXMuc291cmNlLmJhc2VuYW1lKTtcclxuXHJcblx0XHRsZXQgcGFyZW50UGF0aCA9IGZpbGUucGFyZW50LnBhdGg7XHJcblx0XHRpZiAocGFyZW50UGF0aC50cmltKCkgPT0gXCIvXCIgfHwgcGFyZW50UGF0aC50cmltKCkgPT0gXCJcXFxcXCIpIHBhcmVudFBhdGggPSBcIlwiO1xyXG5cdFx0dGhpcy5leHBvcnRQYXRoID0gUGF0aC5qb2luU3RyaW5ncyhwYXJlbnRQYXRoLCB0aGlzLm5hbWUpO1xyXG5cdFx0aWYgKGZvcmNlRXhwb3J0VG9Sb290KSB0aGlzLmV4cG9ydFBhdGgucmVwYXJzZSh0aGlzLm5hbWUpO1xyXG5cdFx0dGhpcy5leHBvcnRQYXRoLnNldFdvcmtpbmdEaXJlY3RvcnkodGhpcy5kZXN0aW5hdGlvbkZvbGRlci5hc1N0cmluZyk7XHJcblxyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZSlcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5uYW1lID0gUGF0aC50b1dlYlN0eWxlKHRoaXMubmFtZSk7XHJcblx0XHRcdHRoaXMuZXhwb3J0UGF0aC5tYWtlV2ViU3R5bGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBIVE1MIHN0cmluZyBmb3IgdGhlIGZpbGVcclxuXHQgKi9cclxuXHRwdWJsaWMgYXN5bmMgZ2V0SFRNTCgpOiBQcm9taXNlPHN0cmluZz5cclxuXHR7XHJcblx0XHRsZXQgaHRtbFN0cmluZyA9IFwiPCFET0NUWVBFIGh0bWw+XFxuXCIgKyB0aGlzLmRvY3VtZW50Py5kb2N1bWVudEVsZW1lbnQub3V0ZXJIVE1MO1xyXG5cclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MubWluaWZ5SFRNTCkgXHJcblx0XHRcdGh0bWxTdHJpbmcgPSBhd2FpdCBtaW5pZnkoaHRtbFN0cmluZywgeyBjb2xsYXBzZUJvb2xlYW5BdHRyaWJ1dGVzOiB0cnVlLCBjb2xsYXBzZVdoaXRlc3BhY2U6IHRydWUsIG1pbmlmeUNTUzogdHJ1ZSwgbWluaWZ5SlM6IHRydWUsIHJlbW92ZUNvbW1lbnRzOiB0cnVlLCByZW1vdmVFbXB0eUF0dHJpYnV0ZXM6IHRydWUsIHJlbW92ZVJlZHVuZGFudEF0dHJpYnV0ZXM6IHRydWUsIHJlbW92ZVNjcmlwdFR5cGVBdHRyaWJ1dGVzOiB0cnVlLCByZW1vdmVTdHlsZUxpbmtUeXBlQXR0cmlidXRlczogdHJ1ZSwgdXNlU2hvcnREb2N0eXBlOiB0cnVlIH0pO1xyXG5cclxuXHRcdHJldHVybiBodG1sU3RyaW5nO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVGhlIGVsZW1lbnQgdGhhdCBjb250YWlucyB0aGUgY29udGVudCBvZiB0aGUgZG9jdW1lbnQsIGFrYSB0aGUgbWFya2Rvd24tcHJldmlldy12aWV3XHJcblx0ICovXHJcblx0Z2V0IGNvbnRlbnRFbGVtZW50KCk6IEhUTUxEaXZFbGVtZW50XHJcblx0e1xyXG5cdFx0aWYgKHRoaXMudmlld1R5cGUgIT0gXCJtYXJrZG93blwiKSByZXR1cm4gdGhpcy5kb2N1bWVudD8ucXVlcnlTZWxlY3RvcihcIi52aWV3LWNvbnRlbnRcIikgYXMgSFRNTERpdkVsZW1lbnQ7XHJcblx0XHRcclxuXHRcdHJldHVybiB0aGlzLmRvY3VtZW50Py5xdWVyeVNlbGVjdG9yKFwiLm1hcmtkb3duLXByZXZpZXctdmlld1wiKSBhcyBIVE1MRGl2RWxlbWVudCA/PyB0aGlzLmRvY3VtZW50Py5xdWVyeVNlbGVjdG9yKFwiLnZpZXctY29udGVudFwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBlbGVtZW50IHRoYXQgZGV0ZXJtaW5lcyB0aGUgc2l6ZSBvZiB0aGUgZG9jdW1lbnQsIGFrYSB0aGUgbWFya2Rvd24tcHJldmlldy1zaXplclxyXG5cdCAqL1xyXG5cdGdldCBzaXplckVsZW1lbnQoKTogSFRNTERpdkVsZW1lbnRcclxuXHR7XHJcblx0XHRpZiAodGhpcy52aWV3VHlwZSAhPSBcIm1hcmtkb3duXCIpIHJldHVybiB0aGlzLmRvY3VtZW50Py5xdWVyeVNlbGVjdG9yKFwiLnZpZXctY29udGVudFwiKT8uZmlyc3RDaGlsZCBhcyBIVE1MRGl2RWxlbWVudDtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5kb2N1bWVudD8ucXVlcnlTZWxlY3RvcihcIi5tYXJrZG93bi1wcmV2aWV3LXNpemVyXCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVGhlIGFic29sdXRlIHBhdGggdGhhdCB0aGUgZmlsZSB3aWxsIGJlIHNhdmVkIHRvXHJcblx0ICovXHJcblx0Z2V0IGV4cG9ydFBhdGhBYnNvbHV0ZSgpOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuZGVzdGluYXRpb25Gb2xkZXIuam9pbih0aGlzLmV4cG9ydFBhdGgpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVGhlIHJlbGF0aXZlIHBhdGggZnJvbSBleHBvcnRQYXRoIHRvIHJvb3RGb2xkZXJcclxuXHQgKi9cclxuXHRnZXQgcGF0aFRvUm9vdCgpOiBQYXRoXHJcblx0e1xyXG5cdFx0cmV0dXJuIFBhdGguZ2V0UmVsYXRpdmVQYXRoKHRoaXMuZXhwb3J0UGF0aCwgbmV3IFBhdGgodGhpcy5leHBvcnRQYXRoLndvcmtpbmdEaXJlY3RvcnkpLCB0cnVlKS5tYWtlVW5peFN0eWxlKCk7XHJcblx0fVxyXG5cclxuXHRnZXQgaXNGaWxlTW9kaWZpZWQoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdHJldHVybiB0aGlzLnNvdXJjZS5zdGF0Lm10aW1lID4gKHRoaXMuZXhwb3J0UGF0aEFic29sdXRlLnN0YXQ/Lm10aW1lLmdldFRpbWUoKSA/PyBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmV0dXJucyBhIGRvd25sb2FkYWJsZSBvYmplY3QgdG8gZG93bmxvYWQgdGhlIC5odG1sIGZpbGUgdG8gdGhlIGN1cnJlbnQgcGF0aCB3aXRoIHRoZSBjdXJyZW50IGh0bWwgY29udGVudHMuXHJcblx0ICovXHJcblx0cHVibGljIGFzeW5jIGdldFNlbGZEb3dubG9hZGFibGUoKTogUHJvbWlzZTxEb3dubG9hZGFibGU+XHJcblx0e1xyXG5cdFx0bGV0IGNvbnRlbnQgPSAodGhpcy5pc0NvbnZlcnRhYmxlID8gYXdhaXQgdGhpcy5nZXRIVE1MKCkgOiBhd2FpdCBuZXcgUGF0aCh0aGlzLnNvdXJjZS5wYXRoKS5yZWFkRmlsZUJ1ZmZlcigpKSA/PyBcIlwiO1xyXG5cdFx0cmV0dXJuIG5ldyBEb3dubG9hZGFibGUodGhpcy5uYW1lLCBjb250ZW50LCB0aGlzLmV4cG9ydFBhdGguZGlyZWN0b3J5Lm1ha2VGb3JjZUZvbGRlcigpKTtcclxuXHR9XHJcblxyXG5cclxuXHJcblx0cHVibGljIGFzeW5jIGNyZWF0ZSgpOiBQcm9taXNlPFdlYnBhZ2UgfCB1bmRlZmluZWQ+XHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmlzQ29udmVydGFibGUgfHwgIXRoaXMuZG9jdW1lbnQpIHJldHVybiB0aGlzO1xyXG5cclxuXHRcdGlmKCEoYXdhaXQgdGhpcy5nZXREb2N1bWVudEhUTUwoKSkpIHJldHVybjtcclxuXHJcblx0XHRsZXQgbGF5b3V0ID0gdGhpcy5nZW5lcmF0ZVdlYnBhZ2VMYXlvdXQodGhpcy5jb250ZW50RWxlbWVudCk7XHJcblx0XHR0aGlzLmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobGF5b3V0LmNvbnRhaW5lcik7XHJcblx0XHRsYXlvdXQuY2VudGVyLmNsYXNzTGlzdC5hZGQoXCJzaG93XCIpO1xyXG5cclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UHJlc2V0ICE9IFwicmF3LWRvY3VtZW50c1wiKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgcmlnaHRTaWRlYmFyID0gbGF5b3V0LnJpZ2h0O1xyXG5cdFx0XHRsZXQgbGVmdFNpZGViYXIgPSBsYXlvdXQubGVmdDtcclxuXHJcblx0XHRcdC8vIGluamVjdCBncmFwaCB2aWV3XHJcblx0XHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUdyYXBoVmlldylcclxuXHRcdFx0e1xyXG5cdFx0XHRcdEdyYXBoVmlldy5nZW5lcmF0ZUdyYXBoRWwocmlnaHRTaWRlYmFyKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gaW5qZWN0IG91dGxpbmVcclxuXHRcdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlT3V0bGluZSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBoZWFkZXJUcmVlID0gbmV3IE91dGxpbmVUcmVlKHRoaXMuc291cmNlLCAxKTtcclxuXHRcdFx0XHRoZWFkZXJUcmVlLmNsYXNzID0gXCJvdXRsaW5lLXRyZWVcIjtcclxuXHRcdFx0XHRoZWFkZXJUcmVlLnRpdGxlID0gXCJUYWJsZSBPZiBDb250ZW50c1wiO1xyXG5cdFx0XHRcdGhlYWRlclRyZWUuc2hvd05lc3RpbmdJbmRpY2F0b3IgPSBmYWxzZTtcclxuXHRcdFx0XHRoZWFkZXJUcmVlLmdlbmVyYXRlV2l0aEl0ZW1zQ2xvc2VkID0gTWFpblNldHRpbmdzLnNldHRpbmdzLnN0YXJ0T3V0bGluZUNvbGxhcHNlZDtcclxuXHRcdFx0XHRhd2FpdCBoZWFkZXJUcmVlLmdlbmVyYXRlVHJlZVdpdGhDb250YWluZXIocmlnaHRTaWRlYmFyKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gaW5qZWN0IGRhcmttb2RlIHRvZ2dsZVxyXG5cdFx0XHRpZiAoTWFpblNldHRpbmdzLnNldHRpbmdzLmFkZERhcmtNb2RlVG9nZ2xlKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0SFRNTEdlbmVyYXRpb24uY3JlYXRlVGhlbWVUb2dnbGUobGVmdFNpZGViYXIpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBpbmplY3QgZmlsZSB0cmVlXHJcblx0XHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUZpbGVUcmVlKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGVmdFNpZGViYXIuY3JlYXRlRGl2KCkub3V0ZXJIVE1MID0gdGhpcy53ZWJzaXRlLmZpbGVUcmVlSHRtbDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZVxyXG5cdFx0e1xyXG5cdFx0XHRsYXlvdXQuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuc2lkZWJhclwiKS5mb3JFYWNoKChlbCkgPT4gZWwucmVtb3ZlKCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGF3YWl0IHRoaXMuYWRkTWV0YWRhdGEoKTtcclxuXHJcblx0XHR0aGlzLmRvd25sb2Fkcy51bnNoaWZ0KGF3YWl0IHRoaXMuZ2V0U2VsZkRvd25sb2FkYWJsZSgpKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgYXN5bmMgZ2V0RG9jdW1lbnRIVE1MKCk6IFByb21pc2U8V2VicGFnZSB8IHVuZGVmaW5lZD5cclxuXHR7XHJcblx0XHRpZiAoIXRoaXMuaXNDb252ZXJ0YWJsZSB8fCAhdGhpcy5kb2N1bWVudCkgcmV0dXJuIHRoaXM7XHJcblxyXG5cdFx0Ly8gc2V0IGN1c3RvbSBsaW5lIHdpZHRoIG9uIGJvZHlcclxuXHRcdGxldCBib2R5ID0gdGhpcy5kb2N1bWVudC5ib2R5O1xyXG5cdFx0Ym9keS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBXZWJzaXRlLmdldFZhbGlkQm9keUNsYXNzZXMoKSk7XHJcblxyXG5cdFx0Ly8gY3JlYXRlIG9ic2lkaWFuIGRvY3VtZW50IGNvbnRhaW5lcnNcclxuXHRcdGxldCByZW5kZXJJbmZvID0gYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJGaWxlKHRoaXMuc291cmNlLCBib2R5KTtcclxuXHRcdGxldCBjb250ZW50RWwgPSByZW5kZXJJbmZvPy5jb250ZW50RWw7XHJcblx0XHR0aGlzLnZpZXdUeXBlID0gcmVuZGVySW5mbz8udmlld1R5cGUgPz8gXCJtYXJrZG93blwiO1xyXG5cclxuXHRcdGlmICghY29udGVudEVsKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0aWYgKE1hcmtkb3duUmVuZGVyZXIuY2hlY2tDYW5jZWxsZWQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRpZiAodGhpcy52aWV3VHlwZSA9PSBcIm1hcmtkb3duXCIpXHJcblx0XHR7IFxyXG5cdFx0XHRjb250ZW50RWwuY2xhc3NMaXN0LnRvZ2dsZShcImFsbG93LWZvbGQtaGVhZGluZ3NcIiwgTWFpblNldHRpbmdzLnNldHRpbmdzLmFsbG93Rm9sZGluZ0hlYWRpbmdzKTtcclxuXHJcblx0XHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuYWRkRmlsZW5hbWVUaXRsZSkgdGhpcy5hZGRUaXRsZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmKHRoaXMuc2l6ZXJFbGVtZW50KSB0aGlzLnNpemVyRWxlbWVudC5zdHlsZS5wYWRkaW5nQm90dG9tID0gXCJcIjtcclxuXHJcblx0XHQvLyBtb3ZlIGJhbm5lciBwbHVnaW4ncyB3cmFwcGVyIGFib3ZlIHRoZSBzaXplclxyXG5cdFx0bGV0IGJhbm5lcldyYXBwZXIgPSB0aGlzLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIub2JzaWRpYW4tYmFubmVyLXdyYXBwZXJcIik7XHJcblxyXG5cdFx0bGV0IHNpemVyUGFyZW50ID0gYmFubmVyV3JhcHBlcj8uY2xvc2VzdChcIi5tYXJrZG93bi1wcmV2aWV3LXNpemVyXCIpO1xyXG5cdFx0bGV0IGNvbnRlbnRQYXJlbnQgPSBiYW5uZXJXcmFwcGVyPy5jbG9zZXN0KFwiLm1hcmtkb3duLXByZXZpZXctdmlld1wiKTtcclxuXHRcdGlmKHNpemVyUGFyZW50ICYmIGNvbnRlbnRQYXJlbnQgJiYgYmFubmVyV3JhcHBlcikgXHJcblx0XHR7XHJcblx0XHRcdGlmKGJhbm5lcldyYXBwZXIpIGNvbnRlbnRQYXJlbnQuYXBwZW5kQ2hpbGQoYmFubmVyV3JhcHBlcik7XHJcblx0XHRcdGlmIChzaXplclBhcmVudCkgY29udGVudFBhcmVudC5hcHBlbmRDaGlsZChzaXplclBhcmVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY29udmVydCBoZWFkaW5ncyBmcm9tIGxpbmVhciB0byB0cmVlc1xyXG5cdFx0SFRNTEdlbmVyYXRpb24ubWFrZUhlYWRpbmdzVHJlZXMoY29udGVudEVsKTtcclxuXHJcblx0XHQvLyBtb2RpZnkgbGlua3MgdG8gd29yayBvdXRzaWRlIG9mIG9ic2lkaWFuIChpbmNsdWRpbmcgcmVsYXRpdmUgbGlua3MpXHJcblx0XHR0aGlzLmNvbnZlcnRMaW5rcygpO1xyXG5cdFx0XHJcblx0XHQvLyBpbmxpbmUgLyBvdXRsaW5lIGltYWdlc1xyXG5cdFx0bGV0IG91dGxpbmVkSW1hZ2VzIDogRG93bmxvYWRhYmxlW10gPSBbXTtcclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSW1hZ2VzKSBhd2FpdCB0aGlzLmlubGluZU1lZGlhKCk7XHJcblx0XHRlbHNlIG91dGxpbmVkSW1hZ2VzID0gYXdhaXQgdGhpcy5leHBvcnRNZWRpYSgpO1xyXG5cdFx0XHJcblxyXG5cdFx0Ly8gYWRkIG1hdGggc3R5bGVzIHRvIHRoZSBkb2N1bWVudC4gVGhleSBhcmUgaGVyZSBhbmQgbm90IGluIDxoZWFkPiBiZWNhdXNlIHRoZXkgYXJlIHVuaXF1ZSB0byBlYWNoIGRvY3VtZW50XHJcblx0XHRsZXQgbWF0aFN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XHJcblx0XHRtYXRoU3R5bGVFbC5pZCA9IFwiTUpYLUNIVE1MLXN0eWxlc1wiO1xyXG5cdFx0bWF0aFN0eWxlRWwuaW5uZXJIVE1MID0gQXNzZXRIYW5kbGVyLm1hdGhTdHlsZXM7XHJcblx0XHR0aGlzLmNvbnRlbnRFbGVtZW50LnByZXBlbmQobWF0aFN0eWxlRWwpO1xyXG5cclxuXHRcdGxldCBkZXBlbmRlbmNpZXNfdGVtcCA9IGF3YWl0IEFzc2V0SGFuZGxlci5nZXREb3dubG9hZHMoKTtcclxuXHRcdGRlcGVuZGVuY2llc190ZW1wLnB1c2goLi4ub3V0bGluZWRJbWFnZXMpO1xyXG5cclxuXHRcdHRoaXMuZG93bmxvYWRzLnB1c2goLi4uZGVwZW5kZW5jaWVzX3RlbXApO1xyXG5cclxuXHRcdGlmKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZSlcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5kb3dubG9hZHMuZm9yRWFjaCgoZmlsZSkgPT5cclxuXHRcdFx0e1xyXG5cdFx0XHRcdGZpbGUuZmlsZW5hbWUgPSBQYXRoLnRvV2ViU3R5bGUoZmlsZS5maWxlbmFtZSk7XHJcblx0XHRcdFx0ZmlsZS5yZWxhdGl2ZURvd25sb2FkUGF0aCA9IGZpbGUucmVsYXRpdmVEb3dubG9hZFBhdGg/Lm1ha2VXZWJTdHlsZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmRlcGVuZGVuY2llcy5wdXNoKC4uLnRoaXMuZG93bmxvYWRzKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblx0XHJcblx0cHJpdmF0ZSBnZW5lcmF0ZVdlYnBhZ2VMYXlvdXQobWlkZGxlQ29udGVudDogSFRNTEVsZW1lbnQpOiB7Y29udGFpbmVyOiBIVE1MRWxlbWVudCwgbGVmdDogSFRNTEVsZW1lbnQsIHJpZ2h0OiBIVE1MRWxlbWVudCwgY2VudGVyOiBIVE1MRWxlbWVudH1cclxuXHR7XHJcblx0XHRpZiAoIXRoaXMuZG9jdW1lbnQpIHJldHVybiB7Y29udGFpbmVyOiBtaWRkbGVDb250ZW50LCBsZWZ0OiBtaWRkbGVDb250ZW50LCByaWdodDogbWlkZGxlQ29udGVudCwgY2VudGVyOiBtaWRkbGVDb250ZW50fTtcclxuXHJcblx0XHQvKlxyXG5cdFx0LSBkaXYud2VicGFnZS1jb250YWluZXJcclxuXHJcblx0XHRcdC0gZGl2LnNpZGViYXIuc2lkZWJhci1sZWZ0XHJcblx0XHRcdFx0LSBkaXYuc2lkZWJhci1jb250YWluZXJcclxuXHRcdFx0XHRcdC0gZGl2LnNpZGViYXItc2l6ZXJcclxuXHRcdFx0XHRcdFx0LSBkaXYuc2lkZWJhci1jb250ZW50LXBvc2l0aW9uZXJcclxuXHRcdFx0XHRcdFx0XHQtIGRpdi5zaWRlYmFyLWNvbnRlbnRcclxuXHRcdFx0XHQtIGRpdi5zaWRlYmFyLWd1dHRlclxyXG5cdFx0XHRcdFx0LSBkaXYuY2xpY2thYmxlLWljb24uc2lkZWJhci1jb2xsYXBzZS1pY29uXHJcblx0XHRcdFx0XHRcdC0gc3ZnXHJcblxyXG5cdFx0XHQtIGRpdi5kb2N1bWVudC1jb250YWluZXJcclxuXHJcblx0XHRcdC0gZGl2LnNpZGViYXIuc2lkZWJhci1yaWdodFxyXG5cdFx0XHRcdC0gZGl2LnNpZGViYXItZ3V0dGVyXHJcblx0XHRcdFx0XHRcdC0gZGl2LmNsaWNrYWJsZS1pY29uLnNpZGViYXItY29sbGFwc2UtaWNvblxyXG5cdFx0XHRcdFx0XHRcdC0gc3ZnXHJcblx0XHRcdFx0LSBkaXYuc2lkZWJhci1jb250YWluZXJcclxuXHRcdFx0XHRcdC0gZGl2LnNpZGViYXItc2l6ZXJcclxuXHRcdFx0XHRcdFx0LSBkaXYuc2lkZWJhci1jb250ZW50LXBvc2l0aW9uZXJcclxuXHRcdFx0XHRcdFx0XHQtIGRpdi5zaWRlYmFyLWNvbnRlbnRcclxuXHRcdCovXHJcblxyXG5cdFx0bGV0IGljb25TVkcgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxMDAlXCIgaGVpZ2h0PVwiMTAwJVwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjNcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBjbGFzcz1cInN2Zy1pY29uXCI+PHBhdGggZD1cIk0yMSAzSDNDMS44OTU0MyAzIDEgMy44OTU0MyAxIDVWMTlDMSAyMC4xMDQ2IDEuODk1NDMgMjEgMyAyMUgyMUMyMi4xMDQ2IDIxIDIzIDIwLjEwNDYgMjMgMTlWNUMyMyAzLjg5NTQzIDIyLjEwNDYgMyAyMSAzWlwiPjwvcGF0aD48cGF0aCBkPVwiTTEwIDRWMjBcIj48L3BhdGg+PHBhdGggZD1cIk00IDdIN1wiPjwvcGF0aD48cGF0aCBkPVwiTTQgMTBIN1wiPjwvcGF0aD48cGF0aCBkPVwiTTQgMTNIN1wiPjwvcGF0aD48L3N2Zz5gXHJcblx0XHRcclxuXHRcdGxldCBwYWdlQ29udGFpbmVyID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IGxlZnRTaWRlYmFyID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IGxlZnRTaWRlYmFyQ29udGFpbmVyID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IGxlZnRTaWRlYmFyU2l6ZXIgPSB0aGlzLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0XHRsZXQgbGVmdFNpZGViYXJDb250ZW50UG9zaXRpb25lciA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdGxldCBsZWZ0Q29udGVudCA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdGxldCBsZWZ0R3V0dGVyID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IGxlZnRHdXR0ZXJJY29uID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IGRvY3VtZW50Q29udGFpbmVyID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IHJpZ2h0U2lkZWJhciA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdGxldCByaWdodFNpZGViYXJDb250YWluZXIgPSB0aGlzLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0XHRsZXQgcmlnaHRTaWRlYmFyU2l6ZXIgPSB0aGlzLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0XHRsZXQgcmlnaHRTaWRlYmFyQ29udGVudFBvc2l0aW9uZXIgPSB0aGlzLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0XHRsZXQgcmlnaHRDb250ZW50ID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IHJpZ2h0R3V0dGVyID0gdGhpcy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0bGV0IHJpZ2h0R3V0dGVySWNvbiA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcblx0XHRwYWdlQ29udGFpbmVyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwid2VicGFnZS1jb250YWluZXJcIik7XHJcblxyXG5cdFx0bGVmdFNpZGViYXIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJzaWRlYmFyLWxlZnQgc2lkZWJhclwiKTtcclxuXHRcdGxlZnRTaWRlYmFyQ29udGFpbmVyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwic2lkZWJhci1jb250YWluZXJcIik7XHJcblx0XHRsZWZ0U2lkZWJhclNpemVyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwic2lkZWJhci1zaXplclwiKTtcclxuXHRcdGxlZnRTaWRlYmFyQ29udGVudFBvc2l0aW9uZXIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJzaWRlYmFyLWNvbnRlbnQtcG9zaXRpb25lclwiKTtcclxuXHRcdGxlZnRDb250ZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwic2lkZWJhci1jb250ZW50XCIpO1xyXG5cdFx0bGVmdEd1dHRlci5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInNpZGViYXItZ3V0dGVyXCIpO1xyXG5cdFx0bGVmdEd1dHRlckljb24uc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJjbGlja2FibGUtaWNvbiBzaWRlYmFyLWNvbGxhcHNlLWljb25cIik7XHJcblxyXG5cdFx0ZG9jdW1lbnRDb250YWluZXIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJkb2N1bWVudC1jb250YWluZXJcIik7XHJcblxyXG5cdFx0cmlnaHRTaWRlYmFyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwic2lkZWJhci1yaWdodCBzaWRlYmFyXCIpO1xyXG5cdFx0cmlnaHRTaWRlYmFyQ29udGFpbmVyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwic2lkZWJhci1jb250YWluZXJcIik7XHJcblx0XHRyaWdodFNpZGViYXJTaXplci5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInNpZGViYXItc2l6ZXJcIik7XHJcblx0XHRyaWdodFNpZGViYXJDb250ZW50UG9zaXRpb25lci5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInNpZGViYXItY29udGVudC1wb3NpdGlvbmVyXCIpO1xyXG5cdFx0cmlnaHRDb250ZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwic2lkZWJhci1jb250ZW50XCIpO1xyXG5cdFx0cmlnaHRHdXR0ZXIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJzaWRlYmFyLWd1dHRlclwiKTtcclxuXHRcdHJpZ2h0R3V0dGVySWNvbi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcImNsaWNrYWJsZS1pY29uIHNpZGViYXItY29sbGFwc2UtaWNvblwiKTtcclxuXHJcblx0XHRwYWdlQ29udGFpbmVyLmFwcGVuZENoaWxkKGxlZnRTaWRlYmFyKTtcclxuXHRcdHBhZ2VDb250YWluZXIuYXBwZW5kQ2hpbGQoZG9jdW1lbnRDb250YWluZXIpO1xyXG5cdFx0cGFnZUNvbnRhaW5lci5hcHBlbmRDaGlsZChyaWdodFNpZGViYXIpO1xyXG5cclxuXHRcdGxlZnRTaWRlYmFyLmFwcGVuZENoaWxkKGxlZnRTaWRlYmFyQ29udGFpbmVyKTtcclxuXHRcdGxlZnRTaWRlYmFyQ29udGFpbmVyLmFwcGVuZENoaWxkKGxlZnRTaWRlYmFyU2l6ZXIpO1xyXG5cdFx0bGVmdFNpZGViYXJTaXplci5hcHBlbmRDaGlsZChsZWZ0U2lkZWJhckNvbnRlbnRQb3NpdGlvbmVyKTtcclxuXHRcdGxlZnRTaWRlYmFyQ29udGVudFBvc2l0aW9uZXIuYXBwZW5kQ2hpbGQobGVmdENvbnRlbnQpO1xyXG5cdFx0bGVmdFNpZGViYXIuYXBwZW5kQ2hpbGQobGVmdEd1dHRlcik7XHJcblx0XHRsZWZ0R3V0dGVyLmFwcGVuZENoaWxkKGxlZnRHdXR0ZXJJY29uKTtcclxuXHRcdGxlZnRHdXR0ZXJJY29uLmlubmVySFRNTCA9IGljb25TVkc7XHJcblxyXG5cdFx0ZG9jdW1lbnRDb250YWluZXIuYXBwZW5kQ2hpbGQobWlkZGxlQ29udGVudCk7XHJcblxyXG5cdFx0cmlnaHRTaWRlYmFyLmFwcGVuZENoaWxkKHJpZ2h0R3V0dGVyKTtcclxuXHRcdHJpZ2h0R3V0dGVyLmFwcGVuZENoaWxkKHJpZ2h0R3V0dGVySWNvbik7XHJcblx0XHRyaWdodEd1dHRlckljb24uaW5uZXJIVE1MID0gaWNvblNWRztcclxuXHRcdHJpZ2h0U2lkZWJhci5hcHBlbmRDaGlsZChyaWdodFNpZGViYXJDb250YWluZXIpO1xyXG5cdFx0cmlnaHRTaWRlYmFyQ29udGFpbmVyLmFwcGVuZENoaWxkKHJpZ2h0U2lkZWJhclNpemVyKTtcclxuXHRcdHJpZ2h0U2lkZWJhclNpemVyLmFwcGVuZENoaWxkKHJpZ2h0U2lkZWJhckNvbnRlbnRQb3NpdGlvbmVyKTtcclxuXHRcdHJpZ2h0U2lkZWJhckNvbnRlbnRQb3NpdGlvbmVyLmFwcGVuZENoaWxkKHJpZ2h0Q29udGVudCk7XHJcblx0XHRcclxuXHJcblx0XHRyZXR1cm4ge2NvbnRhaW5lcjogcGFnZUNvbnRhaW5lciwgbGVmdDogbGVmdENvbnRlbnQsIHJpZ2h0OiByaWdodENvbnRlbnQsIGNlbnRlcjogZG9jdW1lbnRDb250YWluZXJ9O1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBhZGRUaXRsZSgpXHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmRvY3VtZW50KSByZXR1cm47XHJcblxyXG5cdFx0bGV0IGlubGluZVRpdGxlID0gdGhpcy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmlubGluZS10aXRsZVwiKTtcclxuXHRcdGxldCB0aXRsZSA9IGlubGluZVRpdGxlPy50ZXh0Q29udGVudCA/PyB0aGlzLnNvdXJjZS5iYXNlbmFtZTtcclxuXHRcdGlubGluZVRpdGxlPy5yZW1vdmUoKTtcclxuXHJcblx0XHRsZXQgdGl0bGVFbCA9IHRoaXMuc2l6ZXJFbGVtZW50LmNyZWF0ZUVsKFwiaDFcIik7XHJcblx0XHR0aXRsZUVsLnNldEF0dHJpYnV0ZShcImRhdGEtaGVhZGluZ1wiLCB0aXRsZSk7XHJcblx0XHR0aXRsZUVsLmlkID0gdGhpcy5zb3VyY2UuYmFzZW5hbWUucmVwbGFjZUFsbChcIiBcIiwgXCJfXCIpO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBhc3luYyBhZGRNZXRhZGF0YSgpXHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmRvY3VtZW50KSByZXR1cm47XHJcblxyXG5cdFx0bGV0IHJlbGF0aXZlUGF0aHMgPSB0aGlzLmdldFJlbGF0aXZlUGF0aHMoKTtcclxuXHJcblx0XHRsZXQgbWV0YSA9XHJcblx0XHRgXHJcblx0XHQ8dGl0bGU+JHt0aGlzLnNvdXJjZS5iYXNlbmFtZX08L3RpdGxlPlxyXG5cdFx0PGJhc2UgaHJlZj1cIiR7cmVsYXRpdmVQYXRocy5yb290UGF0aH0vXCI+XHJcblx0XHQ8bWV0YSBpZD1cInJvb3QtcGF0aFwiIHJvb3QtcGF0aD1cIiR7cmVsYXRpdmVQYXRocy5yb290UGF0aH0vXCI+XHJcblxyXG5cdFx0PGxpbmsgcmVsPVwiaWNvblwiIHNpemVzPVwiOTZ4OTZcIiBocmVmPVwiaHR0cHM6Ly9wdWJsaXNoLTAxLm9ic2lkaWFuLm1kL2FjY2Vzcy9mNzg2ZGI5ZmFjNDU3NzRmYTRmMGQ4MTEyZTIzMmQ2Ny9mYXZpY29uLTk2eDk2LnBuZ1wiPlxyXG5cdFx0PG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAsIHVzZXItc2NhbGFibGU9eWVzLCBtaW5pbXVtLXNjYWxlPTEuMCwgbWF4aW11bS1zY2FsZT01LjBcIj5cclxuXHRcdDxtZXRhIGNoYXJzZXQ9XCJVVEYtOFwiPlxyXG5cdFx0YDtcclxuXHJcblx0XHQvLyAtLS0gSlMgLS0tXHJcblx0XHRsZXQgc2NyaXB0cyA9IFwiXCI7XHJcblxyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3KSBcclxuXHRcdHtcclxuXHRcdFx0c2NyaXB0cyArPSBgXFxuPHNjcmlwdCB0eXBlPSdtb2R1bGUnIHNyYz0nJHtyZWxhdGl2ZVBhdGhzLmpzUGF0aH0vZ3JhcGhfdmlldy5qcyc+PC9zY3JpcHQ+XFxuYDtcclxuXHRcdFx0c2NyaXB0cyArPSBgXFxuPHNjcmlwdCBzcmM9JyR7cmVsYXRpdmVQYXRocy5qc1BhdGh9L2dyYXBoX3dhc20uanMnPjwvc2NyaXB0PlxcbmA7XHJcblx0XHRcdHNjcmlwdHMgKz0gYFxcbjxzY3JpcHQgc3JjPVwiJHtyZWxhdGl2ZVBhdGhzLmpzUGF0aH0vdGlueWNvbG9yLmpzXCI+PC9zY3JpcHQ+XFxuYDtcclxuXHRcdFx0c2NyaXB0cyArPSBgXFxuPHNjcmlwdCBzcmM9XCJodHRwczovL2NkbmpzLmNsb3VkZmxhcmUuY29tL2FqYXgvbGlicy9waXhpLmpzLzcuMi40L3BpeGkubWluLmpzXCIgaW50ZWdyaXR5PVwic2hhNTEyLUNoL082a0w4QnFVd0FmQ0Y3SWU1U1gxSGluK0JKZ1lINHBOalJxWGRURXFNc2lzMVRVWWcrajZubkk5dWR1UGpHYWo3RE40VUtDWmdwdm9FeHQ2ZGt3PT1cIiBjcm9zc29yaWdpbj1cImFub255bW91c1wiIHJlZmVycmVycG9saWN5PVwibm8tcmVmZXJyZXJcIj48L3NjcmlwdD5cXG5gO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSlMpXHJcblx0XHR7XHJcblx0XHRcdHNjcmlwdHMgKz0gYFxcbjxzY3JpcHQ+XFxuJHtBc3NldEhhbmRsZXIud2VicGFnZUpTfVxcbjwvc2NyaXB0PlxcbmA7XHJcblx0XHRcdHNjcmlwdHMgKz0gYFxcbjxzY3JpcHQ+XFxuJHtBc3NldEhhbmRsZXIuZ2VuZXJhdGVkSlN9XFxuPC9zY3JpcHQ+XFxuYDtcclxuXHRcdH1cclxuXHRcdGVsc2UgXHJcblx0XHR7XHJcblx0XHRcdHNjcmlwdHMgKz0gYFxcbjxzY3JpcHQgc3JjPScke3JlbGF0aXZlUGF0aHMuanNQYXRofS93ZWJwYWdlLmpzJz48L3NjcmlwdD5cXG5gO1xyXG5cdFx0XHRzY3JpcHRzICs9IGBcXG48c2NyaXB0IHNyYz0nJHtyZWxhdGl2ZVBhdGhzLmpzUGF0aH0vZ2VuZXJhdGVkLmpzJz48L3NjcmlwdD5cXG5gO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyAtLS0gQ1NTIC0tLVxyXG5cdFx0bGV0IGNzc1NldHRpbmdzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjc3Mtc2V0dGluZ3MtbWFuYWdlclwiKT8uaW5uZXJIVE1MID8/IFwiXCI7XHJcblx0XHRcclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lQ1NTKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgcGx1Z2luQ1NTID0gQXNzZXRIYW5kbGVyLndlYnBhZ2VTdHlsZXM7XHJcblx0XHRcdGxldCB0aGlyZFBhcnR5UGx1Z2luU3R5bGVzID0gQXNzZXRIYW5kbGVyLnBsdWdpblN0eWxlcztcclxuXHRcdFx0cGx1Z2luQ1NTICs9IHRoaXJkUGFydHlQbHVnaW5TdHlsZXM7XHJcblx0XHRcdFxyXG5cdFx0XHR2YXIgaGVhZGVyID1cclxuXHRcdFx0YFxyXG5cdFx0XHQke21ldGF9XHJcblx0XHRcdFxyXG5cdFx0XHQ8IS0tIE9ic2lkaWFuIEFwcCBTdHlsZXMgLyBPdGhlciBCdWlsdC1pbiBTdHlsZXMgLS0+XHJcblx0XHRcdDxzdHlsZT4gJHtBc3NldEhhbmRsZXIuYXBwU3R5bGVzfSA8L3N0eWxlPlxyXG5cdFx0XHQ8c3R5bGU+ICR7Y3NzU2V0dGluZ3N9IDwvc3R5bGU+XHJcblxyXG5cdFx0XHQ8IS0tIFRoZW1lIFN0eWxlcyAtLT5cclxuXHRcdFx0PHN0eWxlPiAke0Fzc2V0SGFuZGxlci50aGVtZVN0eWxlc30gPC9zdHlsZT5cclxuXHJcblx0XHRcdDwhLS0gUGx1Z2luIFN0eWxlcyAtLT5cclxuXHRcdFx0PHN0eWxlPiAke3BsdWdpbkNTU30gPC9zdHlsZT5cclxuXHJcblx0XHRcdDwhLS0gU25pcHBldHMgLS0+XHJcblx0XHRcdDxzdHlsZT4gJHtBc3NldEhhbmRsZXIuc25pcHBldFN0eWxlc30gPC9zdHlsZT5cclxuXHJcblx0XHRcdDwhLS0gR2VuZXJhdGVkIFN0eWxlcyAtLT5cclxuXHRcdFx0PHN0eWxlPiAke0Fzc2V0SGFuZGxlci5nZW5lcmF0ZWRTdHlsZXN9IDwvc3R5bGU+XHJcblx0XHRcclxuXHRcdFx0JHtzY3JpcHRzfVxyXG5cdFx0XHRgO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZVxyXG5cdFx0e1xyXG5cdFx0XHRoZWFkZXIgPVxyXG5cdFx0XHRgXHJcblx0XHRcdCR7bWV0YX1cclxuXHJcblx0XHRcdDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiJHtyZWxhdGl2ZVBhdGhzLmNzc1BhdGh9L29ic2lkaWFuLXN0eWxlcy5jc3NcIj5cclxuXHRcdFx0PGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCIke3JlbGF0aXZlUGF0aHMuY3NzUGF0aH0vdGhlbWUuY3NzXCI+XHJcblx0XHRcdDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiJHtyZWxhdGl2ZVBhdGhzLmNzc1BhdGh9L3BsdWdpbi1zdHlsZXMuY3NzXCI+XHJcblx0XHRcdDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiJHtyZWxhdGl2ZVBhdGhzLmNzc1BhdGh9L3NuaXBwZXRzLmNzc1wiPlxyXG5cdFx0XHQ8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cIiR7cmVsYXRpdmVQYXRocy5jc3NQYXRofS9nZW5lcmF0ZWQtc3R5bGVzLmNzc1wiPlxyXG5cdFx0XHQ8c3R5bGU+ICR7Y3NzU2V0dGluZ3N9IDwvc3R5bGU+XHJcblxyXG5cdFx0XHQke3NjcmlwdHN9XHJcblx0XHRcdGA7XHJcblx0XHR9XHJcblxyXG5cdFx0aGVhZGVyICs9IFwiXFxuPCEtLSBDdXN0b20gSGVhZCBDb250ZW50IC0tPlxcblwiICsgQXNzZXRIYW5kbGVyLmN1c3RvbUhlYWRDb250ZW50ICsgXCJcXG5cIjtcclxuXHJcblx0XHR0aGlzLmRvY3VtZW50LmhlYWQuaW5uZXJIVE1MID0gaGVhZGVyO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBnZXRSZWxhdGl2ZVBhdGhzKCk6IHttZWRpYVBhdGg6IFBhdGgsIGpzUGF0aDogUGF0aCwgY3NzUGF0aDogUGF0aCwgcm9vdFBhdGg6IFBhdGh9XHJcblx0e1xyXG5cdFx0bGV0IHJvb3RQYXRoID0gdGhpcy5wYXRoVG9Sb290O1xyXG5cdFx0bGV0IGltYWdlUGF0aCA9IEFzc2V0SGFuZGxlci5tZWRpYUZvbGRlck5hbWUubWFrZVVuaXhTdHlsZSgpO1xyXG5cdFx0bGV0IGpzUGF0aCA9IEFzc2V0SGFuZGxlci5qc0ZvbGRlck5hbWUubWFrZVVuaXhTdHlsZSgpO1xyXG5cdFx0bGV0IGNzc1BhdGggPSBBc3NldEhhbmRsZXIuY3NzRm9sZGVyTmFtZS5tYWtlVW5peFN0eWxlKCk7XHJcblxyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZSlcclxuXHRcdHtcclxuXHRcdFx0aW1hZ2VQYXRoID0gaW1hZ2VQYXRoLm1ha2VXZWJTdHlsZSgpO1xyXG5cdFx0XHRqc1BhdGggPSBqc1BhdGgubWFrZVdlYlN0eWxlKCk7XHJcblx0XHRcdGNzc1BhdGggPSBjc3NQYXRoLm1ha2VXZWJTdHlsZSgpO1xyXG5cdFx0XHRyb290UGF0aCA9IHJvb3RQYXRoLm1ha2VXZWJTdHlsZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7bWVkaWFQYXRoOiBpbWFnZVBhdGgsIGpzUGF0aDoganNQYXRoLCBjc3NQYXRoOiBjc3NQYXRoLCByb290UGF0aDogcm9vdFBhdGh9O1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBjb252ZXJ0TGlua3MoKVxyXG5cdHtcclxuXHRcdGlmICghdGhpcy5kb2N1bWVudCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImEuaW50ZXJuYWwtbGlua1wiKS5mb3JFYWNoKChsaW5rRWwpID0+XHJcblx0XHR7XHJcblx0XHRcdGxpbmtFbC5zZXRBdHRyaWJ1dGUoXCJ0YXJnZXRcIiwgXCJfc2VsZlwiKTtcclxuXHJcblx0XHRcdGxldCBocmVmID0gbGlua0VsLmdldEF0dHJpYnV0ZShcImhyZWZcIik7XHJcblx0XHRcdGlmICghaHJlZikgcmV0dXJuO1xyXG5cclxuXHRcdFx0aWYgKGhyZWYuc3RhcnRzV2l0aChcIiNcIikpIC8vIGxpbmsgcG9pbnRpbmcgdG8gaGVhZGVyIG9mIHRoaXMgZG9jdW1lbnRcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxpbmtFbC5zZXRBdHRyaWJ1dGUoXCJocmVmXCIsIGhyZWYucmVwbGFjZUFsbChcIiBcIiwgXCJfXCIpKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIC8vIGlmIGl0IGRvZXNuJ3Qgc3RhcnQgd2l0aCAjLCBpdCdzIGEgbGluayB0byBhbm90aGVyIGRvY3VtZW50XHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgdGFyZ2V0SGVhZGVyID0gaHJlZi5zcGxpdChcIiNcIikubGVuZ3RoID4gMSA/IFwiI1wiICsgaHJlZi5zcGxpdChcIiNcIilbMV0gOiBcIlwiO1xyXG5cdFx0XHRcdGxldCB0YXJnZXQgPSBocmVmLnNwbGl0KFwiI1wiKVswXTtcclxuXHJcblx0XHRcdFx0bGV0IHRhcmdldEZpbGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdCh0YXJnZXQsIHRoaXMuc291cmNlLnBhdGgpO1xyXG5cdFx0XHRcdGlmICghdGFyZ2V0RmlsZSkgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHRsZXQgdGFyZ2V0UGF0aCA9IG5ldyBQYXRoKHRhcmdldEZpbGUucGF0aCk7XHJcblx0XHRcdFx0aWYgKE1hcmtkb3duUmVuZGVyZXIuaXNDb252ZXJ0YWJsZSh0YXJnZXRQYXRoLmV4dGVuc2lvbk5hbWUpKSB0YXJnZXRQYXRoLnNldEV4dGVuc2lvbihcImh0bWxcIik7XHJcblx0XHRcdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZSkgdGFyZ2V0UGF0aC5tYWtlV2ViU3R5bGUoKTtcclxuXHJcblx0XHRcdFx0bGV0IGZpbmFsSHJlZiA9IHRhcmdldFBhdGgubWFrZVVuaXhTdHlsZSgpICsgdGFyZ2V0SGVhZGVyLnJlcGxhY2VBbGwoXCIgXCIsIFwiX1wiKTtcclxuXHRcdFx0XHRsaW5rRWwuc2V0QXR0cmlidXRlKFwiaHJlZlwiLCBmaW5hbEhyZWYpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJhLmZvb3Rub3RlLWxpbmtcIikuZm9yRWFjaCgobGlua0VsKSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRsaW5rRWwuc2V0QXR0cmlidXRlKFwidGFyZ2V0XCIsIFwiX3NlbGZcIik7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJoMSwgaDIsIGgzLCBoNCwgaDUsIGg2XCIpLmZvckVhY2goKGhlYWRlckVsKSA9PlxyXG5cdFx0e1xyXG5cdFx0XHQvLyBjb252ZXJ0IHRoZSBkYXRhLWhlYWRpbmcgdG8gdGhlIGlkXHJcblx0XHRcdGhlYWRlckVsLnNldEF0dHJpYnV0ZShcImlkXCIsIChoZWFkZXJFbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhlYWRpbmdcIikgPz8gaGVhZGVyRWwudGV4dENvbnRlbnQpPy5yZXBsYWNlQWxsKFwiIFwiLCBcIl9cIikgPz8gXCJcIik7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgYXN5bmMgaW5saW5lTWVkaWEoKVxyXG5cdHtcclxuXHRcdGlmICghdGhpcy5kb2N1bWVudCkgcmV0dXJuO1xyXG5cclxuXHRcdGxldCBlbGVtZW50cyA9IEFycmF5LmZyb20odGhpcy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3NyY106bm90KGhlYWQgW3NyY10pXCIpKVxyXG5cdFx0Zm9yIChsZXQgbWVkaWFFbCBvZiBlbGVtZW50cylcclxuXHRcdHtcclxuXHRcdFx0bGV0IHJhd1NyYyA9IG1lZGlhRWwuZ2V0QXR0cmlidXRlKFwic3JjXCIpID8/IFwiXCI7XHJcblx0XHRcdGxldCBmaWxlUGF0aCA9IFdlYnBhZ2UuZ2V0TWVkaWFQYXRoKHJhd1NyYywgdGhpcy5zb3VyY2UucGF0aCk7XHJcblx0XHRcdGlmIChmaWxlUGF0aC5pc0VtcHR5IHx8IGZpbGVQYXRoLmlzRGlyZWN0b3J5IHx8IGZpbGVQYXRoLmlzQWJzb2x1dGUpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0bGV0IGJhc2U2NCA9IGF3YWl0IGZpbGVQYXRoLnJlYWRGaWxlU3RyaW5nKFwiYmFzZTY0XCIpID8/IFwiXCI7XHJcblx0XHRcdGlmIChiYXNlNjQgPT09IFwiXCIpIHJldHVybjtcclxuXHJcblx0XHRcdGxldCBleHQgPSBmaWxlUGF0aC5leHRlbnNpb25OYW1lO1xyXG5cclxuXHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdGxldCB0eXBlID0gYXBwLnZpZXdSZWdpc3RyeS50eXBlQnlFeHRlbnNpb25bZXh0XSA/PyBcImF1ZGlvXCI7XHJcblxyXG5cdFx0XHRpZihleHQgPT09IFwic3ZnXCIpIGV4dCArPSBcIit4bWxcIjtcclxuXHRcdFx0XHJcblx0XHRcdG1lZGlhRWwuc2V0QXR0cmlidXRlKFwic3JjXCIsIGBkYXRhOiR7dHlwZX0vJHtleHR9O2Jhc2U2NCwke2Jhc2U2NH1gKTtcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIGFzeW5jIGV4cG9ydE1lZGlhKCk6IFByb21pc2U8RG93bmxvYWRhYmxlW10+XHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmRvY3VtZW50KSByZXR1cm4gW107XHJcblxyXG5cdFx0bGV0IGRvd25sb2FkczogRG93bmxvYWRhYmxlW10gPSBbXTtcclxuXHJcblx0XHRsZXQgZWxlbWVudHMgPSBBcnJheS5mcm9tKHRoaXMuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltzcmNdOm5vdChoZWFkIFtzcmNdKVwiKSlcclxuXHRcdGZvciAobGV0IG1lZGlhRWwgb2YgZWxlbWVudHMpXHJcblx0XHR7XHJcblx0XHRcdGxldCByYXdTcmMgPSBtZWRpYUVsLmdldEF0dHJpYnV0ZShcInNyY1wiKSA/PyBcIlwiO1xyXG5cdFx0XHRsZXQgZmlsZVBhdGggPSBXZWJwYWdlLmdldE1lZGlhUGF0aChyYXdTcmMsIHRoaXMuc291cmNlLnBhdGgpO1xyXG5cdFx0XHRpZiAoZmlsZVBhdGguaXNFbXB0eSB8fCBmaWxlUGF0aC5pc0RpcmVjdG9yeSB8fCBmaWxlUGF0aC5pc0Fic29sdXRlKSBjb250aW51ZTtcclxuXHJcblx0XHRcdGxldCBleHBvcnRMb2NhdGlvbiA9IGZpbGVQYXRoLmNvcHk7XHJcblxyXG5cdFx0XHQvLyBpZiB0aGUgbWVkaWEgaXMgaW5zaWRlIHRoZSBleHBvcnRlZCBmb2xkZXIgdGhlbiBrZWVwIGl0IGluIHRoZSBzYW1lIHBsYWNlXHJcblx0XHRcdGxldCBtZWRpYVBhdGhJbkV4cG9ydCA9IFBhdGguZ2V0UmVsYXRpdmVQYXRoKHRoaXMuc291cmNlRm9sZGVyLCBmaWxlUGF0aCk7XHJcblx0XHRcdGlmIChtZWRpYVBhdGhJbkV4cG9ydC5hc1N0cmluZy5zdGFydHNXaXRoKFwiLi5cIikpXHJcblx0XHRcdHtcclxuXHRcdFx0XHQvLyBpZiBwYXRoIGlzIG91dHNpZGUgb2YgdGhlIHZhdWx0LCBvdXRsaW5lIGl0IGludG8gdGhlIG1lZGlhIGZvbGRlclxyXG5cdFx0XHRcdGV4cG9ydExvY2F0aW9uID0gQXNzZXRIYW5kbGVyLm1lZGlhRm9sZGVyTmFtZS5qb2luU3RyaW5nKGZpbGVQYXRoLmZ1bGxOYW1lKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gbGV0IHJlbGF0aXZlSW1hZ2VQYXRoID0gUGF0aC5nZXRSZWxhdGl2ZVBhdGgodGhpcy5leHBvcnRQYXRoLCBleHBvcnRMb2NhdGlvbilcclxuXHJcblx0XHRcdGlmKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdC8vIHJlbGF0aXZlSW1hZ2VQYXRoLm1ha2VXZWJTdHlsZSgpO1xyXG5cdFx0XHRcdGV4cG9ydExvY2F0aW9uLm1ha2VXZWJTdHlsZSgpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZWRpYUVsLnNldEF0dHJpYnV0ZShcInNyY1wiLCBleHBvcnRMb2NhdGlvbi5hc1N0cmluZyk7XHJcblxyXG5cdFx0XHRsZXQgZGF0YSA9IGF3YWl0IGZpbGVQYXRoLnJlYWRGaWxlQnVmZmVyKCkgPz8gQnVmZmVyLmZyb20oW10pO1xyXG5cdFx0XHRsZXQgaW1hZ2VEb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoZXhwb3J0TG9jYXRpb24uZnVsbE5hbWUsIGRhdGEsIGV4cG9ydExvY2F0aW9uLmRpcmVjdG9yeS5tYWtlRm9yY2VGb2xkZXIoKSk7XHJcblx0XHRcdGlmIChkYXRhLmxlbmd0aCA9PSAwKSBSZW5kZXJMb2cubG9nKGZpbGVQYXRoLCBcIk5vIGRhdGEgZm9yIGZpbGU6IFwiKTtcclxuXHRcdFx0ZG93bmxvYWRzLnB1c2goaW1hZ2VEb3dubG9hZCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdHJldHVybiBkb3dubG9hZHM7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBnZXRNZWRpYVBhdGgoc3JjOiBzdHJpbmcsIGV4cG9ydGluZ0ZpbGVQYXRoOiBzdHJpbmcpOiBQYXRoXHJcblx0e1xyXG5cdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0bGV0IHBhdGhTdHJpbmcgPSBcIlwiO1xyXG5cdFx0aWYgKHNyYy5zdGFydHNXaXRoKFwiYXBwOi8vXCIpKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgZmFpbCA9IGZhbHNlO1xyXG5cdFx0XHR0cnlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0XHRwYXRoU3RyaW5nID0gYXBwLnZhdWx0LnJlc29sdmVGaWxlVXJsKHNyYyk/LnBhdGggPz8gXCJcIjtcclxuXHRcdFx0XHRpZiAocGF0aFN0cmluZyA9PSBcIlwiKSBmYWlsID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXRjaFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0ZmFpbCA9IHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmKGZhaWwpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRwYXRoU3RyaW5nID0gc3JjLnJlcGxhY2VBbGwoXCJhcHA6Ly9cIiwgXCJcIikucmVwbGFjZUFsbChcIlxcXFxcIiwgXCIvXCIpO1xyXG5cdFx0XHRcdHBhdGhTdHJpbmcgPSBwYXRoU3RyaW5nLnJlcGxhY2VBbGwocGF0aFN0cmluZy5zcGxpdChcIi9cIilbMF0gKyBcIi9cIiwgXCJcIik7XHJcblx0XHRcdFx0cGF0aFN0cmluZyA9IFBhdGguZ2V0UmVsYXRpdmVQYXRoRnJvbVZhdWx0KG5ldyBQYXRoKHBhdGhTdHJpbmcpLCB0cnVlKS5hc1N0cmluZztcclxuXHRcdFx0XHRSZW5kZXJMb2cubG9nKHBhdGhTdHJpbmcsIFwiRmFsbGJhY2sgcGF0aCBwYXJzaW5nOlwiKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZVxyXG5cdFx0e1xyXG5cdFx0XHRwYXRoU3RyaW5nID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3Qoc3JjLCBleHBvcnRpbmdGaWxlUGF0aCk/LnBhdGggPz8gXCJcIjtcclxuXHRcdH1cclxuXHJcblx0XHRwYXRoU3RyaW5nID0gcGF0aFN0cmluZyA/PyBcIlwiO1xyXG5cclxuXHRcdHJldHVybiBuZXcgUGF0aChwYXRoU3RyaW5nKTtcclxuXHR9XHJcbn1cclxuIl19