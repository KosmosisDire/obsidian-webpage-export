var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var WebsiteNamespace;
(function (WebsiteNamespace) {
    let DocumentType;
    (function (DocumentType) {
        DocumentType[DocumentType["Markdown"] = 0] = "Markdown";
        DocumentType[DocumentType["Canvas"] = 1] = "Canvas";
        DocumentType[DocumentType["Embed"] = 2] = "Embed";
        DocumentType[DocumentType["Excalidraw"] = 3] = "Excalidraw";
        DocumentType[DocumentType["Kanban"] = 4] = "Kanban";
        DocumentType[DocumentType["Other"] = 5] = "Other";
    })(DocumentType || (DocumentType = {}));
    class Website {
        static init() {
            return __awaiter(this, void 0, void 0, function* () {
                window.addEventListener("load", () => Website.onInit());
                this.websiteData = yield this.loadWebsiteData();
            });
        }
        static onInit() {
            return __awaiter(this, void 0, void 0, function* () {
                if (window.location.protocol != "file:") {
                    // @ts-ignore
                    yield loadIncludes(); // defined in deferred.js
                }
                this.bodyEl = document.body;
                this.websiteEl = document.querySelector(".website-container");
                this.documentEl = document.querySelector(".document-container");
                let fileTreeEl = document.querySelector(".nav-files-container");
                let outlineTreeEl = document.querySelector(".outline-tree");
                let leftSidebarEl = document.querySelector(".sidebar.sidebar-left");
                let rightSidebarEl = document.querySelector(".sidebar.sidebar-right");
                if (fileTreeEl)
                    this.fileTree = new Tree(fileTreeEl);
                if (outlineTreeEl)
                    this.outlineTree = new Tree(outlineTreeEl);
                if (leftSidebarEl)
                    this.leftSidebar = new Sidebar(leftSidebarEl);
                if (rightSidebarEl)
                    this.rightSidebar = new Sidebar(rightSidebarEl);
                this.loadedWebpage = new WebpageDocument(this.documentEl, DocumentType.Markdown);
                this.isLoaded = true;
                console.log("loaded");
                // @ts-ignore
                window.Website = Website;
            });
        }
        static loadWebsiteData() {
            return __awaiter(this, void 0, void 0, function* () {
                if (window.location.protocol != "file:") {
                    try {
                        let dataReq = yield fetch("lib/metadata.json");
                        if (dataReq.ok) {
                            return yield dataReq.json();
                        }
                        else {
                            console.log("Failed to load website metadata.");
                        }
                    }
                    catch (e) {
                        console.log("Failed to load website metadata.", e);
                    }
                }
                return undefined;
            });
        }
    }
    Website.isLoaded = false;
    Website.websiteData = undefined;
    Website.fileTree = undefined;
    Website.outlineTree = undefined;
    Website.leftSidebar = undefined;
    Website.rightSidebar = undefined;
    Website.init();
    class Header {
    }
    class Tree {
        get allCollapsed() { return this._allCollapsed; }
        set allCollapsed(value) {
            this._allCollapsed = value;
            this.children.forEach((child) => {
                child.allCollapsed = value;
            });
        }
        constructor(container) {
            this.wrapperEl = container.classList.contains("tree-container") ? container : container.querySelector(".tree-container");
            if (this.wrapperEl == null)
                throw new Error("Invalid tree container");
            this.rootEl = this.wrapperEl.querySelector(".mod-root");
            this.titleEl = this.wrapperEl.querySelector(".mod-root > .nav-folder-title > .nav-folder-title-content");
            this.childrenEl = this.wrapperEl.querySelector(".mod-root > .nav-folder-children");
            this.collapseAllEl = this.wrapperEl.querySelector(".tree-collapse-all");
            this.children = [];
            let childItems = Array.from(this.childrenEl.children).filter((el) => el.classList.contains("tree-item"));
            childItems.forEach((child) => {
                this.children.push(new TreeItem(child, this));
            });
            this.collapseAllEl.addEventListener("click", () => {
                this.allCollapsed = !this.allCollapsed;
            });
        }
    }
    class TreeItem {
        get isFolder() { return this._isFolder; }
        get isLink() { return this._isLink; }
        get collapsable() { return this._isCollapsible; }
        get collapsed() { return this._collapsed; }
        set collapsed(collapse) {
            var _a;
            // open parents if we are opening this one and it is hidden
            if (!collapse && this.parent instanceof TreeItem && this.parent.collapsed) {
                this.parent.collapsed = false;
            }
            this._collapsed = collapse;
            this.itemEl.classList.toggle("is-collapsed", collapse);
            (_a = this.collapseIconEl) === null || _a === void 0 ? void 0 : _a.classList.toggle("is-collapsed", collapse);
            this.childrenEl.style.display = collapse ? "none" : "";
        }
        get allCollapsed() { return this._allCollapsed; }
        set allCollapsed(collapse) {
            this.collapsed = collapse;
            this._allCollapsed = collapse;
            this.children.forEach((child) => {
                child.collapsed = collapse;
            });
        }
        constructor(itemEl, parent) {
            var _a;
            this.itemEl = itemEl;
            this.selfEl = itemEl.querySelector(".tree-item-self");
            this.collapseIconEl = itemEl.querySelector(".collapse-icon");
            this.innerEl = itemEl.querySelector(".tree-item-inner");
            this.childrenEl = itemEl.querySelector(".tree-item-children");
            this.parent = parent;
            this.children = [];
            let childItems = Array.from(this.childrenEl.children).filter((el) => el.classList.contains("tree-item"));
            childItems.forEach((child) => {
                this.children.push(new TreeItem(child, this));
            });
            this._isFolder = this.itemEl.classList.contains("nav-folder");
            this._isLink = this.selfEl.tagName == "A";
            this._isCollapsible = this.itemEl.classList.contains("mod-collapsible");
            this.collapsed = this.itemEl.classList.contains("is-collapsed");
            if (this._isCollapsible) {
                let clickItem = this.isLink ? (_a = this.collapseIconEl) !== null && _a !== void 0 ? _a : this.selfEl : this.selfEl;
                clickItem.addEventListener("click", () => {
                    this.collapsed = !this.collapsed;
                });
            }
        }
    }
    class Canvas {
        centerView() { }
    }
    class Sidebar {
        get sidebarID() { return this._sidebarID; }
        get isLeft() { return this._isLeft; }
        get resizing() { return this._resizing; }
        get collapsed() { return this._collapsed; }
        set collapsed(collapse) {
            this._collapsed = collapse;
            if (!collapse && document.body.classList.contains("floating-sidebars")) {
                document.body.addEventListener("click", this.clickOutsideCollapse);
            }
            if (collapse)
                document.body.removeEventListener("click", this.clickOutsideCollapse);
            this.containerEl.classList.toggle("is-collapsed", collapse);
        }
        constructor(container) {
            if (!container.classList.contains("sidebar"))
                throw new Error("Invalid sidebar container");
            this.containerEl = container;
            this.contentEl = container.querySelector(".sidebar-content");
            this.topbarEl = container.querySelector(".sidebar-topbar");
            this.collapseEl = container.querySelector(".sidebar-collapse-icon");
            this.topbarContentEl = container.querySelector(".topbar-content");
            this.resizeHandleEl = container.querySelector(".sidebar-handle");
            this._isLeft = container.classList.contains("sidebar-left");
            this._sidebarID = container.classList.contains("sidebar-left") ? "sidebar-left" : "sidebar-right";
            this.collapseEl.addEventListener("click", () => {
                this.collapsed = !this.collapsed;
            });
            this.setupSidebarResize();
        }
        setupSidebarResize() {
            if (!this.resizeHandleEl)
                return;
            let minWidthEm = 15;
            let minResizeWidth = parseFloat(getComputedStyle(this.resizeHandleEl.parentElement).fontSize) * minWidthEm;
            let collapseWidth = minResizeWidth / 4.0;
            let savedWidth = localStorage.getItem(`${this.sidebarID}-width`);
            if (savedWidth)
                this.containerEl.style.setProperty('--sidebar-width', savedWidth);
            let localThis = this;
            function resizeMove(e) {
                if (!localThis.resizing)
                    return;
                var distance = localThis.isLeft ? e.clientX : window.innerWidth - e.clientX;
                var newWidth = `min(max(${distance}px, ${minWidthEm}em), 40vw)`;
                if (distance < collapseWidth) {
                    localThis.collapsed = true;
                    localThis.containerEl.style.removeProperty('transition-duration');
                }
                else {
                    localThis.collapsed = false;
                    localThis.containerEl.style.setProperty('--sidebar-width', newWidth);
                    if (distance > minResizeWidth)
                        localThis.containerEl.style.transitionDuration = "0s";
                }
            }
            function handleClick(e) {
                localThis._resizing = true;
                localThis.containerEl.classList.add('is-resizing');
                document.addEventListener('pointermove', resizeMove);
                document.addEventListener('pointerup', function () {
                    document.removeEventListener('pointermove', resizeMove);
                    const finalWidth = getComputedStyle(localThis.containerEl).getPropertyValue('--sidebar-width');
                    localStorage.setItem(`${localThis.sidebarID}-width`, finalWidth);
                    localThis.containerEl.classList.remove('is-resizing');
                    localThis.containerEl.style.removeProperty('transition-duration');
                });
            }
            this.resizeHandleEl.addEventListener('pointerdown', handleClick);
            // reset sidebar width on double click
            function resetSidebarEvent(e) {
                localThis.containerEl.style.removeProperty('transition-duration');
                localThis.containerEl.style.removeProperty('--sidebar-width');
                localStorage.removeItem(`${localThis.sidebarID}-width`);
            }
            this.resizeHandleEl.addEventListener('dblclick', resetSidebarEvent);
        }
        clickOutsideCollapse(event) {
            // don't allow bubbling into sidebar
            if (event.target.closest(".sidebar"))
                return;
            this.collapsed = true;
        }
    }
    class LinkHandler {
        static initializeLinks(onElement) {
        }
    }
    class GraphView {
        centerView() { }
        setNodes() { }
    }
    class WebpageDocument {
        constructor(documentContainerEl, documentType) {
            console.log(documentContainerEl);
            if (!documentContainerEl.classList.contains("document-container"))
                throw new Error("Invalid document container");
            this.documentContainerEl = documentContainerEl;
            this.documentType = documentType;
            this.headers = [];
            setTimeout(() => this.documentContainerEl.classList.remove("hide"));
        }
    }
})(WebsiteNamespace || (WebsiteNamespace = {}));
// temp
function setActiveDocument(url, showInTree, changeURL, animate = true) {
    console.log("setActiveDocument", url, showInTree, changeURL, animate);
}
function getPointerPosition(event) {
    let touches = event.touches ? Array.from(event.touches) : [];
    let x = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientX, 0) / event.touches.length) : event.clientX;
    let y = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientY, 0) / event.touches.length) : event.clientY;
    return { x: x, y: y };
}
//# sourceMappingURL=webpage.js.map