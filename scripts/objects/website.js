import { __awaiter } from "tslib";
import { Webpage } from "./webpage";
import { FileTree } from "./file-tree";
import { AssetHandler } from "scripts/html-generation/asset-handler";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { MainSettings } from "scripts/settings/main-settings";
import { GraphView } from "./graph-view";
import { Path } from "scripts/utils/path";
import { RenderLog } from "scripts/html-generation/render-log";
import { Utils } from "scripts/utils/utils";
// const ignoreBodyClases: string[] = [
// 	"mod-windows", "is-frameless", "is-maximized", "is-hidden-frameless",
// 	"obsidian-app","show-view-header", "Heading", "minimal-theme", 
// 	"minimal-default-dark","minimal-default-light", "links-int-on", "links-ext-on", 
// 	"minimal-folding","minimal-readable", "minimal-light", 
// 	"minimal-dark", "chart-default-width", "table-default-width",
// 	"img-default-width", "iframe-default-width", "map-default-width", 
// 	"sizing-readable", "is-focused","sidebar-float-bottom", "check-color", 
// 	"check-bg", "colorful-active", "folder-notes-plugin",
// 	"hide-folder-note", "folder-note-underline", "folder-note-underline-path",
// 	"fn-whitespace-stop-collapsing", "callouts-default", "trim-cols", 
// 	"sidebar-tabs-default", "maximize-tables","tabs-default", 
// 	"tab-stack-top", "minimal-tab-title-hover"];
export class Website {
    constructor() {
        this.webpages = [];
        this.dependencies = [];
        this.downloads = [];
        this.batchFiles = [];
        this.progress = 0;
        this.fileTreeHtml = "";
        this.globalFileTreeChanged = true;
        this.globalFileTreeUnchangedTime = 0;
        this.globalBodyClassesChanged = true;
        this.globalBodyClassesUnchangedTime = 0;
        this.globalGraphChanged = true;
        this.globalGraphUnchangedTime = 0;
        this.created = false;
    }
    static getValidBodyClasses() {
        let bodyClasses = document.body.classList;
        let validClasses = "";
        // bodyClasses.forEach((className) =>
        // {
        // 	if (!ignoreBodyClases.includes(className)) validClasses += className + " ";
        // });
        validClasses += bodyClasses.contains("theme-light") ? " theme-light " : " theme-dark ";
        if (MainSettings.settings.sidebarsAlwaysCollapsible)
            validClasses += " sidebars-always-collapsible ";
        validClasses += " loading ";
        return validClasses.replace(/\s\s+/g, ' ');
    }
    updateGlobalsInExistingFile(webpage) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            // if the file was from a previous export then recheck if the global data has changed
            let modTime = (_b = (_a = webpage.exportPathAbsolute.stat) === null || _a === void 0 ? void 0 : _a.mtimeMs) !== null && _b !== void 0 ? _b : 0;
            let timeThreshold = 1000 * 60 * 5; // 5 minutes
            if (modTime && (modTime < this.globalFileTreeUnchangedTime - timeThreshold || modTime > this.globalFileTreeUnchangedTime + timeThreshold)) {
                this.globalFileTreeChanged = true;
                this.globalGraphUnchangedTime = modTime;
            }
            if (modTime && (modTime < this.globalBodyClassesUnchangedTime - timeThreshold || modTime > this.globalBodyClassesUnchangedTime + timeThreshold)) {
                this.globalBodyClassesChanged = true;
                this.globalBodyClassesUnchangedTime = modTime;
            }
            if (modTime && (modTime < this.globalGraphUnchangedTime - timeThreshold || modTime > this.globalGraphUnchangedTime + timeThreshold)) {
                this.globalGraphChanged = true;
                this.globalGraphUnchangedTime = modTime;
            }
            if ((!this.globalBodyClassesChanged && !this.globalFileTreeChanged && !this.globalGraphChanged) || !webpage.document) {
                RenderLog.progress(this.progress, this.batchFiles.length, "Skipping Unmodified File", "File: " + webpage.source.path, "var(--color-yellow)");
                yield Utils.delay(1);
                return;
            }
            let pageString = yield webpage.exportPathAbsolute.readFileString();
            if (!pageString)
                return;
            webpage.document.close();
            webpage.document.open();
            webpage.document.write(pageString);
            if (webpage.document.head.children.length == 0) {
                RenderLog.warning("Could not update global data in file: " + webpage.source.path + "\nFile is missing a head element");
                return;
            }
            RenderLog.progress(this.progress, this.batchFiles.length, "Update Global Data", "Updating Global Data: " + webpage.source.path, "var(--color-blue)");
            if (this.globalBodyClassesChanged) {
                let newBodyClass = Website.getValidBodyClasses();
                if (newBodyClass == webpage.document.body.getAttribute("class")) {
                    this.globalBodyClassesChanged = false;
                    this.globalBodyClassesUnchangedTime = modTime;
                }
                else {
                    webpage.document.body.setAttribute("class", newBodyClass);
                }
            }
            if (this.globalFileTreeChanged) {
                let fileTree = webpage.document.querySelector(".tree-container.file-tree");
                if ((_c = this.fileTreeHtml == (fileTree === null || fileTree === void 0 ? void 0 : fileTree.outerHTML)) !== null && _c !== void 0 ? _c : "") {
                    this.globalFileTreeChanged = false;
                    this.globalFileTreeUnchangedTime = modTime;
                }
                if (MainSettings.settings.includeFileTree && !fileTree) {
                    let treeContainer = (_e = (_d = webpage.document) === null || _d === void 0 ? void 0 : _d.querySelector(".sidebar-left .sidebar-content")) === null || _e === void 0 ? void 0 : _e.createDiv();
                    if (treeContainer)
                        treeContainer.outerHTML = this.fileTreeHtml;
                }
                else if (!MainSettings.settings.includeFileTree && fileTree) {
                    fileTree.remove();
                }
            }
            if (this.globalGraphChanged) {
                let graph = webpage.document.querySelector(".graph-view-wrapper");
                if (graph && MainSettings.settings.includeGraphView || !graph && !MainSettings.settings.includeGraphView) {
                    this.globalGraphChanged = false;
                    this.globalGraphUnchangedTime = modTime;
                }
                if (MainSettings.settings.includeGraphView && !graph) {
                    let rightSidebar = webpage.document.querySelector(".sidebar-right .sidebar-content");
                    if (rightSidebar) {
                        let graphEl = GraphView.generateGraphEl(rightSidebar);
                        rightSidebar.prepend(graphEl);
                    }
                }
                else if (!MainSettings.settings.includeGraphView && graph) {
                    graph.remove();
                }
            }
            if (MarkdownRenderer.checkCancelled())
                return undefined;
            // write the new html to the file
            yield webpage.exportPathAbsolute.writeFile(yield webpage.getHTML());
            webpage.document.close();
            delete webpage.document;
        });
    }
    checkIncrementalExport(webpage) {
        return __awaiter(this, void 0, void 0, function* () {
            if (MarkdownRenderer.checkCancelled())
                return false;
            if (!MainSettings.settings.incrementalExport || webpage.isFileModified) // don't skip the file if it's modified
             {
                return true;
            }
            else if (webpage.isConvertable) // Skip the file if it's unchanged since last export
             {
                // if file was not modified then copy over any global changes to the html file
                yield this.updateGlobalsInExistingFile(webpage);
            }
            return false;
        });
    }
    createWithFiles(files, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            this.batchFiles = files;
            this.destination = destination;
            if (MainSettings.settings.includeGraphView) {
                let convertableFiles = this.batchFiles.filter((file) => MarkdownRenderer.isConvertable(file.extension));
                Website.globalGraph = new GraphView(convertableFiles, MainSettings.settings.graphMinNodeSize, MainSettings.settings.graphMaxNodeSize);
            }
            if (MainSettings.settings.includeFileTree) {
                this.fileTree = new FileTree(this.batchFiles, false, true);
                this.fileTree.makeLinksWebStyle = MainSettings.settings.makeNamesWebStyle;
                this.fileTree.showNestingIndicator = true;
                this.fileTree.generateWithItemsClosed = true;
                this.fileTree.title = app.vault.getName();
                this.fileTree.class = "file-tree";
                let tempTreeContainer = document.body.createDiv();
                yield this.fileTree.generateTreeWithContainer(tempTreeContainer);
                this.fileTreeHtml = tempTreeContainer.innerHTML;
                tempTreeContainer.remove();
            }
            yield AssetHandler.updateAssetCache();
            yield MarkdownRenderer.beginBatch();
            RenderLog.progress(0, files.length, "Generating HTML", "...", "var(--color-accent)");
            this.progress = 0;
            for (let file of files) {
                if (MarkdownRenderer.checkCancelled())
                    return undefined;
                this.progress++;
                try {
                    let filename = new Path(file.path).basename;
                    let webpage = new Webpage(file, this, destination, this.batchFiles.length > 1, filename, MainSettings.isAllInline());
                    if (yield this.checkIncrementalExport(webpage)) // Skip creating the webpage if it's unchanged since last export
                     {
                        RenderLog.progress(this.progress, this.batchFiles.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");
                        if (!webpage.isConvertable)
                            webpage.downloads.push(yield webpage.getSelfDownloadable());
                        let createdPage = yield webpage.create();
                        if (!createdPage) {
                            if (MarkdownRenderer.cancelled)
                                return undefined;
                            continue;
                        }
                    }
                    this.webpages.push(webpage);
                    this.dependencies.push(...webpage.dependencies);
                    this.downloads.push(...webpage.downloads);
                }
                catch (e) {
                    RenderLog.error(e, "Could not export file: " + file.name);
                    continue;
                }
                if (MarkdownRenderer.checkCancelled())
                    return undefined;
            }
            // remove duplicates from the dependencies and downloads
            this.dependencies = this.dependencies.filter((file, index) => this.dependencies.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath && f.filename === file.filename) == index);
            this.downloads = this.downloads.filter((file, index) => this.downloads.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath && f.filename === file.filename) == index);
            this.created = true;
            return this;
        });
    }
    // saves a .json file with all the data needed to recreate the website
    saveAsDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.created)
                throw new Error("Cannot save website database before generating the website.");
            // data is a dictionary mapping a file path to file data
            let data = {};
            for (let webpage of this.webpages) {
                let webpageData = yield webpage.getHTML();
                let path = encodeURI(webpage.exportPath.copy.makeUnixStyle().asString);
                data[path] = webpageData;
            }
            for (let file of this.dependencies) {
                let fileData = file.content;
                if (fileData instanceof Buffer)
                    fileData = fileData.toString("base64");
                let path = encodeURI(file.relativeDownloadPath.joinString(file.filename).makeUnixStyle().asString);
                if (fileData == "") {
                    RenderLog.log(file.content);
                }
                data[path] = fileData;
            }
            let json = JSON.stringify(data);
            let databasePath = this.destination.directory.joinString("database.json");
            yield databasePath.writeFile(json);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vic2l0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIndlYnNpdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDcEMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN2QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFN0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDekMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFNUMsdUNBQXVDO0FBQ3ZDLHlFQUF5RTtBQUN6RSxtRUFBbUU7QUFDbkUsb0ZBQW9GO0FBQ3BGLDJEQUEyRDtBQUMzRCxpRUFBaUU7QUFDakUsc0VBQXNFO0FBQ3RFLDJFQUEyRTtBQUMzRSx5REFBeUQ7QUFDekQsOEVBQThFO0FBQzlFLHNFQUFzRTtBQUN0RSw4REFBOEQ7QUFDOUQsZ0RBQWdEO0FBRWhELE1BQU0sT0FBTyxPQUFPO0lBQXBCO1FBRVEsYUFBUSxHQUFjLEVBQUUsQ0FBQztRQUN6QixpQkFBWSxHQUFtQixFQUFFLENBQUM7UUFDbEMsY0FBUyxHQUFtQixFQUFFLENBQUM7UUFDL0IsZUFBVSxHQUFZLEVBQUUsQ0FBQztRQUN6QixhQUFRLEdBQVcsQ0FBQyxDQUFDO1FBS3JCLGlCQUFZLEdBQVcsRUFBRSxDQUFDO1FBRXpCLDBCQUFxQixHQUFHLElBQUksQ0FBQztRQUM3QixnQ0FBMkIsR0FBRyxDQUFDLENBQUM7UUFDaEMsNkJB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NUI7Z0JBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQzthQUN0QjtZQUVELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEMsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzFFLE1BQU0sWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQyxDQUFDO0tBQUE7Q0FFRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERvd25sb2FkYWJsZSB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL2Rvd25sb2FkYWJsZVwiO1xyXG5pbXBvcnQgeyBXZWJwYWdlIH0gZnJvbSBcIi4vd2VicGFnZVwiO1xyXG5pbXBvcnQgeyBGaWxlVHJlZSB9IGZyb20gXCIuL2ZpbGUtdHJlZVwiO1xyXG5pbXBvcnQgeyBBc3NldEhhbmRsZXIgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vYXNzZXQtaGFuZGxlclwiO1xyXG5pbXBvcnQgeyBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSBcInNjcmlwdHMvaHRtbC1nZW5lcmF0aW9uL21hcmtkb3duLXJlbmRlcmVyXCI7XHJcbmltcG9ydCB7IFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IE1haW5TZXR0aW5ncyB9IGZyb20gXCJzY3JpcHRzL3NldHRpbmdzL21haW4tc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgR3JhcGhWaWV3IH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xyXG5pbXBvcnQgeyBQYXRoIH0gZnJvbSBcInNjcmlwdHMvdXRpbHMvcGF0aFwiO1xyXG5pbXBvcnQgeyBSZW5kZXJMb2cgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vcmVuZGVyLWxvZ1wiO1xyXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL3V0aWxzXCI7XHJcblxyXG4vLyBjb25zdCBpZ25vcmVCb2R5Q2xhc2VzOiBzdHJpbmdbXSA9IFtcclxuLy8gXHRcIm1vZC13aW5kb3dzXCIsIFwiaXMtZnJhbWVsZXNzXCIsIFwiaXMtbWF4aW1pemVkXCIsIFwiaXMtaGlkZGVuLWZyYW1lbGVzc1wiLFxyXG4vLyBcdFwib2JzaWRpYW4tYXBwXCIsXCJzaG93LXZpZXctaGVhZGVyXCIsIFwiSGVhZGluZ1wiLCBcIm1pbmltYWwtdGhlbWVcIiwgXHJcbi8vIFx0XCJtaW5pbWFsLWRlZmF1bHQtZGFya1wiLFwibWluaW1hbC1kZWZhdWx0LWxpZ2h0XCIsIFwibGlua3MtaW50LW9uXCIsIFwibGlua3MtZXh0LW9uXCIsIFxyXG4vLyBcdFwibWluaW1hbC1mb2xkaW5nXCIsXCJtaW5pbWFsLXJlYWRhYmxlXCIsIFwibWluaW1hbC1saWdodFwiLCBcclxuLy8gXHRcIm1pbmltYWwtZGFya1wiLCBcImNoYXJ0LWRlZmF1bHQtd2lkdGhcIiwgXCJ0YWJsZS1kZWZhdWx0LXdpZHRoXCIsXHJcbi8vIFx0XCJpbWctZGVmYXVsdC13aWR0aFwiLCBcImlmcmFtZS1kZWZhdWx0LXdpZHRoXCIsIFwibWFwLWRlZmF1bHQtd2lkdGhcIiwgXHJcbi8vIFx0XCJzaXppbmctcmVhZGFibGVcIiwgXCJpcy1mb2N1c2VkXCIsXCJzaWRlYmFyLWZsb2F0LWJvdHRvbVwiLCBcImNoZWNrLWNvbG9yXCIsIFxyXG4vLyBcdFwiY2hlY2stYmdcIiwgXCJjb2xvcmZ1bC1hY3RpdmVcIiwgXCJmb2xkZXItbm90ZXMtcGx1Z2luXCIsXHJcbi8vIFx0XCJoaWRlLWZvbGRlci1ub3RlXCIsIFwiZm9sZGVyLW5vdGUtdW5kZXJsaW5lXCIsIFwiZm9sZGVyLW5vdGUtdW5kZXJsaW5lLXBhdGhcIixcclxuLy8gXHRcImZuLXdoaXRlc3BhY2Utc3RvcC1jb2xsYXBzaW5nXCIsIFwiY2FsbG91dHMtZGVmYXVsdFwiLCBcInRyaW0tY29sc1wiLCBcclxuLy8gXHRcInNpZGViYXItdGFicy1kZWZhdWx0XCIsIFwibWF4aW1pemUtdGFibGVzXCIsXCJ0YWJzLWRlZmF1bHRcIiwgXHJcbi8vIFx0XCJ0YWItc3RhY2stdG9wXCIsIFwibWluaW1hbC10YWItdGl0bGUtaG92ZXJcIl07XHJcblxyXG5leHBvcnQgY2xhc3MgV2Vic2l0ZVxyXG57XHJcblx0cHVibGljIHdlYnBhZ2VzOiBXZWJwYWdlW10gPSBbXTtcclxuXHRwdWJsaWMgZGVwZW5kZW5jaWVzOiBEb3dubG9hZGFibGVbXSA9IFtdO1xyXG5cdHB1YmxpYyBkb3dubG9hZHM6IERvd25sb2FkYWJsZVtdID0gW107XHJcblx0cHVibGljIGJhdGNoRmlsZXM6IFRGaWxlW10gPSBbXTtcclxuXHRwdWJsaWMgcHJvZ3Jlc3M6IG51bWJlciA9IDA7XHJcblx0cHVibGljIGRlc3RpbmF0aW9uOiBQYXRoO1xyXG5cclxuXHRwdWJsaWMgc3RhdGljIGdsb2JhbEdyYXBoOiBHcmFwaFZpZXc7XHJcblx0cHVibGljIGZpbGVUcmVlOiBGaWxlVHJlZTtcclxuXHRwdWJsaWMgZmlsZVRyZWVIdG1sOiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuXHRwcml2YXRlIGdsb2JhbEZpbGVUcmVlQ2hhbmdlZCA9IHRydWU7XHJcblx0cHJpdmF0ZSBnbG9iYWxGaWxlVHJlZVVuY2hhbmdlZFRpbWUgPSAwO1xyXG5cdHByaXZhdGUgZ2xvYmFsQm9keUNsYXNzZXNDaGFuZ2VkID0gdHJ1ZTtcclxuXHRwcml2YXRlIGdsb2JhbEJvZHlDbGFzc2VzVW5jaGFuZ2VkVGltZSA9IDA7XHJcblx0cHJpdmF0ZSBnbG9iYWxHcmFwaENoYW5nZWQgPSB0cnVlO1xyXG5cdHByaXZhdGUgZ2xvYmFsR3JhcGhVbmNoYW5nZWRUaW1lID0gMDtcclxuXHJcblx0cHJpdmF0ZSBjcmVhdGVkID0gZmFsc2U7XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgZ2V0VmFsaWRCb2R5Q2xhc3NlcygpOiBzdHJpbmdcclxuXHR7XHJcblx0XHRsZXQgYm9keUNsYXNzZXMgPSBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdDtcclxuXHRcdGxldCB2YWxpZENsYXNzZXMgPSBcIlwiO1xyXG5cclxuXHRcdC8vIGJvZHlDbGFzc2VzLmZvckVhY2goKGNsYXNzTmFtZSkgPT5cclxuXHRcdC8vIHtcclxuXHRcdC8vIFx0aWYgKCFpZ25vcmVCb2R5Q2xhc2VzLmluY2x1ZGVzKGNsYXNzTmFtZSkpIHZhbGlkQ2xhc3NlcyArPSBjbGFzc05hbWUgKyBcIiBcIjtcclxuXHRcdC8vIH0pO1xyXG5cclxuXHRcdHZhbGlkQ2xhc3NlcyArPSBib2R5Q2xhc3Nlcy5jb250YWlucyhcInRoZW1lLWxpZ2h0XCIpID8gXCIgdGhlbWUtbGlnaHQgXCIgOiBcIiB0aGVtZS1kYXJrIFwiO1xyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5zaWRlYmFyc0Fsd2F5c0NvbGxhcHNpYmxlKSB2YWxpZENsYXNzZXMgKz0gXCIgc2lkZWJhcnMtYWx3YXlzLWNvbGxhcHNpYmxlIFwiO1xyXG5cdFx0dmFsaWRDbGFzc2VzICs9IFwiIGxvYWRpbmcgXCI7XHJcblx0XHRyZXR1cm4gdmFsaWRDbGFzc2VzLnJlcGxhY2UoL1xcc1xccysvZywgJyAnKTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlR2xvYmFsc0luRXhpc3RpbmdGaWxlKHdlYnBhZ2U6IFdlYnBhZ2UpXHJcblx0e1xyXG5cdFx0Ly8gaWYgdGhlIGZpbGUgd2FzIGZyb20gYSBwcmV2aW91cyBleHBvcnQgdGhlbiByZWNoZWNrIGlmIHRoZSBnbG9iYWwgZGF0YSBoYXMgY2hhbmdlZFxyXG5cdFx0bGV0IG1vZFRpbWUgPSB3ZWJwYWdlLmV4cG9ydFBhdGhBYnNvbHV0ZS5zdGF0Py5tdGltZU1zID8/IDA7XHJcblx0XHRsZXQgdGltZVRocmVzaG9sZCA9IDEwMDAgKiA2MCAqIDU7IC8vIDUgbWludXRlc1xyXG5cdFx0aWYgKG1vZFRpbWUgJiYgKG1vZFRpbWUgPCB0aGlzLmdsb2JhbEZpbGVUcmVlVW5jaGFuZ2VkVGltZSAtIHRpbWVUaHJlc2hvbGQgfHwgbW9kVGltZSA+IHRoaXMuZ2xvYmFsRmlsZVRyZWVVbmNoYW5nZWRUaW1lICsgdGltZVRocmVzaG9sZCkpXHJcblx0XHR7XHJcblx0XHRcdHRoaXMuZ2xvYmFsRmlsZVRyZWVDaGFuZ2VkID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5nbG9iYWxHcmFwaFVuY2hhbmdlZFRpbWUgPSBtb2RUaW1lO1xyXG5cdFx0fVxyXG5cdFx0aWYgKG1vZFRpbWUgJiYgKG1vZFRpbWUgPCB0aGlzLmdsb2JhbEJvZHlDbGFzc2VzVW5jaGFuZ2VkVGltZSAtIHRpbWVUaHJlc2hvbGQgfHwgbW9kVGltZSA+IHRoaXMuZ2xvYmFsQm9keUNsYXNzZXNVbmNoYW5nZWRUaW1lICsgdGltZVRocmVzaG9sZCkpXHJcblx0XHR7XHJcblx0XHRcdHRoaXMuZ2xvYmFsQm9keUNsYXNzZXNDaGFuZ2VkID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5nbG9iYWxCb2R5Q2xhc3Nlc1VuY2hhbmdlZFRpbWUgPSBtb2RUaW1lO1xyXG5cclxuXHRcdH1cclxuXHRcdGlmIChtb2RUaW1lICYmIChtb2RUaW1lIDwgdGhpcy5nbG9iYWxHcmFwaFVuY2hhbmdlZFRpbWUgLSB0aW1lVGhyZXNob2xkIHx8IG1vZFRpbWUgPiB0aGlzLmdsb2JhbEdyYXBoVW5jaGFuZ2VkVGltZSArIHRpbWVUaHJlc2hvbGQpKVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLmdsb2JhbEdyYXBoQ2hhbmdlZCA9IHRydWU7XHJcblx0XHRcdHRoaXMuZ2xvYmFsR3JhcGhVbmNoYW5nZWRUaW1lID0gbW9kVGltZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoKCF0aGlzLmdsb2JhbEJvZHlDbGFzc2VzQ2hhbmdlZCAmJiAhdGhpcy5nbG9iYWxGaWxlVHJlZUNoYW5nZWQgJiYgIXRoaXMuZ2xvYmFsR3JhcGhDaGFuZ2VkKSB8fCAhd2VicGFnZS5kb2N1bWVudClcclxuXHRcdHtcclxuXHRcdFx0UmVuZGVyTG9nLnByb2dyZXNzKHRoaXMucHJvZ3Jlc3MsIHRoaXMuYmF0Y2hGaWxlcy5sZW5ndGgsIFwiU2tpcHBpbmcgVW5tb2RpZmllZCBGaWxlXCIsIFwiRmlsZTogXCIgKyB3ZWJwYWdlLnNvdXJjZS5wYXRoLCBcInZhcigtLWNvbG9yLXllbGxvdylcIik7XHJcblx0XHRcdGF3YWl0IFV0aWxzLmRlbGF5KDEpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHBhZ2VTdHJpbmcgPSBhd2FpdCB3ZWJwYWdlLmV4cG9ydFBhdGhBYnNvbHV0ZS5yZWFkRmlsZVN0cmluZygpO1xyXG5cdFx0aWYgKCFwYWdlU3RyaW5nKSByZXR1cm47XHJcblxyXG5cdFx0d2VicGFnZS5kb2N1bWVudC5jbG9zZSgpO1xyXG5cdFx0d2VicGFnZS5kb2N1bWVudC5vcGVuKCk7XHJcblx0XHR3ZWJwYWdlLmRvY3VtZW50LndyaXRlKHBhZ2VTdHJpbmcpO1xyXG5cclxuXHRcdGlmICh3ZWJwYWdlLmRvY3VtZW50LmhlYWQuY2hpbGRyZW4ubGVuZ3RoID09IDApXHJcblx0XHR7XHJcblx0XHRcdFJlbmRlckxvZy53YXJuaW5nKFwiQ291bGQgbm90IHVwZGF0ZSBnbG9iYWwgZGF0YSBpbiBmaWxlOiBcIiArIHdlYnBhZ2Uuc291cmNlLnBhdGggKyBcIlxcbkZpbGUgaXMgbWlzc2luZyBhIGhlYWQgZWxlbWVudFwiKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdFJlbmRlckxvZy5wcm9ncmVzcyh0aGlzLnByb2dyZXNzLCB0aGlzLmJhdGNoRmlsZXMubGVuZ3RoLCBcIlVwZGF0ZSBHbG9iYWwgRGF0YVwiLCBcIlVwZGF0aW5nIEdsb2JhbCBEYXRhOiBcIiArIHdlYnBhZ2Uuc291cmNlLnBhdGgsIFwidmFyKC0tY29sb3ItYmx1ZSlcIik7XHJcblxyXG5cdFx0aWYodGhpcy5nbG9iYWxCb2R5Q2xhc3Nlc0NoYW5nZWQpXHJcblx0XHR7XHJcblx0XHRcdGxldCBuZXdCb2R5Q2xhc3MgPSBXZWJzaXRlLmdldFZhbGlkQm9keUNsYXNzZXMoKTtcclxuXHRcdFx0aWYgKG5ld0JvZHlDbGFzcyA9PSB3ZWJwYWdlLmRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKFwiY2xhc3NcIikpIFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGhpcy5nbG9iYWxCb2R5Q2xhc3Nlc0NoYW5nZWQgPSBmYWxzZTtcclxuXHRcdFx0XHR0aGlzLmdsb2JhbEJvZHlDbGFzc2VzVW5jaGFuZ2VkVGltZSA9IG1vZFRpbWU7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHdlYnBhZ2UuZG9jdW1lbnQuYm9keS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBuZXdCb2R5Q2xhc3MpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuZ2xvYmFsRmlsZVRyZWVDaGFuZ2VkKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgZmlsZVRyZWUgPSB3ZWJwYWdlLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIudHJlZS1jb250YWluZXIuZmlsZS10cmVlXCIpO1xyXG5cdFx0XHRpZiAodGhpcy5maWxlVHJlZUh0bWwgPT0gZmlsZVRyZWU/Lm91dGVySFRNTCA/PyBcIlwiKSBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHRoaXMuZ2xvYmFsRmlsZVRyZWVDaGFuZ2VkID0gZmFsc2U7XHJcblx0XHRcdFx0dGhpcy5nbG9iYWxGaWxlVHJlZVVuY2hhbmdlZFRpbWUgPSBtb2RUaW1lO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVGaWxlVHJlZSAmJiAhZmlsZVRyZWUpIFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGV0IHRyZWVDb250YWluZXIgPSB3ZWJwYWdlLmRvY3VtZW50Py5xdWVyeVNlbGVjdG9yKFwiLnNpZGViYXItbGVmdCAuc2lkZWJhci1jb250ZW50XCIpPy5jcmVhdGVEaXYoKTtcclxuXHRcdFx0XHRpZih0cmVlQ29udGFpbmVyKSB0cmVlQ29udGFpbmVyLm91dGVySFRNTCA9IHRoaXMuZmlsZVRyZWVIdG1sO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKCFNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUZpbGVUcmVlICYmIGZpbGVUcmVlKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0ZmlsZVRyZWUucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAodGhpcy5nbG9iYWxHcmFwaENoYW5nZWQpXHJcblx0XHR7XHJcblx0XHRcdGxldCBncmFwaCA9IHdlYnBhZ2UuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5ncmFwaC12aWV3LXdyYXBwZXJcIik7XHJcblx0XHRcdGlmIChncmFwaCAmJiBNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUdyYXBoVmlldyB8fCAhZ3JhcGggJiYgIU1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3KVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGhpcy5nbG9iYWxHcmFwaENoYW5nZWQgPSBmYWxzZTtcclxuXHRcdFx0XHR0aGlzLmdsb2JhbEdyYXBoVW5jaGFuZ2VkVGltZSA9IG1vZFRpbWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUdyYXBoVmlldyAmJiAhZ3JhcGgpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgcmlnaHRTaWRlYmFyID0gd2VicGFnZS5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnNpZGViYXItcmlnaHQgLnNpZGViYXItY29udGVudFwiKSBhcyBIVE1MRWxlbWVudDtcclxuXHRcdFx0XHRpZiAocmlnaHRTaWRlYmFyKVxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGxldCBncmFwaEVsID0gR3JhcGhWaWV3LmdlbmVyYXRlR3JhcGhFbChyaWdodFNpZGViYXIpO1xyXG5cdFx0XHRcdFx0cmlnaHRTaWRlYmFyLnByZXBlbmQoZ3JhcGhFbCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKCFNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUdyYXBoVmlldyAmJiBncmFwaCkgXHJcblx0XHRcdHtcclxuXHRcdFx0XHRncmFwaC5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmKE1hcmtkb3duUmVuZGVyZXIuY2hlY2tDYW5jZWxsZWQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHQvLyB3cml0ZSB0aGUgbmV3IGh0bWwgdG8gdGhlIGZpbGVcclxuXHRcdGF3YWl0IHdlYnBhZ2UuZXhwb3J0UGF0aEFic29sdXRlLndyaXRlRmlsZShhd2FpdCB3ZWJwYWdlLmdldEhUTUwoKSk7XHJcblxyXG5cdFx0d2VicGFnZS5kb2N1bWVudC5jbG9zZSgpO1xyXG5cclxuXHRcdGRlbGV0ZSB3ZWJwYWdlLmRvY3VtZW50O1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBhc3luYyBjaGVja0luY3JlbWVudGFsRXhwb3J0KHdlYnBhZ2U6IFdlYnBhZ2UpOiBQcm9taXNlPGJvb2xlYW4+XHJcblx0e1x0XHRcclxuXHRcdGlmKE1hcmtkb3duUmVuZGVyZXIuY2hlY2tDYW5jZWxsZWQoKSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdGlmICghTWFpblNldHRpbmdzLnNldHRpbmdzLmluY3JlbWVudGFsRXhwb3J0IHx8IHdlYnBhZ2UuaXNGaWxlTW9kaWZpZWQpIC8vIGRvbid0IHNraXAgdGhlIGZpbGUgaWYgaXQncyBtb2RpZmllZFxyXG5cdFx0e1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYgKHdlYnBhZ2UuaXNDb252ZXJ0YWJsZSkgLy8gU2tpcCB0aGUgZmlsZSBpZiBpdCdzIHVuY2hhbmdlZCBzaW5jZSBsYXN0IGV4cG9ydFxyXG5cdFx0e1xyXG5cdFx0XHQvLyBpZiBmaWxlIHdhcyBub3QgbW9kaWZpZWQgdGhlbiBjb3B5IG92ZXIgYW55IGdsb2JhbCBjaGFuZ2VzIHRvIHRoZSBodG1sIGZpbGVcclxuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVHbG9iYWxzSW5FeGlzdGluZ0ZpbGUod2VicGFnZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0cHVibGljIGFzeW5jIGNyZWF0ZVdpdGhGaWxlcyhmaWxlczogVEZpbGVbXSwgZGVzdGluYXRpb246IFBhdGgpOiBQcm9taXNlPFdlYnNpdGUgfCB1bmRlZmluZWQ+XHJcblx0e1xyXG5cdFx0dGhpcy5iYXRjaEZpbGVzID0gZmlsZXM7XHJcblx0XHR0aGlzLmRlc3RpbmF0aW9uID0gZGVzdGluYXRpb247XHJcblxyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3KVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgY29udmVydGFibGVGaWxlcyA9IHRoaXMuYmF0Y2hGaWxlcy5maWx0ZXIoKGZpbGUpID0+IE1hcmtkb3duUmVuZGVyZXIuaXNDb252ZXJ0YWJsZShmaWxlLmV4dGVuc2lvbikpO1xyXG5cdFx0XHRXZWJzaXRlLmdsb2JhbEdyYXBoID0gbmV3IEdyYXBoVmlldyhjb252ZXJ0YWJsZUZpbGVzLCBNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhNaW5Ob2RlU2l6ZSwgTWFpblNldHRpbmdzLnNldHRpbmdzLmdyYXBoTWF4Tm9kZVNpemUpO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVGaWxlVHJlZSlcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5maWxlVHJlZSA9IG5ldyBGaWxlVHJlZSh0aGlzLmJhdGNoRmlsZXMsIGZhbHNlLCB0cnVlKTtcclxuXHRcdFx0dGhpcy5maWxlVHJlZS5tYWtlTGlua3NXZWJTdHlsZSA9IE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZTtcclxuXHRcdFx0dGhpcy5maWxlVHJlZS5zaG93TmVzdGluZ0luZGljYXRvciA9IHRydWU7XHJcblx0XHRcdHRoaXMuZmlsZVRyZWUuZ2VuZXJhdGVXaXRoSXRlbXNDbG9zZWQgPSB0cnVlO1xyXG5cdFx0XHR0aGlzLmZpbGVUcmVlLnRpdGxlID0gYXBwLnZhdWx0LmdldE5hbWUoKTtcclxuXHRcdFx0dGhpcy5maWxlVHJlZS5jbGFzcyA9IFwiZmlsZS10cmVlXCI7XHJcblxyXG5cdFx0XHRsZXQgdGVtcFRyZWVDb250YWluZXIgPSBkb2N1bWVudC5ib2R5LmNyZWF0ZURpdigpO1xyXG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVUcmVlLmdlbmVyYXRlVHJlZVdpdGhDb250YWluZXIodGVtcFRyZWVDb250YWluZXIpO1xyXG5cdFx0XHR0aGlzLmZpbGVUcmVlSHRtbCA9IHRlbXBUcmVlQ29udGFpbmVyLmlubmVySFRNTDtcclxuXHRcdFx0dGVtcFRyZWVDb250YWluZXIucmVtb3ZlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0YXdhaXQgQXNzZXRIYW5kbGVyLnVwZGF0ZUFzc2V0Q2FjaGUoKTtcclxuXHRcdGF3YWl0IE1hcmtkb3duUmVuZGVyZXIuYmVnaW5CYXRjaCgpO1xyXG5cclxuXHRcdFJlbmRlckxvZy5wcm9ncmVzcygwLCBmaWxlcy5sZW5ndGgsIFwiR2VuZXJhdGluZyBIVE1MXCIsIFwiLi4uXCIsIFwidmFyKC0tY29sb3ItYWNjZW50KVwiKTtcclxuXHJcblx0XHR0aGlzLnByb2dyZXNzID0gMDtcclxuXHJcblx0XHRmb3IgKGxldCBmaWxlIG9mIGZpbGVzKVxyXG5cdFx0e1x0XHRcdFxyXG5cdFx0XHRpZihNYXJrZG93blJlbmRlcmVyLmNoZWNrQ2FuY2VsbGVkKCkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdFx0XHR0aGlzLnByb2dyZXNzKys7XHJcblxyXG5cdFx0XHR0cnlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBmaWxlbmFtZSA9IG5ldyBQYXRoKGZpbGUucGF0aCkuYmFzZW5hbWU7XHJcblx0XHRcdFx0bGV0IHdlYnBhZ2UgPSBuZXcgV2VicGFnZShmaWxlLCB0aGlzLCBkZXN0aW5hdGlvbiwgdGhpcy5iYXRjaEZpbGVzLmxlbmd0aCA+IDEsIGZpbGVuYW1lLCBNYWluU2V0dGluZ3MuaXNBbGxJbmxpbmUoKSk7XHJcblxyXG5cdFx0XHRcdGlmIChhd2FpdCB0aGlzLmNoZWNrSW5jcmVtZW50YWxFeHBvcnQod2VicGFnZSkpIC8vIFNraXAgY3JlYXRpbmcgdGhlIHdlYnBhZ2UgaWYgaXQncyB1bmNoYW5nZWQgc2luY2UgbGFzdCBleHBvcnRcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRSZW5kZXJMb2cucHJvZ3Jlc3ModGhpcy5wcm9ncmVzcywgdGhpcy5iYXRjaEZpbGVzLmxlbmd0aCwgXCJHZW5lcmF0aW5nIEhUTUxcIiwgXCJFeHBvcnRpbmc6IFwiICsgZmlsZS5wYXRoLCBcInZhcigtLWNvbG9yLWFjY2VudClcIik7XHJcblx0XHRcdFx0XHRpZiAoIXdlYnBhZ2UuaXNDb252ZXJ0YWJsZSkgd2VicGFnZS5kb3dubG9hZHMucHVzaChhd2FpdCB3ZWJwYWdlLmdldFNlbGZEb3dubG9hZGFibGUoKSk7XHJcblx0XHRcdFx0XHRsZXQgY3JlYXRlZFBhZ2UgPSBhd2FpdCB3ZWJwYWdlLmNyZWF0ZSgpO1xyXG5cdFx0XHRcdFx0aWYoIWNyZWF0ZWRQYWdlKSBcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0aWYgKE1hcmtkb3duUmVuZGVyZXIuY2FuY2VsbGVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0aGlzLndlYnBhZ2VzLnB1c2god2VicGFnZSk7XHJcblx0XHRcdFx0dGhpcy5kZXBlbmRlbmNpZXMucHVzaCguLi53ZWJwYWdlLmRlcGVuZGVuY2llcyk7XHJcblx0XHRcdFx0dGhpcy5kb3dubG9hZHMucHVzaCguLi53ZWJwYWdlLmRvd25sb2Fkcyk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2F0Y2ggKGUpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRSZW5kZXJMb2cuZXJyb3IoZSwgXCJDb3VsZCBub3QgZXhwb3J0IGZpbGU6IFwiICsgZmlsZS5uYW1lKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYoTWFya2Rvd25SZW5kZXJlci5jaGVja0NhbmNlbGxlZCgpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHJlbW92ZSBkdXBsaWNhdGVzIGZyb20gdGhlIGRlcGVuZGVuY2llcyBhbmQgZG93bmxvYWRzXHJcblx0XHR0aGlzLmRlcGVuZGVuY2llcyA9IHRoaXMuZGVwZW5kZW5jaWVzLmZpbHRlcigoZmlsZSwgaW5kZXgpID0+IHRoaXMuZGVwZW5kZW5jaWVzLmZpbmRJbmRleCgoZikgPT4gZi5yZWxhdGl2ZURvd25sb2FkUGF0aCA9PSBmaWxlLnJlbGF0aXZlRG93bmxvYWRQYXRoICYmIGYuZmlsZW5hbWUgPT09IGZpbGUuZmlsZW5hbWUpID09IGluZGV4KTtcclxuXHRcdHRoaXMuZG93bmxvYWRzID0gdGhpcy5kb3dubG9hZHMuZmlsdGVyKChmaWxlLCBpbmRleCkgPT4gdGhpcy5kb3dubG9hZHMuZmluZEluZGV4KChmKSA9PiBmLnJlbGF0aXZlRG93bmxvYWRQYXRoID09IGZpbGUucmVsYXRpdmVEb3dubG9hZFBhdGggJiYgZi5maWxlbmFtZSA9PT0gZmlsZS5maWxlbmFtZSkgPT0gaW5kZXgpO1xyXG5cclxuXHRcdHRoaXMuY3JlYXRlZCA9IHRydWU7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHQvLyBzYXZlcyBhIC5qc29uIGZpbGUgd2l0aCBhbGwgdGhlIGRhdGEgbmVlZGVkIHRvIHJlY3JlYXRlIHRoZSB3ZWJzaXRlXHJcblx0cHVibGljIGFzeW5jIHNhdmVBc0RhdGFiYXNlKClcclxuXHR7XHJcblx0XHRpZiAoIXRoaXMuY3JlYXRlZCkgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IHNhdmUgd2Vic2l0ZSBkYXRhYmFzZSBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgd2Vic2l0ZS5cIik7XHJcblxyXG5cdFx0Ly8gZGF0YSBpcyBhIGRpY3Rpb25hcnkgbWFwcGluZyBhIGZpbGUgcGF0aCB0byBmaWxlIGRhdGFcclxuXHRcdGxldCBkYXRhOiB7IFtwYXRoOiBzdHJpbmddIDogc3RyaW5nOyB9ID0ge307XHJcblx0XHRcclxuXHRcdGZvciAobGV0IHdlYnBhZ2Ugb2YgdGhpcy53ZWJwYWdlcylcclxuXHRcdHtcclxuXHRcdFx0bGV0IHdlYnBhZ2VEYXRhOiBzdHJpbmcgPSBhd2FpdCB3ZWJwYWdlLmdldEhUTUwoKTtcclxuXHRcdFx0bGV0IHBhdGggPSBlbmNvZGVVUkkod2VicGFnZS5leHBvcnRQYXRoLmNvcHkubWFrZVVuaXhTdHlsZSgpLmFzU3RyaW5nKTtcclxuXHRcdFx0ZGF0YVtwYXRoXSA9IHdlYnBhZ2VEYXRhO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAobGV0IGZpbGUgb2YgdGhpcy5kZXBlbmRlbmNpZXMpXHJcblx0XHR7XHJcblx0XHRcdGxldCBmaWxlRGF0YTogc3RyaW5nIHwgQnVmZmVyID0gZmlsZS5jb250ZW50O1xyXG5cdFx0XHRpZiAoZmlsZURhdGEgaW5zdGFuY2VvZiBCdWZmZXIpIGZpbGVEYXRhID0gZmlsZURhdGEudG9TdHJpbmcoXCJiYXNlNjRcIik7XHJcblx0XHRcdGxldCBwYXRoID0gZW5jb2RlVVJJKGZpbGUucmVsYXRpdmVEb3dubG9hZFBhdGguam9pblN0cmluZyhmaWxlLmZpbGVuYW1lKS5tYWtlVW5peFN0eWxlKCkuYXNTdHJpbmcpO1xyXG5cclxuXHRcdFx0aWYoZmlsZURhdGEgPT0gXCJcIilcclxuXHRcdFx0e1xyXG5cdFx0XHRcdFJlbmRlckxvZy5sb2coZmlsZS5jb250ZW50KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGF0YVtwYXRoXSA9IGZpbGVEYXRhO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBqc29uID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcblx0XHRsZXQgZGF0YWJhc2VQYXRoID0gdGhpcy5kZXN0aW5hdGlvbi5kaXJlY3Rvcnkuam9pblN0cmluZyhcImRhdGFiYXNlLmpzb25cIik7XHJcblx0XHRhd2FpdCBkYXRhYmFzZVBhdGgud3JpdGVGaWxlKGpzb24pO1xyXG5cdH1cclxuXHJcbn1cclxuIl19