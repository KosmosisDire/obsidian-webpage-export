import { __awaiter } from "tslib";
import { TFolder } from "obsidian";
import { FileTree, FileTreeItem } from "./file-tree";
import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "scripts/html-generation/markdown-renderer";
export class FilePickerTree extends FileTree {
    constructor(files, keepOriginalExtensions = false, sort = true) {
        super(files, keepOriginalExtensions, sort);
        this.children = [];
        this.renderMarkdownTitles = false;
        for (let file of files) {
            let pathSections = [];
            let parentFile = file;
            while (parentFile != undefined) {
                pathSections.push(parentFile);
                parentFile = parentFile.parent;
            }
            pathSections.reverse();
            let parent = this;
            for (let i = 1; i < pathSections.length; i++) {
                let section = pathSections[i];
                let isFolder = section instanceof TFolder;
                let child = parent.children.find(sibling => sibling.title == section.name && sibling.isFolder == isFolder && sibling.depth == i);
                if (child == undefined) {
                    child = new FilePickerTreeItem(this, parent, i);
                    child.title = section.name;
                    child.isFolder = isFolder;
                    if (!child.isFolder)
                        child.file = file;
                    if (child.isFolder)
                        child.itemClass = "mod-tree-folder";
                    else
                        child.itemClass = "mod-tree-file";
                    parent.children.push(child);
                }
                parent = child;
            }
            if (parent instanceof FilePickerTreeItem) {
                let path = new Path(file.path).makeUnixStyle();
                if (file instanceof TFolder)
                    path.makeForceFolder();
                else if (!keepOriginalExtensions && MarkdownRenderer.isConvertable(path.extensionName))
                    path.setExtension("html");
                parent.href = path.asString;
                parent.title = path.basename == "." ? "" : path.basename;
            }
        }
        if (sort) {
            this.sortAlphabetically();
            this.sortByIsFolder();
        }
    }
    generateTree(container) {
        const _super = Object.create(null, {
            generateTree: { get: () => super.generateTree }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.generateTree.call(this, container);
            // add a select all button at the top
            let item = new FilePickerTreeItem(this, this, 0);
            item.title = "Select All";
            item.itemClass = "mod-tree-control";
            let itemEl = yield item.generateItemHTML(container);
            // remove all event listeners from the select all button
            let oldItemEl = itemEl;
            itemEl = itemEl.cloneNode(true);
            item.checkbox = itemEl.querySelector("input");
            item.itemEl = itemEl;
            item.childContainer = itemEl.querySelector(".tree-item-children");
            container.prepend(itemEl);
            oldItemEl.remove();
            let localThis = this;
            function selectAll() {
                let checked = item.checkbox.checked;
                item.check(!checked);
                localThis.forAllChildren((child) => child.check(!checked));
            }
            item.checkbox.addEventListener("click", (event) => {
                item.checkbox.checked = !item.checkbox.checked;
                selectAll();
                event.stopPropagation();
            });
            item.itemEl.addEventListener("click", () => {
                selectAll();
            });
            this.selectAllItem = item;
        });
    }
    getSelectedFiles() {
        let selectedFiles = [];
        this.forAllChildren((child) => {
            if (child.checked && !child.isFolder)
                selectedFiles.push(child.file);
        });
        return selectedFiles;
    }
    setSelectedFiles(files) {
        let stringfiles = files.map(f => f.makeUnixStyle().asString);
        this.forAllChildren((child) => {
            var _a;
            if (stringfiles.includes(new Path((_a = child.href) !== null && _a !== void 0 ? _a : "").makeUnixStyle().asString)) {
                child.check(true);
            }
        });
        this.evaluateFolderChecks();
    }
    forAllChildren(func, recursive) {
        super.forAllChildren(func, recursive);
    }
    evaluateFolderChecks() {
        var _a, _b;
        // if all a folder's children are checked, check the folder, otherwise uncheck it
        this.forAllChildren((child) => {
            var _a, _b;
            if (child.isFolder) {
                let uncheckedChildren = (_a = child === null || child === void 0 ? void 0 : child.itemEl) === null || _a === void 0 ? void 0 : _a.querySelectorAll(".mod-tree-file .file-checkbox:not(.checked)");
                if (!child.checked && (uncheckedChildren === null || uncheckedChildren === void 0 ? void 0 : uncheckedChildren.length) == 0) {
                    child.check(true);
                }
                else if ((_b = uncheckedChildren === null || uncheckedChildren === void 0 ? void 0 : uncheckedChildren.length) !== null && _b !== void 0 ? _b : 0 > 0) {
                    child.check(false);
                }
            }
        });
        // if all folders are checked, check the select all button, otherwise uncheck it
        if (this.children.reduce((acc, child) => acc && child.checked, true)) {
            (_a = this.selectAllItem) === null || _a === void 0 ? void 0 : _a.check(true);
        }
        else {
            (_b = this.selectAllItem) === null || _b === void 0 ? void 0 : _b.check(false);
        }
    }
}
export class FilePickerTreeItem extends FileTreeItem {
    constructor() {
        super(...arguments);
        this.checked = false;
    }
    createItemLink(container) {
        let linkEl = super.createItemLink(container);
        this.checkbox = linkEl.createEl("input");
        this.checkbox.classList.add("file-checkbox");
        this.checkbox.setAttribute("type", "checkbox");
        this.checkbox.addEventListener("click", (event) => {
            event.stopPropagation();
            this.check(this.checkbox.checked, false);
            this.checkAllChildren(this.checkbox.checked);
            this.tree.evaluateFolderChecks();
        });
        let localThis = this;
        linkEl === null || linkEl === void 0 ? void 0 : linkEl.addEventListener("click", function (event) {
            if (localThis.isFolder)
                localThis.toggleCollapse();
            else
                localThis.toggle(true);
        });
        return linkEl;
    }
    check(checked, evaluate = false) {
        // if (!this.checkbox) return;
        this.checked = checked;
        this.checkbox.checked = checked;
        this.checkbox.classList.toggle("checked", checked);
        if (evaluate)
            this.tree.evaluateFolderChecks();
    }
    toggle(evaluate = false) {
        this.check(!this.checked, evaluate);
    }
    checkAllChildren(checked) {
        this.forAllChildren((child) => child.check(checked));
    }
    forAllChildren(func, recursive) {
        super.forAllChildren(func, recursive);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZS1waWNrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmaWxlLXBpY2tlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUF3QixPQUFPLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDekQsT0FBTyxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDckQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBSTdFLE1BQU0sT0FBTyxjQUFlLFNBQVEsUUFBUTtJQUszQyxZQUFtQixLQUFjLEVBQUUseUJBQWtDLEtBQUssRUFBRSxJQUFJLEdBQUcsSUFBSTtRQUV0RixLQUFLLENBQUMsS0FBSyxFQUFFLHNCQUFzQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBTHJDLGFBQVEsR0FBeUIsRUFBRSxDQUFDO1FBTzFDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUM7UUFFbEMsS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQ3RCO1lBQ0MsSUFBSSxZQUFZLEdBQW9CLEVBQUUsQ0FBQztZQUV2QyxJQUFJLFVBQVUsR0FBa0IsSUFBSSxDQUFDO1lBQ3JDLE9BQU8sVUFBVSxJQUFJLFNBQVMsRUFDOUI7Z0JBQ0MsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDOUIsVUFBVSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUM7YUFDL0I7WUFFRCxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFdkIsSUFBSSxNQUFNLEdBQXdDLElBQUksQ0FBQztZQUN2RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFDNUM7Z0JBQ0MsSUFBSSxPQUFPLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5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QUMsY0FBYyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN2QyxDQUFDO0NBRUQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUQWJzdHJhY3RGaWxlLCBURmlsZSwgVEZvbGRlciB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBGaWxlVHJlZSwgRmlsZVRyZWVJdGVtIH0gZnJvbSBcIi4vZmlsZS10cmVlXCI7XHJcbmltcG9ydCB7IFBhdGggfSBmcm9tIFwic2NyaXB0cy91dGlscy9wYXRoXCI7XHJcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vbWFya2Rvd24tcmVuZGVyZXJcIjtcclxuaW1wb3J0IHsgVHJlZSB9IGZyb20gXCIuL3RyZWVcIjtcclxuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwic2NyaXB0cy91dGlscy91dGlsc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEZpbGVQaWNrZXJUcmVlIGV4dGVuZHMgRmlsZVRyZWVcclxue1xyXG5cdHB1YmxpYyBjaGlsZHJlbjogRmlsZVBpY2tlclRyZWVJdGVtW10gPSBbXTtcclxuXHRwdWJsaWMgc2VsZWN0QWxsSXRlbTogRmlsZVBpY2tlclRyZWVJdGVtIHwgdW5kZWZpbmVkO1xyXG5cclxuXHRwdWJsaWMgY29uc3RydWN0b3IoZmlsZXM6IFRGaWxlW10sIGtlZXBPcmlnaW5hbEV4dGVuc2lvbnM6IGJvb2xlYW4gPSBmYWxzZSwgc29ydCA9IHRydWUpXHJcblx0e1xyXG5cdFx0c3VwZXIoZmlsZXMsIGtlZXBPcmlnaW5hbEV4dGVuc2lvbnMsIHNvcnQpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyTWFya2Rvd25UaXRsZXMgPSBmYWxzZTtcclxuXHRcdFxyXG5cdFx0Zm9yIChsZXQgZmlsZSBvZiBmaWxlcylcclxuXHRcdHtcclxuXHRcdFx0bGV0IHBhdGhTZWN0aW9uczogVEFic3RyYWN0RmlsZVtdID0gW107XHJcblxyXG5cdFx0XHRsZXQgcGFyZW50RmlsZTogVEFic3RyYWN0RmlsZSA9IGZpbGU7XHJcblx0XHRcdHdoaWxlIChwYXJlbnRGaWxlICE9IHVuZGVmaW5lZClcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHBhdGhTZWN0aW9ucy5wdXNoKHBhcmVudEZpbGUpO1xyXG5cdFx0XHRcdHBhcmVudEZpbGUgPSBwYXJlbnRGaWxlLnBhcmVudDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cGF0aFNlY3Rpb25zLnJldmVyc2UoKTtcclxuXHJcblx0XHRcdGxldCBwYXJlbnQ6IEZpbGVQaWNrZXJUcmVlSXRlbSB8IEZpbGVQaWNrZXJUcmVlID0gdGhpcztcclxuXHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBwYXRoU2VjdGlvbnMubGVuZ3RoOyBpKyspXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgc2VjdGlvbiA9IHBhdGhTZWN0aW9uc1tpXTtcclxuXHRcdFx0XHRsZXQgaXNGb2xkZXIgPSBzZWN0aW9uIGluc3RhbmNlb2YgVEZvbGRlcjtcclxuXHRcdFx0XHRsZXQgY2hpbGQgPSBwYXJlbnQuY2hpbGRyZW4uZmluZChzaWJsaW5nID0+IHNpYmxpbmcudGl0bGUgPT0gc2VjdGlvbi5uYW1lICYmIHNpYmxpbmcuaXNGb2xkZXIgPT0gaXNGb2xkZXIgJiYgc2libGluZy5kZXB0aCA9PSBpKSBhcyBGaWxlUGlja2VyVHJlZUl0ZW0gfCB1bmRlZmluZWQ7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYgKGNoaWxkID09IHVuZGVmaW5lZClcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRjaGlsZCA9IG5ldyBGaWxlUGlja2VyVHJlZUl0ZW0odGhpcywgcGFyZW50LCBpKTtcclxuXHRcdFx0XHRcdGNoaWxkLnRpdGxlID0gc2VjdGlvbi5uYW1lO1xyXG5cdFx0XHRcdFx0Y2hpbGQuaXNGb2xkZXIgPSBpc0ZvbGRlcjtcclxuXHJcblx0XHRcdFx0XHRpZighY2hpbGQuaXNGb2xkZXIpIGNoaWxkLmZpbGUgPSBmaWxlO1xyXG5cclxuXHRcdFx0XHRcdGlmKGNoaWxkLmlzRm9sZGVyKSBjaGlsZC5pdGVtQ2xhc3MgPSBcIm1vZC10cmVlLWZvbGRlclwiXHJcblx0XHRcdFx0XHRlbHNlIGNoaWxkLml0ZW1DbGFzcyA9IFwibW9kLXRyZWUtZmlsZVwiXHJcblxyXG5cdFx0XHRcdFx0cGFyZW50LmNoaWxkcmVuLnB1c2goY2hpbGQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRwYXJlbnQgPSBjaGlsZDtcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0aWYgKHBhcmVudCBpbnN0YW5jZW9mIEZpbGVQaWNrZXJUcmVlSXRlbSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBwYXRoID0gbmV3IFBhdGgoZmlsZS5wYXRoKS5tYWtlVW5peFN0eWxlKCk7XHJcblx0XHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSBwYXRoLm1ha2VGb3JjZUZvbGRlcigpO1xyXG5cdFx0XHRcdGVsc2UgaWYoIWtlZXBPcmlnaW5hbEV4dGVuc2lvbnMgJiYgTWFya2Rvd25SZW5kZXJlci5pc0NvbnZlcnRhYmxlKHBhdGguZXh0ZW5zaW9uTmFtZSkpIHBhdGguc2V0RXh0ZW5zaW9uKFwiaHRtbFwiKTtcclxuXHRcdFx0XHRwYXJlbnQuaHJlZiA9IHBhdGguYXNTdHJpbmc7XHJcblx0XHRcdFx0cGFyZW50LnRpdGxlID0gcGF0aC5iYXNlbmFtZSA9PSBcIi5cIiA/IFwiXCIgOiBwYXRoLmJhc2VuYW1lO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHNvcnQpIFxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLnNvcnRBbHBoYWJldGljYWxseSgpO1xyXG5cdFx0XHR0aGlzLnNvcnRCeUlzRm9sZGVyKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgYXN5bmMgZ2VuZXJhdGVUcmVlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IFxyXG5cdHtcclxuXHRcdGF3YWl0IHN1cGVyLmdlbmVyYXRlVHJlZShjb250YWluZXIpO1xyXG5cclxuXHRcdC8vIGFkZCBhIHNlbGVjdCBhbGwgYnV0dG9uIGF0IHRoZSB0b3BcclxuXHRcdGxldCBpdGVtID0gbmV3IEZpbGVQaWNrZXJUcmVlSXRlbSh0aGlzLCB0aGlzLCAwKTtcclxuXHRcdGl0ZW0udGl0bGUgPSBcIlNlbGVjdCBBbGxcIjtcclxuXHRcdGl0ZW0uaXRlbUNsYXNzID0gXCJtb2QtdHJlZS1jb250cm9sXCI7XHJcblx0XHRsZXQgaXRlbUVsID0gYXdhaXQgaXRlbS5nZW5lcmF0ZUl0ZW1IVE1MKGNvbnRhaW5lcik7XHJcblxyXG5cdFx0Ly8gcmVtb3ZlIGFsbCBldmVudCBsaXN0ZW5lcnMgZnJvbSB0aGUgc2VsZWN0IGFsbCBidXR0b25cclxuXHRcdGxldCBvbGRJdGVtRWwgPSBpdGVtRWw7XHJcblx0XHRpdGVtRWwgPSBpdGVtRWwuY2xvbmVOb2RlKHRydWUpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cdFx0aXRlbS5jaGVja2JveCA9IGl0ZW1FbC5xdWVyeVNlbGVjdG9yKFwiaW5wdXRcIikgYXMgSFRNTElucHV0RWxlbWVudDtcclxuXHRcdGl0ZW0uaXRlbUVsID0gaXRlbUVsO1xyXG5cdFx0aXRlbS5jaGlsZENvbnRhaW5lciA9IGl0ZW1FbC5xdWVyeVNlbGVjdG9yKFwiLnRyZWUtaXRlbS1jaGlsZHJlblwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuXHJcblx0XHRjb250YWluZXIucHJlcGVuZChpdGVtRWwpO1xyXG5cclxuXHRcdG9sZEl0ZW1FbC5yZW1vdmUoKTtcclxuXHJcblxyXG5cdFx0bGV0IGxvY2FsVGhpcyA9IHRoaXM7XHJcblx0XHRmdW5jdGlvbiBzZWxlY3RBbGwoKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgY2hlY2tlZCA9IGl0ZW0uY2hlY2tib3guY2hlY2tlZDtcclxuXHRcdFx0aXRlbS5jaGVjayghY2hlY2tlZCk7XHJcblx0XHRcdGxvY2FsVGhpcy5mb3JBbGxDaGlsZHJlbigoY2hpbGQpID0+IGNoaWxkLmNoZWNrKCFjaGVja2VkKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aXRlbS5jaGVja2JveC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRpdGVtLmNoZWNrYm94LmNoZWNrZWQgPSAhaXRlbS5jaGVja2JveC5jaGVja2VkO1xyXG5cdFx0XHRzZWxlY3RBbGwoKTtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdGVtLml0ZW1FbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT5cclxuXHRcdHtcclxuXHRcdFx0c2VsZWN0QWxsKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLnNlbGVjdEFsbEl0ZW0gPSBpdGVtO1xyXG5cdH1cclxuXHRcclxuXHRwdWJsaWMgZ2V0U2VsZWN0ZWRGaWxlcygpOiBURmlsZVtdXHJcblx0e1xyXG5cdFx0bGV0IHNlbGVjdGVkRmlsZXM6IFRGaWxlW10gPSBbXTtcclxuXHRcdFxyXG5cdFx0dGhpcy5mb3JBbGxDaGlsZHJlbigoY2hpbGQpID0+XHJcblx0XHR7XHJcblx0XHRcdGlmKGNoaWxkLmNoZWNrZWQgJiYgIWNoaWxkLmlzRm9sZGVyKSBzZWxlY3RlZEZpbGVzLnB1c2goY2hpbGQuZmlsZSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWRGaWxlcztcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzZXRTZWxlY3RlZEZpbGVzKGZpbGVzOiBQYXRoW10pXHJcblx0e1xyXG5cdFx0bGV0IHN0cmluZ2ZpbGVzID0gZmlsZXMubWFwKGYgPT4gZi5tYWtlVW5peFN0eWxlKCkuYXNTdHJpbmcpO1xyXG5cclxuXHRcdHRoaXMuZm9yQWxsQ2hpbGRyZW4oKGNoaWxkKSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRpZihzdHJpbmdmaWxlcy5pbmNsdWRlcyhuZXcgUGF0aChjaGlsZC5ocmVmID8/IFwiXCIpLm1ha2VVbml4U3R5bGUoKS5hc1N0cmluZykpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRjaGlsZC5jaGVjayh0cnVlKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5ldmFsdWF0ZUZvbGRlckNoZWNrcygpO1xyXG5cdH1cclxuXHJcblx0cHVibGljIGZvckFsbENoaWxkcmVuKGZ1bmM6IChjaGlsZDogRmlsZVBpY2tlclRyZWVJdGVtKSA9PiB2b2lkLCByZWN1cnNpdmU/OiBib29sZWFuKTogdm9pZCB7XHJcblx0XHRzdXBlci5mb3JBbGxDaGlsZHJlbihmdW5jLCByZWN1cnNpdmUpO1xyXG5cdH1cclxuXHJcblx0cHVibGljIGV2YWx1YXRlRm9sZGVyQ2hlY2tzKClcclxuXHR7XHJcblx0XHQvLyBpZiBhbGwgYSBmb2xkZXIncyBjaGlsZHJlbiBhcmUgY2hlY2tlZCwgY2hlY2sgdGhlIGZvbGRlciwgb3RoZXJ3aXNlIHVuY2hlY2sgaXRcclxuXHRcdHRoaXMuZm9yQWxsQ2hpbGRyZW4oKGNoaWxkKSA9PiBcclxuXHRcdHtcclxuXHRcdFx0aWYoY2hpbGQuaXNGb2xkZXIpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgdW5jaGVja2VkQ2hpbGRyZW4gPSBjaGlsZD8uaXRlbUVsPy5xdWVyeVNlbGVjdG9yQWxsKFwiLm1vZC10cmVlLWZpbGUgLmZpbGUtY2hlY2tib3g6bm90KC5jaGVja2VkKVwiKTtcclxuXHJcblx0XHRcdFx0aWYgKCFjaGlsZC5jaGVja2VkICYmIHVuY2hlY2tlZENoaWxkcmVuPy5sZW5ndGggPT0gMClcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRjaGlsZC5jaGVjayh0cnVlKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWxzZSBpZiAodW5jaGVja2VkQ2hpbGRyZW4/Lmxlbmd0aCA/PyAwID4gMClcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRjaGlsZC5jaGVjayhmYWxzZSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcdFxyXG5cclxuXHRcdC8vIGlmIGFsbCBmb2xkZXJzIGFyZSBjaGVja2VkLCBjaGVjayB0aGUgc2VsZWN0IGFsbCBidXR0b24sIG90aGVyd2lzZSB1bmNoZWNrIGl0XHJcblx0XHRpZiAodGhpcy5jaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IGFjYyAmJiBjaGlsZC5jaGVja2VkLCB0cnVlKSlcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5zZWxlY3RBbGxJdGVtPy5jaGVjayh0cnVlKTtcclxuXHRcdH1cclxuXHRcdGVsc2VcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5zZWxlY3RBbGxJdGVtPy5jaGVjayhmYWxzZSk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgRmlsZVBpY2tlclRyZWVJdGVtIGV4dGVuZHMgRmlsZVRyZWVJdGVtXHJcbntcclxuXHRwdWJsaWMgZmlsZTogVEZpbGU7XHJcblx0cHVibGljIGNoZWNrYm94OiBIVE1MSW5wdXRFbGVtZW50O1xyXG5cdHB1YmxpYyB0cmVlOiBGaWxlUGlja2VyVHJlZTtcclxuXHRwdWJsaWMgY2hlY2tlZDogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuXHRwcm90ZWN0ZWQgY3JlYXRlSXRlbUxpbmsoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IEhUTUxBbmNob3JFbGVtZW50XHJcblx0e1xyXG5cdFx0bGV0IGxpbmtFbCA9IHN1cGVyLmNyZWF0ZUl0ZW1MaW5rKGNvbnRhaW5lcik7XHJcblxyXG5cdFx0dGhpcy5jaGVja2JveCA9IGxpbmtFbC5jcmVhdGVFbChcImlucHV0XCIpO1xyXG5cdFx0dGhpcy5jaGVja2JveC5jbGFzc0xpc3QuYWRkKFwiZmlsZS1jaGVja2JveFwiKTtcclxuXHRcdHRoaXMuY2hlY2tib3guc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcImNoZWNrYm94XCIpO1xyXG5cdFx0dGhpcy5jaGVja2JveC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHJcblx0XHRcdHRoaXMuY2hlY2sodGhpcy5jaGVja2JveC5jaGVja2VkLCBmYWxzZSk7XHJcblx0XHRcdHRoaXMuY2hlY2tBbGxDaGlsZHJlbih0aGlzLmNoZWNrYm94LmNoZWNrZWQpO1xyXG5cdFx0XHR0aGlzLnRyZWUuZXZhbHVhdGVGb2xkZXJDaGVja3MoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGxldCBsb2NhbFRoaXMgPSB0aGlzO1xyXG5cdFx0bGlua0VsPy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oZXZlbnQpXHJcblx0XHR7XHJcblx0XHRcdGlmKGxvY2FsVGhpcy5pc0ZvbGRlcikgbG9jYWxUaGlzLnRvZ2dsZUNvbGxhcHNlKCk7XHJcblx0XHRcdGVsc2UgbG9jYWxUaGlzLnRvZ2dsZSh0cnVlKTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gbGlua0VsO1xyXG5cdH1cclxuXHJcblx0cHVibGljIGNoZWNrKGNoZWNrZWQ6IGJvb2xlYW4sIGV2YWx1YXRlOiBib29sZWFuID0gZmFsc2UpXHJcblx0e1xyXG5cdFx0Ly8gaWYgKCF0aGlzLmNoZWNrYm94KSByZXR1cm47XHJcblx0XHR0aGlzLmNoZWNrZWQgPSBjaGVja2VkO1xyXG5cdFx0dGhpcy5jaGVja2JveC5jaGVja2VkID0gY2hlY2tlZDtcclxuXHRcdHRoaXMuY2hlY2tib3guY2xhc3NMaXN0LnRvZ2dsZShcImNoZWNrZWRcIiwgY2hlY2tlZCk7XHJcblx0XHRpZihldmFsdWF0ZSkgdGhpcy50cmVlLmV2YWx1YXRlRm9sZGVyQ2hlY2tzKCk7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgdG9nZ2xlKGV2YWx1YXRlID0gZmFsc2UpXHJcblx0e1xyXG5cdFx0dGhpcy5jaGVjayghdGhpcy5jaGVja2VkLCBldmFsdWF0ZSk7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgY2hlY2tBbGxDaGlsZHJlbihjaGVja2VkOiBib29sZWFuKVxyXG5cdHtcclxuXHRcdHRoaXMuZm9yQWxsQ2hpbGRyZW4oKGNoaWxkKSA9PiBjaGlsZC5jaGVjayhjaGVja2VkKSk7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgZm9yQWxsQ2hpbGRyZW4oZnVuYzogKGNoaWxkOiBGaWxlUGlja2VyVHJlZUl0ZW0pID0+IHZvaWQsIHJlY3Vyc2l2ZT86IGJvb2xlYW4pOiB2b2lkIFxyXG5cdHtcclxuXHRcdHN1cGVyLmZvckFsbENoaWxkcmVuKGZ1bmMsIHJlY3Vyc2l2ZSk7XHJcblx0fVxyXG5cclxufVxyXG4iXX0=