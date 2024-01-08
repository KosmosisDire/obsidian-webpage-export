import { Plugin, PluginSettingTab, Setting, TFile, TextComponent } from 'obsidian';
import { Utils } from '../utils/utils';
import { Path } from '../utils/path';
import pluginStylesBlacklist from 'assets/third-party-styles-blacklist.txt';
import { FlowList } from './flow-list';
import { ExportInfo, ExportModal } from './export-modal';

// #region Settings Definition

export interface MainSettingsData 
{
	// Inlining Options
	inlineCSS: boolean;
	inlineJS: boolean;
	inlineImages: boolean;
	includePluginCSS: string;
	includeSvelteCSS: boolean;
	titleProperty: string;
	customHeadContentPath: string;

	// Formatting Options
	makeNamesWebStyle: boolean;
	allowFoldingHeadings: boolean;
	sidebarsAlwaysCollapsible: boolean;
	addFilenameTitle: boolean;
	minifyHTML: boolean;
	customLineWidth: string;
	contentWidth: string;
	sidebarWidth: string;
	startOutlineCollapsed: boolean;

	// Export Options
	logLevel: "all" | "warning" | "error" | "fatal" | "none";
	incrementalExport: boolean;
	deleteOldExportedFiles: boolean;

	// Page Features
	addDarkModeToggle: boolean;
	includeOutline: boolean;
	includeFileTree: boolean;
	includeSearchBar: boolean;
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
	exportPath: string;
	filesToExport: string[][];
}

const DEFAULT_SETTINGS: MainSettingsData =
{
	// Inlining Options
	inlineCSS: false,
	inlineJS: false,
	inlineImages: false,
	includePluginCSS: '',
	includeSvelteCSS: true,
	titleProperty: 'webpage-title',
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
	includeFileTree: true,
	includeSearchBar: true,
	includeGraphView: true,

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
}

// #endregion

export class MainSettings extends PluginSettingTab 
{

	// #region Class Functions and Variables

	static settings: MainSettingsData = DEFAULT_SETTINGS;
	static plugin: Plugin;


	private blacklistedPluginIDs: string[] = [];
	public async getBlacklistedPluginIDs(): Promise<string[]> 
	{
		if (this.blacklistedPluginIDs.length > 0) return this.blacklistedPluginIDs;
		this.blacklistedPluginIDs = pluginStylesBlacklist.replaceAll("\r", "").split("\n");

		return this.blacklistedPluginIDs;
	}

	constructor(plugin: Plugin) {
		super(app, plugin);
		MainSettings.plugin = plugin;
	}

	static async loadSettings() {
		MainSettings.settings = Object.assign({}, DEFAULT_SETTINGS, await MainSettings.plugin.loadData());
		MainSettings.settings.customLineWidth = MainSettings.settings.customLineWidth.toString();
		if (MainSettings.settings.customLineWidth === "0") MainSettings.settings.customLineWidth = "";
	}

	static async saveSettings() {
		await MainSettings.plugin.saveData(MainSettings.settings);
	}

	static renameFile(file: TFile, oldPath: string)
	{
		let oldPathParsed = new Path(oldPath).asString;
		MainSettings.settings.filesToExport.forEach((fileList) =>
		{
			let index = fileList.indexOf(oldPathParsed);
			if (index >= 0)
			{
				fileList[index] = file.path;
			}
		});
	}

	static async updateSettings(usePreviousSettings: boolean = false, overrideFiles: TFile[] | undefined = undefined): Promise<ExportInfo | undefined>
	{
		if (!usePreviousSettings) 
		{
			let modal = new ExportModal();
			if(overrideFiles) modal.overridePickedFiles(overrideFiles);
			return await modal.open();
		}
		
		let files = MainSettings.settings.filesToExport[0];
		let path = new Path(MainSettings.settings.exportPath);
		if ((files.length == 0 && overrideFiles == undefined) || !path.exists || !path.isAbsolute || !path.isDirectory)
		{
			let modal = new ExportModal();
			if(overrideFiles) modal.overridePickedFiles(overrideFiles);
			return await modal.open();
		}

		return undefined;
	}

	static isAllInline(): boolean
	{
		return MainSettings.settings.inlineCSS && MainSettings.settings.inlineJS && MainSettings.settings.inlineImages;
	}

	static getFilesToExport(): TFile[]
	{
		let files: TFile[] = [];
		MainSettings.settings.filesToExport.forEach((fileList) =>
		{
			fileList.forEach((filePath) =>
			{
				let file = app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) files.push(file);
			});
		});
		return files;
	}

	// #endregion

	display() 
	{
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
				.setHeading()

		if (MainSettings.settings.exportPreset != "raw-documents")
		{
			new Setting(contentEl)
				.setName('Include theme toggle')
				.setDesc('Adds a theme toggle to the left sidebar.')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.addDarkModeToggle)
					.onChange(async (value) => {
						MainSettings.settings.addDarkModeToggle = value;
						await MainSettings.saveSettings();
					}));

			new Setting(contentEl)
				.setName('Include document outline')
				.setDesc('Adds the document\'s table of contents to the right sidebar.')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.includeOutline)
					.onChange(async (value) => {
						MainSettings.settings.includeOutline = value;
						await MainSettings.saveSettings();
					}
					));

			new Setting(contentEl)
				.setName('Include file tree')
				.setDesc('Adds an interactive file tree to the left sidebar.')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.includeFileTree)
					.onChange(async (value) => {
						MainSettings.settings.includeFileTree = value;
						await MainSettings.saveSettings();
					}
					));

			new Setting(contentEl)
				.setName('Include search bar')
				.setDesc('Adds a full text search of the website to the left sidebar.')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.includeSearchBar)
					.onChange(async (value) => {
						MainSettings.settings.includeSearchBar = value;
						await MainSettings.saveSettings();
					}
					));
		}

		new Setting(contentEl)
			.setName('Property name for title')
			.setDesc('Use this property to specify the page title. This also affects how the page is displayed in the file tree.')
			.addText((text) => text
				.setValue(MainSettings.settings.titleProperty)
				.onChange(async (value) => {
					MainSettings.settings.titleProperty = value;
					await MainSettings.saveSettings();
				})
			);

		let errorMessage = contentEl.createDiv({ cls: 'setting-item-description' });
		errorMessage.style.color = "var(--color-red)";
		errorMessage.style.marginBottom = "0.75rem";

		let tempPath = new Path(MainSettings.settings.customHeadContentPath);
		if(tempPath.isDirectory) errorMessage.setText("Path must be a file!");
		else if(!tempPath.isAbsolute) errorMessage.setText("Path must be absolute!");
		else if(!tempPath.exists) errorMessage.setText("Path does not exist!");

		let pathInput : TextComponent | undefined = undefined;

		new Setting(contentEl)
			.setName('Custom head content path')
			.addText((text) => 
			{
				pathInput = text;
				text.inputEl.style.width = '100%';
				text.setPlaceholder('Enter an absolute path to any text file')
					.setValue(MainSettings.settings.customHeadContentPath)
					.onChange(async (value) => 
					{
						let path = new Path(value);
						if(path.isDirectory) errorMessage.setText("Path must be a file!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else if(!path.exists) errorMessage.setText("Path does not exist!");
						else
						{
							errorMessage.setText("");
							MainSettings.settings.customHeadContentPath = value.replaceAll("\"", "");
							text.setValue(MainSettings.settings.customHeadContentPath);
							await MainSettings.saveSettings();
						}
					});
			})
			.addButton((button) =>
			{
				button.setButtonText('Browse').onClick(async () => 
				{
					let ideal = Utils.idealDefaultPath();
					let path = (await Utils.showSelectFileDialog(ideal));
					if (path) 
					{
						MainSettings.settings.customHeadContentPath = path.asString;
						await MainSettings.saveSettings();

						if(path.isDirectory) errorMessage.setText("Path must be a file!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else if(!path.exists) errorMessage.setText("Path does not exist!");
						else errorMessage.setText("");

						pathInput?.setValue(MainSettings.settings.customHeadContentPath);
					}
				});
			});

		contentEl.appendChild(errorMessage);

		if (MainSettings.settings.exportPreset != "raw-documents")
		{
			
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
					.setValue(MainSettings.settings.startOutlineCollapsed)
					.onChange(async (value) => {
						MainSettings.settings.startOutlineCollapsed = value;
						await MainSettings.saveSettings();
					}));

			new Setting(contentEl)
				.setName('Allow folding headings')
				.setDesc('Allow headings to be folded with an arrow icon beside each heading, just as in Obsidian.')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.allowFoldingHeadings)
					.onChange(async (value) => {
						MainSettings.settings.allowFoldingHeadings = value;
						await MainSettings.saveSettings();
					}));

			new Setting(contentEl)
				.setName('Sidebars Always Collapsible')
				.setDesc('Always allow the sidebars to be collapsed regardless of the space on the screen. By default the sidebars adjust whether they can be collapsed based on the space available.')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.sidebarsAlwaysCollapsible)
					.onChange(async (value) => {
						MainSettings.settings.sidebarsAlwaysCollapsible = value;
						await MainSettings.saveSettings();
					}));

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
			.setHeading()

		new Setting(contentEl)
			.setName('Document Width')
			.setDesc('Sets the line width of the exported document. Use any css units.\nDefault units: px')
			.addText((text) => text
				.setValue(MainSettings.settings.customLineWidth)
				.setPlaceholder('Leave blank for default')
				.onChange(async (value) => {
					MainSettings.settings.customLineWidth = value;
					await MainSettings.saveSettings();
				}
				))
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
				.onChange(async (value) => {
					MainSettings.settings.contentWidth = value;
					await MainSettings.saveSettings();
				}
				))
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
				.onChange(async (value) => {
					MainSettings.settings.sidebarWidth = value;
					await MainSettings.saveSettings();
				}
				))
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
			.setHeading()

		new Setting(contentEl)
			.setName('Log Level')
			.setDesc('Set the level of logging to display in the export log.')
			.addDropdown((dropdown) => dropdown
				.addOption('all', 'All')
				.addOption('warning', 'Warning')
				.addOption('error', 'Error')
				.addOption('fatal', 'Only Fatal Errors')
				.setValue(MainSettings.settings.logLevel)
				.onChange(async (value: "all" | "warning" | "error" | "fatal" | "none") =>
				{
					MainSettings.settings.logLevel = value;
					await MainSettings.saveSettings();
				}));
		
		new Setting(contentEl)
			.setName('Make names web style')
			.setDesc('Make the names of files and folders lowercase and replace spaces with dashes.')
			.addToggle((toggle) => toggle
				.setValue(MainSettings.settings.makeNamesWebStyle)
				.onChange(async (value) => {
					MainSettings.settings.makeNamesWebStyle = value;
					await MainSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Minify HTML')
			.setDesc('Minify the HTML to make it load faster (but it will be less readable to humans).')
			.addToggle((toggle) => toggle
				.setValue(MainSettings.settings.minifyHTML)
				.onChange(async (value) => {
					MainSettings.settings.minifyHTML = value;
					await MainSettings.saveSettings();
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

			let isChecked = MainSettings.settings.includePluginCSS.match(new RegExp(`^${plugin}`, 'm')) != null;

			pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) => {
				MainSettings.settings.includePluginCSS = pluginsList.checkedList.join('\n');
				MainSettings.saveSettings();
			});
		});

		new Setting(contentEl)
			.setName('Include Svelte CSS')
			.setDesc('Include the CSS from any plugins that use the svelte framework.')
			.addToggle((toggle) => toggle
				.setValue(MainSettings.settings.includeSvelteCSS)
				.onChange(async (value) => {
					MainSettings.settings.includeSvelteCSS = value;
					await MainSettings.saveSettings();
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

		
		if (MainSettings.settings.exportPreset != "raw-documents")
		{
			new Setting(contentEl)
				.setName('Graph View (PLEASE READ DESCRIPTION)')
				.setDesc('This CANNOT be used with the file:// protocol, the assets for this also will not be inlined into the HTML file at this point.')
				.setHeading()

			new Setting(contentEl)
				.setName('Include global graph view')
				.setDesc('Include an interactive graph view sim of the WHOLE vault similar to obsidian\'s. ')
				.addToggle((toggle) => toggle
					.setValue(MainSettings.settings.includeGraphView)
					.onChange(async (value) => {
						MainSettings.settings.includeGraphView = value;
						await MainSettings.saveSettings();
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
					.setValue(MainSettings.settings.graphAttractionForce / (2 / 100))
					.setDynamicTooltip()
					.onChange(async (value) => {
						// remap to 0 - 2;
						let remapMultiplier = 2 / 100;
						MainSettings.settings.graphAttractionForce = value * remapMultiplier;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);

			new Setting(contentEl)
				.setName('Link Length')
				.setDesc("How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.")
				.addSlider((slider) => slider
					.setLimits(0, 100, 1)
					.setValue(MainSettings.settings.graphLinkLength)
					.setDynamicTooltip()
					.onChange(async (value) => {
						MainSettings.settings.graphLinkLength = value;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);

			new Setting(contentEl)
				.setName('Repulsion Force')
				.setDesc("How much should nodes repel each other? This will make the graph appear more spread out.")
				.addSlider((slider) => slider
					.setLimits(0, 100, 1)
					.setValue(MainSettings.settings.graphRepulsionForce / 3)
					.setDynamicTooltip()
					.onChange(async (value) => {
						MainSettings.settings.graphRepulsionForce = value * 3;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);

			new Setting(contentEl)
				.setName('Central Force')
				.setDesc("How much should nodes be attracted to the center? This will make the graph appear more dense and circular.")
				.addSlider((slider) => slider
					.setLimits(0, 100, 1)
					.setValue(MainSettings.settings.graphCentralForce / (5 / 100))
					.setDynamicTooltip()
					.onChange(async (value) => {
						// remap to 0 - 5;
						let remapMultiplier = 5 / 100;
						MainSettings.settings.graphCentralForce = value * remapMultiplier;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);

			new Setting(contentEl)
				.setName('Max Node Radius')
				.setDesc("How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.")
				.addSlider((slider) => slider
					.setLimits(3, 15, 1)
					.setValue(MainSettings.settings.graphMaxNodeSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						MainSettings.settings.graphMaxNodeSize = value;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);

			new Setting(contentEl)
				.setName('Min Node Radius')
				.setDesc("How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.")
				.addSlider((slider) => slider
					.setLimits(3, 15, 1)
					.setValue(MainSettings.settings.graphMinNodeSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						MainSettings.settings.graphMinNodeSize = value;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);

			new Setting(contentEl)
				.setName('Edge Pruning Factor')
				.setDesc("Edges with a length below this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.")
				.addSlider((slider) => slider
					.setLimits(0, 100, 1)
					.setValue(100 - MainSettings.settings.graphEdgePruning)
					.setDynamicTooltip()
					.onChange(async (value) => {
						MainSettings.settings.graphEdgePruning = 100 - value;
						await MainSettings.saveSettings();
					})
					.showTooltip()
				);
		}

		let experimentalHREnd = contentEl.createEl('hr');
		experimentalHREnd.style.borderColor = "var(--color-red)";

		//#endregion

	}
}
