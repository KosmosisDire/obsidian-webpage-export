import { __awaiter } from "tslib";
import { Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import { Utils } from '../utils/utils';
import { Path } from '../utils/path';
import pluginStylesBlacklist from 'assets/third-party-styles-blacklist.txt';
import { FlowList } from './flow-list';
import { ExportModal } from './export-modal';
import { migrateSettings } from './settings-migration';
const DEFAULT_SETTINGS = {
    settingsVersion: "0.0.0",
    upgradedFrom: "0.0.0",
    // Inlining Options
    inlineCSS: false,
    inlineJS: false,
    inlineImages: false,
    includePluginCSS: '',
    includeSvelteCSS: true,
    customHeadContentPath: '',
    // Formatting Options
    makeNamesWebStyle: true,
    allowFoldingHeadings: true,
    sidebarsAlwaysCollapsible: false,
    addFilenameTitle: true,
    minifyHTML: true,
    customLineWidth: "",
    contentWidth: "",
    sidebarWidth: "",
    startOutlineCollapsed: false,
    // Export Options
    logLevel: "warning",
    incrementalExport: false,
    deleteOldExportedFiles: false,
    // Page Features
    addDarkModeToggle: true,
    includeOutline: true,
    includeGraphView: true,
    includeFileTree: true,
    // Main Export Options
    exportPreset: 'website',
    openAfterExport: false,
    // Graph View Settings
    graphAttractionForce: 1,
    graphLinkLength: 10,
    graphRepulsionForce: 150,
    graphCentralForce: 3,
    graphEdgePruning: 100,
    graphMinNodeSize: 3,
    graphMaxNodeSize: 7,
    // Cache
    exportPath: '',
    filesToExport: [[]],
};
// #endregion
export class MainSettings extends PluginSettingTab {
    getBlacklistedPluginIDs() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.blacklistedPluginIDs.length > 0)
                return this.blacklistedPluginIDs;
            this.blacklistedPluginIDs = pluginStylesBlacklist.replaceAll("\r", "").split("\n");
            return this.blacklistedPluginIDs;
        });
    }
    constructor(plugin) {
        super(app, plugin);
        this.blacklistedPluginIDs = [];
        MainSettings.plugin = plugin;
    }
    static loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings = Object.assign({}, DEFAULT_SETTINGS, yield MainSettings.plugin.loadData());
            MainSettings.settings.customLineWidth = MainSettings.settings.customLineWidth.toString();
            if (MainSettings.settings.customLineWidth === "0")
                MainSettings.settings.customLineWidth = "";
            yield migrateSettings(MainSettings.settings);
            MainSettings.loaded = true;
        });
    }
    static saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield MainSettings.plugin.saveData(MainSettings.settings);
        });
    }
    static renameFile(file, oldPath) {
        let oldPathParsed = new Path(oldPath).asString;
        MainSettings.settings.filesToExport.forEach((fileList) => {
            let index = fileList.indexOf(oldPathParsed);
            if (index >= 0) {
                fileList[index] = file.path;
            }
        });
    }
    static updateSettings(usePreviousSettings = false, overrideFiles = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!usePreviousSettings) {
                let modal = new ExportModal();
                if (overrideFiles)
                    modal.overridePickedFiles(overrideFiles);
                return yield modal.open();
            }
            let files = MainSettings.settings.filesToExport[0];
            let path = new Path(MainSettings.settings.exportPath);
            if ((files.length == 0 && overrideFiles == undefined) || !path.exists || !path.isAbsolute || !path.isDirectory) {
                new Notice("Please set the export path and files to export in the settings first.", 5000);
                let modal = new ExportModal();
                if (overrideFiles)
                    modal.overridePickedFiles(overrideFiles);
                return yield modal.open();
            }
            return undefined;
        });
    }
    static isAllInline() {
        return MainSettings.settings.inlineCSS && MainSettings.settings.inlineJS && MainSettings.settings.inlineImages;
    }
    static getFilesToExport() {
        let files = [];
        MainSettings.settings.filesToExport.forEach((fileList) => {
            fileList.forEach((filePath) => {
                let file = app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile)
                    files.push(file);
            });
        });
        return files;
    }
    // #endregion
    display() {
        const { containerEl: contentEl } = this;
        // #region Settings Header
        contentEl.empty();
        let header = contentEl.createEl('h2', { text: 'HTML Export Settings' });
        header.style.display = 'block';
        header.style.marginBottom = '15px';
        let supportLink = contentEl.createEl('a');
        let buttonColor = Utils.sampleCSSColorHex("--color-accent", document.body).hex;
        let buttonTextColor = Utils.sampleCSSColorHex("--text-on-accent", document.body).hex;
        // @ts-ignore
        supportLink.outerHTML = `<a href="https://www.buymeacoffee.com/nathangeorge"><img style="height:40px;" src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=nathangeorge&button_colour=${buttonColor}&font_colour=${buttonTextColor}&font_family=Poppins&outline_colour=${buttonTextColor}&coffee_colour=FFDD00"></a>`;
        let supportHeader = contentEl.createDiv({ text: 'Support the continued development of this plugin.', cls: "setting-item-description" });
        supportHeader.style.display = 'block';
        supportHeader.style.marginBottom = '20px';
        // #endregion
        //#region Page Features
        let hr = contentEl.createEl("hr");
        hr.style.marginTop = "20px";
        hr.style.marginBottom = "20px";
        hr.style.borderColor = "var(--color-accent)";
        hr.style.opacity = "0.5";
        new Setting(contentEl)
            .setName('Page Features:')
            .setDesc("Special features to embed onto the page.")
            .setHeading();
        if (MainSettings.settings.exportPreset != "raw-documents") {
            new Setting(contentEl)
                .setName('Include theme toggle')
                .setDesc('Adds a theme toggle to the left sidebar.')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.addDarkModeToggle)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.addDarkModeToggle = value;
                yield MainSettings.saveSettings();
            })));
            new Setting(contentEl)
                .setName('Include document outline')
                .setDesc('Adds the document\'s table of contents to the right sidebar.')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.includeOutline)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.includeOutline = value;
                yield MainSettings.saveSettings();
            })));
            new Setting(contentEl)
                .setName('Include file tree')
                .setDesc('Adds an interactive file tree to the left sidebar.')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.includeFileTree)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.includeFileTree = value;
                yield MainSettings.saveSettings();
            })));
        }
        let errorMessage = contentEl.createDiv({ cls: 'setting-item-description' });
        errorMessage.style.color = "var(--color-red)";
        errorMessage.style.marginBottom = "0.75rem";
        if (!(MainSettings.settings.customHeadContentPath.trim() == "")) {
            let tempPath = new Path(MainSettings.settings.customHeadContentPath);
            if (tempPath.isDirectory)
                errorMessage.setText("Path must be a file!");
            else if (!tempPath.isAbsolute)
                errorMessage.setText("Path must be absolute!");
            else if (!tempPath.exists)
                errorMessage.setText("Path does not exist!");
        }
        let pathInput = undefined;
        new Setting(contentEl)
            .setName('Custom head content path')
            .addText((text) => {
            pathInput = text;
            text.inputEl.style.width = '100%';
            text.setPlaceholder('Enter an absolute path to any text file')
                .setValue(MainSettings.settings.customHeadContentPath)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                let path = new Path(value);
                if (value == "")
                    errorMessage.setText("");
                else if (path.isDirectory)
                    errorMessage.setText("Path must be a file!");
                else if (!path.isAbsolute)
                    errorMessage.setText("Path must be absolute!");
                else if (!path.exists)
                    errorMessage.setText("Path does not exist!");
                else {
                    errorMessage.setText("");
                    MainSettings.settings.customHeadContentPath = value.replaceAll("\"", "");
                    text.setValue(MainSettings.settings.customHeadContentPath);
                    yield MainSettings.saveSettings();
                }
            }));
        })
            .addButton((button) => {
            button.setButtonText('Browse').onClick(() => __awaiter(this, void 0, void 0, function* () {
                let ideal = Utils.idealDefaultPath();
                let path = (yield Utils.showSelectFileDialog(ideal));
                if (path) {
                    MainSettings.settings.customHeadContentPath = path.asString;
                    yield MainSettings.saveSettings();
                    if (path.isDirectory)
                        errorMessage.setText("Path must be a file!");
                    else if (!path.isAbsolute)
                        errorMessage.setText("Path must be absolute!");
                    else if (!path.exists)
                        errorMessage.setText("Path does not exist!");
                    else
                        errorMessage.setText("");
                    pathInput === null || pathInput === void 0 ? void 0 : pathInput.setValue(MainSettings.settings.customHeadContentPath);
                }
            }));
        });
        contentEl.appendChild(errorMessage);
        if (MainSettings.settings.exportPreset != "raw-documents") {
            hr = contentEl.createEl("hr");
            hr.style.marginTop = "20px";
            hr.style.marginBottom = "20px";
            hr.style.borderColor = "var(--color-accent)";
            hr.style.opacity = "0.5";
            new Setting(contentEl)
                .setName('Page Behaviors:')
                .setDesc("Control the behavior of different page features.")
                .setHeading();
            new Setting(contentEl)
                .setName('Start Outline Collapsed')
                .setDesc('Start the document\'s table of contents with all items collapsed')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.startOutlineCollapsed)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.startOutlineCollapsed = value;
                yield MainSettings.saveSettings();
            })));
            new Setting(contentEl)
                .setName('Allow folding headings')
                .setDesc('Allow headings to be folded with an arrow icon beside each heading, just as in Obsidian.')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.allowFoldingHeadings)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.allowFoldingHeadings = value;
                yield MainSettings.saveSettings();
            })));
            new Setting(contentEl)
                .setName('Sidebars Always Collapsible')
                .setDesc('Always allow the sidebars to be collapsed regardless of the space on the screen. By default the sidebars adjust whether they can be collapsed based on the space available.')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.sidebarsAlwaysCollapsible)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.sidebarsAlwaysCollapsible = value;
                yield MainSettings.saveSettings();
            })));
        }
        //#endregion
        //#region Layout Options
        hr = contentEl.createEl("hr");
        hr.style.marginTop = "20px";
        hr.style.marginBottom = "20px";
        hr.style.borderColor = "var(--color-accent)";
        hr.style.opacity = "0.5";
        new Setting(contentEl)
            .setName('Layout Options:')
            .setHeading();
        new Setting(contentEl)
            .setName('Document Width')
            .setDesc('Sets the line width of the exported document. Use any css units.\nDefault units: px')
            .addText((text) => text
            .setValue(MainSettings.settings.customLineWidth)
            .setPlaceholder('Leave blank for default')
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.customLineWidth = value;
            yield MainSettings.saveSettings();
        })))
            .addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
            MainSettings.settings.customLineWidth = "";
            MainSettings.saveSettings();
            this.display();
        }));
        new Setting(contentEl)
            .setName('Content Width')
            .setDesc('Sets the width of the central content section of the document. This will push the sidebars towards the edges of the screen the larger it is leaving margins on either side of the document. Use any css units.\nDefault units: px')
            .addText((text) => text
            .setValue(MainSettings.settings.contentWidth)
            .setPlaceholder('Leave blank for default')
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.contentWidth = value;
            yield MainSettings.saveSettings();
        })))
            .addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
            MainSettings.settings.contentWidth = "";
            MainSettings.saveSettings();
            this.display();
        }));
        new Setting(contentEl)
            .setName('Sidebar Width')
            .setDesc('Sets the width of the sidebar\'s content. Use any css units.\nDefault units: px')
            .addText((text) => text
            .setValue(MainSettings.settings.sidebarWidth)
            .setPlaceholder('Leave blank for default')
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.sidebarWidth = value;
            yield MainSettings.saveSettings();
        })))
            .addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
            MainSettings.settings.sidebarWidth = "";
            MainSettings.saveSettings();
            this.display();
        }));
        //#endregion
        //#region Export Options
        hr = contentEl.createEl("hr");
        hr.style.marginTop = "20px";
        hr.style.marginBottom = "20px";
        hr.style.borderColor = "var(--color-accent)";
        hr.style.opacity = "0.5";
        new Setting(contentEl)
            .setName('Export Options:')
            .setHeading();
        new Setting(contentEl)
            .setName('Log Level')
            .setDesc('Set the level of logging to display in the export log.')
            .addDropdown((dropdown) => dropdown
            .addOption('all', 'All')
            .addOption('warning', 'Warning')
            .addOption('error', 'Error')
            .addOption('fatal', 'Only Fatal Errors')
            .setValue(MainSettings.settings.logLevel)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.logLevel = value;
            yield MainSettings.saveSettings();
        })));
        new Setting(contentEl)
            .setName('Make names web style')
            .setDesc('Make the names of files and folders lowercase and replace spaces with dashes.')
            .addToggle((toggle) => toggle
            .setValue(MainSettings.settings.makeNamesWebStyle)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.makeNamesWebStyle = value;
            yield MainSettings.saveSettings();
        })));
        new Setting(contentEl)
            .setName('Minify HTML')
            .setDesc('Minify the HTML to make it load faster (but it will be less readable to humans).')
            .addToggle((toggle) => toggle
            .setValue(MainSettings.settings.minifyHTML)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.minifyHTML = value;
            yield MainSettings.saveSettings();
        })));
        //#endregion
        //#region Plugin CSS
        hr = contentEl.createEl("hr");
        hr.style.marginTop = "20px";
        hr.style.marginBottom = "20px";
        hr.style.borderColor = "var(--color-accent)";
        hr.style.opacity = "0.5";
        new Setting(contentEl)
            .setName('Include Plugin CSS')
            .setDesc('Include the CSS from the following plugins in the exported HTML. If plugin features aren\'t rendering correctly, try adding the plugin to this list.')
            .setHeading();
        let pluginsList = new FlowList(contentEl);
        Utils.getPluginIDs().forEach((plugin) => __awaiter(this, void 0, void 0, function* () {
            let pluginManifest = Utils.getPluginManifest(plugin);
            if (!pluginManifest)
                return;
            if ((yield this.getBlacklistedPluginIDs()).contains(pluginManifest.id)) {
                return;
            }
            let pluginDir = pluginManifest.dir;
            if (!pluginDir)
                return;
            let pluginPath = new Path(pluginDir);
            let hasCSS = pluginPath.joinString('styles.css').exists;
            if (!hasCSS)
                return;
            let isChecked = MainSettings.settings.includePluginCSS.match(new RegExp(`^${plugin}`, 'm')) != null;
            pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) => {
                MainSettings.settings.includePluginCSS = pluginsList.checkedList.join('\n');
                MainSettings.saveSettings();
            });
        }));
        new Setting(contentEl)
            .setName('Include Svelte CSS')
            .setDesc('Include the CSS from any plugins that use the svelte framework.')
            .addToggle((toggle) => toggle
            .setValue(MainSettings.settings.includeSvelteCSS)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.includeSvelteCSS = value;
            yield MainSettings.saveSettings();
        })));
        //#endregion
        //#region Experimental
        let experimentalContainer = contentEl.createDiv();
        let experimentalHR1 = experimentalContainer.createEl('hr');
        let experimentalHeader = experimentalContainer.createEl('span', { text: 'Experimental' });
        let experimentalHR2 = experimentalContainer.createEl('hr');
        experimentalContainer.style.display = 'flex';
        experimentalContainer.style.marginTop = '5em';
        experimentalContainer.style.alignItems = 'center';
        experimentalHR1.style.borderColor = "var(--color-red)";
        experimentalHR2.style.borderColor = "var(--color-red)";
        experimentalHeader.style.color = "var(--color-red)";
        experimentalHR1.style.flexGrow = "1";
        experimentalHR2.style.flexGrow = "1";
        experimentalHeader.style.flexGrow = "0.1";
        experimentalHeader.style.textAlign = "center";
        new Setting(contentEl)
            .setName('Only Export Modified')
            .setDesc('Disable this to do a full re-export. If you have an existing vault since before this feature was introduced, please do a full re-export before turning this on!')
            .addToggle((toggle) => toggle
            .setValue(MainSettings.settings.incrementalExport)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.incrementalExport = value;
            yield MainSettings.saveSettings();
        })));
        new Setting(contentEl)
            .setName('Delete Old Files')
            .setDesc('Delete *ALL* files in the export directory that are not included in this export.')
            .addToggle((toggle) => toggle
            .setValue(MainSettings.settings.deleteOldExportedFiles)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            MainSettings.settings.deleteOldExportedFiles = value;
            yield MainSettings.saveSettings();
        })));
        if (MainSettings.settings.exportPreset != "raw-documents") {
            new Setting(contentEl)
                .setName('Graph View (PLEASE READ DESCRIPTION)')
                .setDesc('This CANNOT be used with the file:// protocol, the assets for this also will not be inlined into the HTML file at this point.')
                .setHeading();
            new Setting(contentEl)
                .setName('Include global graph view')
                .setDesc('Include an interactive graph view sim of the WHOLE vault similar to obsidian\'s. ')
                .addToggle((toggle) => toggle
                .setValue(MainSettings.settings.includeGraphView)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.includeGraphView = value;
                yield MainSettings.saveSettings();
            })));
            new Setting(contentEl)
                .setName('Graph View Settings')
                .setDesc('Settings to control the behavior and look of the graph view. For now there is no live preview of this, so you must export your files to see your changes.')
                .setHeading();
            new Setting(contentEl)
                .setName('Attraction Force')
                .setDesc("How much should linked nodes attract each other? This will make the graph appear more clustered.")
                .addSlider((slider) => slider
                .setLimits(0, 100, 1)
                .setValue(MainSettings.settings.graphAttractionForce / (2 / 100))
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                // remap to 0 - 2;
                let remapMultiplier = 2 / 100;
                MainSettings.settings.graphAttractionForce = value * remapMultiplier;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
            new Setting(contentEl)
                .setName('Link Length')
                .setDesc("How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.")
                .addSlider((slider) => slider
                .setLimits(0, 100, 1)
                .setValue(MainSettings.settings.graphLinkLength)
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.graphLinkLength = value;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
            new Setting(contentEl)
                .setName('Repulsion Force')
                .setDesc("How much should nodes repel each other? This will make the graph appear more spread out.")
                .addSlider((slider) => slider
                .setLimits(0, 100, 1)
                .setValue(MainSettings.settings.graphRepulsionForce / 3)
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.graphRepulsionForce = value * 3;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
            new Setting(contentEl)
                .setName('Central Force')
                .setDesc("How much should nodes be attracted to the center? This will make the graph appear more dense and circular.")
                .addSlider((slider) => slider
                .setLimits(0, 100, 1)
                .setValue(MainSettings.settings.graphCentralForce / (5 / 100))
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                // remap to 0 - 5;
                let remapMultiplier = 5 / 100;
                MainSettings.settings.graphCentralForce = value * remapMultiplier;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
            new Setting(contentEl)
                .setName('Max Node Radius')
                .setDesc("How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.")
                .addSlider((slider) => slider
                .setLimits(3, 15, 1)
                .setValue(MainSettings.settings.graphMaxNodeSize)
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.graphMaxNodeSize = value;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
            new Setting(contentEl)
                .setName('Min Node Radius')
                .setDesc("How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.")
                .addSlider((slider) => slider
                .setLimits(3, 15, 1)
                .setValue(MainSettings.settings.graphMinNodeSize)
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.graphMinNodeSize = value;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
            new Setting(contentEl)
                .setName('Edge Pruning Factor')
                .setDesc("Edges with a length below this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.")
                .addSlider((slider) => slider
                .setLimits(0, 100, 1)
                .setValue(100 - MainSettings.settings.graphEdgePruning)
                .setDynamicTooltip()
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                MainSettings.settings.graphEdgePruning = 100 - value;
                yield MainSettings.saveSettings();
            }))
                .showTooltip());
        }
        let experimentalHREnd = contentEl.createEl('hr');
        experimentalHREnd.style.borderColor = "var(--color-red)";
        //#endregion
    }
}
// #region Class Functions and Variables
MainSettings.settings = DEFAULT_SETTINGS;
MainSettings.loaded = false;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi1zZXR0aW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4tc2V0dGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQVUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBaUIsTUFBTSxVQUFVLENBQUM7QUFDM0YsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDckMsT0FBTyxxQkFBcUIsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3ZDLE9BQU8sRUFBYyxXQUFXLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUV6RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUF5RHZELE1BQU0sZ0JBQWdCLEdBQ3RCO0lBQ0MsZUFBZSxFQUFFLE9BQU87SUFDeEIsWUFBWSxFQUFFLE9BQU87SUFFckIsbUJBQW1CO0lBQ25CLFNBQVMsRUFBRSxLQUFLO0lBQ2hCLFFBQVEsRUFBRSxLQUFLO0lBQ2YsWUFBWSxFQUFFLEtBQUs7SUFDbkIsZ0JBQWdCLEVBQUUsRUFBRTtJQUNwQixnQkFBZ0IsRUFBRSxJQUFJO0lBQ3RCLHFCQUFxQixFQUFFLEVBQUU7SUFFekIscUJBQXFCO0lBQ3JCLGlCQUFpQixFQUFFLElBQUk7SUFDdkIsb0JBQW9CLEVBQUUsSUFBSTtJQUMxQix5QkFBeUIsRUFBRSxLQUFLO0lBQ2hDLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsVUFBVSxFQUFFLElBQUk7SUFDaEIsZUFBZSxFQUFFLEVBQUU7SUFDbkIsWUFBWSxFQUFFLEVBQUU7SUFDaEIsWUFBWSxFQUFFLEVBQUU7SUFDaEIscUJBQXFCLEVBQUUsS0FBSztJQUU1QixpQkFBaUI7SUFDakIsUUFBUSxFQUFFLFNBQVM7SUFDbkIsaUJBQWlCLEVBQUUsS0FBSztJQUN4QixzQkFBc0IsRUFBRSxLQUFLO0lBRTdCLGdCQUFnQjtJQUNoQixpQkFBaUIsRUFBRSxJQUFJO0lBQ3ZCLGNBQWMsRUFBRSxJQUFJO0lBQ3BCLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsZUFBZSxFQUFFLElBQUk7SUFFckIsc0JBQXNCO0lBQ3RCLFlBQVksRUFBRSxTQUFTO0lBQ3ZCLGVBQWUsRUFBRSxLQUFLO0lBRXRCLHNCQUFzQjtJQUN0QixvQkFBb0IsRUFBRSxDQUFDO0lBQ3ZCLGVBQWUsRUFBRSxFQUFFO0lBQ25CLG1CQUFtQixFQUFFLEdBQUc7SUFDeEIsaUJBQWlCLEVBQUUsQ0FBQztJQUNwQixnQkFBZ0IsRUFBRSxHQUFHO0lBQ3JCLGdCQUFnQixFQUFFLENBQUM7SUFDbkIsZ0JBQWdCLEVBQUUsQ0FBQztJQUVuQixRQUFRO0lBQ1IsVUFBVSxFQUFFLEVBQUU7SUFDZCxhQUFhLEVBQUUsQ0FBQyxFQUFFLENBQUM7Q0FDbkIsQ0FBQTtBQUVELGFBQWE7QUFFYixNQUFNLE9BQU8sWUFBYSxTQUFRLGdCQUFnQjtJQVdwQyx1QkFBdUI7O1lBRW5DLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUFFLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDO1lBQzNFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVuRixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztRQUNsQyxDQUFDO0tBQUE7SUFFRCxZQUFZLE1BQWM7UUFDekIsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQVZaLHlCQUFvQixHQUFhLEVBQUUsQ0FBQztRQVczQyxZQUFZLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUM5QixDQUFDO0lBRUQsTUFBTSxDQUFPLFlBQVk7O1lBQ3hCLFlBQVksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxZQUFZLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDbEcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDekYsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLGVBQWUsS0FBSyxHQUFHO2dCQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQztZQUM5RixNQUFNLGVBQWUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDN0MsWUFBWSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDNUIsQ0FBQztLQUFBO0lBRUQsTUFBTSxDQUFPLFlBQVk7O1lBQ3hCLE1BQU0sWUFBWSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNELENBQUM7S0FBQTtJQUVELE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBVyxFQUFFLE9BQWU7UUFFN0MsSUFBSSxhQUFhLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQy9DLFlBQVksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBRXhELElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDNUMsSUFBSSxLQUFLLElBQUksQ0FBQyxFQUNkO2dCQUNDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO2FBQzVCO1FBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxDQUFPLGNBQWMsQ0FBQyxzQkFBK0IsS0FBSyxFQUFFLGdCQUFxQyxTQUFTOztZQUUvRyxJQUFJLENBQUMsbUJBQW1CLEVBQ3hCO2dCQUNDLElBQUksS0FBSyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQzlCLElBQUcsYUFBYTtvQkFBRSxLQUFLLENBQUMsbUJBQW1CLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQzNELE9BQU8sTUFBTSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDMUI7WUFFRCxJQUFJLEtBQUssR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRCxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3RELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxhQUFhLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQzlHO2dCQUNDLElBQUksTUFBTSxDQUFDLHVFQUF1RSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMxRixJQUFJLEtBQUssR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUM5QixJQUFHLGFBQWE7b0JBQUUsS0FBSyxDQUFDLG1CQUFtQixDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUMzRCxPQUFPLE1BQU0sS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO2FBQzFCO1lBRUQsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztLQUFBO0lBRUQsTUFBTSxDQUFDLFdBQVc7UUFFakIsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDLFNBQVMsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztJQUNoSCxDQUFDO0lBRUQsTUFBTSxDQUFDLGdCQUFnQjtRQUV0QixJQUFJLEtBQUssR0FBWSxFQUFFLENBQUM7UUFDeEIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFFeEQsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFO2dCQUU3QixJQUFJLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNyRCxJQUFJLElBQUksWUFBWSxLQUFLO29CQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELGFBQWE7SUFFYixPQUFPO1FBRU4sTUFBTSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFFeEMsMEJBQTBCO1FBRTFCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVsQixJQUFJLE1BQU0sR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUM7UUFDeEUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQztRQUVuQyxJQUFJLFdBQVcsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTFDLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQy9FLElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ3JGLGFBQWE7UUFDYixXQUFXLENBQUMsU0FBUyxHQUFHLDJMQUEyTCxXQUFXLGdCQUFnQixlQUFlLHVDQUF1QyxlQUFlLDZCQUE2QixDQUFDO1FBQ2pWLElBQUksYUFBYSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUUsbURBQW1ELEVBQUUsR0FBRyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUN4SSxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdEMsYUFBYSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO1FBRTFDLGFBQWE7UUFFYix1QkFBdUI7UUFFdkIsSUFBSSxFQUFFLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUM7UUFDNUIsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO1FBQy9CLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLHFCQUFxQixDQUFDO1FBQzdDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztRQUV6QixJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7YUFDbkIsT0FBTyxDQUFDLGdCQUFnQixDQUFDO2FBQ3pCLE9BQU8sQ0FBQywwQ0FBMEMsQ0FBQzthQUNuRCxVQUFVLEVBQUUsQ0FBQTtRQUVmLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxZQUFZLElBQUksZUFBZSxFQUN6RDtZQUNDLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQztpQkFDcEIsT0FBTyxDQUFDLHNCQUFzQixDQUFDO2lCQUMvQixPQUFPLENBQUMsMENBQTBDLENBQUM7aUJBQ25ELFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTTtpQkFDM0IsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUM7aUJBQ2pELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO2dCQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQztnQkFDaEQsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDO1lBRU4sSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2lCQUNwQixPQUFPLENBQUMsMEJBQTBCLENBQUM7aUJBQ25DLE9BQU8sQ0FBQyw4REFBOEQsQ0FBQztpQkFDdkUsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNO2lCQUMzQixRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUM7aUJBQzlDLFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO2dCQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7Z0JBQzdDLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUNBLENBQUMsQ0FBQztZQUVMLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQztpQkFDcEIsT0FBTyxDQUFDLG1CQUFtQixDQUFDO2lCQUM1QixPQUFPLENBQUMsb0RBQW9ELENBQUM7aUJBQzdELFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTTtpQkFDM0IsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDO2lCQUMvQyxRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtnQkFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO2dCQUM5QyxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNuQyxDQUFDLENBQUEsQ0FDQSxDQUFDLENBQUM7U0FDTDtRQUVELElBQUksWUFBWSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQzVFLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLGtCQUFrQixDQUFDO1FBQzlDLFlBQVksQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLFNBQVMsQ0FBQztRQUU1QyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUMvRDtZQUNDLElBQUksUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUNyRSxJQUFHLFFBQVEsQ0FBQyxXQUFXO2dCQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztpQkFDakUsSUFBRyxDQUFDLFFBQVEsQ0FBQyxVQUFVO2dCQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQztpQkFDeEUsSUFBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNO2dCQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztTQUN2RTtRQUVELElBQUksU0FBUyxHQUErQixTQUFTLENBQUM7UUFFdEQsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2FBQ3BCLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQzthQUNuQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUVqQixTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7WUFDbEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyx5Q0FBeUMsQ0FBQztpQkFDNUQsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMscUJBQXFCLENBQUM7aUJBQ3JELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO2dCQUV6QixJQUFJLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0IsSUFBRyxLQUFLLElBQUksRUFBRTtvQkFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO3FCQUNwQyxJQUFHLElBQUksQ0FBQyxXQUFXO29CQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztxQkFDbEUsSUFBRyxDQUFDLElBQUksQ0FBQyxVQUFVO29CQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQztxQkFDcEUsSUFBRyxDQUFDLElBQUksQ0FBQyxNQUFNO29CQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztxQkFFbkU7b0JBQ0MsWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDekUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLENBQUM7b0JBQzNELE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO2lCQUNsQztZQUNGLENBQUMsQ0FBQSxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUM7YUFDRCxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUVyQixNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFTLEVBQUU7Z0JBRWpELElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNyQyxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELElBQUksSUFBSSxFQUNSO29CQUNDLFlBQVksQ0FBQyxRQUFRLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztvQkFDNUQsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBRWxDLElBQUcsSUFBSSxDQUFDLFdBQVc7d0JBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO3lCQUM3RCxJQUFHLENBQUMsSUFBSSxDQUFDLFVBQVU7d0JBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO3lCQUNwRSxJQUFHLENBQUMsSUFBSSxDQUFDLE1BQU07d0JBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDOzt3QkFDOUQsWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFFOUIsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLENBQUM7aUJBQ2pFO1lBQ0YsQ0FBQyxDQUFBLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUosU0FBUyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVwQyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxJQUFJLGVBQWUsRUFDekQ7WUFFQyxFQUFFLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM5QixFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUM7WUFDNUIsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO1lBQy9CLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLHFCQUFxQixDQUFDO1lBQzdDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztZQUV6QixJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztpQkFDMUIsT0FBTyxDQUFDLGtEQUFrRCxDQUFDO2lCQUMzRCxVQUFVLEVBQUUsQ0FBQTtZQUVkLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQztpQkFDcEIsT0FBTyxDQUFDLHlCQUF5QixDQUFDO2lCQUNsQyxPQUFPLENBQUMsa0VBQWtFLENBQUM7aUJBQzNFLFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTTtpQkFDM0IsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMscUJBQXFCLENBQUM7aUJBQ3JELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO2dCQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLHFCQUFxQixHQUFHLEtBQUssQ0FBQztnQkFDcEQsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDO1lBRU4sSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2lCQUNwQixPQUFPLENBQUMsd0JBQXdCLENBQUM7aUJBQ2pDLE9BQU8sQ0FBQywwRkFBMEYsQ0FBQztpQkFDbkcsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNO2lCQUMzQixRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQztpQkFDcEQsUUFBUSxDQUFDLENBQU8sS0FBSyxFQUFFLEVBQUU7Z0JBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEdBQUcsS0FBSyxDQUFDO2dCQUNuRCxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNuQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUM7WUFFTixJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQztpQkFDdEMsT0FBTyxDQUFDLDZLQUE2SyxDQUFDO2lCQUN0TCxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLHlCQUF5QixDQUFDO2lCQUN6RCxRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtnQkFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsR0FBRyxLQUFLLENBQUM7Z0JBQ3hELE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQztTQUVOO1FBRUQsWUFBWTtRQUVaLHdCQUF3QjtRQUV4QixFQUFFLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5QixFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUM7UUFDNUIsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO1FBQy9CLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLHFCQUFxQixDQUFDO1FBQzdDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztRQUN6QixJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7YUFDcEIsT0FBTyxDQUFDLGlCQUFpQixDQUFDO2FBQzFCLFVBQVUsRUFBRSxDQUFBO1FBRWQsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2FBQ3BCLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQzthQUN6QixPQUFPLENBQUMscUZBQXFGLENBQUM7YUFDOUYsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJO2FBQ3JCLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQzthQUMvQyxjQUFjLENBQUMseUJBQXlCLENBQUM7YUFDekMsUUFBUSxDQUFDLENBQU8sS0FBSyxFQUFFLEVBQUU7WUFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO1lBQzlDLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ25DLENBQUMsQ0FBQSxDQUNBLENBQUM7YUFDRixjQUFjLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUMvRixZQUFZLENBQUMsUUFBUSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUM7WUFDM0MsWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2FBQ3BCLE9BQU8sQ0FBQyxlQUFlLENBQUM7YUFDeEIsT0FBTyxDQUFDLG1PQUFtTyxDQUFDO2FBQzVPLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSTthQUNyQixRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUM7YUFDNUMsY0FBYyxDQUFDLHlCQUF5QixDQUFDO2FBQ3pDLFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO1lBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztZQUMzQyxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNuQyxDQUFDLENBQUEsQ0FDQSxDQUFDO2FBQ0YsY0FBYyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7WUFDL0YsWUFBWSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1lBQ3hDLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVMLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQzthQUNwQixPQUFPLENBQUMsZUFBZSxDQUFDO2FBQ3hCLE9BQU8sQ0FBQyxpRkFBaUYsQ0FBQzthQUMxRixPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUk7YUFDckIsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO2FBQzVDLGNBQWMsQ0FBQyx5QkFBeUIsQ0FBQzthQUN6QyxRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtZQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7WUFDM0MsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDbkMsQ0FBQyxDQUFBLENBQ0EsQ0FBQzthQUNGLGNBQWMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQy9GLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztZQUN4QyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFTCxZQUFZO1FBRVosd0JBQXdCO1FBRXhCLEVBQUUsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQztRQUM1QixFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUM7UUFDL0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcscUJBQXFCLENBQUM7UUFDN0MsRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBRXpCLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQzthQUNwQixPQUFPLENBQUMsaUJBQWlCLENBQUM7YUFDMUIsVUFBVSxFQUFFLENBQUE7UUFFZCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7YUFDcEIsT0FBTyxDQUFDLFdBQVcsQ0FBQzthQUNwQixPQUFPLENBQUMsd0RBQXdELENBQUM7YUFDakUsV0FBVyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRO2FBQ2pDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO2FBQ3ZCLFNBQVMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO2FBQy9CLFNBQVMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO2FBQzNCLFNBQVMsQ0FBQyxPQUFPLEVBQUUsbUJBQW1CLENBQUM7YUFDdkMsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO2FBQ3hDLFFBQVEsQ0FBQyxDQUFPLEtBQXFELEVBQUUsRUFBRTtZQUV6RSxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7WUFDdkMsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDbkMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDO1FBRU4sSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2FBQ3BCLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQzthQUMvQixPQUFPLENBQUMsK0VBQStFLENBQUM7YUFDeEYsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNO2FBQzNCLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDO2FBQ2pELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO1lBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO1lBQ2hELE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ25DLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQztRQUVOLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQzthQUNwQixPQUFPLENBQUMsYUFBYSxDQUFDO2FBQ3RCLE9BQU8sQ0FBQyxrRkFBa0YsQ0FBQzthQUMzRixTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07YUFDM0IsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO2FBQzFDLFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO1lBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztZQUN6QyxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNuQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUM7UUFFTixZQUFZO1FBRVosb0JBQW9CO1FBRXBCLEVBQUUsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQztRQUM1QixFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUM7UUFDL0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcscUJBQXFCLENBQUM7UUFDN0MsRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQzthQUNwQixPQUFPLENBQUMsb0JBQW9CLENBQUM7YUFDN0IsT0FBTyxDQUFDLHNKQUFzSixDQUFDO2FBQy9KLFVBQVUsRUFBRSxDQUFBO1FBRWQsSUFBSSxXQUFXLEdBQUcsSUFBSSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDMUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFPLE1BQU0sRUFBRSxFQUFFO1lBQzdDLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsY0FBYztnQkFBRSxPQUFPO1lBRTVCLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDdkUsT0FBTzthQUNQO1lBRUQsSUFBSSxTQUFTLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQztZQUNuQyxJQUFJLENBQUMsU0FBUztnQkFBRSxPQUFPO1lBQ3ZCLElBQUksVUFBVSxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRXJDLElBQUksTUFBTSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3hELElBQUksQ0FBQyxNQUFNO2dCQUFFLE9BQU87WUFFcEIsSUFBSSxTQUFTLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxNQUFNLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQztZQUVwRyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUNyRSxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM1RSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDN0IsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUEsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2FBQ3BCLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQzthQUM3QixPQUFPLENBQUMsaUVBQWlFLENBQUM7YUFDMUUsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNO2FBQzNCLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO2FBQ2hELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO1lBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO1lBQy9DLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ25DLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQztRQUVOLFlBQVk7UUFFWixzQkFBc0I7UUFHdEIsSUFBSSxxQkFBcUIsR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDbEQsSUFBSSxlQUFlLEdBQUcscUJBQXFCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNELElBQUksa0JBQWtCLEdBQUcscUJBQXFCLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDO1FBQzFGLElBQUksZUFBZSxHQUFHLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUzRCxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUM3QyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUM5QyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQztRQUVsRCxlQUFlLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQztRQUN2RCxlQUFlLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQztRQUN2RCxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLGtCQUFrQixDQUFDO1FBRXBELGVBQWUsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQztRQUNyQyxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUM7UUFDckMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDMUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFFOUMsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2FBQ3BCLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQzthQUMvQixPQUFPLENBQUMsaUtBQWlLLENBQUM7YUFDMUssU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNO2FBQzNCLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDO2FBQ2pELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO1lBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO1lBQ2hELE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JDLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQzthQUNwQixPQUFPLENBQUMsa0JBQWtCLENBQUM7YUFDM0IsT0FBTyxDQUFDLGtGQUFrRixDQUFDO2FBQzNGLFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTTthQUMzQixRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQzthQUN0RCxRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtZQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLHNCQUFzQixHQUFHLEtBQUssQ0FBQztZQUNyRCxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNyQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUM7UUFHSixJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxJQUFJLGVBQWUsRUFDekQ7WUFDQyxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxzQ0FBc0MsQ0FBQztpQkFDL0MsT0FBTyxDQUFDLCtIQUErSCxDQUFDO2lCQUN4SSxVQUFVLEVBQUUsQ0FBQTtZQUVkLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQztpQkFDcEIsT0FBTyxDQUFDLDJCQUEyQixDQUFDO2lCQUNwQyxPQUFPLENBQUMsbUZBQW1GLENBQUM7aUJBQzVGLFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTTtpQkFDM0IsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUM7aUJBQ2hELFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO2dCQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztnQkFDL0MsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDO1lBRU4sSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO2lCQUNwQixPQUFPLENBQUMscUJBQXFCLENBQUM7aUJBQzlCLE9BQU8sQ0FBQywySkFBMkosQ0FBQztpQkFDcEssVUFBVSxFQUFFLENBQUE7WUFFZCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQztpQkFDM0IsT0FBTyxDQUFDLGtHQUFrRyxDQUFDO2lCQUMzRyxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztpQkFDcEIsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7aUJBQ2hFLGlCQUFpQixFQUFFO2lCQUNuQixRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtnQkFDekIsa0JBQWtCO2dCQUNsQixJQUFJLGVBQWUsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO2dCQUM5QixZQUFZLENBQUMsUUFBUSxDQUFDLG9CQUFvQixHQUFHLEtBQUssR0FBRyxlQUFlLENBQUM7Z0JBQ3JFLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUFDO2lCQUNELFdBQVcsRUFBRSxDQUNkLENBQUM7WUFFSCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxhQUFhLENBQUM7aUJBQ3RCLE9BQU8sQ0FBQyxxSEFBcUgsQ0FBQztpQkFDOUgsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNO2lCQUMzQixTQUFTLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7aUJBQ3BCLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQztpQkFDL0MsaUJBQWlCLEVBQUU7aUJBQ25CLFFBQVEsQ0FBQyxDQUFPLEtBQUssRUFBRSxFQUFFO2dCQUN6QixZQUFZLENBQUMsUUFBUSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7Z0JBQzlDLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUFDO2lCQUNELFdBQVcsRUFBRSxDQUNkLENBQUM7WUFFSCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztpQkFDMUIsT0FBTyxDQUFDLDBGQUEwRixDQUFDO2lCQUNuRyxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztpQkFDcEIsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO2lCQUN2RCxpQkFBaUIsRUFBRTtpQkFDbkIsUUFBUSxDQUFDLENBQU8sS0FBSyxFQUFFLEVBQUU7Z0JBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQztnQkFDdEQsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFBLENBQUM7aUJBQ0QsV0FBVyxFQUFFLENBQ2QsQ0FBQztZQUVILElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQztpQkFDcEIsT0FBTyxDQUFDLGVBQWUsQ0FBQztpQkFDeEIsT0FBTyxDQUFDLDRHQUE0RyxDQUFDO2lCQUNySCxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztpQkFDcEIsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7aUJBQzdELGlCQUFpQixFQUFFO2lCQUNuQixRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtnQkFDekIsa0JBQWtCO2dCQUNsQixJQUFJLGVBQWUsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO2dCQUM5QixZQUFZLENBQUMsUUFBUSxDQUFDLGlCQUFpQixHQUFHLEtBQUssR0FBRyxlQUFlLENBQUM7Z0JBQ2xFLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUFDO2lCQUNELFdBQVcsRUFBRSxDQUNkLENBQUM7WUFFSCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztpQkFDMUIsT0FBTyxDQUFDLDROQUE0TixDQUFDO2lCQUNyTyxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDbkIsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUM7aUJBQ2hELGlCQUFpQixFQUFFO2lCQUNuQixRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtnQkFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7Z0JBQy9DLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUFDO2lCQUNELFdBQVcsRUFBRSxDQUNkLENBQUM7WUFFSCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztpQkFDMUIsT0FBTyxDQUFDLHFHQUFxRyxDQUFDO2lCQUM5RyxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDbkIsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUM7aUJBQ2hELGlCQUFpQixFQUFFO2lCQUNuQixRQUFRLENBQUMsQ0FBTyxLQUFLLEVBQUUsRUFBRTtnQkFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7Z0JBQy9DLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25DLENBQUMsQ0FBQSxDQUFDO2lCQUNELFdBQVcsRUFBRSxDQUNkLENBQUM7WUFFSCxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUM7aUJBQ3BCLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQztpQkFDOUIsT0FBTyxDQUFDLG1PQUFtTyxDQUFDO2lCQUM1TyxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07aUJBQzNCLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztpQkFDcEIsUUFBUSxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO2lCQUN0RCxpQkFBaUIsRUFBRTtpQkFDbkIsUUFBUSxDQUFDLENBQU8sS0FBSyxFQUFFLEVBQUU7Z0JBQ3pCLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQztnQkFDckQsTUFBTSxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFBLENBQUM7aUJBQ0QsV0FBVyxFQUFFLENBQ2QsQ0FBQztTQUNIO1FBRUQsSUFBSSxpQkFBaUIsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pELGlCQUFpQixDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsa0JBQWtCLENBQUM7UUFFekQsWUFBWTtJQUViLENBQUM7O0FBM2xCRCx3Q0FBd0M7QUFFakMscUJBQVEsR0FBcUIsZ0JBQWdCLEFBQXJDLENBQXNDO0FBRTlDLG1CQUFNLEdBQUcsS0FBSyxBQUFSLENBQVMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFRleHRDb21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi4vdXRpbHMvdXRpbHMnO1xyXG5pbXBvcnQgeyBQYXRoIH0gZnJvbSAnLi4vdXRpbHMvcGF0aCc7XHJcbmltcG9ydCBwbHVnaW5TdHlsZXNCbGFja2xpc3QgZnJvbSAnYXNzZXRzL3RoaXJkLXBhcnR5LXN0eWxlcy1ibGFja2xpc3QudHh0JztcclxuaW1wb3J0IHsgRmxvd0xpc3QgfSBmcm9tICcuL2Zsb3ctbGlzdCc7XHJcbmltcG9ydCB7IEV4cG9ydEluZm8sIEV4cG9ydE1vZGFsIH0gZnJvbSAnLi9leHBvcnQtbW9kYWwnO1xyXG5pbXBvcnQgSFRNTEV4cG9ydFBsdWdpbiBmcm9tICdzY3JpcHRzL21haW4nO1xyXG5pbXBvcnQgeyBtaWdyYXRlU2V0dGluZ3MgfSBmcm9tICcuL3NldHRpbmdzLW1pZ3JhdGlvbic7XHJcblxyXG4vLyAjcmVnaW9uIFNldHRpbmdzIERlZmluaXRpb25cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWFpblNldHRpbmdzRGF0YSBcclxue1xyXG5cdHNldHRpbmdzVmVyc2lvbjogc3RyaW5nO1xyXG5cdHVwZ3JhZGVkRnJvbTogc3RyaW5nO1xyXG5cclxuXHQvLyBJbmxpbmluZyBPcHRpb25zXHJcblx0aW5saW5lQ1NTOiBib29sZWFuO1xyXG5cdGlubGluZUpTOiBib29sZWFuO1xyXG5cdGlubGluZUltYWdlczogYm9vbGVhbjtcclxuXHRpbmNsdWRlUGx1Z2luQ1NTOiBzdHJpbmc7XHJcblx0aW5jbHVkZVN2ZWx0ZUNTUzogYm9vbGVhbjtcclxuXHRjdXN0b21IZWFkQ29udGVudFBhdGg6IHN0cmluZztcclxuXHJcblx0Ly8gRm9ybWF0dGluZyBPcHRpb25zXHJcblx0bWFrZU5hbWVzV2ViU3R5bGU6IGJvb2xlYW47XHJcblx0YWxsb3dGb2xkaW5nSGVhZGluZ3M6IGJvb2xlYW47XHJcblx0c2lkZWJhcnNBbHdheXNDb2xsYXBzaWJsZTogYm9vbGVhbjtcclxuXHRhZGRGaWxlbmFtZVRpdGxlOiBib29sZWFuO1xyXG5cdG1pbmlmeUhUTUw6IGJvb2xlYW47XHJcblx0Y3VzdG9tTGluZVdpZHRoOiBzdHJpbmc7XHJcblx0Y29udGVudFdpZHRoOiBzdHJpbmc7XHJcblx0c2lkZWJhcldpZHRoOiBzdHJpbmc7XHJcblx0c3RhcnRPdXRsaW5lQ29sbGFwc2VkOiBib29sZWFuO1xyXG5cclxuXHQvLyBFeHBvcnQgT3B0aW9uc1xyXG5cdGxvZ0xldmVsOiBcImFsbFwiIHwgXCJ3YXJuaW5nXCIgfCBcImVycm9yXCIgfCBcImZhdGFsXCIgfCBcIm5vbmVcIjtcclxuXHRpbmNyZW1lbnRhbEV4cG9ydDogYm9vbGVhbjtcclxuXHRkZWxldGVPbGRFeHBvcnRlZEZpbGVzOiBib29sZWFuO1xyXG5cclxuXHQvLyBQYWdlIEZlYXR1cmVzXHJcblx0YWRkRGFya01vZGVUb2dnbGU6IGJvb2xlYW47XHJcblx0aW5jbHVkZU91dGxpbmU6IGJvb2xlYW47XHJcblx0aW5jbHVkZUZpbGVUcmVlOiBib29sZWFuO1xyXG5cdGluY2x1ZGVHcmFwaFZpZXc6IGJvb2xlYW47XHJcblxyXG5cdC8vIE1haW4gRXhwb3J0IE9wdGlvbnNcclxuXHRleHBvcnRQcmVzZXQ6IHN0cmluZztcclxuXHRvcGVuQWZ0ZXJFeHBvcnQ6IGJvb2xlYW47XHJcblxyXG5cdC8vIEdyYXBoIFZpZXcgU2V0dGluZ3NcclxuXHRncmFwaEF0dHJhY3Rpb25Gb3JjZTogbnVtYmVyO1xyXG5cdGdyYXBoTGlua0xlbmd0aDogbnVtYmVyO1xyXG5cdGdyYXBoUmVwdWxzaW9uRm9yY2U6IG51bWJlcjtcclxuXHRncmFwaENlbnRyYWxGb3JjZTogbnVtYmVyO1xyXG5cdGdyYXBoRWRnZVBydW5pbmc6IG51bWJlcjtcclxuXHRncmFwaE1pbk5vZGVTaXplOiBudW1iZXI7XHJcblx0Z3JhcGhNYXhOb2RlU2l6ZTogbnVtYmVyO1xyXG5cclxuXHQvLyBDYWNoZVxyXG5cdGV4cG9ydFBhdGg6IHN0cmluZztcclxuXHRmaWxlc1RvRXhwb3J0OiBzdHJpbmdbXVtdO1xyXG59XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBNYWluU2V0dGluZ3NEYXRhID1cclxue1xyXG5cdHNldHRpbmdzVmVyc2lvbjogXCIwLjAuMFwiLFxyXG5cdHVwZ3JhZGVkRnJvbTogXCIwLjAuMFwiLFxyXG5cclxuXHQvLyBJbmxpbmluZyBPcHRpb25zXHJcblx0aW5saW5lQ1NTOiBmYWxzZSxcclxuXHRpbmxpbmVKUzogZmFsc2UsXHJcblx0aW5saW5lSW1hZ2VzOiBmYWxzZSxcclxuXHRpbmNsdWRlUGx1Z2luQ1NTOiAnJyxcclxuXHRpbmNsdWRlU3ZlbHRlQ1NTOiB0cnVlLFxyXG5cdGN1c3RvbUhlYWRDb250ZW50UGF0aDogJycsXHJcblxyXG5cdC8vIEZvcm1hdHRpbmcgT3B0aW9uc1xyXG5cdG1ha2VOYW1lc1dlYlN0eWxlOiB0cnVlLFxyXG5cdGFsbG93Rm9sZGluZ0hlYWRpbmdzOiB0cnVlLFxyXG5cdHNpZGViYXJzQWx3YXlzQ29sbGFwc2libGU6IGZhbHNlLFxyXG5cdGFkZEZpbGVuYW1lVGl0bGU6IHRydWUsXHJcblx0bWluaWZ5SFRNTDogdHJ1ZSxcclxuXHRjdXN0b21MaW5lV2lkdGg6IFwiXCIsXHJcblx0Y29udGVudFdpZHRoOiBcIlwiLFxyXG5cdHNpZGViYXJXaWR0aDogXCJcIixcclxuXHRzdGFydE91dGxpbmVDb2xsYXBzZWQ6IGZhbHNlLFxyXG5cclxuXHQvLyBFeHBvcnQgT3B0aW9uc1xyXG5cdGxvZ0xldmVsOiBcIndhcm5pbmdcIixcclxuXHRpbmNyZW1lbnRhbEV4cG9ydDogZmFsc2UsXHJcblx0ZGVsZXRlT2xkRXhwb3J0ZWRGaWxlczogZmFsc2UsXHJcblxyXG5cdC8vIFBhZ2UgRmVhdHVyZXNcclxuXHRhZGREYXJrTW9kZVRvZ2dsZTogdHJ1ZSxcclxuXHRpbmNsdWRlT3V0bGluZTogdHJ1ZSxcclxuXHRpbmNsdWRlR3JhcGhWaWV3OiB0cnVlLFxyXG5cdGluY2x1ZGVGaWxlVHJlZTogdHJ1ZSxcclxuXHJcblx0Ly8gTWFpbiBFeHBvcnQgT3B0aW9uc1xyXG5cdGV4cG9ydFByZXNldDogJ3dlYnNpdGUnLFxyXG5cdG9wZW5BZnRlckV4cG9ydDogZmFsc2UsXHJcblxyXG5cdC8vIEdyYXBoIFZpZXcgU2V0dGluZ3NcclxuXHRncmFwaEF0dHJhY3Rpb25Gb3JjZTogMSxcclxuXHRncmFwaExpbmtMZW5ndGg6IDEwLFxyXG5cdGdyYXBoUmVwdWxzaW9uRm9yY2U6IDE1MCxcclxuXHRncmFwaENlbnRyYWxGb3JjZTogMyxcclxuXHRncmFwaEVkZ2VQcnVuaW5nOiAxMDAsXHJcblx0Z3JhcGhNaW5Ob2RlU2l6ZTogMyxcclxuXHRncmFwaE1heE5vZGVTaXplOiA3LFxyXG5cclxuXHQvLyBDYWNoZVxyXG5cdGV4cG9ydFBhdGg6ICcnLFxyXG5cdGZpbGVzVG9FeHBvcnQ6IFtbXV0sXHJcbn1cclxuXHJcbi8vICNlbmRyZWdpb25cclxuXHJcbmV4cG9ydCBjbGFzcyBNYWluU2V0dGluZ3MgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIFxyXG57XHJcblxyXG5cdC8vICNyZWdpb24gQ2xhc3MgRnVuY3Rpb25zIGFuZCBWYXJpYWJsZXNcclxuXHJcblx0c3RhdGljIHNldHRpbmdzOiBNYWluU2V0dGluZ3NEYXRhID0gREVGQVVMVF9TRVRUSU5HUztcclxuXHRzdGF0aWMgcGx1Z2luOiBQbHVnaW47XHJcblx0c3RhdGljIGxvYWRlZCA9IGZhbHNlO1xyXG5cclxuXHJcblx0cHJpdmF0ZSBibGFja2xpc3RlZFBsdWdpbklEczogc3RyaW5nW10gPSBbXTtcclxuXHRwdWJsaWMgYXN5bmMgZ2V0QmxhY2tsaXN0ZWRQbHVnaW5JRHMoKTogUHJvbWlzZTxzdHJpbmdbXT4gXHJcblx0e1xyXG5cdFx0aWYgKHRoaXMuYmxhY2tsaXN0ZWRQbHVnaW5JRHMubGVuZ3RoID4gMCkgcmV0dXJuIHRoaXMuYmxhY2tsaXN0ZWRQbHVnaW5JRHM7XHJcblx0XHR0aGlzLmJsYWNrbGlzdGVkUGx1Z2luSURzID0gcGx1Z2luU3R5bGVzQmxhY2tsaXN0LnJlcGxhY2VBbGwoXCJcXHJcIiwgXCJcIikuc3BsaXQoXCJcXG5cIik7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuYmxhY2tsaXN0ZWRQbHVnaW5JRHM7XHJcblx0fVxyXG5cclxuXHRjb25zdHJ1Y3RvcihwbHVnaW46IFBsdWdpbikge1xyXG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xyXG5cdFx0TWFpblNldHRpbmdzLnBsdWdpbiA9IHBsdWdpbjtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcblx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCBNYWluU2V0dGluZ3MucGx1Z2luLmxvYWREYXRhKCkpO1xyXG5cdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUxpbmVXaWR0aCA9IE1haW5TZXR0aW5ncy5zZXR0aW5ncy5jdXN0b21MaW5lV2lkdGgudG9TdHJpbmcoKTtcclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuY3VzdG9tTGluZVdpZHRoID09PSBcIjBcIikgTWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUxpbmVXaWR0aCA9IFwiXCI7XHJcblx0XHRhd2FpdCBtaWdyYXRlU2V0dGluZ3MoTWFpblNldHRpbmdzLnNldHRpbmdzKTtcclxuXHRcdE1haW5TZXR0aW5ncy5sb2FkZWQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcclxuXHRcdGF3YWl0IE1haW5TZXR0aW5ncy5wbHVnaW4uc2F2ZURhdGEoTWFpblNldHRpbmdzLnNldHRpbmdzKTtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyByZW5hbWVGaWxlKGZpbGU6IFRGaWxlLCBvbGRQYXRoOiBzdHJpbmcpXHJcblx0e1xyXG5cdFx0bGV0IG9sZFBhdGhQYXJzZWQgPSBuZXcgUGF0aChvbGRQYXRoKS5hc1N0cmluZztcclxuXHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5maWxlc1RvRXhwb3J0LmZvckVhY2goKGZpbGVMaXN0KSA9PlxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgaW5kZXggPSBmaWxlTGlzdC5pbmRleE9mKG9sZFBhdGhQYXJzZWQpO1xyXG5cdFx0XHRpZiAoaW5kZXggPj0gMClcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGZpbGVMaXN0W2luZGV4XSA9IGZpbGUucGF0aDtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgYXN5bmMgdXBkYXRlU2V0dGluZ3ModXNlUHJldmlvdXNTZXR0aW5nczogYm9vbGVhbiA9IGZhbHNlLCBvdmVycmlkZUZpbGVzOiBURmlsZVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkKTogUHJvbWlzZTxFeHBvcnRJbmZvIHwgdW5kZWZpbmVkPlxyXG5cdHtcclxuXHRcdGlmICghdXNlUHJldmlvdXNTZXR0aW5ncykgXHJcblx0XHR7XHJcblx0XHRcdGxldCBtb2RhbCA9IG5ldyBFeHBvcnRNb2RhbCgpO1xyXG5cdFx0XHRpZihvdmVycmlkZUZpbGVzKSBtb2RhbC5vdmVycmlkZVBpY2tlZEZpbGVzKG92ZXJyaWRlRmlsZXMpO1xyXG5cdFx0XHRyZXR1cm4gYXdhaXQgbW9kYWwub3BlbigpO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRsZXQgZmlsZXMgPSBNYWluU2V0dGluZ3Muc2V0dGluZ3MuZmlsZXNUb0V4cG9ydFswXTtcclxuXHRcdGxldCBwYXRoID0gbmV3IFBhdGgoTWFpblNldHRpbmdzLnNldHRpbmdzLmV4cG9ydFBhdGgpO1xyXG5cdFx0aWYgKChmaWxlcy5sZW5ndGggPT0gMCAmJiBvdmVycmlkZUZpbGVzID09IHVuZGVmaW5lZCkgfHwgIXBhdGguZXhpc3RzIHx8ICFwYXRoLmlzQWJzb2x1dGUgfHwgIXBhdGguaXNEaXJlY3RvcnkpXHJcblx0XHR7XHJcblx0XHRcdG5ldyBOb3RpY2UoXCJQbGVhc2Ugc2V0IHRoZSBleHBvcnQgcGF0aCBhbmQgZmlsZXMgdG8gZXhwb3J0IGluIHRoZSBzZXR0aW5ncyBmaXJzdC5cIiwgNTAwMCk7XHJcblx0XHRcdGxldCBtb2RhbCA9IG5ldyBFeHBvcnRNb2RhbCgpO1xyXG5cdFx0XHRpZihvdmVycmlkZUZpbGVzKSBtb2RhbC5vdmVycmlkZVBpY2tlZEZpbGVzKG92ZXJyaWRlRmlsZXMpO1xyXG5cdFx0XHRyZXR1cm4gYXdhaXQgbW9kYWwub3BlbigpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB1bmRlZmluZWQ7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgaXNBbGxJbmxpbmUoKTogYm9vbGVhblxyXG5cdHtcclxuXHRcdHJldHVybiBNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lQ1NTICYmIE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmxpbmVKUyAmJiBNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSW1hZ2VzO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGdldEZpbGVzVG9FeHBvcnQoKTogVEZpbGVbXVxyXG5cdHtcclxuXHRcdGxldCBmaWxlczogVEZpbGVbXSA9IFtdO1xyXG5cdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmZpbGVzVG9FeHBvcnQuZm9yRWFjaCgoZmlsZUxpc3QpID0+XHJcblx0XHR7XHJcblx0XHRcdGZpbGVMaXN0LmZvckVhY2goKGZpbGVQYXRoKSA9PlxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGV0IGZpbGUgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoKTtcclxuXHRcdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSBmaWxlcy5wdXNoKGZpbGUpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIGZpbGVzO1xyXG5cdH1cclxuXHJcblx0Ly8gI2VuZHJlZ2lvblxyXG5cclxuXHRkaXNwbGF5KCkgXHJcblx0e1xyXG5cdFx0Y29uc3QgeyBjb250YWluZXJFbDogY29udGVudEVsIH0gPSB0aGlzO1xyXG5cclxuXHRcdC8vICNyZWdpb24gU2V0dGluZ3MgSGVhZGVyXHJcblxyXG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XHJcblxyXG5cdFx0bGV0IGhlYWRlciA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdIVE1MIEV4cG9ydCBTZXR0aW5ncycgfSk7XHJcblx0XHRoZWFkZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XHJcblx0XHRoZWFkZXIuc3R5bGUubWFyZ2luQm90dG9tID0gJzE1cHgnO1xyXG5cclxuXHRcdGxldCBzdXBwb3J0TGluayA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnYScpO1xyXG5cclxuXHRcdGxldCBidXR0b25Db2xvciA9IFV0aWxzLnNhbXBsZUNTU0NvbG9ySGV4KFwiLS1jb2xvci1hY2NlbnRcIiwgZG9jdW1lbnQuYm9keSkuaGV4O1xyXG5cdFx0bGV0IGJ1dHRvblRleHRDb2xvciA9IFV0aWxzLnNhbXBsZUNTU0NvbG9ySGV4KFwiLS10ZXh0LW9uLWFjY2VudFwiLCBkb2N1bWVudC5ib2R5KS5oZXg7XHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRzdXBwb3J0TGluay5vdXRlckhUTUwgPSBgPGEgaHJlZj1cImh0dHBzOi8vd3d3LmJ1eW1lYWNvZmZlZS5jb20vbmF0aGFuZ2VvcmdlXCI+PGltZyBzdHlsZT1cImhlaWdodDo0MHB4O1wiIHNyYz1cImh0dHBzOi8vaW1nLmJ1eW1lYWNvZmZlZS5jb20vYnV0dG9uLWFwaS8/dGV4dD1CdXkgbWUgYSBjb2ZmZWUmZW1vamk9JnNsdWc9bmF0aGFuZ2VvcmdlJmJ1dHRvbl9jb2xvdXI9JHtidXR0b25Db2xvcn0mZm9udF9jb2xvdXI9JHtidXR0b25UZXh0Q29sb3J9JmZvbnRfZmFtaWx5PVBvcHBpbnMmb3V0bGluZV9jb2xvdXI9JHtidXR0b25UZXh0Q29sb3J9JmNvZmZlZV9jb2xvdXI9RkZERDAwXCI+PC9hPmA7XHJcblx0XHRsZXQgc3VwcG9ydEhlYWRlciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyB0ZXh0OiAnU3VwcG9ydCB0aGUgY29udGludWVkIGRldmVsb3BtZW50IG9mIHRoaXMgcGx1Z2luLicsIGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIiB9KTtcclxuXHRcdHN1cHBvcnRIZWFkZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XHJcblx0XHRzdXBwb3J0SGVhZGVyLnN0eWxlLm1hcmdpbkJvdHRvbSA9ICcyMHB4JztcclxuXHJcblx0XHQvLyAjZW5kcmVnaW9uXHJcblxyXG5cdFx0Ly8jcmVnaW9uIFBhZ2UgRmVhdHVyZXNcclxuXHJcblx0XHRsZXQgaHIgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJoclwiKTtcclxuXHRcdGhyLnN0eWxlLm1hcmdpblRvcCA9IFwiMjBweFwiO1xyXG5cdFx0aHIuc3R5bGUubWFyZ2luQm90dG9tID0gXCIyMHB4XCI7XHJcblx0XHRoci5zdHlsZS5ib3JkZXJDb2xvciA9IFwidmFyKC0tY29sb3ItYWNjZW50KVwiO1xyXG5cdFx0aHIuc3R5bGUub3BhY2l0eSA9IFwiMC41XCI7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdQYWdlIEZlYXR1cmVzOicpXHJcblx0XHRcdFx0LnNldERlc2MoXCJTcGVjaWFsIGZlYXR1cmVzIHRvIGVtYmVkIG9udG8gdGhlIHBhZ2UuXCIpXHJcblx0XHRcdFx0LnNldEhlYWRpbmcoKVxyXG5cclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UHJlc2V0ICE9IFwicmF3LWRvY3VtZW50c1wiKVxyXG5cdFx0e1xyXG5cdFx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdFx0LnNldE5hbWUoJ0luY2x1ZGUgdGhlbWUgdG9nZ2xlJylcclxuXHRcdFx0XHQuc2V0RGVzYygnQWRkcyBhIHRoZW1lIHRvZ2dsZSB0byB0aGUgbGVmdCBzaWRlYmFyLicpXHJcblx0XHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGVcclxuXHRcdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3MuYWRkRGFya01vZGVUb2dnbGUpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5hZGREYXJrTW9kZVRvZ2dsZSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KSk7XHJcblxyXG5cdFx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdFx0LnNldE5hbWUoJ0luY2x1ZGUgZG9jdW1lbnQgb3V0bGluZScpXHJcblx0XHRcdFx0LnNldERlc2MoJ0FkZHMgdGhlIGRvY3VtZW50XFwncyB0YWJsZSBvZiBjb250ZW50cyB0byB0aGUgcmlnaHQgc2lkZWJhci4nKVxyXG5cdFx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVPdXRsaW5lKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZU91dGxpbmUgPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KSk7XHJcblxyXG5cdFx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdFx0LnNldE5hbWUoJ0luY2x1ZGUgZmlsZSB0cmVlJylcclxuXHRcdFx0XHQuc2V0RGVzYygnQWRkcyBhbiBpbnRlcmFjdGl2ZSBmaWxlIHRyZWUgdG8gdGhlIGxlZnQgc2lkZWJhci4nKVxyXG5cdFx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVGaWxlVHJlZSlcclxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVGaWxlVHJlZSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQpKTtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgZXJyb3JNZXNzYWdlID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmctaXRlbS1kZXNjcmlwdGlvbicgfSk7XHJcblx0XHRlcnJvck1lc3NhZ2Uuc3R5bGUuY29sb3IgPSBcInZhcigtLWNvbG9yLXJlZClcIjtcclxuXHRcdGVycm9yTWVzc2FnZS5zdHlsZS5tYXJnaW5Cb3R0b20gPSBcIjAuNzVyZW1cIjtcclxuXHJcblx0XHRpZiAoIShNYWluU2V0dGluZ3Muc2V0dGluZ3MuY3VzdG9tSGVhZENvbnRlbnRQYXRoLnRyaW0oKSA9PSBcIlwiKSlcclxuXHRcdHtcclxuXHRcdFx0bGV0IHRlbXBQYXRoID0gbmV3IFBhdGgoTWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUhlYWRDb250ZW50UGF0aCk7XHJcblx0XHRcdGlmKHRlbXBQYXRoLmlzRGlyZWN0b3J5KSBlcnJvck1lc3NhZ2Uuc2V0VGV4dChcIlBhdGggbXVzdCBiZSBhIGZpbGUhXCIpO1xyXG5cdFx0XHRlbHNlIGlmKCF0ZW1wUGF0aC5pc0Fic29sdXRlKSBlcnJvck1lc3NhZ2Uuc2V0VGV4dChcIlBhdGggbXVzdCBiZSBhYnNvbHV0ZSFcIik7XHJcblx0XHRcdGVsc2UgaWYoIXRlbXBQYXRoLmV4aXN0cykgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIGRvZXMgbm90IGV4aXN0IVwiKTtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgcGF0aElucHV0IDogVGV4dENvbXBvbmVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdDdXN0b20gaGVhZCBjb250ZW50IHBhdGgnKVxyXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4gXHJcblx0XHRcdHtcclxuXHRcdFx0XHRwYXRoSW5wdXQgPSB0ZXh0O1xyXG5cdFx0XHRcdHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9ICcxMDAlJztcclxuXHRcdFx0XHR0ZXh0LnNldFBsYWNlaG9sZGVyKCdFbnRlciBhbiBhYnNvbHV0ZSBwYXRoIHRvIGFueSB0ZXh0IGZpbGUnKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5jdXN0b21IZWFkQ29udGVudFBhdGgpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiBcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bGV0IHBhdGggPSBuZXcgUGF0aCh2YWx1ZSk7XHJcblx0XHRcdFx0XHRcdGlmKHZhbHVlID09IFwiXCIpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiXCIpO1xyXG5cdFx0XHRcdFx0XHRlbHNlIGlmKHBhdGguaXNEaXJlY3RvcnkpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiUGF0aCBtdXN0IGJlIGEgZmlsZSFcIik7XHJcblx0XHRcdFx0XHRcdGVsc2UgaWYoIXBhdGguaXNBYnNvbHV0ZSkgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIG11c3QgYmUgYWJzb2x1dGUhXCIpO1xyXG5cdFx0XHRcdFx0XHRlbHNlIGlmKCFwYXRoLmV4aXN0cykgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIGRvZXMgbm90IGV4aXN0IVwiKTtcclxuXHRcdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JNZXNzYWdlLnNldFRleHQoXCJcIik7XHJcblx0XHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUhlYWRDb250ZW50UGF0aCA9IHZhbHVlLnJlcGxhY2VBbGwoXCJcXFwiXCIsIFwiXCIpO1xyXG5cdFx0XHRcdFx0XHRcdHRleHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUhlYWRDb250ZW50UGF0aCk7XHJcblx0XHRcdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0fSlcclxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG5cdFx0XHR7XHJcblx0XHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoJ0Jyb3dzZScpLm9uQ2xpY2soYXN5bmMgKCkgPT4gXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0bGV0IGlkZWFsID0gVXRpbHMuaWRlYWxEZWZhdWx0UGF0aCgpO1xyXG5cdFx0XHRcdFx0bGV0IHBhdGggPSAoYXdhaXQgVXRpbHMuc2hvd1NlbGVjdEZpbGVEaWFsb2coaWRlYWwpKTtcclxuXHRcdFx0XHRcdGlmIChwYXRoKSBcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUhlYWRDb250ZW50UGF0aCA9IHBhdGguYXNTdHJpbmc7XHJcblx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmKHBhdGguaXNEaXJlY3RvcnkpIGVycm9yTWVzc2FnZS5zZXRUZXh0KFwiUGF0aCBtdXN0IGJlIGEgZmlsZSFcIik7XHJcblx0XHRcdFx0XHRcdGVsc2UgaWYoIXBhdGguaXNBYnNvbHV0ZSkgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIG11c3QgYmUgYWJzb2x1dGUhXCIpO1xyXG5cdFx0XHRcdFx0XHRlbHNlIGlmKCFwYXRoLmV4aXN0cykgZXJyb3JNZXNzYWdlLnNldFRleHQoXCJQYXRoIGRvZXMgbm90IGV4aXN0IVwiKTtcclxuXHRcdFx0XHRcdFx0ZWxzZSBlcnJvck1lc3NhZ2Uuc2V0VGV4dChcIlwiKTtcclxuXHJcblx0XHRcdFx0XHRcdHBhdGhJbnB1dD8uc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUhlYWRDb250ZW50UGF0aCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdGNvbnRlbnRFbC5hcHBlbmRDaGlsZChlcnJvck1lc3NhZ2UpO1xyXG5cclxuXHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UHJlc2V0ICE9IFwicmF3LWRvY3VtZW50c1wiKVxyXG5cdFx0e1xyXG5cdFx0XHRcclxuXHRcdFx0aHIgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJoclwiKTtcclxuXHRcdFx0aHIuc3R5bGUubWFyZ2luVG9wID0gXCIyMHB4XCI7XHJcblx0XHRcdGhyLnN0eWxlLm1hcmdpbkJvdHRvbSA9IFwiMjBweFwiO1xyXG5cdFx0XHRoci5zdHlsZS5ib3JkZXJDb2xvciA9IFwidmFyKC0tY29sb3ItYWNjZW50KVwiO1xyXG5cdFx0XHRoci5zdHlsZS5vcGFjaXR5ID0gXCIwLjVcIjtcclxuXHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnUGFnZSBCZWhhdmlvcnM6JylcclxuXHRcdFx0XHQuc2V0RGVzYyhcIkNvbnRyb2wgdGhlIGJlaGF2aW9yIG9mIGRpZmZlcmVudCBwYWdlIGZlYXR1cmVzLlwiKVxyXG5cdFx0XHRcdC5zZXRIZWFkaW5nKClcclxuXHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnU3RhcnQgT3V0bGluZSBDb2xsYXBzZWQnKVxyXG5cdFx0XHRcdC5zZXREZXNjKCdTdGFydCB0aGUgZG9jdW1lbnRcXCdzIHRhYmxlIG9mIGNvbnRlbnRzIHdpdGggYWxsIGl0ZW1zIGNvbGxhcHNlZCcpXHJcblx0XHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGVcclxuXHRcdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3Muc3RhcnRPdXRsaW5lQ29sbGFwc2VkKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3Muc3RhcnRPdXRsaW5lQ29sbGFwc2VkID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pKTtcclxuXHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnQWxsb3cgZm9sZGluZyBoZWFkaW5ncycpXHJcblx0XHRcdFx0LnNldERlc2MoJ0FsbG93IGhlYWRpbmdzIHRvIGJlIGZvbGRlZCB3aXRoIGFuIGFycm93IGljb24gYmVzaWRlIGVhY2ggaGVhZGluZywganVzdCBhcyBpbiBPYnNpZGlhbi4nKVxyXG5cdFx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmFsbG93Rm9sZGluZ0hlYWRpbmdzKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuYWxsb3dGb2xkaW5nSGVhZGluZ3MgPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fSkpO1xyXG5cclxuXHRcdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdTaWRlYmFycyBBbHdheXMgQ29sbGFwc2libGUnKVxyXG5cdFx0XHRcdC5zZXREZXNjKCdBbHdheXMgYWxsb3cgdGhlIHNpZGViYXJzIHRvIGJlIGNvbGxhcHNlZCByZWdhcmRsZXNzIG9mIHRoZSBzcGFjZSBvbiB0aGUgc2NyZWVuLiBCeSBkZWZhdWx0IHRoZSBzaWRlYmFycyBhZGp1c3Qgd2hldGhlciB0aGV5IGNhbiBiZSBjb2xsYXBzZWQgYmFzZWQgb24gdGhlIHNwYWNlIGF2YWlsYWJsZS4nKVxyXG5cdFx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLnNpZGViYXJzQWx3YXlzQ29sbGFwc2libGUpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5zaWRlYmFyc0Fsd2F5c0NvbGxhcHNpYmxlID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0Ly8jZW5kcmVnaW9uXHJcblxyXG5cdFx0Ly8jcmVnaW9uIExheW91dCBPcHRpb25zXHJcblxyXG5cdFx0aHIgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJoclwiKTtcclxuXHRcdGhyLnN0eWxlLm1hcmdpblRvcCA9IFwiMjBweFwiO1xyXG5cdFx0aHIuc3R5bGUubWFyZ2luQm90dG9tID0gXCIyMHB4XCI7XHJcblx0XHRoci5zdHlsZS5ib3JkZXJDb2xvciA9IFwidmFyKC0tY29sb3ItYWNjZW50KVwiO1xyXG5cdFx0aHIuc3R5bGUub3BhY2l0eSA9IFwiMC41XCI7XHJcblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdMYXlvdXQgT3B0aW9uczonKVxyXG5cdFx0XHQuc2V0SGVhZGluZygpXHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnRG9jdW1lbnQgV2lkdGgnKVxyXG5cdFx0XHQuc2V0RGVzYygnU2V0cyB0aGUgbGluZSB3aWR0aCBvZiB0aGUgZXhwb3J0ZWQgZG9jdW1lbnQuIFVzZSBhbnkgY3NzIHVuaXRzLlxcbkRlZmF1bHQgdW5pdHM6IHB4JylcclxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+IHRleHRcclxuXHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUxpbmVXaWR0aClcclxuXHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ0xlYXZlIGJsYW5rIGZvciBkZWZhdWx0JylcclxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuY3VzdG9tTGluZVdpZHRoID0gdmFsdWU7XHJcblx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdCkpXHJcblx0XHRcdC5hZGRFeHRyYUJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0SWNvbigncmVzZXQnKS5zZXRUb29sdGlwKCdSZXNldCB0byBkZWZhdWx0Jykub25DbGljaygoKSA9PiB7XHJcblx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUxpbmVXaWR0aCA9IFwiXCI7XHJcblx0XHRcdFx0TWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xyXG5cdFx0XHR9KSk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnQ29udGVudCBXaWR0aCcpXHJcblx0XHRcdC5zZXREZXNjKCdTZXRzIHRoZSB3aWR0aCBvZiB0aGUgY2VudHJhbCBjb250ZW50IHNlY3Rpb24gb2YgdGhlIGRvY3VtZW50LiBUaGlzIHdpbGwgcHVzaCB0aGUgc2lkZWJhcnMgdG93YXJkcyB0aGUgZWRnZXMgb2YgdGhlIHNjcmVlbiB0aGUgbGFyZ2VyIGl0IGlzIGxlYXZpbmcgbWFyZ2lucyBvbiBlaXRoZXIgc2lkZSBvZiB0aGUgZG9jdW1lbnQuIFVzZSBhbnkgY3NzIHVuaXRzLlxcbkRlZmF1bHQgdW5pdHM6IHB4JylcclxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+IHRleHRcclxuXHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmNvbnRlbnRXaWR0aClcclxuXHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ0xlYXZlIGJsYW5rIGZvciBkZWZhdWx0JylcclxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuY29udGVudFdpZHRoID0gdmFsdWU7XHJcblx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdCkpXHJcblx0XHRcdC5hZGRFeHRyYUJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0SWNvbigncmVzZXQnKS5zZXRUb29sdGlwKCdSZXNldCB0byBkZWZhdWx0Jykub25DbGljaygoKSA9PiB7XHJcblx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmNvbnRlbnRXaWR0aCA9IFwiXCI7XHJcblx0XHRcdFx0TWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xyXG5cdFx0XHR9KSk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnU2lkZWJhciBXaWR0aCcpXHJcblx0XHRcdC5zZXREZXNjKCdTZXRzIHRoZSB3aWR0aCBvZiB0aGUgc2lkZWJhclxcJ3MgY29udGVudC4gVXNlIGFueSBjc3MgdW5pdHMuXFxuRGVmYXVsdCB1bml0czogcHgnKVxyXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4gdGV4dFxyXG5cdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3Muc2lkZWJhcldpZHRoKVxyXG5cdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignTGVhdmUgYmxhbmsgZm9yIGRlZmF1bHQnKVxyXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5zaWRlYmFyV2lkdGggPSB2YWx1ZTtcclxuXHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0KSlcclxuXHRcdFx0LmFkZEV4dHJhQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRJY29uKCdyZXNldCcpLnNldFRvb2x0aXAoJ1Jlc2V0IHRvIGRlZmF1bHQnKS5vbkNsaWNrKCgpID0+IHtcclxuXHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3Muc2lkZWJhcldpZHRoID0gXCJcIjtcclxuXHRcdFx0XHRNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XHJcblx0XHRcdH0pKTtcclxuXHJcblx0XHQvLyNlbmRyZWdpb25cclxuXHJcblx0XHQvLyNyZWdpb24gRXhwb3J0IE9wdGlvbnNcclxuXHJcblx0XHRociA9IGNvbnRlbnRFbC5jcmVhdGVFbChcImhyXCIpO1xyXG5cdFx0aHIuc3R5bGUubWFyZ2luVG9wID0gXCIyMHB4XCI7XHJcblx0XHRoci5zdHlsZS5tYXJnaW5Cb3R0b20gPSBcIjIwcHhcIjtcclxuXHRcdGhyLnN0eWxlLmJvcmRlckNvbG9yID0gXCJ2YXIoLS1jb2xvci1hY2NlbnQpXCI7XHJcblx0XHRoci5zdHlsZS5vcGFjaXR5ID0gXCIwLjVcIjtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdFeHBvcnQgT3B0aW9uczonKVxyXG5cdFx0XHQuc2V0SGVhZGluZygpXHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnTG9nIExldmVsJylcclxuXHRcdFx0LnNldERlc2MoJ1NldCB0aGUgbGV2ZWwgb2YgbG9nZ2luZyB0byBkaXNwbGF5IGluIHRoZSBleHBvcnQgbG9nLicpXHJcblx0XHRcdC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IGRyb3Bkb3duXHJcblx0XHRcdFx0LmFkZE9wdGlvbignYWxsJywgJ0FsbCcpXHJcblx0XHRcdFx0LmFkZE9wdGlvbignd2FybmluZycsICdXYXJuaW5nJylcclxuXHRcdFx0XHQuYWRkT3B0aW9uKCdlcnJvcicsICdFcnJvcicpXHJcblx0XHRcdFx0LmFkZE9wdGlvbignZmF0YWwnLCAnT25seSBGYXRhbCBFcnJvcnMnKVxyXG5cdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3MubG9nTGV2ZWwpXHJcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogXCJhbGxcIiB8IFwid2FybmluZ1wiIHwgXCJlcnJvclwiIHwgXCJmYXRhbFwiIHwgXCJub25lXCIpID0+XHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmxvZ0xldmVsID0gdmFsdWU7XHJcblx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0fSkpO1xyXG5cdFx0XHJcblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdNYWtlIG5hbWVzIHdlYiBzdHlsZScpXHJcblx0XHRcdC5zZXREZXNjKCdNYWtlIHRoZSBuYW1lcyBvZiBmaWxlcyBhbmQgZm9sZGVycyBsb3dlcmNhc2UgYW5kIHJlcGxhY2Ugc3BhY2VzIHdpdGggZGFzaGVzLicpXHJcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5tYWtlTmFtZXNXZWJTdHlsZSlcclxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MubWFrZU5hbWVzV2ViU3R5bGUgPSB2YWx1ZTtcclxuXHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHR9KSk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnTWluaWZ5IEhUTUwnKVxyXG5cdFx0XHQuc2V0RGVzYygnTWluaWZ5IHRoZSBIVE1MIHRvIG1ha2UgaXQgbG9hZCBmYXN0ZXIgKGJ1dCBpdCB3aWxsIGJlIGxlc3MgcmVhZGFibGUgdG8gaHVtYW5zKS4nKVxyXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZVxyXG5cdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3MubWluaWZ5SFRNTClcclxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MubWluaWZ5SFRNTCA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdH0pKTtcclxuXHJcblx0XHQvLyNlbmRyZWdpb25cclxuXHJcblx0XHQvLyNyZWdpb24gUGx1Z2luIENTU1xyXG5cclxuXHRcdGhyID0gY29udGVudEVsLmNyZWF0ZUVsKFwiaHJcIik7XHJcblx0XHRoci5zdHlsZS5tYXJnaW5Ub3AgPSBcIjIwcHhcIjtcclxuXHRcdGhyLnN0eWxlLm1hcmdpbkJvdHRvbSA9IFwiMjBweFwiO1xyXG5cdFx0aHIuc3R5bGUuYm9yZGVyQ29sb3IgPSBcInZhcigtLWNvbG9yLWFjY2VudClcIjtcclxuXHRcdGhyLnN0eWxlLm9wYWNpdHkgPSBcIjAuNVwiO1xyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnSW5jbHVkZSBQbHVnaW4gQ1NTJylcclxuXHRcdFx0LnNldERlc2MoJ0luY2x1ZGUgdGhlIENTUyBmcm9tIHRoZSBmb2xsb3dpbmcgcGx1Z2lucyBpbiB0aGUgZXhwb3J0ZWQgSFRNTC4gSWYgcGx1Z2luIGZlYXR1cmVzIGFyZW5cXCd0IHJlbmRlcmluZyBjb3JyZWN0bHksIHRyeSBhZGRpbmcgdGhlIHBsdWdpbiB0byB0aGlzIGxpc3QuJylcclxuXHRcdFx0LnNldEhlYWRpbmcoKVxyXG5cclxuXHRcdGxldCBwbHVnaW5zTGlzdCA9IG5ldyBGbG93TGlzdChjb250ZW50RWwpO1xyXG5cdFx0VXRpbHMuZ2V0UGx1Z2luSURzKCkuZm9yRWFjaChhc3luYyAocGx1Z2luKSA9PiB7XHJcblx0XHRcdGxldCBwbHVnaW5NYW5pZmVzdCA9IFV0aWxzLmdldFBsdWdpbk1hbmlmZXN0KHBsdWdpbik7XHJcblx0XHRcdGlmICghcGx1Z2luTWFuaWZlc3QpIHJldHVybjtcclxuXHJcblx0XHRcdGlmICgoYXdhaXQgdGhpcy5nZXRCbGFja2xpc3RlZFBsdWdpbklEcygpKS5jb250YWlucyhwbHVnaW5NYW5pZmVzdC5pZCkpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBwbHVnaW5EaXIgPSBwbHVnaW5NYW5pZmVzdC5kaXI7XHJcblx0XHRcdGlmICghcGx1Z2luRGlyKSByZXR1cm47XHJcblx0XHRcdGxldCBwbHVnaW5QYXRoID0gbmV3IFBhdGgocGx1Z2luRGlyKTtcclxuXHJcblx0XHRcdGxldCBoYXNDU1MgPSBwbHVnaW5QYXRoLmpvaW5TdHJpbmcoJ3N0eWxlcy5jc3MnKS5leGlzdHM7XHJcblx0XHRcdGlmICghaGFzQ1NTKSByZXR1cm47XHJcblxyXG5cdFx0XHRsZXQgaXNDaGVja2VkID0gTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVQbHVnaW5DU1MubWF0Y2gobmV3IFJlZ0V4cChgXiR7cGx1Z2lufWAsICdtJykpICE9IG51bGw7XHJcblxyXG5cdFx0XHRwbHVnaW5zTGlzdC5hZGRJdGVtKHBsdWdpbk1hbmlmZXN0Lm5hbWUsIHBsdWdpbiwgaXNDaGVja2VkLCAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZVBsdWdpbkNTUyA9IHBsdWdpbnNMaXN0LmNoZWNrZWRMaXN0LmpvaW4oJ1xcbicpO1xyXG5cdFx0XHRcdE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdC5zZXROYW1lKCdJbmNsdWRlIFN2ZWx0ZSBDU1MnKVxyXG5cdFx0XHQuc2V0RGVzYygnSW5jbHVkZSB0aGUgQ1NTIGZyb20gYW55IHBsdWdpbnMgdGhhdCB1c2UgdGhlIHN2ZWx0ZSBmcmFtZXdvcmsuJylcclxuXHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGVcclxuXHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVTdmVsdGVDU1MpXHJcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVTdmVsdGVDU1MgPSB2YWx1ZTtcclxuXHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHR9KSk7XHJcblxyXG5cdFx0Ly8jZW5kcmVnaW9uXHJcblxyXG5cdFx0Ly8jcmVnaW9uIEV4cGVyaW1lbnRhbFxyXG5cclxuXHJcblx0XHRsZXQgZXhwZXJpbWVudGFsQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xyXG5cdFx0bGV0IGV4cGVyaW1lbnRhbEhSMSA9IGV4cGVyaW1lbnRhbENvbnRhaW5lci5jcmVhdGVFbCgnaHInKTtcclxuXHRcdGxldCBleHBlcmltZW50YWxIZWFkZXIgPSBleHBlcmltZW50YWxDb250YWluZXIuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6ICdFeHBlcmltZW50YWwnIH0pO1xyXG5cdFx0bGV0IGV4cGVyaW1lbnRhbEhSMiA9IGV4cGVyaW1lbnRhbENvbnRhaW5lci5jcmVhdGVFbCgnaHInKTtcclxuXHJcblx0XHRleHBlcmltZW50YWxDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuXHRcdGV4cGVyaW1lbnRhbENvbnRhaW5lci5zdHlsZS5tYXJnaW5Ub3AgPSAnNWVtJztcclxuXHRcdGV4cGVyaW1lbnRhbENvbnRhaW5lci5zdHlsZS5hbGlnbkl0ZW1zID0gJ2NlbnRlcic7XHJcblxyXG5cdFx0ZXhwZXJpbWVudGFsSFIxLnN0eWxlLmJvcmRlckNvbG9yID0gXCJ2YXIoLS1jb2xvci1yZWQpXCI7XHJcblx0XHRleHBlcmltZW50YWxIUjIuc3R5bGUuYm9yZGVyQ29sb3IgPSBcInZhcigtLWNvbG9yLXJlZClcIjtcclxuXHRcdGV4cGVyaW1lbnRhbEhlYWRlci5zdHlsZS5jb2xvciA9IFwidmFyKC0tY29sb3ItcmVkKVwiO1xyXG5cclxuXHRcdGV4cGVyaW1lbnRhbEhSMS5zdHlsZS5mbGV4R3JvdyA9IFwiMVwiO1xyXG5cdFx0ZXhwZXJpbWVudGFsSFIyLnN0eWxlLmZsZXhHcm93ID0gXCIxXCI7XHJcblx0XHRleHBlcmltZW50YWxIZWFkZXIuc3R5bGUuZmxleEdyb3cgPSBcIjAuMVwiO1xyXG5cdFx0ZXhwZXJpbWVudGFsSGVhZGVyLnN0eWxlLnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnT25seSBFeHBvcnQgTW9kaWZpZWQnKVxyXG5cdFx0XHQuc2V0RGVzYygnRGlzYWJsZSB0aGlzIHRvIGRvIGEgZnVsbCByZS1leHBvcnQuIElmIHlvdSBoYXZlIGFuIGV4aXN0aW5nIHZhdWx0IHNpbmNlIGJlZm9yZSB0aGlzIGZlYXR1cmUgd2FzIGludHJvZHVjZWQsIHBsZWFzZSBkbyBhIGZ1bGwgcmUtZXhwb3J0IGJlZm9yZSB0dXJuaW5nIHRoaXMgb24hJylcclxuXHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGVcclxuXHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY3JlbWVudGFsRXhwb3J0KVxyXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNyZW1lbnRhbEV4cG9ydCA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0fSkpO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0LnNldE5hbWUoJ0RlbGV0ZSBPbGQgRmlsZXMnKVxyXG5cdFx0XHQuc2V0RGVzYygnRGVsZXRlICpBTEwqIGZpbGVzIGluIHRoZSBleHBvcnQgZGlyZWN0b3J5IHRoYXQgYXJlIG5vdCBpbmNsdWRlZCBpbiB0aGlzIGV4cG9ydC4nKVxyXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZVxyXG5cdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3MuZGVsZXRlT2xkRXhwb3J0ZWRGaWxlcylcclxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuZGVsZXRlT2xkRXhwb3J0ZWRGaWxlcyA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0fSkpO1xyXG5cclxuXHRcdFxyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQcmVzZXQgIT0gXCJyYXctZG9jdW1lbnRzXCIpXHJcblx0XHR7XHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnR3JhcGggVmlldyAoUExFQVNFIFJFQUQgREVTQ1JJUFRJT04pJylcclxuXHRcdFx0XHQuc2V0RGVzYygnVGhpcyBDQU5OT1QgYmUgdXNlZCB3aXRoIHRoZSBmaWxlOi8vIHByb3RvY29sLCB0aGUgYXNzZXRzIGZvciB0aGlzIGFsc28gd2lsbCBub3QgYmUgaW5saW5lZCBpbnRvIHRoZSBIVE1MIGZpbGUgYXQgdGhpcyBwb2ludC4nKVxyXG5cdFx0XHRcdC5zZXRIZWFkaW5nKClcclxuXHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnSW5jbHVkZSBnbG9iYWwgZ3JhcGggdmlldycpXHJcblx0XHRcdFx0LnNldERlc2MoJ0luY2x1ZGUgYW4gaW50ZXJhY3RpdmUgZ3JhcGggdmlldyBzaW0gb2YgdGhlIFdIT0xFIHZhdWx0IHNpbWlsYXIgdG8gb2JzaWRpYW5cXCdzLiAnKVxyXG5cdFx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVHcmFwaFZpZXcpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3ID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pKTtcclxuXHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnR3JhcGggVmlldyBTZXR0aW5ncycpXHJcblx0XHRcdFx0LnNldERlc2MoJ1NldHRpbmdzIHRvIGNvbnRyb2wgdGhlIGJlaGF2aW9yIGFuZCBsb29rIG9mIHRoZSBncmFwaCB2aWV3LiBGb3Igbm93IHRoZXJlIGlzIG5vIGxpdmUgcHJldmlldyBvZiB0aGlzLCBzbyB5b3UgbXVzdCBleHBvcnQgeW91ciBmaWxlcyB0byBzZWUgeW91ciBjaGFuZ2VzLicpXHJcblx0XHRcdFx0LnNldEhlYWRpbmcoKVxyXG5cclxuXHRcdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdBdHRyYWN0aW9uIEZvcmNlJylcclxuXHRcdFx0XHQuc2V0RGVzYyhcIkhvdyBtdWNoIHNob3VsZCBsaW5rZWQgbm9kZXMgYXR0cmFjdCBlYWNoIG90aGVyPyBUaGlzIHdpbGwgbWFrZSB0aGUgZ3JhcGggYXBwZWFyIG1vcmUgY2x1c3RlcmVkLlwiKVxyXG5cdFx0XHRcdC5hZGRTbGlkZXIoKHNsaWRlcikgPT4gc2xpZGVyXHJcblx0XHRcdFx0XHQuc2V0TGltaXRzKDAsIDEwMCwgMSlcclxuXHRcdFx0XHRcdC5zZXRWYWx1ZShNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhBdHRyYWN0aW9uRm9yY2UgLyAoMiAvIDEwMCkpXHJcblx0XHRcdFx0XHQuc2V0RHluYW1pY1Rvb2x0aXAoKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHQvLyByZW1hcCB0byAwIC0gMjtcclxuXHRcdFx0XHRcdFx0bGV0IHJlbWFwTXVsdGlwbGllciA9IDIgLyAxMDA7XHJcblx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaEF0dHJhY3Rpb25Gb3JjZSA9IHZhbHVlICogcmVtYXBNdWx0aXBsaWVyO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0LnNob3dUb29sdGlwKClcclxuXHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdMaW5rIExlbmd0aCcpXHJcblx0XHRcdFx0LnNldERlc2MoXCJIb3cgbG9uZyBzaG91bGQgdGhlIGxpbmtzIGJldHdlZW4gbm9kZXMgYmU/IFRoZSBzaG9ydGVyIHRoZSBsaW5rcyB0aGUgY2xvc2VyIGNvbm5lY3RlZCBub2RlcyB3aWxsIGNsdXN0ZXIgdG9nZXRoZXIuXCIpXHJcblx0XHRcdFx0LmFkZFNsaWRlcigoc2xpZGVyKSA9PiBzbGlkZXJcclxuXHRcdFx0XHRcdC5zZXRMaW1pdHMoMCwgMTAwLCAxKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaExpbmtMZW5ndGgpXHJcblx0XHRcdFx0XHQuc2V0RHluYW1pY1Rvb2x0aXAoKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhMaW5rTGVuZ3RoID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHQuc2hvd1Rvb2x0aXAoKVxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXHJcblx0XHRcdFx0LnNldE5hbWUoJ1JlcHVsc2lvbiBGb3JjZScpXHJcblx0XHRcdFx0LnNldERlc2MoXCJIb3cgbXVjaCBzaG91bGQgbm9kZXMgcmVwZWwgZWFjaCBvdGhlcj8gVGhpcyB3aWxsIG1ha2UgdGhlIGdyYXBoIGFwcGVhciBtb3JlIHNwcmVhZCBvdXQuXCIpXHJcblx0XHRcdFx0LmFkZFNsaWRlcigoc2xpZGVyKSA9PiBzbGlkZXJcclxuXHRcdFx0XHRcdC5zZXRMaW1pdHMoMCwgMTAwLCAxKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaFJlcHVsc2lvbkZvcmNlIC8gMylcclxuXHRcdFx0XHRcdC5zZXREeW5hbWljVG9vbHRpcCgpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaFJlcHVsc2lvbkZvcmNlID0gdmFsdWUgKiAzO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0LnNob3dUb29sdGlwKClcclxuXHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdDZW50cmFsIEZvcmNlJylcclxuXHRcdFx0XHQuc2V0RGVzYyhcIkhvdyBtdWNoIHNob3VsZCBub2RlcyBiZSBhdHRyYWN0ZWQgdG8gdGhlIGNlbnRlcj8gVGhpcyB3aWxsIG1ha2UgdGhlIGdyYXBoIGFwcGVhciBtb3JlIGRlbnNlIGFuZCBjaXJjdWxhci5cIilcclxuXHRcdFx0XHQuYWRkU2xpZGVyKChzbGlkZXIpID0+IHNsaWRlclxyXG5cdFx0XHRcdFx0LnNldExpbWl0cygwLCAxMDAsIDEpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmdyYXBoQ2VudHJhbEZvcmNlIC8gKDUgLyAxMDApKVxyXG5cdFx0XHRcdFx0LnNldER5bmFtaWNUb29sdGlwKClcclxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdFx0Ly8gcmVtYXAgdG8gMCAtIDU7XHJcblx0XHRcdFx0XHRcdGxldCByZW1hcE11bHRpcGxpZXIgPSA1IC8gMTAwO1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhDZW50cmFsRm9yY2UgPSB2YWx1ZSAqIHJlbWFwTXVsdGlwbGllcjtcclxuXHRcdFx0XHRcdFx0YXdhaXQgTWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRcdC5zaG93VG9vbHRpcCgpXHJcblx0XHRcdFx0KTtcclxuXHJcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcclxuXHRcdFx0XHQuc2V0TmFtZSgnTWF4IE5vZGUgUmFkaXVzJylcclxuXHRcdFx0XHQuc2V0RGVzYyhcIkhvdyBsYXJnZSBzaG91bGQgdGhlIGxhcmdlc3Qgbm9kZXMgYmU/IE5vZGVzIGFyZSBzaXplZCBieSBob3cgbWFueSBsaW5rcyB0aGV5IGhhdmUuIFRoZSBsYXJnZXIgYSBub2RlIGlzIHRoZSBtb3JlIGl0IHdpbGwgYXR0cmFjdCBvdGhlciBub2Rlcy4gVGhpcyBjYW4gYmUgdXNlZCB0byBjcmVhdGUgYSBnb29kIGdyb3VwaW5nIGFyb3VuZCB0aGUgbW9zdCBpbXBvcnRhbnQgbm9kZXMuXCIpXHJcblx0XHRcdFx0LmFkZFNsaWRlcigoc2xpZGVyKSA9PiBzbGlkZXJcclxuXHRcdFx0XHRcdC5zZXRMaW1pdHMoMywgMTUsIDEpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmdyYXBoTWF4Tm9kZVNpemUpXHJcblx0XHRcdFx0XHQuc2V0RHluYW1pY1Rvb2x0aXAoKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhNYXhOb2RlU2l6ZSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0LnNob3dUb29sdGlwKClcclxuXHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdNaW4gTm9kZSBSYWRpdXMnKVxyXG5cdFx0XHRcdC5zZXREZXNjKFwiSG93IHNtYWxsIHNob3VsZCB0aGUgc21hbGxlc3Qgbm9kZXMgYmU/IFRoZSBzbWFsbGVyIGEgbm9kZSBpcyB0aGUgbGVzcyBpdCB3aWxsIGF0dHJhY3Qgb3RoZXIgbm9kZXMuXCIpXHJcblx0XHRcdFx0LmFkZFNsaWRlcigoc2xpZGVyKSA9PiBzbGlkZXJcclxuXHRcdFx0XHRcdC5zZXRMaW1pdHMoMywgMTUsIDEpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUoTWFpblNldHRpbmdzLnNldHRpbmdzLmdyYXBoTWluTm9kZVNpemUpXHJcblx0XHRcdFx0XHQuc2V0RHluYW1pY1Rvb2x0aXAoKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhNaW5Ob2RlU2l6ZSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCBNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0LnNob3dUb29sdGlwKClcclxuXHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxyXG5cdFx0XHRcdC5zZXROYW1lKCdFZGdlIFBydW5pbmcgRmFjdG9yJylcclxuXHRcdFx0XHQuc2V0RGVzYyhcIkVkZ2VzIHdpdGggYSBsZW5ndGggYmVsb3cgdGhpcyB0aHJlc2hvbGQgd2lsbCBub3QgYmUgcmVuZGVyZWQsIGhvd2V2ZXIgdGhleSB3aWxsIHN0aWxsIGNvbnRyaWJ1dGUgdG8gdGhlIHNpbXVsYXRpb24uIFRoaXMgY2FuIGhlbHAgbGFyZ2UgdGFuZ2xlZCBncmFwaHMgbG9vayBtb3JlIG9yZ2FuaXNlZC4gSG92ZXJpbmcgb3ZlciBhIG5vZGUgd2lsbCBzdGlsbCBkaXNwbGF5IHRoZXNlIGxpbmtzLlwiKVxyXG5cdFx0XHRcdC5hZGRTbGlkZXIoKHNsaWRlcikgPT4gc2xpZGVyXHJcblx0XHRcdFx0XHQuc2V0TGltaXRzKDAsIDEwMCwgMSlcclxuXHRcdFx0XHRcdC5zZXRWYWx1ZSgxMDAgLSBNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhFZGdlUHJ1bmluZylcclxuXHRcdFx0XHRcdC5zZXREeW5hbWljVG9vbHRpcCgpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaEVkZ2VQcnVuaW5nID0gMTAwIC0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGF3YWl0IE1haW5TZXR0aW5ncy5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHQuc2hvd1Rvb2x0aXAoKVxyXG5cdFx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IGV4cGVyaW1lbnRhbEhSRW5kID0gY29udGVudEVsLmNyZWF0ZUVsKCdocicpO1xyXG5cdFx0ZXhwZXJpbWVudGFsSFJFbmQuc3R5bGUuYm9yZGVyQ29sb3IgPSBcInZhcigtLWNvbG9yLXJlZClcIjtcclxuXHJcblx0XHQvLyNlbmRyZWdpb25cclxuXHJcblx0fVxyXG59XHJcbiJdfQ==