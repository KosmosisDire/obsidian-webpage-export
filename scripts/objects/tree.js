import { __awaiter } from "tslib";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
import { Path } from "scripts/utils/path";
export class Tree {
    constructor() {
        this.children = [];
        this.minCollapsableDepth = 1;
        this.title = "Tree";
        this.class = "mod-tree-none";
        this.showNestingIndicator = true;
        this.minDepth = 1;
        this.generateWithItemsClosed = false;
        this.makeLinksWebStyle = false;
        this.renderMarkdownTitles = true;
        this.container = undefined;
    }
    buildTreeRecursive(tree, container, minDepth = 1, closeAllItems = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let treeItem = yield tree.generateItemHTML(container, closeAllItems);
            if (!tree.childContainer)
                return;
            for (let item of tree.children) {
                if (item.depth < minDepth)
                    continue;
                yield this.buildTreeRecursive(item, tree.childContainer, minDepth, closeAllItems);
            }
        });
    }
    //**Generate the raw tree with no extra containers or buttons*/
    generateTree(container) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let item of this.children) {
                yield this.buildTreeRecursive(item, container, this.minDepth, this.generateWithItemsClosed);
            }
            this.forAllChildren((child) => {
                if (child.isCollapsed)
                    child.setCollapse(true, false);
            });
        });
    }
    //**Generate a tree with a title and full tree collapse button*/
    generateTreeWithContainer(container) {
        return __awaiter(this, void 0, void 0, function* () {
            /*
            - div.tree-container
                - div.tree-header
                    - span.sidebar-section-header
                    - button.collapse-tree-button
                        - svg
                - div.tree-scroll-area
                    - div.tree-item
                        - div.tree-item-contents
                            - div.tree-item-icon
                                - svg
                            - a.internal-link
                                - span.tree-item-title
                        - div.tree-item-children
            */
            this.container = container;
            let treeContainerEl = container.createDiv();
            let treeHeaderEl = container.createDiv();
            let sectionHeaderEl = container.createEl('span');
            let collapseAllEl = container.createEl('button');
            let treeScrollAreaEl = container.createDiv();
            treeContainerEl.classList.add('tree-container', this.class);
            treeHeaderEl.classList.add("tree-header");
            sectionHeaderEl.classList.add("sidebar-section-header");
            collapseAllEl.classList.add("clickable-icon", "collapse-tree-button");
            collapseAllEl.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></svg>";
            treeScrollAreaEl.classList.add("tree-scroll-area");
            if (this.generateWithItemsClosed)
                collapseAllEl.classList.add("is-collapsed");
            if (this.showNestingIndicator)
                treeContainerEl.classList.add("mod-nav-indicator");
            treeContainerEl.setAttribute("data-depth", "0");
            sectionHeaderEl.innerText = this.title;
            treeContainerEl.appendChild(treeHeaderEl);
            treeContainerEl.appendChild(treeScrollAreaEl);
            treeHeaderEl.appendChild(sectionHeaderEl);
            treeHeaderEl.appendChild(collapseAllEl);
            yield this.generateTree(treeScrollAreaEl);
        });
    }
    sortAlphabetically(reverse = false) {
        this.children.sort((a, b) => reverse ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title));
        for (let child of this.children) {
            child.sortAlphabetically();
        }
    }
    forAllChildren(func, recursive = true) {
        for (let child of this.children) {
            func(child);
            if (recursive)
                child.forAllChildren(func);
        }
    }
}
export class TreeItem {
    constructor(tree, parent, depth) {
        this.children = [];
        this.depth = 0;
        this.itemClass = "";
        this.title = "";
        this.href = undefined;
        this.minCollapsableDepth = 1;
        this.isCollapsed = false;
        this.childContainer = undefined;
        this.itemEl = undefined;
        this.tree = tree;
        this.parent = parent;
        this.depth = depth;
    }
    generateItemHTML(container, startClosed = true) {
        return __awaiter(this, void 0, void 0, function* () {
            /*
            - div.tree-item-wrapper
                - div.tree-item-contents
                    - a.internal-link.tree-item-link
                        - div.tree-item-icon
                            - svg
                        - span.tree-item-title
                - div.tree-item-children
            */
            this.itemEl = this.createItemWrapper(container);
            let itemContentsEl = this.createItemContents(this.itemEl);
            let itemLinkEl = this.createItemLink(itemContentsEl);
            if (this.isCollapsible()) {
                this.createItemIcon(itemLinkEl);
                if (startClosed) {
                    this.itemEl.classList.add("is-collapsed");
                    this.isCollapsed = true;
                }
            }
            yield this.createItemTitle(itemLinkEl);
            this.createItemChildren(this.itemEl);
            return this.itemEl;
        });
    }
    forAllChildren(func, recursive = true) {
        for (let child of this.children) {
            func(child);
            if (recursive)
                child.forAllChildren(func);
        }
    }
    setCollapse(collapsed, animate = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isCollapsible())
                return;
            if (!this.itemEl || !this.itemEl.classList.contains("mod-collapsible"))
                return;
            let children = this.itemEl.querySelector(".tree-item-children");
            if (children == null)
                return;
            if (collapsed) {
                this.itemEl.classList.add("is-collapsed");
                if (animate)
                    this.slideUp(children, 100);
                else
                    children.style.display = "none";
            }
            else {
                this.itemEl.classList.remove("is-collapsed");
                if (animate)
                    this.slideDown(children, 100);
                else
                    children.style.removeProperty("display");
            }
            this.isCollapsed = collapsed;
        });
    }
    toggleCollapse() {
        if (!this.itemEl)
            return;
        this.setCollapse(!this.itemEl.classList.contains("is-collapsed"));
    }
    sortAlphabetically(reverse = false) {
        this.children.sort((a, b) => reverse ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title));
        for (let child of this.children) {
            child.sortAlphabetically();
        }
    }
    isCollapsible() {
        return this.children.length != 0 && this.depth >= this.minCollapsableDepth;
    }
    createItemWrapper(container) {
        let itemEl = container.createDiv();
        itemEl.classList.add("tree-item");
        if (this.itemClass.trim() != "")
            itemEl.classList.add(this.itemClass);
        itemEl.setAttribute("data-depth", this.depth.toString());
        if (this.isCollapsible())
            itemEl.classList.add("mod-collapsible");
        return itemEl;
    }
    createItemContents(container) {
        let itemContentsEl = container.createDiv("tree-item-contents");
        return itemContentsEl;
    }
    createItemLink(container) {
        if (this.tree.makeLinksWebStyle && this.href)
            this.href = Path.toWebStyle(this.href);
        let itemLinkEl = container.createEl("a", { cls: "internal-link tree-item-link" });
        if (this.href)
            itemLinkEl.setAttribute("href", this.href);
        return itemLinkEl;
    }
    createItemIcon(container) {
        const arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
        let itemIconEl = container.createDiv("tree-item-icon collapse-icon");
        itemIconEl.innerHTML = arrowIcon;
        return itemIconEl;
    }
    createItemTitle(container) {
        return __awaiter(this, void 0, void 0, function* () {
            let titleEl = container.createEl("span", { cls: "tree-item-title" });
            if (this.tree.renderMarkdownTitles)
                MarkdownRenderer.renderSingleLineMarkdown(this.title, titleEl);
            else
                titleEl.innerText = this.title;
            return titleEl;
        });
    }
    createItemChildren(container) {
        this.childContainer = container.createDiv("tree-item-children");
        return this.childContainer;
    }
    slideUp(target, duration = 500) {
        target.style.transitionProperty = 'height, margin, padding';
        target.style.transitionDuration = duration + 'ms';
        target.style.boxSizing = 'border-box';
        target.style.height = target.offsetHeight + 'px';
        target.offsetHeight;
        target.style.overflow = 'hidden';
        target.style.height = "0";
        target.style.paddingTop = "0";
        target.style.paddingBottom = "0";
        target.style.marginTop = "0";
        target.style.marginBottom = "0";
        window.setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            target.style.display = 'none';
            target.style.removeProperty('height');
            target.style.removeProperty('padding-top');
            target.style.removeProperty('padding-bottom');
            target.style.removeProperty('margin-top');
            target.style.removeProperty('margin-bottom');
            target.style.removeProperty('overflow');
            target.style.removeProperty('transition-duration');
            target.style.removeProperty('transition-property');
        }), duration);
    }
    slideDown(target, duration = 500) {
        target.style.removeProperty('display');
        let display = window.getComputedStyle(target).display;
        if (display === 'none')
            display = 'block';
        target.style.display = display;
        let height = target.offsetHeight;
        target.style.overflow = 'hidden';
        target.style.height = "0";
        target.style.paddingTop = "0";
        target.style.paddingBottom = "0";
        target.style.marginTop = "0";
        target.style.marginBottom = "0";
        target.offsetHeight;
        target.style.boxSizing = 'border-box';
        target.style.transitionProperty = "height, margin, padding";
        target.style.transitionDuration = duration + 'ms';
        target.style.height = height + 'px';
        target.style.removeProperty('padding-top');
        target.style.removeProperty('padding-bottom');
        target.style.removeProperty('margin-top');
        target.style.removeProperty('margin-bottom');
        window.setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            target.style.removeProperty('height');
            target.style.removeProperty('overflow');
            target.style.removeProperty('transition-duration');
            target.style.removeProperty('transition-property');
        }), duration);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRyZWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUUxQyxNQUFNLE9BQU8sSUFBSTtJQUFqQjtRQUVRLGFBQVEsR0FBZSxFQUFFLENBQUM7UUFDMUIsd0JBQW1CLEdBQVcsQ0FBQyxDQUFDO1FBQ2hDLFVBQUssR0FBVyxNQUFNLENBQUM7UUFDdkIsVUFBSyxHQUFXLGVBQWUsQ0FBQztRQUNoQyx5QkFBb0IsR0FBRyxJQUFJLENBQUM7UUFDNUIsYUFBUSxHQUFXLENBQUMsQ0FBQztRQUNyQiw0QkFBdUIsR0FBWSxLQUFLLENBQUM7UUFDekMsc0JBQWlCLEdBQVksS0FBSyxDQUFDO1FBQ25DLHlCQUFvQixHQUFZLElBQUksQ0FBQztRQUNyQyxjQUFTLEdBQTRCLFNBQVMsQ0FBQztJQThGdkQsQ0FBQztJQTVGZ0Isa0JBQWtCLENBQUMsSUFBYyxFQUFFLFNBQXNCLEVBQUUsV0FBa0IsQ0FBQyxFQUFFLGdCQUF5QixLQUFLOztZQUU3SCxJQUFJLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFFckUsSUFBRyxDQUFDLElBQUksQ0FBQyxjQUFjO2dCQUFFLE9BQU87WUFFaEMsS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxFQUM5QjtnQkFDQyxJQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUTtvQkFBRSxTQUFTO2dCQUNuQyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUM7YUFDbEY7UUFDRixDQUFDO0tBQUE7SUFFRCwrREFBK0Q7SUFDbEQsWUFBWSxD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TUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFTLEVBQUU7WUFDNUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUNuRCxNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3BELENBQUMsQ0FBQSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2QsQ0FBQztDQUNEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vbWFya2Rvd24tcmVuZGVyZXJcIjtcclxuaW1wb3J0IHsgUGF0aCB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL3BhdGhcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBUcmVlXHJcbntcclxuXHRwdWJsaWMgY2hpbGRyZW46IFRyZWVJdGVtW10gPSBbXTtcclxuXHRwdWJsaWMgbWluQ29sbGFwc2FibGVEZXB0aDogbnVtYmVyID0gMTtcclxuXHRwdWJsaWMgdGl0bGU6IHN0cmluZyA9IFwiVHJlZVwiO1xyXG5cdHB1YmxpYyBjbGFzczogc3RyaW5nID0gXCJtb2QtdHJlZS1ub25lXCI7XHJcblx0cHVibGljIHNob3dOZXN0aW5nSW5kaWNhdG9yID0gdHJ1ZTtcclxuXHRwdWJsaWMgbWluRGVwdGg6IG51bWJlciA9IDE7IFxyXG5cdHB1YmxpYyBnZW5lcmF0ZVdpdGhJdGVtc0Nsb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdHB1YmxpYyBtYWtlTGlua3NXZWJTdHlsZTogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdHB1YmxpYyByZW5kZXJNYXJrZG93blRpdGxlczogYm9vbGVhbiA9IHRydWU7XHJcblx0cHVibGljIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblxyXG5cdHByb3RlY3RlZCBhc3luYyBidWlsZFRyZWVSZWN1cnNpdmUodHJlZTogVHJlZUl0ZW0sIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG1pbkRlcHRoOm51bWJlciA9IDEsIGNsb3NlQWxsSXRlbXM6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8dm9pZD5cclxuXHR7XHJcblx0XHRsZXQgdHJlZUl0ZW0gPSBhd2FpdCB0cmVlLmdlbmVyYXRlSXRlbUhUTUwoY29udGFpbmVyLCBjbG9zZUFsbEl0ZW1zKTtcclxuXHJcblx0XHRpZighdHJlZS5jaGlsZENvbnRhaW5lcikgcmV0dXJuO1xyXG5cclxuXHRcdGZvciAobGV0IGl0ZW0gb2YgdHJlZS5jaGlsZHJlbilcclxuXHRcdHtcclxuXHRcdFx0aWYoaXRlbS5kZXB0aCA8IG1pbkRlcHRoKSBjb250aW51ZTtcclxuXHRcdFx0YXdhaXQgdGhpcy5idWlsZFRyZWVSZWN1cnNpdmUoaXRlbSwgdHJlZS5jaGlsZENvbnRhaW5lciwgbWluRGVwdGgsIGNsb3NlQWxsSXRlbXMpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8qKkdlbmVyYXRlIHRoZSByYXcgdHJlZSB3aXRoIG5vIGV4dHJhIGNvbnRhaW5lcnMgb3IgYnV0dG9ucyovXHJcblx0cHVibGljIGFzeW5jIGdlbmVyYXRlVHJlZShjb250YWluZXI6IEhUTUxFbGVtZW50KVxyXG5cdHtcclxuXHRcdGZvciAobGV0IGl0ZW0gb2YgdGhpcy5jaGlsZHJlbilcclxuXHRcdHtcclxuXHRcdFx0YXdhaXQgdGhpcy5idWlsZFRyZWVSZWN1cnNpdmUoaXRlbSwgY29udGFpbmVyLCB0aGlzLm1pbkRlcHRoLCB0aGlzLmdlbmVyYXRlV2l0aEl0ZW1zQ2xvc2VkKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmZvckFsbENoaWxkcmVuKChjaGlsZCkgPT5cclxuXHRcdHtcclxuXHRcdFx0aWYgKGNoaWxkLmlzQ29sbGFwc2VkKSBjaGlsZC5zZXRDb2xsYXBzZSh0cnVlLCBmYWxzZSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0XHJcblx0Ly8qKkdlbmVyYXRlIGEgdHJlZSB3aXRoIGEgdGl0bGUgYW5kIGZ1bGwgdHJlZSBjb2xsYXBzZSBidXR0b24qL1xyXG5cdHB1YmxpYyBhc3luYyBnZW5lcmF0ZVRyZWVXaXRoQ29udGFpbmVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpXHJcblx0e1xyXG5cdFx0LypcclxuXHRcdC0gZGl2LnRyZWUtY29udGFpbmVyXHJcblx0XHRcdC0gZGl2LnRyZWUtaGVhZGVyXHJcblx0XHRcdFx0LSBzcGFuLnNpZGViYXItc2VjdGlvbi1oZWFkZXJcclxuXHRcdFx0XHQtIGJ1dHRvbi5jb2xsYXBzZS10cmVlLWJ1dHRvblxyXG5cdFx0XHRcdFx0LSBzdmdcclxuXHRcdFx0LSBkaXYudHJlZS1zY3JvbGwtYXJlYVxyXG5cdFx0XHRcdC0gZGl2LnRyZWUtaXRlbVxyXG5cdFx0XHRcdFx0LSBkaXYudHJlZS1pdGVtLWNvbnRlbnRzXHJcblx0XHRcdFx0XHRcdC0gZGl2LnRyZWUtaXRlbS1pY29uXHJcblx0XHRcdFx0XHRcdFx0LSBzdmdcclxuXHRcdFx0XHRcdFx0LSBhLmludGVybmFsLWxpbmtcclxuXHRcdFx0XHRcdFx0XHQtIHNwYW4udHJlZS1pdGVtLXRpdGxlXHJcblx0XHRcdFx0XHQtIGRpdi50cmVlLWl0ZW0tY2hpbGRyZW5cclxuXHRcdCovXHJcblxyXG5cdFx0dGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XHJcblx0XHRcclxuXHRcdGxldCB0cmVlQ29udGFpbmVyRWwgPSBjb250YWluZXIuY3JlYXRlRGl2KCk7XHJcblx0XHRsZXQgdHJlZUhlYWRlckVsID0gY29udGFpbmVyLmNyZWF0ZURpdigpO1xyXG5cdFx0bGV0IHNlY3Rpb25IZWFkZXJFbCA9IGNvbnRhaW5lci5jcmVhdGVFbCgnc3BhbicpO1xyXG5cdFx0bGV0IGNvbGxhcHNlQWxsRWwgPSBjb250YWluZXIuY3JlYXRlRWwoJ2J1dHRvbicpO1xyXG5cdFx0bGV0IHRyZWVTY3JvbGxBcmVhRWwgPSBjb250YWluZXIuY3JlYXRlRGl2KCk7XHJcblxyXG5cdFx0dHJlZUNvbnRhaW5lckVsLmNsYXNzTGlzdC5hZGQoJ3RyZWUtY29udGFpbmVyJywgdGhpcy5jbGFzcyk7XHJcblx0XHR0cmVlSGVhZGVyRWwuY2xhc3NMaXN0LmFkZChcInRyZWUtaGVhZGVyXCIpO1xyXG5cdFx0c2VjdGlvbkhlYWRlckVsLmNsYXNzTGlzdC5hZGQoXCJzaWRlYmFyLXNlY3Rpb24taGVhZGVyXCIpO1xyXG5cdFx0Y29sbGFwc2VBbGxFbC5jbGFzc0xpc3QuYWRkKFwiY2xpY2thYmxlLWljb25cIiwgXCJjb2xsYXBzZS10cmVlLWJ1dHRvblwiKTtcclxuXHRcdGNvbGxhcHNlQWxsRWwuaW5uZXJIVE1MID0gXCI8c3ZnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgd2lkdGg9JzI0JyBoZWlnaHQ9JzI0JyB2aWV3Qm94PScwIDAgMjQgMjQnIGZpbGw9J25vbmUnIHN0cm9rZT0nY3VycmVudENvbG9yJyBzdHJva2Utd2lkdGg9JzInIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCc+PC9zdmc+XCI7XHJcblx0XHR0cmVlU2Nyb2xsQXJlYUVsLmNsYXNzTGlzdC5hZGQoXCJ0cmVlLXNjcm9sbC1hcmVhXCIpO1xyXG5cclxuXHRcdGlmICh0aGlzLmdlbmVyYXRlV2l0aEl0ZW1zQ2xvc2VkKSBjb2xsYXBzZUFsbEVsLmNsYXNzTGlzdC5hZGQoXCJpcy1jb2xsYXBzZWRcIik7XHJcblx0XHRpZiAodGhpcy5zaG93TmVzdGluZ0luZGljYXRvcikgdHJlZUNvbnRhaW5lckVsLmNsYXNzTGlzdC5hZGQoXCJtb2QtbmF2LWluZGljYXRvclwiKTtcclxuXHJcblx0XHR0cmVlQ29udGFpbmVyRWwuc2V0QXR0cmlidXRlKFwiZGF0YS1kZXB0aFwiLCBcIjBcIik7XHJcblx0XHRzZWN0aW9uSGVhZGVyRWwuaW5uZXJUZXh0ID0gdGhpcy50aXRsZTtcclxuXHJcblx0XHR0cmVlQ29udGFpbmVyRWwuYXBwZW5kQ2hpbGQodHJlZUhlYWRlckVsKTtcclxuXHRcdHRyZWVDb250YWluZXJFbC5hcHBlbmRDaGlsZCh0cmVlU2Nyb2xsQXJlYUVsKTtcclxuXHRcdHRyZWVIZWFkZXJFbC5hcHBlbmRDaGlsZChzZWN0aW9uSGVhZGVyRWwpO1xyXG5cdFx0dHJlZUhlYWRlckVsLmFwcGVuZENoaWxkKGNvbGxhcHNlQWxsRWwpO1xyXG5cclxuXHRcdGF3YWl0IHRoaXMuZ2VuZXJhdGVUcmVlKHRyZWVTY3JvbGxBcmVhRWwpO1xyXG5cdH1cclxuXHJcblx0cHVibGljIHNvcnRBbHBoYWJldGljYWxseShyZXZlcnNlOiBib29sZWFuID0gZmFsc2UpXHJcblx0e1xyXG5cdFx0dGhpcy5jaGlsZHJlbi5zb3J0KChhLCBiKSA9PiByZXZlcnNlID8gYi50aXRsZS5sb2NhbGVDb21wYXJlKGEudGl0bGUpIDogYS50aXRsZS5sb2NhbGVDb21wYXJlKGIudGl0bGUpKTtcclxuXHRcdGZvciAobGV0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pXHJcblx0XHR7XHJcblx0XHRcdGNoaWxkLnNvcnRBbHBoYWJldGljYWxseSgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cHVibGljIGZvckFsbENoaWxkcmVuKGZ1bmM6IChjaGlsZDogVHJlZUl0ZW0pID0+IHZvaWQsIHJlY3Vyc2l2ZTogYm9vbGVhbiA9IHRydWUpXHJcblx0e1xyXG5cdFx0Zm9yIChsZXQgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbilcclxuXHRcdHtcclxuXHRcdFx0ZnVuYyhjaGlsZCk7XHJcblx0XHRcdGlmIChyZWN1cnNpdmUpIGNoaWxkLmZvckFsbENoaWxkcmVuKGZ1bmMpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFRyZWVJdGVtXHJcbntcclxuXHRwdWJsaWMgdHJlZTogVHJlZTtcclxuXHRwdWJsaWMgY2hpbGRyZW46IFRyZWVJdGVtW10gPSBbXTtcclxuXHRwdWJsaWMgcGFyZW50OiBUcmVlSXRlbSB8IFRyZWU7XHJcblx0cHVibGljIGRlcHRoOiBudW1iZXIgPSAwO1xyXG5cdHB1YmxpYyBpdGVtQ2xhc3M6IHN0cmluZyA9IFwiXCI7XHJcblx0cHVibGljIHRpdGxlOiBzdHJpbmcgPSBcIlwiO1xyXG5cdHB1YmxpYyBocmVmOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblx0cHVibGljIG1pbkNvbGxhcHNhYmxlRGVwdGg6IG51bWJlciA9IDE7XHJcblx0cHVibGljIGlzQ29sbGFwc2VkOiBib29sZWFuID0gZmFsc2U7XHJcblx0cHVibGljIGNoaWxkQ29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuXHJcblx0cHVibGljIGl0ZW1FbDogSFRNTERpdkVsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblxyXG5cdHB1YmxpYyBjb25zdHJ1Y3Rvcih0cmVlOiBUcmVlLCBwYXJlbnQ6IFRyZWVJdGVtIHwgVHJlZSwgZGVwdGg6IG51bWJlcilcclxuXHR7XHJcblx0XHR0aGlzLnRyZWUgPSB0cmVlO1xyXG5cdFx0dGhpcy5wYXJlbnQgPSBwYXJlbnQ7XHJcblx0XHR0aGlzLmRlcHRoID0gZGVwdGg7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgYXN5bmMgZ2VuZXJhdGVJdGVtSFRNTChjb250YWluZXI6IEhUTUxFbGVtZW50LCBzdGFydENsb3NlZDogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPEhUTUxEaXZFbGVtZW50PlxyXG5cdHtcclxuXHJcblx0XHQvKlxyXG5cdFx0LSBkaXYudHJlZS1pdGVtLXdyYXBwZXJcclxuXHRcdFx0LSBkaXYudHJlZS1pdGVtLWNvbnRlbnRzXHJcblx0XHRcdFx0LSBhLmludGVybmFsLWxpbmsudHJlZS1pdGVtLWxpbmtcclxuXHRcdFx0XHRcdC0gZGl2LnRyZWUtaXRlbS1pY29uXHJcblx0XHRcdFx0XHRcdC0gc3ZnXHJcblx0XHRcdFx0XHQtIHNwYW4udHJlZS1pdGVtLXRpdGxlXHJcblx0XHRcdC0gZGl2LnRyZWUtaXRlbS1jaGlsZHJlblxyXG5cdFx0Ki9cclxuXHJcblx0XHR0aGlzLml0ZW1FbCA9IHRoaXMuY3JlYXRlSXRlbVdyYXBwZXIoY29udGFpbmVyKTtcclxuXHRcdGxldCBpdGVtQ29udGVudHNFbCA9IHRoaXMuY3JlYXRlSXRlbUNvbnRlbnRzKHRoaXMuaXRlbUVsKTtcclxuXHRcdGxldCBpdGVtTGlua0VsID0gdGhpcy5jcmVhdGVJdGVtTGluayhpdGVtQ29udGVudHNFbCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuaXNDb2xsYXBzaWJsZSgpKVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLmNyZWF0ZUl0ZW1JY29uKGl0ZW1MaW5rRWwpO1xyXG5cdFx0XHRpZiAoc3RhcnRDbG9zZWQpIFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGhpcy5pdGVtRWwuY2xhc3NMaXN0LmFkZChcImlzLWNvbGxhcHNlZFwiKTtcclxuXHRcdFx0XHR0aGlzLmlzQ29sbGFwc2VkID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGF3YWl0IHRoaXMuY3JlYXRlSXRlbVRpdGxlKGl0ZW1MaW5rRWwpO1xyXG5cdFx0dGhpcy5jcmVhdGVJdGVtQ2hpbGRyZW4odGhpcy5pdGVtRWwpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLml0ZW1FbDtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBmb3JBbGxDaGlsZHJlbihmdW5jOiAoY2hpbGQ6IFRyZWVJdGVtKSA9PiB2b2lkLCByZWN1cnNpdmU6IGJvb2xlYW4gPSB0cnVlKVxyXG5cdHtcclxuXHRcdGZvciAobGV0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pXHJcblx0XHR7XHJcblx0XHRcdGZ1bmMoY2hpbGQpO1xyXG5cdFx0XHRpZiAocmVjdXJzaXZlKSBjaGlsZC5mb3JBbGxDaGlsZHJlbihmdW5jKTtcclxuXHRcdH1cclxuXHR9XHJcblx0XHJcblx0cHVibGljIGFzeW5jIHNldENvbGxhcHNlKGNvbGxhcHNlZDogYm9vbGVhbiwgYW5pbWF0ZSA9IHRydWUpXHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLmlzQ29sbGFwc2libGUoKSkgcmV0dXJuO1xyXG5cdFx0aWYgKCF0aGlzLml0ZW1FbCB8fCAhdGhpcy5pdGVtRWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwibW9kLWNvbGxhcHNpYmxlXCIpKSByZXR1cm47XHJcblxyXG5cdFx0bGV0IGNoaWxkcmVuID0gdGhpcy5pdGVtRWwucXVlcnlTZWxlY3RvcihcIi50cmVlLWl0ZW0tY2hpbGRyZW5cIikgYXMgSFRNTEVsZW1lbnQ7XHJcblxyXG5cdFx0aWYgKGNoaWxkcmVuID09IG51bGwpIHJldHVybjtcclxuXHJcblx0XHRpZiAoY29sbGFwc2VkKVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLml0ZW1FbC5jbGFzc0xpc3QuYWRkKFwiaXMtY29sbGFwc2VkXCIpO1xyXG5cdFx0XHRpZihhbmltYXRlKSB0aGlzLnNsaWRlVXAoY2hpbGRyZW4sIDEwMCk7XHJcblx0XHRcdGVsc2UgY2hpbGRyZW4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLml0ZW1FbC5jbGFzc0xpc3QucmVtb3ZlKFwiaXMtY29sbGFwc2VkXCIpO1xyXG5cdFx0XHRpZihhbmltYXRlKSB0aGlzLnNsaWRlRG93bihjaGlsZHJlbiwgMTAwKTtcclxuXHRcdFx0ZWxzZSBjaGlsZHJlbi5zdHlsZS5yZW1vdmVQcm9wZXJ0eShcImRpc3BsYXlcIik7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5pc0NvbGxhcHNlZCA9IGNvbGxhcHNlZDtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyB0b2dnbGVDb2xsYXBzZSgpXHJcblx0e1xyXG5cdFx0aWYgKCF0aGlzLml0ZW1FbCkgcmV0dXJuO1xyXG5cdFx0dGhpcy5zZXRDb2xsYXBzZSghdGhpcy5pdGVtRWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwiaXMtY29sbGFwc2VkXCIpKTtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzb3J0QWxwaGFiZXRpY2FsbHkocmV2ZXJzZTogYm9vbGVhbiA9IGZhbHNlKVxyXG5cdHtcclxuXHRcdHRoaXMuY2hpbGRyZW4uc29ydCgoYSwgYikgPT4gcmV2ZXJzZSA/IGIudGl0bGUubG9jYWxlQ29tcGFyZShhLnRpdGxlKSA6IGEudGl0bGUubG9jYWxlQ29tcGFyZShiLnRpdGxlKSk7XHJcblx0XHRmb3IgKGxldCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKVxyXG5cdFx0e1xyXG5cdFx0XHRjaGlsZC5zb3J0QWxwaGFiZXRpY2FsbHkoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHByb3RlY3RlZCBpc0NvbGxhcHNpYmxlKCk6IGJvb2xlYW5cclxuXHR7XHJcblx0XHRyZXR1cm4gdGhpcy5jaGlsZHJlbi5sZW5ndGggIT0gMCAmJiB0aGlzLmRlcHRoID49IHRoaXMubWluQ29sbGFwc2FibGVEZXB0aDtcclxuXHR9XHJcblxyXG5cdHByb3RlY3RlZCBjcmVhdGVJdGVtV3JhcHBlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTERpdkVsZW1lbnRcclxuXHR7XHJcblx0XHRsZXQgaXRlbUVsID0gY29udGFpbmVyLmNyZWF0ZURpdigpO1xyXG5cdFx0aXRlbUVsLmNsYXNzTGlzdC5hZGQoXCJ0cmVlLWl0ZW1cIik7XHJcblx0XHRpZiAodGhpcy5pdGVtQ2xhc3MudHJpbSgpICE9IFwiXCIpIGl0ZW1FbC5jbGFzc0xpc3QuYWRkKHRoaXMuaXRlbUNsYXNzKTtcclxuXHRcdGl0ZW1FbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWRlcHRoXCIsIHRoaXMuZGVwdGgudG9TdHJpbmcoKSk7XHJcblx0XHRpZiAodGhpcy5pc0NvbGxhcHNpYmxlKCkpIGl0ZW1FbC5jbGFzc0xpc3QuYWRkKFwibW9kLWNvbGxhcHNpYmxlXCIpO1xyXG5cdFx0cmV0dXJuIGl0ZW1FbDtcclxuXHR9XHJcblxyXG5cdHByb3RlY3RlZCBjcmVhdGVJdGVtQ29udGVudHMoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IEhUTUxEaXZFbGVtZW50XHJcblx0e1xyXG5cdFx0bGV0IGl0ZW1Db250ZW50c0VsID0gY29udGFpbmVyLmNyZWF0ZURpdihcInRyZWUtaXRlbS1jb250ZW50c1wiKTtcclxuXHRcdHJldHVybiBpdGVtQ29udGVudHNFbDtcclxuXHR9XHJcblxyXG5cdHByb3RlY3RlZCBjcmVhdGVJdGVtTGluayhjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTEFuY2hvckVsZW1lbnRcclxuXHR7XHJcblx0XHRpZiAodGhpcy50cmVlLm1ha2VMaW5rc1dlYlN0eWxlICYmIHRoaXMuaHJlZikgdGhpcy5ocmVmID0gUGF0aC50b1dlYlN0eWxlKHRoaXMuaHJlZik7XHJcblx0XHRsZXQgaXRlbUxpbmtFbCA9IGNvbnRhaW5lci5jcmVhdGVFbChcImFcIiwgeyBjbHM6IFwiaW50ZXJuYWwtbGluayB0cmVlLWl0ZW0tbGlua1wiIH0pO1xyXG5cdFx0aWYgKHRoaXMuaHJlZikgaXRlbUxpbmtFbC5zZXRBdHRyaWJ1dGUoXCJocmVmXCIsIHRoaXMuaHJlZik7XHJcblx0XHRyZXR1cm4gaXRlbUxpbmtFbDtcclxuXHR9XHJcblxyXG5cdHByb3RlY3RlZCBjcmVhdGVJdGVtSWNvbihjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnRcclxuXHR7XHJcblx0XHRjb25zdCBhcnJvd0ljb24gPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIyNFwiIGhlaWdodD1cIjI0XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGNsYXNzPVwic3ZnLWljb24gcmlnaHQtdHJpYW5nbGVcIj48cGF0aCBkPVwiTTMgOEwxMiAxN0wyMSA4XCI+PC9wYXRoPjwvc3ZnPmA7XHJcblxyXG5cdFx0bGV0IGl0ZW1JY29uRWwgPSBjb250YWluZXIuY3JlYXRlRGl2KFwidHJlZS1pdGVtLWljb24gY29sbGFwc2UtaWNvblwiKTtcclxuXHRcdGl0ZW1JY29uRWwuaW5uZXJIVE1MID0gYXJyb3dJY29uO1xyXG5cdFx0cmV0dXJuIGl0ZW1JY29uRWw7XHJcblx0fVxyXG5cclxuXHRwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlSXRlbVRpdGxlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBQcm9taXNlPEhUTUxTcGFuRWxlbWVudD5cclxuXHR7XHJcblx0XHRsZXQgdGl0bGVFbCA9IGNvbnRhaW5lci5jcmVhdGVFbChcInNwYW5cIiwgeyBjbHM6IFwidHJlZS1pdGVtLXRpdGxlXCIgfSk7XHJcblx0XHRpZiAodGhpcy50cmVlLnJlbmRlck1hcmtkb3duVGl0bGVzKSBNYXJrZG93blJlbmRlcmVyLnJlbmRlclNpbmdsZUxpbmVNYXJrZG93bih0aGlzLnRpdGxlLCB0aXRsZUVsKTtcclxuXHRcdGVsc2UgdGl0bGVFbC5pbm5lclRleHQgPSB0aGlzLnRpdGxlO1xyXG5cdFx0cmV0dXJuIHRpdGxlRWw7XHJcblx0fVxyXG5cclxuXHRwcm90ZWN0ZWQgY3JlYXRlSXRlbUNoaWxkcmVuKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBIVE1MRGl2RWxlbWVudFxyXG5cdHtcclxuXHRcdHRoaXMuY2hpbGRDb250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KFwidHJlZS1pdGVtLWNoaWxkcmVuXCIpO1xyXG5cdFx0cmV0dXJuIHRoaXMuY2hpbGRDb250YWluZXI7XHJcblx0fVxyXG5cclxuXHJcblx0cHJvdGVjdGVkIHNsaWRlVXAodGFyZ2V0OiBIVE1MRWxlbWVudCwgZHVyYXRpb249NTAwKVxyXG5cdHtcclxuXHRcdHRhcmdldC5zdHlsZS50cmFuc2l0aW9uUHJvcGVydHkgPSAnaGVpZ2h0LCBtYXJnaW4sIHBhZGRpbmcnO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnRyYW5zaXRpb25EdXJhdGlvbiA9IGR1cmF0aW9uICsgJ21zJztcclxuXHRcdHRhcmdldC5zdHlsZS5ib3hTaXppbmcgPSAnYm9yZGVyLWJveCc7XHJcblx0XHR0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gdGFyZ2V0Lm9mZnNldEhlaWdodCArICdweCc7XHJcblx0XHR0YXJnZXQub2Zmc2V0SGVpZ2h0O1xyXG5cdFx0dGFyZ2V0LnN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XHJcblx0XHR0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gXCIwXCI7XHJcblx0XHR0YXJnZXQuc3R5bGUucGFkZGluZ1RvcCA9IFwiMFwiO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnBhZGRpbmdCb3R0b20gPSBcIjBcIjtcclxuXHRcdHRhcmdldC5zdHlsZS5tYXJnaW5Ub3AgPSBcIjBcIjtcclxuXHRcdHRhcmdldC5zdHlsZS5tYXJnaW5Cb3R0b20gPSBcIjBcIjtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcclxuXHRcdFx0XHR0YXJnZXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuXHRcdFx0XHR0YXJnZXQuc3R5bGUucmVtb3ZlUHJvcGVydHkoJ2hlaWdodCcpO1xyXG5cdFx0XHRcdHRhcmdldC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgncGFkZGluZy10b3AnKTtcclxuXHRcdFx0XHR0YXJnZXQuc3R5bGUucmVtb3ZlUHJvcGVydHkoJ3BhZGRpbmctYm90dG9tJyk7XHJcblx0XHRcdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdtYXJnaW4tdG9wJyk7XHJcblx0XHRcdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdtYXJnaW4tYm90dG9tJyk7XHJcblx0XHRcdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdvdmVyZmxvdycpO1xyXG5cdFx0XHRcdHRhcmdldC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgndHJhbnNpdGlvbi1kdXJhdGlvbicpO1xyXG5cdFx0XHRcdHRhcmdldC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgndHJhbnNpdGlvbi1wcm9wZXJ0eScpO1xyXG5cdFx0fSwgZHVyYXRpb24pO1xyXG5cdH1cclxuXHJcblx0cHJvdGVjdGVkIHNsaWRlRG93bih0YXJnZXQ6IEhUTUxFbGVtZW50LCBkdXJhdGlvbj01MDApXHJcblx0e1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdkaXNwbGF5Jyk7XHJcblx0XHRsZXQgZGlzcGxheSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhcmdldCkuZGlzcGxheTtcclxuXHRcdGlmIChkaXNwbGF5ID09PSAnbm9uZScpIGRpc3BsYXkgPSAnYmxvY2snO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSBkaXNwbGF5O1xyXG5cdFx0bGV0IGhlaWdodCA9IHRhcmdldC5vZmZzZXRIZWlnaHQ7XHJcblx0XHR0YXJnZXQuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcclxuXHRcdHRhcmdldC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcclxuXHRcdHRhcmdldC5zdHlsZS5wYWRkaW5nVG9wID0gXCIwXCI7XHJcblx0XHR0YXJnZXQuc3R5bGUucGFkZGluZ0JvdHRvbSA9IFwiMFwiO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLm1hcmdpblRvcCA9IFwiMFwiO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLm1hcmdpbkJvdHRvbSA9IFwiMFwiO1xyXG5cdFx0dGFyZ2V0Lm9mZnNldEhlaWdodDtcclxuXHRcdHRhcmdldC5zdHlsZS5ib3hTaXppbmcgPSAnYm9yZGVyLWJveCc7XHJcblx0XHR0YXJnZXQuc3R5bGUudHJhbnNpdGlvblByb3BlcnR5ID0gXCJoZWlnaHQsIG1hcmdpbiwgcGFkZGluZ1wiO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnRyYW5zaXRpb25EdXJhdGlvbiA9IGR1cmF0aW9uICsgJ21zJztcclxuXHRcdHRhcmdldC5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdwYWRkaW5nLXRvcCcpO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdwYWRkaW5nLWJvdHRvbScpO1xyXG5cdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdtYXJnaW4tdG9wJyk7XHJcblx0XHR0YXJnZXQuc3R5bGUucmVtb3ZlUHJvcGVydHkoJ21hcmdpbi1ib3R0b20nKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcclxuXHRcdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdoZWlnaHQnKTtcclxuXHRcdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdvdmVyZmxvdycpO1xyXG5cdFx0XHR0YXJnZXQuc3R5bGUucmVtb3ZlUHJvcGVydHkoJ3RyYW5zaXRpb24tZHVyYXRpb24nKTtcclxuXHRcdFx0dGFyZ2V0LnN0eWxlLnJlbW92ZVByb3BlcnR5KCd0cmFuc2l0aW9uLXByb3BlcnR5Jyk7XHJcblx0XHR9LCBkdXJhdGlvbik7XHJcblx0fVxyXG59XHJcbiJdfQ==