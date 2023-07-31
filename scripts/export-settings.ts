import { Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Utils } from './utils/utils';
import HTMLExportPlugin from './main';
import { Path } from './utils/path';
import pluginStylesBlacklist from 'assets/third-party-styles-blacklist.txt';

export interface ExportSettingsData 
{
	// Inlining Options
	inlineCSS: boolean;
	inlineJS: boolean;
	inlineImages: boolean;
	includePluginCSS: string;
	includeSvelteCSS: boolean;

	// Formatting Options
	makeNamesWebStyle: boolean;
	allowFoldingHeadings: boolean;
	addFilenameTitle: boolean;
	beautifyHTML: boolean;
	customLineWidth: string;
	contentWidth: string;
	sidebarWidth: string;
	startOutlineCollapsed: boolean;

	// Export Options
	dataviewBlockWaitTime: number;
	showWarningsInExportLog: boolean;
	incrementalExport: boolean;

	// Page Features
	addDarkModeToggle: boolean;
	includeOutline: boolean;
	includeFileTree: boolean;
	includeGraphView: boolean;

	// Main Export Options
	exportPreset: string;
	openAfterExport: boolean;

	// Graph View Settings
	graphAttractionForce: number;
	graphLinkLength: number;
	graphRepulsionForce: number;
	graphCentralForce: number;
	graphEdgePruning: number;
	graphMinNodeSize: number;
	graphMaxNodeSize: number;

	// Cache
	lastExportPath: string;
}

const DEFAULT_SETTINGS: ExportSettingsData =
{
	// Inlining Options
	inlineCSS: true,
	inlineJS: true,
	inlineImages: true,
	includePluginCSS: '',
	includeSvelteCSS: true,

	// Formatting Options
	makeNamesWebStyle: false,
	allowFoldingHeadings: true,
	addFilenameTitle: true,
	beautifyHTML: false,
	customLineWidth: "",
	contentWidth: "",
	sidebarWidth: "",
	startOutlineCollapsed: false,

	// Export Options
	dataviewBlockWaitTime: 700,
	showWarningsInExportLog: true,
	incrementalExport: false,

	// Page Features
	addDarkModeToggle: true,
	includeOutline: true,
	includeGraphView: false,
	includeFileTree: true,

	// Main Export Options
	exportPreset: '',
	openAfterExport: true,

	// Graph View Settings
	graphAttractionForce: 1,
	graphLinkLength: 10,
	graphRepulsionForce: 150,
	graphCentralForce: 3,
	graphEdgePruning: 100,
	graphMinNodeSize: 3,
	graphMaxNodeSize: 7,

	// Cache
	lastExportPath: '',
}

export class FlowList {
	containerEl: HTMLElement;
	flowListEl: HTMLElement;
	checkedList: string[] = [];

	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
		this.flowListEl = this.containerEl.createDiv({ cls: 'flow-list' });

	}

	addItem(name: string, key: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
		let item = this.flowListEl.createDiv({ cls: 'flow-item' });
		let checkbox = item.createEl('input', { type: 'checkbox' });
		checkbox.checked = value;
		if (checkbox.checked) this.checkedList.push(key)

		checkbox.addEventListener('change', (evt) => {
			if (checkbox.checked) {
				if (!this.checkedList.includes(key))
					this.checkedList.push(key)
			}
			else {
				if (this.checkedList.includes(key))
					this.checkedList.remove(key)
			}
		});

		checkbox.addEventListener('change', (evt) => onChange(checkbox.checked));


		let label = item.createDiv({ cls: 'flow-label' });
		label.setText(name);

		return item;
	}

}

export class ExportSettings extends PluginSettingTab {

	static settings: ExportSettingsData = DEFAULT_SETTINGS;
	static plugin: Plugin;

	private blacklistedPluginIDs: string[] = [];
	public async getBlacklistedPluginIDs(): Promise<string[]> {
		if (this.blacklistedPluginIDs.length > 0) return this.blacklistedPluginIDs;
		this.blacklistedPluginIDs = pluginStylesBlacklist.split("\n");

		return this.blacklistedPluginIDs;
	}

	constructor(plugin: Plugin) {
		super(app, plugin);
		ExportSettings.plugin = plugin;
	}

	static async loadSettings() {
		ExportSettings.settings = Object.assign({}, DEFAULT_SETTINGS, await ExportSettings.plugin.loadData());
		ExportSettings.settings.customLineWidth = ExportSettings.settings.customLineWidth.toString();
		if (ExportSettings.settings.customLineWidth === "0") ExportSettings.settings.customLineWidth = "";
	}

	static async saveSettings() {
		await ExportSettings.plugin.saveData(ExportSettings.settings);
	}

	display() {
		const { containerEl: contentEl } = this;

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

		//#region Page Features

		let hr = contentEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(contentEl)
			.setName('Page Features:')
			.setDesc("Special features to embed onto the page.")
			.setHeading()

		new Setting(contentEl)
			.setName('Include theme toggle')
			.setDesc('Adds a theme toggle to the left sidebar.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.addDarkModeToggle)
				.onChange(async (value) => {
					ExportSettings.settings.addDarkModeToggle = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Include document outline')
			.setDesc('Adds the document\'s table of contents to the right sidebar.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeOutline)
				.onChange(async (value) => {
					ExportSettings.settings.includeOutline = value;
					await ExportSettings.saveSettings();
				}
				));

		new Setting(contentEl)
			.setName('Include file tree')
			.setDesc('Adds an interactive file tree to the left sidebar.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeFileTree)
				.onChange(async (value) => {
					ExportSettings.settings.includeFileTree = value;
					await ExportSettings.saveSettings();
				}
				));

		new Setting(contentEl)
			.setName('Add filename as title')
			.setDesc('If the first header is not an H1, include the file name as a title at the top of the page.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.addFilenameTitle)
				.onChange(async (value) => {
					ExportSettings.settings.addFilenameTitle = value;
					await ExportSettings.saveSettings();
				}));

		hr = contentEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(contentEl)
			.setName('Page Behaviors:')
			.setDesc("Control the behavior of different page features.")
			.setHeading()

		new Setting(contentEl)
			.setName('Start Outline Collapsed')
			.setDesc('Start the document\'s table of contents with all items collapsed')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.startOutlineCollapsed)
				.onChange(async (value) => {
					ExportSettings.settings.startOutlineCollapsed = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Allow folding headings')
			.setDesc('Allow headings to be folded with an arrow icon beside each heading, just as in Obsidian.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.allowFoldingHeadings)
				.onChange(async (value) => {
					ExportSettings.settings.allowFoldingHeadings = value;
					await ExportSettings.saveSettings();
				}));

		//#endregion

		//#region Embedding Options

		hr = contentEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(contentEl)
			.setName('Embedding Options:')
			.setDesc("If all three of these are on, the html files will be completely self-contained.")
			.setHeading()

		new Setting(contentEl)
			.setName('Embed CSS')
			.setDesc('Embed the CSS into the HTML file.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.inlineCSS)
				.onChange(async (value) => {
					ExportSettings.settings.inlineCSS = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Embed JS')
			.setDesc('Embed the JS into the HTML file.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.inlineJS)
				.onChange(async (value) => {
					ExportSettings.settings.inlineJS = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Embed Images')
			.setDesc('Embed the images into the HTML file.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.inlineImages)
				.onChange(async (value) => {
					ExportSettings.settings.inlineImages = value;
					await ExportSettings.saveSettings();
				}));

		//#endregion

		//#region Layout Options

		hr = contentEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(contentEl)
			.setName('Layout Options:')
			.setHeading()

		new Setting(contentEl)
			.setName('Document Width')
			.setDesc('Sets the line width of the exported document. Use any css units.\nDefault units: px')
			.addText((text) => text
				.setValue(ExportSettings.settings.customLineWidth)
				.setPlaceholder('Leave blank for default')
				.onChange(async (value) => {
					ExportSettings.settings.customLineWidth = value;
					await ExportSettings.saveSettings();
				}
				))
			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
				ExportSettings.settings.customLineWidth = "";
				ExportSettings.saveSettings();
				this.display();
			}));

		new Setting(contentEl)
			.setName('Content Width')
			.setDesc('Sets the width of the central content section of the document. This will push the sidebars towards the edges of the screen the larger it is leaving margins on either side of the document. Use any css units.\nDefault units: px')
			.addText((text) => text
				.setValue(ExportSettings.settings.contentWidth)
				.setPlaceholder('Leave blank for default')
				.onChange(async (value) => {
					ExportSettings.settings.contentWidth = value;
					await ExportSettings.saveSettings();
				}
				))
			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
				ExportSettings.settings.contentWidth = "";
				ExportSettings.saveSettings();
				this.display();
			}));

		new Setting(contentEl)
			.setName('Sidebar Width')
			.setDesc('Sets the width of the sidebar\'s content. Use any css units.\nDefault units: px')
			.addText((text) => text
				.setValue(ExportSettings.settings.sidebarWidth)
				.setPlaceholder('Leave blank for default')
				.onChange(async (value) => {
					ExportSettings.settings.sidebarWidth = value;
					await ExportSettings.saveSettings();
				}
				))
			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
				ExportSettings.settings.sidebarWidth = "";
				ExportSettings.saveSettings();
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
			.setHeading()

		new Setting(contentEl)
			.setName('Dataview Block Render Wait Time')
			.setDesc('In milliseconds.\n\nWait this long for each dataview block to render. If you have large dataview queries this can help make sure they are rendered correctly.')
			.addText((text) => text
				.setValue(ExportSettings.settings.dataviewBlockWaitTime.toString())
				.setPlaceholder(DEFAULT_SETTINGS.dataviewBlockWaitTime.toString())
				.onChange(async (value) => {
					// is the input is not a number then don't let it change
					if (isNaN(Number(value))) return;
					ExportSettings.settings.dataviewBlockWaitTime = Number(value);
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Show warnings in export log')
			.setDesc('The export log (shown in the export window) displays only relevant warnings or errors to you. Turn this off to stop displaying warnings. Errors will always show.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.showWarningsInExportLog)
				.onChange(async (value) => {
					ExportSettings.settings.showWarningsInExportLog = value;
					await ExportSettings.saveSettings();
				}));
		
		new Setting(contentEl)
			.setName('Make names web style')
			.setDesc('Make the names of files and folders lowercase and replace spaces with dashes.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.makeNamesWebStyle)
				.onChange(async (value) => {
					ExportSettings.settings.makeNamesWebStyle = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Beautify HTML')
			.setDesc('Beautify the HTML text to make it more human readable at the cost of export speed.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.beautifyHTML)
				.onChange(async (value) => {
					ExportSettings.settings.beautifyHTML = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Incremental export')
			.setDesc('Only export files that have changed since last export.')
			.addToggle((toggle) => toggle
			.setValue(ExportSettings.settings.incrementalExport)
			.onChange(async (value) => {
				ExportSettings.settings.incrementalExport = value;
				await ExportSettings.saveSettings();
			}));

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
			.setHeading()

		let pluginsList = new FlowList(contentEl);
		Utils.getPluginIDs().forEach(async (plugin) => {
			let pluginManifest = Utils.getPluginManifest(plugin);
			if (!pluginManifest) return;

			if ((await this.getBlacklistedPluginIDs()).contains(pluginManifest.id)) {
				return;
			}

			let pluginDir = pluginManifest.dir;
			if (!pluginDir) return;
			let pluginPath = new Path(pluginDir);

			let hasCSS = pluginPath.joinString('styles.css').exists;
			if (!hasCSS) return;

			let isChecked = ExportSettings.settings.includePluginCSS.match(new RegExp(`^${plugin}`, 'm')) != null;

			pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) => {
				ExportSettings.settings.includePluginCSS = pluginsList.checkedList.join('\n');
				ExportSettings.saveSettings();
			});
		});

		new Setting(contentEl)
			.setName('Include Svelte CSS')
			.setDesc('Include the CSS from any plugins that use the svelte framework.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeSvelteCSS)
				.onChange(async (value) => {
					ExportSettings.settings.includeSvelteCSS = value;
					await ExportSettings.saveSettings();
				}));

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
			.setName('Graph View (PLEASE READ DESCRIPTION)')
			.setDesc('This CANNOT be used with the file:// protocol, the assets for this also will not be inlined into the HTML file at this point.')
			.setHeading()

		new Setting(contentEl)
			.setName('Include global graph view')
			.setDesc('Include an interactive graph view sim of the WHOLE vault similar to obsidian\'s. ')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeGraphView)
				.onChange(async (value) => {
					ExportSettings.settings.includeGraphView = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Graph View Settings')
			.setDesc('Settings to control the behavior and look of the graph view. For now there is no live preview of this, so you must export your files to see your changes.')
			.setHeading()

		new Setting(contentEl)
			.setName('Attraction Force')
			.setDesc("How much should linked nodes attract each other? This will make the graph appear more clustered.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphAttractionForce / (2 / 100))
				.setDynamicTooltip()
				.onChange(async (value) => {
					// remap to 0 - 2;
					let remapMultiplier = 2 / 100;
					ExportSettings.settings.graphAttractionForce = value * remapMultiplier;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(contentEl)
			.setName('Link Length')
			.setDesc("How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphLinkLength)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ExportSettings.settings.graphLinkLength = value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(contentEl)
			.setName('Repulsion Force')
			.setDesc("How much should nodes repel each other? This will make the graph appear more spread out.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphRepulsionForce / 3)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ExportSettings.settings.graphRepulsionForce = value * 3;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(contentEl)
			.setName('Central Force')
			.setDesc("How much should nodes be attracted to the center? This will make the graph appear more dense and circular.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphCentralForce / (5 / 100))
				.setDynamicTooltip()
				.onChange(async (value) => {
					// remap to 0 - 5;
					let remapMultiplier = 5 / 100;
					ExportSettings.settings.graphCentralForce = value * remapMultiplier;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(contentEl)
			.setName('Max Node Radius')
			.setDesc("How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.")
			.addSlider((slider) => slider
				.setLimits(3, 15, 1)
				.setValue(ExportSettings.settings.graphMaxNodeSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ExportSettings.settings.graphMaxNodeSize = value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(contentEl)
			.setName('Min Node Radius')
			.setDesc("How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.")
			.addSlider((slider) => slider
				.setLimits(3, 15, 1)
				.setValue(ExportSettings.settings.graphMinNodeSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ExportSettings.settings.graphMinNodeSize = value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(contentEl)
			.setName('Edge Pruning Factor')
			.setDesc("Edges with a length below this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(100 - ExportSettings.settings.graphEdgePruning)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ExportSettings.settings.graphEdgePruning = 100 - value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		let experimentalHREnd = contentEl.createEl('hr');
		experimentalHREnd.style.borderColor = "var(--color-red)";

		//#endregion

	}
}

export class ExportModal extends Modal {
	static isClosed: boolean = true;
	static canceled: boolean = true;

	constructor() {
		super(app);
	}

	/**
	 * @brief Opens the modal and async blocks until the modal is closed.
	 * @returns True if the EXPORT button was pressed, false is the export was canceled.
	 * @override
	*/
	async open(): Promise<{ canceled: boolean }> {
		ExportModal.isClosed = false;
		ExportModal.canceled = true;

		super.open();

		const { contentEl } = this;

		contentEl.empty();

		this.titleEl.setText('Export to HTML');

		if (HTMLExportPlugin.updateInfo.updateAvailable) {
			// create red notice showing the update is available
			let updateNotice = contentEl.createEl('strong', { text: `Update Available: ${HTMLExportPlugin.updateInfo.currentVersion} ⟶ ${HTMLExportPlugin.updateInfo.latestVersion}` });
			updateNotice.setAttribute("style",
				`margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--interactive-normal);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--color-red);
			border-radius: 5px;
			display: block;
			width: fit-content;`)

			// create normal block with update notes
			let updateNotes = contentEl.createEl('div', { text: HTMLExportPlugin.updateInfo.updateNote });
			updateNotes.setAttribute("style",
				`margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--background-secondary-alt);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--text-normal);
			font-size: var(--font-ui-smaller);
			border-radius: 5px;
			display: block;
			width: fit-content;
			white-space: pre-wrap;`)
		}

		let hr = contentEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";

		contentEl.createEl('h3', { text: 'Basic Options:' });

		new Setting(contentEl)
			.setName('Export Presets')
			.setHeading()
			.addDropdown((dropdown) => dropdown
				.addOption('website', 'Multi-File Website')
				.addOption('documents', 'Self-contained Documents')
				.setValue(ExportSettings.settings.exportPreset)
				.onChange(async (value) => 
				{
					ExportSettings.settings.exportPreset = value;

					switch (value) {
						case 'documents':
							ExportSettings.settings.inlineCSS = true;
							ExportSettings.settings.inlineJS = true;
							ExportSettings.settings.inlineImages = true;
							ExportSettings.settings.makeNamesWebStyle = false;
							ExportSettings.settings.includeGraphView = false;
							ExportSettings.settings.includeFileTree = false;
							await ExportSettings.saveSettings();

							break;
						case 'website':
							ExportSettings.settings.inlineCSS = false;
							ExportSettings.settings.inlineJS = false;
							ExportSettings.settings.inlineImages = false;
							ExportSettings.settings.makeNamesWebStyle = true;
							ExportSettings.settings.includeGraphView = true;
							ExportSettings.settings.includeFileTree = true;
							await ExportSettings.saveSettings();

							break;
					}

					this.open();
				}
				));

		contentEl.createDiv().outerHTML = 
		`
		<div class="setting-item-description" style="white-space: pre-wrap; margin-bottom: 1em;
		">Multi-File Website: For multiple files as a website.
Self-contained Documents: For documents which should each be self contained as one file.

<em>For more control open the plugin settings from the button at the bottom of this popup.</em></div>`

		new Setting(contentEl)
			.setName('Open after export')
			.addToggle((toggle) => toggle
				.setTooltip('Open the exported file after exporting.')
				.setValue(ExportSettings.settings.openAfterExport)
				.onChange(async (value) => {
					ExportSettings.settings.openAfterExport = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('')
			.setHeading()
			.addButton((button) => 
			{
				button.setButtonText('Export').onClick(async () => 
				{
					ExportModal.canceled = false;
					this.close();
				});

				button.buttonEl.style.marginRight = 'auto';
				button.buttonEl.style.marginLeft = 'auto';
				button.buttonEl.style.width = '-webkit-fill-available';
				button.buttonEl.style.marginBottom = '2em';
			});

		new Setting(contentEl)
			.setDesc("More options located on the plugin settings page.")
			.addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() => {
				//@ts-ignore
				app.setting.open();
				//@ts-ignore
				app.setting.openTabById('webpage-html-export');
			}));


		await Utils.waitUntil(() => ExportModal.isClosed, 60 * 60 * 1000, 10);

		return { canceled: ExportModal.canceled };
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		ExportModal.isClosed = true;
	}
}
