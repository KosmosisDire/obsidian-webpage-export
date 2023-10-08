import { __awaiter } from "tslib";
import { Modal, Setting } from 'obsidian';
import { Utils } from '../utils/utils';
import HTMLExportPlugin from '../main';
import { MainSettings } from './main-settings';
import { FilePickerTree } from '../objects/file-picker';
import { Path } from 'scripts/utils/path';
export class ExportModal extends Modal {
    constructor() {
        super(app);
        this.isClosed = true;
        this.canceled = true;
        this.pickedFiles = undefined;
        this.validPath = true;
    }
    overridePickedFiles(files) {
        this.pickedFiles = files;
    }
    /**
     * @brief Opens the modal and async blocks until the modal is closed.
     * @returns True if the EXPORT button was pressed, false is the export was canceled.
     * @override
    */
    open() {
        const _super = Object.create(null, {
            open: { get: () => super.open }
        });
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            this.isClosed = false;
            this.canceled = true;
            _super.open.call(this);
            if (!this.filePickerModalEl) {
                this.filePickerModalEl = this.containerEl.createDiv({ cls: 'modal' });
                this.containerEl.insertBefore(this.filePickerModalEl, this.modalEl);
                this.filePickerModalEl.style.position = 'relative';
                this.filePickerModalEl.style.zIndex = "1";
                this.filePickerModalEl.style.width = "20em";
                this.filePickerModalEl.style.padding = "0";
                this.filePickerModalEl.style.margin = "10px";
                this.filePickerModalEl.style.maxHeight = "80%";
                this.filePickerModalEl.style.boxShadow = "0 0 7px 1px inset #00000060";
                let container = this.filePickerModalEl.createDiv({ cls: 'modal-content tree-container file-tree mod-nav-indicator' });
                container.style.height = "100%";
                container.style.width = "100%";
                container.style.padding = "0";
                container.style.margin = "0";
                container.style.display = "flex";
                container.style.flexDirection = "column";
                container.style.alignItems = "flex-end";
                let scrollArea = container.createDiv({ cls: 'tree-scroll-area' });
                scrollArea.style.height = "100%";
                scrollArea.style.width = "100%";
                scrollArea.style.overflowY = "auto";
                scrollArea.style.overflowX = "hidden";
                scrollArea.style.padding = "1em";
                scrollArea.style.boxShadow = "0 0 7px 1px inset #00000060";
                this.filePicker = new FilePickerTree(app.vault.getFiles(), true, true);
                this.filePicker.generateWithItemsClosed = true;
                yield this.filePicker.generateTree(scrollArea);
                if (((_b = (_a = this.pickedFiles) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0 > 0) || MainSettings.settings.filesToExport[0].length > 0) {
                    let filesToPick = (_d = (_c = this.pickedFiles) === null || _c === void 0 ? void 0 : _c.map(file => new Path(file.path))) !== null && _d !== void 0 ? _d : MainSettings.settings.filesToExport[0].map(path => new Path(path));
                    this.filePicker.setSelectedFiles(filesToPick);
                }
                let saveFiles = new Setting(container).addButton((button) => {
                    button.setButtonText("Save").onClick(() => __awaiter(this, void 0, void 0, function* () {
                        MainSettings.settings.filesToExport[0] = this.filePicker.getSelectedFiles().map(file => file.path);
                        yield MainSettings.saveSettings();
                    }));
                });
                saveFiles.settingEl.style.border = "none";
                saveFiles.settingEl.style.marginRight = "1em";
            }
            const { contentEl } = this;
            contentEl.empty();
            this.titleEl.setText('Export to HTML');
            if (HTMLExportPlugin.updateInfo.updateAvailable) {
                // create red notice showing the update is available
                let updateNotice = contentEl.createEl('strong', { text: `Update Available: ${HTMLExportPlugin.updateInfo.currentVersion} ⟶ ${HTMLExportPlugin.updateInfo.latestVersion}` });
                updateNotice.setAttribute("style", `margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--interactive-normal);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--color-red);
			border-radius: 5px;
			display: block;
			width: fit-content;`);
                // create normal block with update notes
                let updateNotes = contentEl.createEl('div', { text: HTMLExportPlugin.updateInfo.updateNote });
                updateNotes.setAttribute("style", `margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--background-secondary-alt);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--text-normal);
			font-size: var(--font-ui-smaller);
			border-radius: 5px;
			display: block;
			width: fit-content;
			white-space: pre-wrap;`);
            }
            let modeDescriptions = {
                "website": "This will export a file structure suitable for uploading to your own web server.",
                "local": "This will export an executable file along with a database file. This makes it easy to share the whole vault with others by only sharing 2 files.",
                "documents": "This will export self-contained html documents.",
                "raw-documents": "This will export raw, self-contained documents without the website layout. This is useful for sharing individual notes, or printing."
            };
            let exportModeSetting = new Setting(contentEl)
                .setName('Export Mode')
                // @ts-ignore
                .setDesc(modeDescriptions[(_e = MainSettings.settings.exportPreset) !== null && _e !== void 0 ? _e : 'website'])
                .setHeading()
                .addDropdown((dropdown) => dropdown
                .addOption('website', 'Online Web Server')
                // .addOption('local', 'Local Shareable Web Server') This feature is not ready yet, so it is disabled for now
                .addOption('documents', 'HTML Documents')
                .addOption('raw-documents', 'Raw HTML Documents')
                .setValue(["website", "local", "documents", "raw-documents"].contains(MainSettings.settings.exportPreset) ? MainSettings.settings.exportPreset : 'website')
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.exportPreset = value;
                switch (value) {
                    case 'documents':
                        MainSettings.settings.inlineCSS = true;
                        MainSettings.settings.inlineJS = true;
                        MainSettings.settings.inlineImages = true;
                        MainSettings.settings.makeNamesWebStyle = false;
                        MainSettings.settings.includeGraphView = false;
                        yield MainSettings.saveSettings();
                        break;
                    case 'raw-documents':
                        MainSettings.settings.inlineCSS = true;
                        MainSettings.settings.inlineJS = true;
                        MainSettings.settings.inlineImages = true;
                        MainSettings.settings.makeNamesWebStyle = false;
                        MainSettings.settings.includeGraphView = false;
                        yield MainSettings.saveSettings();
                        break;
                    case 'local':
                        MainSettings.settings.inlineCSS = false;
                        MainSettings.settings.inlineJS = false;
                        MainSettings.settings.inlineImages = false;
                        MainSettings.settings.makeNamesWebStyle = true;
                        MainSettings.settings.includeGraphView = true;
                        MainSettings.settings.includeFileTree = true;
                        yield MainSettings.saveSettings();
                        break;
                    case 'website':
                        MainSettings.settings.inlineCSS = false;
                        MainSettings.settings.inlineJS = false;
                        MainSettings.settings.inlineImages = false;
                        MainSettings.settings.makeNamesWebStyle = true;
                        MainSettings.settings.includeGraphView = true;
                        MainSettings.settings.includeFileTree = true;
                        yield MainSettings.saveSettings();
                        break;
                }
                this.open();
            })));
            new Setting(contentEl)
                .setName('Open after export')
                .addToggle((toggle) => toggle
                .setTooltip('Open the exported file after exporting.')
                .setValue(MainSettings.settings.openAfterExport)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.openAfterExport = value;
                yield MainSettings.saveSettings();
            })));
            let errorMessage = contentEl.createDiv({ cls: 'setting-item-description' });
            errorMessage.style.color = "var(--color-red)";
            errorMessage.style.marginBottom = "0.75rem";
            let tempPath = new Path(MainSettings.settings.exportPath);
            if (!tempPath.isDirectory)
                errorMessage.setText("Path must be a directory!");
            else if (!tempPath.isAbsolute)
                errorMessage.setText("Path must be absolute!");
            else if (!tempPath.exists)
                errorMessage.setText("Path does not exist!");
            if (errorMessage.innerText != "") {
                this.validPath = false;
            }
            let exportButton = undefined;
            let pathInput = undefined;
            function setExportDisabled(disabled) {
                if (exportButton) {
                    exportButton.setDisabled(disabled);
                    if (exportButton.disabled)
                        exportButton.buttonEl.style.opacity = "0.5";
                    else
                        exportButton.buttonEl.style.opacity = "1";
                }
            }
            new Setting(contentEl)
                .setName('')
                .setHeading()
                .addText((text) => {
                pathInput = text;
                text.inputEl.style.width = '100%';
                text.setPlaceholder('Enter an absolute export directory path')
                    .setValue(MainSettings.settings.exportPath)
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    let path = new Path(value);
                    if (!path.isDirectory)
                        errorMessage.setText("Path must be a directory!");
                    else if (!path.isAbsolute)
                        errorMessage.setText("Path must be absolute!");
                    else if (!path.exists)
                        errorMessage.setText("Path does not exist!");
                    else {
                        errorMessage.setText("");
                        MainSettings.settings.exportPath = value.replaceAll("\"", "");
                        text.setValue(MainSettings.settings.exportPath);
                        this.validPath = true;
                        yield MainSettings.saveSettings();
                    }
                    setExportDisabled(!path.isDirectory || !path.isAbsolute || !path.exists);
                }));
            })
                .addButton((button) => {
                button.setButtonText('Browse').onClick(() => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    let ideal = Utils.idealDefaultPath();
                    let path = (_a = (yield Utils.showSelectFolderDialog(ideal))) === null || _a === void 0 ? void 0 : _a.directory;
                    if (path) {
                        MainSettings.settings.exportPath = path.directory.asString;
                        yield MainSettings.saveSettings();
                        setExportDisabled(!path.isDirectory || !path.isAbsolute || !path.exists);
                        if (!path.isDirectory)
                            errorMessage.setText("Path must be a directory!");
                        else if (!path.isAbsolute)
                            errorMessage.setText("Path must be absolute!");
                        else if (!path.exists)
                            errorMessage.setText("Path does not exist!");
                        else
                            errorMessage.setText("");
                        pathInput === null || pathInput === void 0 ? void 0 : pathInput.setValue(MainSettings.settings.exportPath);
                    }
                }));
            })
                .addButton((button) => {
                exportButton = button;
                setExportDisabled(!this.validPath);
                button.setButtonText('Export').onClick(() => __awaiter(this, void 0, void 0, function* () {
                    this.canceled = false;
                    this.close();
                }));
            });
            contentEl.appendChild(errorMessage);
            new Setting(contentEl)
                .setDesc("More options located on the plugin settings page.")
                .addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() => {
                //@ts-ignore
                app.setting.open();
                //@ts-ignore
                app.setting.openTabById('webpage-html-export');
            }));
            this.filePickerModalEl.style.height = this.modalEl.clientHeight * 2 + "px";
            yield Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 10);
            this.pickedFiles = this.filePicker.getSelectedFiles();
            this.filePickerModalEl.remove();
            this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(MainSettings.settings.exportPath), validPath: this.validPath };
            return this.exportInfo;
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.isClosed = true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0LW1vZGFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXhwb3J0LW1vZGFsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPLEVBQW1CLEtBQUssRUFBRSxPQUFPLEVBQXdCLE1BQU0sVUFBVSxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2QyxPQUFPLGdCQUFnQixNQUFNLFNBQVMsQ0FBQztBQUN2QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3hELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQVUxQyxNQUFNLE9BQU8sV0FBWSxTQUFRLEtBQUs7SUFXckM7UUFDQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFWSixhQUFRLEdBQVksSUFBSSxDQUFDO1FBQ3pCLGFBQVEsR0FBWSxJQUFJLENBQUM7UUFHekIsZ0JBQVcsR0FBd0IsU0FBUyxDQUFDO1FBQzdDLGNBQVMsR0FBWSxJQUFJLENBQUM7SUFNbEMsQ0FBQztJQUVELG1CQUFtQixDQUFDLEtBQWM7UUFFakMsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7SUFDMUIsQ0FBQztJQUVEOzs7O01BSUU7SUFDSSxJQUFJOzs7Ozs7WUFFVCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztZQUN0QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztZQUVyQixPQUFNLElBQUksWUFBRztZQUViLElBQUcsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQzFCO2dCQUNDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO2dCQUN0RSxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVks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LEdBQUcsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRS9ELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3RELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQztZQUUvSixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7O0tBQ3ZCO0lBRUQsT0FBTztRQUVOLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDM0IsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLENBQUM7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJ1dHRvbkNvbXBvbmVudCwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBUZXh0Q29tcG9uZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uL3V0aWxzL3V0aWxzJztcclxuaW1wb3J0IEhUTUxFeHBvcnRQbHVnaW4gZnJvbSAnLi4vbWFpbic7XHJcbmltcG9ydCB7IE1haW5TZXR0aW5ncyB9IGZyb20gJy4vbWFpbi1zZXR0aW5ncyc7XHJcbmltcG9ydCB7IEZpbGVQaWNrZXJUcmVlIH0gZnJvbSAnLi4vb2JqZWN0cy9maWxlLXBpY2tlcic7XHJcbmltcG9ydCB7IFBhdGggfSBmcm9tICdzY3JpcHRzL3V0aWxzL3BhdGgnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBvcnRJbmZvXHJcbntcclxuXHRjYW5jZWxlZDogYm9vbGVhbjtcclxuXHRwaWNrZWRGaWxlczogVEZpbGVbXTtcclxuXHRleHBvcnRQYXRoOiBQYXRoO1xyXG5cdHZhbGlkUGF0aDogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEV4cG9ydE1vZGFsIGV4dGVuZHMgTW9kYWwgXHJcbntcclxuXHRwcml2YXRlIGlzQ2xvc2VkOiBib29sZWFuID0gdHJ1ZTtcclxuXHRwcml2YXRlIGNhbmNlbGVkOiBib29sZWFuID0gdHJ1ZTtcclxuXHRwcml2YXRlIGZpbGVQaWNrZXJNb2RhbEVsOiBIVE1MRWxlbWVudDtcclxuXHRwcml2YXRlIGZpbGVQaWNrZXI6IEZpbGVQaWNrZXJUcmVlO1xyXG5cdHByaXZhdGUgcGlja2VkRmlsZXM6IFRGaWxlW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblx0cHJpdmF0ZSB2YWxpZFBhdGg6IGJvb2xlYW4gPSB0cnVlO1xyXG5cclxuXHRwdWJsaWMgZXhwb3J0SW5mbzogRXhwb3J0SW5mbztcclxuXHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRzdXBlcihhcHApO1xyXG5cdH1cclxuXHJcblx0b3ZlcnJpZGVQaWNrZWRGaWxlcyhmaWxlczogVEZpbGVbXSlcclxuXHR7XHJcblx0XHR0aGlzLnBpY2tlZEZpbGVzID0gZmlsZXM7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBAYnJpZWYgT3BlbnMgdGhlIG1vZGFsIGFuZCBhc3luYyBibG9ja3MgdW50aWwgdGhlIG1vZGFsIGlzIGNsb3NlZC5cclxuXHQgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBFWFBPUlQgYnV0dG9uIHdhcyBwcmVzc2VkLCBmYWxzZSBpcyB0aGUgZXhwb3J0IHdhcyBjYW5jZWxlZC5cclxuXHQgKiBAb3ZlcnJpZGVcclxuXHQqL1xyXG5cdGFzeW5jIG9wZW4oKTogUHJvbWlzZTxFeHBvcnRJbmZvPiBcclxuXHR7XHJcblx0XHR0aGlzLmlzQ2xvc2VkID0gZmFsc2U7XHJcblx0XHR0aGlzLmNhbmNlbGVkID0gdHJ1ZTtcclxuXHJcblx0XHRzdXBlci5vcGVuKCk7XHJcblxyXG5cdFx0aWYoIXRoaXMuZmlsZVBpY2tlck1vZGFsRWwpXHJcblx0XHR7XHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlck1vZGFsRWwgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ21vZGFsJyB9KTtcclxuXHRcdFx0dGhpcy5jb250YWluZXJFbC5pbnNlcnRCZWZvcmUodGhpcy5maWxlUGlja2VyTW9kYWxFbCwgdGhpcy5tb2RhbEVsKTtcclxuXHRcdFx0dGhpcy5maWxlUGlja2VyTW9kYWxFbC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlck1vZGFsRWwuc3R5bGUuekluZGV4ID0gXCIxXCI7XHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlck1vZGFsRWwuc3R5bGUud2lkdGggPSBcIjIwZW1cIjtcclxuXHRcdFx0dGhpcy5maWxlUGlja2VyTW9kYWxFbC5zdHlsZS5wYWRkaW5nID0gXCIwXCI7XHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlck1vZGFsRWwuc3R5bGUubWFyZ2luID0gXCIxMHB4XCI7XHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlck1vZGFsRWwuc3R5bGUubWF4SGVpZ2h0ID0gXCI4MCVcIjtcclxuXHRcdFx0dGhpcy5maWxlUGlja2VyTW9kYWxFbC5zdHlsZS5ib3hTaGFkb3cgPSBcIjAgMCA3cHggMXB4IGluc2V0ICMwMDAwMDA2MFwiO1xyXG5cclxuXHRcdFx0bGV0IGNvbnRhaW5lciA9IHRoaXMuZmlsZVBpY2tlck1vZGFsRWwuY3JlYXRlRGl2KHsgY2xzOiAnbW9kYWwtY29udGVudCB0cmVlLWNvbnRhaW5lciBmaWxlLXRyZWUgbW9kLW5hdi1pbmRpY2F0b3InIH0pO1xyXG5cdFx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gXCIxMDAlXCI7XHJcblx0XHRcdGNvbnRhaW5lci5zdHlsZS53aWR0aCA9IFwiMTAwJVwiO1xyXG5cdFx0XHRjb250YWluZXIuc3R5bGUucGFkZGluZyA9IFwiMFwiO1xyXG5cdFx0XHRjb250YWluZXIuc3R5bGUubWFyZ2luID0gXCIwXCI7XHJcblx0XHRcdGNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCI7XHJcblx0XHRcdGNvbnRhaW5lci5zdHlsZS5mbGV4RGlyZWN0aW9uID0gXCJjb2x1bW5cIjtcclxuXHRcdFx0Y29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSBcImZsZXgtZW5kXCI7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgc2Nyb2xsQXJlYSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICd0cmVlLXNjcm9sbC1hcmVhJyB9KTtcclxuXHRcdFx0c2Nyb2xsQXJlYS5zdHlsZS5oZWlnaHQgPSBcIjEwMCVcIjtcclxuXHRcdFx0c2Nyb2xsQXJlYS5zdHlsZS53aWR0aCA9IFwiMTAwJVwiO1xyXG5cdFx0XHRzY3JvbGxBcmVhLnN0eWxlLm92ZXJmbG93WSA9IFwiYXV0b1wiO1xyXG5cdFx0XHRzY3JvbGxBcmVhLnN0eWxlLm92ZXJmbG93WCA9IFwiaGlkZGVuXCI7XHJcblx0XHRcdHNjcm9sbEFyZWEuc3R5bGUucGFkZGluZyA9IFwiMWVtXCI7XHJcblx0XHRcdHNjcm9sbEFyZWEuc3R5bGUuYm94U2hhZG93ID0gXCIwIDAgN3B4IDFweCBpbnNldCAjMDAwMDAwNjBcIjtcclxuXHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlciA9IG5ldyBGaWxlUGlja2VyVHJlZShhcHAudmF1bHQuZ2V0RmlsZXMoKSwgdHJ1ZSwgdHJ1ZSk7XHJcblx0XHRcdHRoaXMuZmlsZVBpY2tlci5nZW5lcmF0ZVdpdGhJdGVtc0Nsb3NlZCA9IHRydWU7XHJcblx0XHRcdGF3YWl0IHRoaXMuZmlsZVBpY2tlci5nZW5lcmF0ZVRyZWUoc2Nyb2xsQXJlYSk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZigodGhpcy5waWNrZWRGaWxlcz8ubGVuZ3RoID8/IDAgPiAwKSB8fCBNYWluU2V0dGluZ3Muc2V0dGluZ3MuZmlsZXNUb0V4cG9ydFswXS5sZW5ndGggPiAwKSBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBmaWxlc1RvUGljayA9IHRoaXMucGlja2VkRmlsZXM/Lm1hcChmaWxlID0+IG5ldyBQYXRoKGZpbGUucGF0aCkpID8/IE1haW5TZXR0aW5ncy5zZXR0aW5ncy5maWxlc1RvRXhwb3J0WzBdLm1hcChwYXRoID0+IG5ldyBQYXRoKHBhdGgpKTtcclxuXHRcdFx0XHR0aGlzLmZpbGVQaWNrZXIuc2V0U2VsZWN0ZWRGaWxlcyhmaWxlc1RvUGljayk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBzYXZlRmlsZXMgPSBuZXcgU2V0dGluZyhjb250YWluZXIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiU2F2ZVwiKS5vbkNsaWNrKGFzeW5jICgpID0+XHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmZpbGVzVG9FeHBvcnRbMF0gPSB0aGlzLmZpbGVQaWNrZXIuZ2V0U2VsZWN0ZWRGaWxlcygpLm1hcChmaWxlID0+IGZpbGUucGF0aCk7XHJcblx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0c2F2ZUZpbGVzLnNldHRpbmdFbC5zdHlsZS5ib3JkZXIgPSBcIm5vbmVcIjtcclxuXHRcdFx0c2F2ZUZpbGVzLnNldHRpbmdFbC5zdHlsZS5tYXJnaW5SaWdodCA9IFwiMWVtXCI7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xyXG5cclxuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xyXG5cclxuXHRcdHRoaXMudGl0bGVFbC5zZXRUZXh0KCdFeHBvcnQgdG8gSFRNTCcpO1xyXG5cclxuXHRcdGlmIChIVE1MRXhwb3J0UGx1Z2luLnVwZGF0ZUluZm8udXBkYXRlQXZhaWxhYmxlKSBcclxuXHRcdHtcclxuXHRcdFx0Ly8gY3JlYXRlIHJlZCBub3RpY2Ugc2hvd2luZyB0aGUgdXBkYXRlIGlzIGF2YWlsYWJsZVxyXG5cdFx0XHRsZXQgdXBkYXRlTm90aWNlID0gY29udGVudEVsLmNyZWF0ZUVsKCdzdHJvbmcnLCB7IHRleHQ6IGBVcGRhdGUgQXZhaWxhYmxlOiAke0hUTUxFeHBvcnRQbHVnaW4udXBkYXRlSW5mby5jdXJyZW50VmVyc2lvbn0g4p+2ICR7SFRNTEV4cG9ydFBsdWdpbi51cGRhdGVJbmZvLmxhdGVzdFZlcnNpb259YCB9KTtcclxuXHRcdFx0dXBkYXRlTm90aWNlLnNldEF0dHJpYnV0ZShcInN0eWxlXCIsXHJcblx0XHRcdFx0YG1hcmdpbi1ibG9jay1zdGFydDogY2FsYyh2YXIoLS1oMy1zaXplKS8yKTtcclxuXHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtbm9ybWFsKTtcclxuXHRcdFx0cGFkZGluZzogNHB4O1xyXG5cdFx0XHRwYWRkaW5nLWxlZnQ6IDFlbTtcclxuXHRcdFx0cGFkZGluZy1yaWdodDogMWVtO1xyXG5cdFx0XHRjb2xvcjogdmFyKC0tY29sb3ItcmVkKTtcclxuXHRcdFx0Ym9yZGVyLXJhZGl1czogNXB4O1xyXG5cdFx0XHRkaXNwbGF5OiBibG9jaztcclxuXHRcdFx0d2lkdGg6IGZpdC1jb250ZW50O2ApXHJcblxyXG5cdFx0XHQvLyBjcmVhdGUgbm9ybWFsIGJsb2NrIHdpdGggdXBkYXRlIG5vdGVzXHJcblx0XHRcdGxldCB1cGRhdGVOb3RlcyA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBIVE1MRXhwb3J0UGx1Z2luLnVwZGF0ZUluZm8udXBkYXRlTm90ZSB9KTtcclxuXHRcdFx0dXBkYXRlTm90ZXMuc2V0QXR0cmlidXRlKFwic3R5bGVcIixcclxuXHRcdFx0XHRgbWFyZ2luLWJsb2NrLXN0YXJ0OiBjYWxjKHZhcigtLWgzLXNpemUpLzIpO1xyXG5cdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeS1hbHQpO1xyXG5cdFx0XHRwYWRkaW5nOiA0cHg7XHJcblx0XHRcdHBhZGRpbmctbGVmdDogMWVtO1xyXG5cdFx0XHRwYWRkaW5nLXJpZ2h0OiAxZW07XHJcblx0XHRcdGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcblx0XHRcdGZvbnQtc2l6ZTogdmFyKC0tZm9udC11aS1zbWFsbGVyKTtcclxuXHRcdFx0Ym9yZGVyLXJhZGl1czogNXB4O1xyXG5cdFx0XHRkaXNwbGF5OiBibG9jaztcclxuXHRcdFx0d2lkdGg6IGZpdC1jb250ZW50O1xyXG5cdFx0XHR3aGl0ZS1zcGFjZTogcHJlLXdyYXA7YClcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgbW9kZURlc2NyaXB0aW9ucyA9IFxyXG5cdFx0e1xyXG5cdFx0XHRcIndlYnNpdGVcIjogXCJUaGlzIHdpbGwgZXhwb3J0IGEgZmlsZSBzdHJ1Y3R1cmUgc3VpdGFibGUgZm9yIHVwbG9hZGluZyB0byB5b3VyIG93biB3ZWIgc2VydmVyLlwiLFxyXG5cdFx0XHRcImxvY2FsXCI6IFwiVGhpcyB3aWxsIGV4cG9ydCBhbiBleGVjdXRhYmxlIGZpbGUgYWxvbmcgd2l0aCBhIGRhdGFiYXNlIGZpbGUuIFRoaXMgbWFrZXMgaXQgZWFzeSB0byBzaGFyZSB0aGUgd2hvbGUgdmF1bHQgd2l0aCBvdGhlcnMgYnkgb25seSBzaGFyaW5nIDIgZmlsZXMuXCIsXHJcblx0XHRcdFwiZG9jdW1lbnRzXCI6IFwiVGhpcyB3aWxsIGV4cG9ydCBzZWxmLWNvbnRhaW5lZCBodG1sIGRvY3VtZW50cy5cIixcclxuXHRcdFx0XCJyYXctZG9jdW1lbnRzXCI6IFwiVGhpcyB3aWxsIGV4cG9ydCByYXcsIHNlbGYtY29udGFpbmVkIGRvY3VtZW50cyB3aXRob3V0IHRoZSB3ZWJzaXRlIGxheW91dC4gVGhpcyBpcyB1c2VmdWwgZm9yIHNoYXJpbmcgaW5kaXZpZHVhbCBub3Rlcywgb3IgcHJpbnRpbmcuXCJcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgZXhwb3J0TW9kZVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdFeHBvcnQgTW9kZScpXHJcblx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0LnNldERlc2MobW9kZURlc2NyaXB0aW9uc1tNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UHJlc2V0ID8/ICd3ZWJzaXRlJ10pXHJcblx0XHRcdC5zZXRIZWFkaW5nKClcclxuXHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4gZHJvcGRvd25cclxuXHRcdFx0XHQuYWRkT3B0aW9uKCd3ZWJzaXRlJywgJ09ubGluZSBXZWIgU2VydmVyJylcclxuXHRcdFx0XHQvLyAuYWRkT3B0aW9uKCdsb2NhbCcsICdMb2NhbCBTaGFyZWFibGUgV2ViIFNlcnZlcicpIFRoaXMgZmVhdHVyZSBpcyBub3QgcmVhZHkgeWV0LCBzbyBpdCBpcyBkaXNhYmxlZCBmb3Igbm93XHJcblx0XHRcdFx0LmFkZE9wdGlvbignZG9jdW1lbnRzJywgJ0hUTUwgRG9jdW1lbnRzJylcclxuXHRcdFx0XHQuYWRkT3B0aW9uKCdyYXctZG9jdW1lbnRzJywgJ1JhdyBIVE1MIERvY3VtZW50cycpXHJcblx0XHRcdFx0LnNldFZhbHVlKFtcIndlYnNpdGVcIiwgXCJsb2NhbFwiLCBcImRvY3VtZW50c1wiLCBcInJhdy1kb2N1bWVudHNcIl0uY29udGFpbnMoTWFpblNldHRpbmdzLnNldHRpbmdzLmV4cG9ydFByZXNldCkgPyBNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UHJlc2V0IDogJ3dlYnNpdGUnKVxyXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQcmVzZXQgPSB2YWx1ZTtcclxuXHJcblx0XHRcdFx0XHRzd2l0Y2ggKHZhbHVlKSB7XHJcblx0XHRcdFx0XHRcdGNhc2UgJ2RvY3VtZW50cyc6XHJcblx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmlubGluZUNTUyA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmlubGluZUpTID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSW1hZ2VzID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MubWFrZU5hbWVzV2ViU3R5bGUgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUdyYXBoVmlldyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHRcdGNhc2UgJ3Jhdy1kb2N1bWVudHMnOlxyXG5cdFx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmlubGluZUNTUyA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSlMgPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmlubGluZUltYWdlcyA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MubWFrZU5hbWVzV2ViU3R5bGUgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3ID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHJcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0Y2FzZSAnbG9jYWwnOlxyXG5cdFx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmxpbmVDU1MgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSlMgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSW1hZ2VzID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLm1ha2VOYW1lc1dlYlN0eWxlID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUdyYXBoVmlldyA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVGaWxlVHJlZSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0Y2FzZSAnd2Vic2l0ZSc6XHJcblx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmlubGluZUNTUyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmxpbmVKUyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmxpbmVJbWFnZXMgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MubWFrZU5hbWVzV2ViU3R5bGUgPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3ID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZUZpbGVUcmVlID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHRoaXMub3BlbigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQpKTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdPcGVuIGFmdGVyIGV4cG9ydCcpXHJcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0LnNldFRvb2x0aXAoJ09wZW4gdGhlIGV4cG9ydGVkIGZpbGUgYWZ0ZXIgZXhwb3J0aW5nLicpXHJcblx0XHRcdFx0LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5vcGVuQWZ0ZXJFeHBvcnQpXHJcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLm9wZW5BZnRlckV4cG9ydCA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0fSkpO1xyXG5cclxuXHRcdGxldCBlcnJvck1lc3NhZ2UgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJyB9KTtcclxuXHRcdGVycm9yTWVzc2FnZS5zdHlsZS5jb2xvciA9IFwidmFyKC0tY29sb3ItcmVkKVwiO1xyXG5cdFx0ZXJyb3JNZXNzYWdlLnN0eWxlLm1hcmdpbkJvdHRvbSA9IFwiMC43NXJlbVwiO1xyXG5cclxuXHRcdGxldCB0ZW1wUGF0aCA9IG5ldyBQYXRoKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQYXRoKTtcclxuXHRcdGlmKCF0ZW1wUGF0aC5pc0RpcmVjdG9yeSkgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIG11c3QgYmUgYSBkaXJlY3RvcnkhXCIpO1xyXG5cdFx0ZWxzZSBpZighdGVtcFBhdGguaXNBYnNvbHV0ZSkgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIG11c3QgYmUgYWJzb2x1dGUhXCIpO1xyXG5cdFx0ZWxzZSBpZighdGVtcFBhdGguZXhpc3RzKSBlcnJvck1lc3NhZ2Uuc2V0VGV4dChcIlBhdGggZG9lcyBub3QgZXhpc3QhXCIpO1xyXG5cclxuXHRcdGlmKGVycm9yTWVzc2FnZS5pbm5lclRleHQgIT0gXCJcIikgXHJcblx0XHR7XHJcblx0XHRcdHRoaXMudmFsaWRQYXRoID0gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IGV4cG9ydEJ1dHRvbiA6IEJ1dHRvbkNvbXBvbmVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuXHRcdGxldCBwYXRoSW5wdXQgOiBUZXh0Q29tcG9uZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHNldEV4cG9ydERpc2FibGVkKGRpc2FibGVkOiBib29sZWFuKVxyXG5cdFx0e1xyXG5cdFx0XHRpZihleHBvcnRCdXR0b24pIFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0ZXhwb3J0QnV0dG9uLnNldERpc2FibGVkKGRpc2FibGVkKTtcclxuXHRcdFx0XHRpZiAoZXhwb3J0QnV0dG9uLmRpc2FibGVkKSBleHBvcnRCdXR0b24uYnV0dG9uRWwuc3R5bGUub3BhY2l0eSA9IFwiMC41XCI7XHJcblx0XHRcdFx0ZWxzZSBleHBvcnRCdXR0b24uYnV0dG9uRWwuc3R5bGUub3BhY2l0eSA9IFwiMVwiO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnJylcclxuXHRcdFx0LnNldEhlYWRpbmcoKVxyXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4gXHJcblx0XHRcdHtcclxuXHRcdFx0XHRwYXRoSW5wdXQgPSB0ZXh0O1xyXG5cdFx0XHRcdHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9ICcxMDAlJztcclxuXHRcdFx0XHR0ZXh0LnNldFBsYWNlaG9sZGVyKCdFbnRlciBhbiBhYnNvbHV0ZSBleHBvcnQgZGlyZWN0b3J5IHBhdGgnKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQYXRoKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4gXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdGxldCBwYXRoID0gbmV3IFBhdGgodmFsdWUpO1xyXG5cdFx0XHRcdFx0XHRpZighcGF0aC5pc0RpcmVjdG9yeSkgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIG11c3QgYmUgYSBkaXJlY3RvcnkhXCIpO1xyXG5cdFx0XHRcdFx0XHRlbHNlIGlmKCFwYXRoLmlzQWJzb2x1dGUpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiUGF0aCBtdXN0IGJlIGFic29sdXRlIVwiKTtcclxuXHRcdFx0XHRcdFx0ZWxzZSBpZighcGF0aC5leGlzdHMpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiUGF0aCBkb2VzIG5vdCBleGlzdCFcIik7XHJcblx0XHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiXCIpO1xyXG5cdFx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQYXRoID0gdmFsdWUucmVwbGFjZUFsbChcIlxcXCJcIiwgXCJcIik7XHJcblx0XHRcdFx0XHRcdFx0dGV4dC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UGF0aCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy52YWxpZFBhdGggPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0c2V0RXhwb3J0RGlzYWJsZWQoIXBhdGguaXNEaXJlY3RvcnkgfHwgIXBhdGguaXNBYnNvbHV0ZSB8fCAhcGF0aC5leGlzdHMpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT5cclxuXHRcdFx0e1xyXG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KCdCcm93c2UnKS5vbkNsaWNrKGFzeW5jICgpID0+IFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGxldCBpZGVhbCA9IFV0aWxzLmlkZWFsRGVmYXVsdFBhdGgoKTtcclxuXHRcdFx0XHRcdGxldCBwYXRoID0gKGF3YWl0IFV0aWxzLnNob3dTZWxlY3RGb2xkZXJEaWFsb2coaWRlYWwpKT8uZGlyZWN0b3J5O1xyXG5cdFx0XHRcdFx0aWYgKHBhdGgpIFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UGF0aCA9IHBhdGguZGlyZWN0b3J5LmFzU3RyaW5nO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblxyXG5cdFx0XHRcdFx0XHRzZXRFeHBvcnREaXNhYmxlZCghcGF0aC5pc0RpcmVjdG9yeSB8fCAhcGF0aC5pc0Fic29sdXRlIHx8ICFwYXRoLmV4aXN0cyk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZighcGF0aC5pc0RpcmVjdG9yeSkgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIG11c3QgYmUgYSBkaXJlY3RvcnkhXCIpO1xyXG5cdFx0XHRcdFx0XHRlbHNlIGlmKCFwYXRoLmlzQWJzb2x1dGUpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiUGF0aCBtdXN0IGJlIGFic29sdXRlIVwiKTtcclxuXHRcdFx0XHRcdFx0ZWxzZSBpZighcGF0aC5leGlzdHMpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiUGF0aCBkb2VzIG5vdCBleGlzdCFcIik7XHJcblx0XHRcdFx0XHRcdGVsc2UgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJcIik7XHJcblxyXG5cdFx0XHRcdFx0XHRwYXRoSW5wdXQ/LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQYXRoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSlcclxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGV4cG9ydEJ1dHRvbiA9IGJ1dHRvbjtcclxuXHRcdFx0XHRzZXRFeHBvcnREaXNhYmxlZCghdGhpcy52YWxpZFBhdGgpO1xyXG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KCdFeHBvcnQnKS5vbkNsaWNrKGFzeW5jICgpID0+IFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdHRoaXMuY2FuY2VsZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdHRoaXMuY2xvc2UoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbnRlbnRFbC5hcHBlbmRDaGlsZChlcnJvck1lc3NhZ2UpO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0LnNldERlc2MoXCJNb3JlIG9wdGlvbnMgbG9jYXRlZCBvbiB0aGUgcGx1Z2luIHNldHRpbmdzIHBhZ2UuXCIpXHJcblx0XHRcdC5hZGRFeHRyYUJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0VG9vbHRpcCgnT3BlbiBwbHVnaW4gc2V0dGluZ3MnKS5vbkNsaWNrKCgpID0+IHtcclxuXHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRhcHAuc2V0dGluZy5vcGVuKCk7XHJcblx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0YXBwLnNldHRpbmcub3BlblRhYkJ5SWQoJ3dlYnBhZ2UtaHRtbC1leHBvcnQnKTtcclxuXHRcdH0pKTtcclxuXHJcblx0XHR0aGlzLmZpbGVQaWNrZXJNb2RhbEVsLnN0eWxlLmhlaWdodCA9IHRoaXMubW9kYWxFbC5jbGllbnRIZWlnaHQgKiAyICsgXCJweFwiO1xyXG5cclxuXHRcdGF3YWl0IFV0aWxzLndhaXRVbnRpbCgoKSA9PiB0aGlzLmlzQ2xvc2VkLCA2MCAqIDYwICogMTAwMCwgMTApO1xyXG5cdFx0XHJcblx0XHR0aGlzLnBpY2tlZEZpbGVzID0gdGhpcy5maWxlUGlja2VyLmdldFNlbGVjdGVkRmlsZXMoKTtcclxuXHRcdHRoaXMuZmlsZVBpY2tlck1vZGFsRWwucmVtb3ZlKCk7XHJcblx0XHR0aGlzLmV4cG9ydEluZm8gPSB7IGNhbmNlbGVkOiB0aGlzLmNhbmNlbGVkLCBwaWNrZWRGaWxlczogdGhpcy5waWNrZWRGaWxlcywgZXhwb3J0UGF0aDogbmV3IFBhdGgoTWFpblNldHRpbmdzLnNldHRpbmdzLmV4cG9ydFBhdGgpLCB2YWxpZFBhdGg6IHRoaXMudmFsaWRQYXRofTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5leHBvcnRJbmZvO1xyXG5cdH1cclxuXHJcblx0b25DbG9zZSgpIFxyXG5cdHtcclxuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xyXG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XHJcblx0XHR0aGlzLmlzQ2xvc2VkID0gdHJ1ZTtcclxuXHR9XHJcbn1cclxuIl19