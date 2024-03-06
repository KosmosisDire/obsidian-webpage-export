import { Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, TextComponent, Vault, getIcon } from 'obsidian';
import { Utils } from '../utils/utils';
import { Path } from '../utils/path';
import pluginStylesBlacklist from 'assets/third-party-styles-blacklist.txt';
import { FlowList } from './flow-list';
import { ExportInfo, ExportModal } from './export-modal';
import { migrateSettings } from './settings-migration';
import { ExportLog } from 'scripts/html-generation/render-log';

// #region Settings Definition

export enum ExportPreset
{
	Website = "website",
	Documents = "documents",
	RawDocuments = "raw-documents",
}

export enum EmojiStyle
{
	Native = "Native",
	Twemoji = "Twemoji",
	OpenMoji = "OpenMoji",
	OpenMojiOutline = "OpenMojiOutline",
	FluentUI = "FluentUI",
}

export class Settings
{
	public static settingsVersion: string;

	// Asset Options
	public static makeOfflineCompatible: boolean;
	public static inlineAssets: boolean;
	public static includePluginCSS: string;
	public static includeSvelteCSS: boolean;
	public static titleProperty: string;
	public static customHeadContentPath: string;
	public static faviconPath: string;

	// Layout Options
	public static documentWidth: string;
	public static sidebarWidth: string;

	// Behavior Options
	public static minOutlineCollapse: number;
	public static startOutlineCollapsed: boolean;
	public static allowFoldingHeadings: boolean;
	public static allowFoldingLists: boolean;
	public static allowResizingSidebars: boolean;

	// Export Options
	public static logLevel: "all" | "warning" | "error" | "fatal" | "none";
	public static minifyHTML: boolean;
	public static makeNamesWebStyle: boolean;
	public static onlyExportModified: boolean;
	public static deleteOldFiles: boolean;

	// Page Features
	public static addThemeToggle: boolean;
	public static addOutline: boolean;
	public static addFileNav: boolean;
	public static addSearchBar: boolean;
	public static addGraphView: boolean;
	public static addTitle: boolean;
	public static addRSSFeed: boolean;

	// Main Export Options
	public static siteURL: string;
	public static authorName: string;
	public static vaultTitle: string;
	public static exportPreset: ExportPreset;
	public static openAfterExport: boolean;

	// Graph View Settings
	public static graphAttractionForce: number;
	public static graphLinkLength: number;
	public static graphRepulsionForce: number;
	public static graphCentralForce: number;
	public static graphEdgePruning: number;
	public static graphMinNodeSize: number;
	public static graphMaxNodeSize: number;

	// icons
	public static showDefaultTreeIcons: boolean;
	public static emojiStyle: EmojiStyle;
	public static defaultFileIcon: string;
	public static defaultFolderIcon: string;
	public static defaultMediaIcon: string;

	// Cache
	public static exportPath: string;
	public static filesToExport: string[][];
}

export const DEFAULT_SETTINGS: Settings =
{
	settingsVersion: "0.0.0",

	// Asset Options
	makeOfflineCompatible: false,
	inlineAssets: false,
	includePluginCSS: '',
	includeSvelteCSS: true,
	titleProperty: 'title',
	customHeadContentPath: '',
	faviconPath: '',

	// Layout Options
	documentWidth: "40em",
	sidebarWidth: "20em",
	
	// Behavior Options
	minOutlineCollapse: 2,
	startOutlineCollapsed: false,
	allowFoldingHeadings: true,
	allowFoldingLists: true,
	allowResizingSidebars: true,
	
	// Export Options
	logLevel: "warning",
	minifyHTML: true,
	makeNamesWebStyle: true,
	onlyExportModified: true,
	deleteOldFiles: true,
	
	// Page Features
	addThemeToggle: true,
	addOutline: true,
	addFileNav: true,
	addSearchBar: true,
	addGraphView: true,
	addTitle: true,
	addRSSFeed: true,

	// Main Export Options
	siteURL: '',
	authorName: '',
	vaultTitle: app.vault.getName(),
	exportPreset: ExportPreset.Website,
	openAfterExport: false,

	// Graph View Settings
	graphAttractionForce: 1,
	graphLinkLength: 10,
	graphRepulsionForce: 150,
	graphCentralForce: 3,
	graphEdgePruning: 100,
	graphMinNodeSize: 3,
	graphMaxNodeSize: 7,

	// icons
	showDefaultTreeIcons: false,
	emojiStyle: EmojiStyle.Native,
	defaultFileIcon: "lucide//file",
	defaultFolderIcon: "lucide//folder",
	defaultMediaIcon: "lucide//file-image",

	// Cache
	exportPath: '',
	filesToExport: [[]],
}

// #endregion

export class SettingsPage extends PluginSettingTab
{
	display() 
	{
		const { containerEl: contentEl } = this;

		// #region Settings Header

		contentEl.empty();

		let header = contentEl.createEl('h2', { text: 'HTML Export Settings' });
		header.style.display = 'block';
		header.style.marginBottom = '15px';

		let supportContainer = contentEl.createDiv();
		supportContainer.style.marginBottom = '15px';
		let supportLink = contentEl.createEl('a');
		let buttonColor = Utils.sampleCSSColorHex("--color-accent", document.body).hex;
		let buttonTextColor = Utils.sampleCSSColorHex("--text-on-accent", document.body).hex;
		// @ts-ignore
		supportLink.href = `href="https://www.buymeacoffee.com/nathangeorge"`;
		supportLink.style.height = "40px"
		supportLink.innerHTML = `<img style="height:40px;" src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=nathangeorge&button_colour=${buttonColor}&font_colour=${buttonTextColor}&font_family=Poppins&outline_colour=${buttonTextColor}&coffee_colour=FFDD00">`;
		let supportHeader = contentEl.createDiv({ text: 'Support the continued development of this plugin.', cls: "setting-item-description" });
		supportHeader.style.display = 'block';

		supportContainer.style.display = 'grid';
		supportContainer.style.gridTemplateColumns = "0.5fr 0.5fr";
		supportContainer.style.gridTemplateRows = "40px 20px";
		supportContainer.appendChild(supportLink);

		// debug info button
		let debugInfoButton = contentEl.createEl('button');
		let bugIcon = getIcon('bug');
		if (bugIcon) debugInfoButton.appendChild(bugIcon);
		debugInfoButton.style.height = '100%';
		debugInfoButton.style.aspectRatio = '1/1';
		debugInfoButton.style.justifySelf = 'end';
		let debugHeader = contentEl.createDiv({ text: 'Copy debug info to clipboard', cls: "setting-item-description" });
		debugHeader.style.display = 'block';
		debugHeader.style.justifySelf = 'end';
		debugInfoButton.addEventListener('click', () => {
			navigator.clipboard.writeText(ExportLog.getDebugInfo());
			new Notice("Debug info copied to clipboard!");
		});
		supportContainer.appendChild(debugInfoButton);
		supportContainer.appendChild(supportHeader);
		supportContainer.appendChild(debugHeader);
		

		// #endregion

		//#region Page Features

		if (Settings.exportPreset != ExportPreset.RawDocuments)
		{
			SettingsPage.createDivider(contentEl);
			let section = SettingsPage.createSection(contentEl, 'Page Features', 'Control the visibility of different page features');

			SettingsPage.createToggle(section, 'Theme toggle', () => Settings.addThemeToggle, (value) => Settings.addThemeToggle = value);
			SettingsPage.createToggle(section, 'Document outline / table of contents', () => Settings.addOutline, (value) => Settings.addOutline = value);
			SettingsPage.createToggle(section, 'File navigation tree', () => Settings.addFileNav, (value) => Settings.addFileNav = value);
			SettingsPage.createToggle(section, 'File & folder icons', () => Settings.showDefaultTreeIcons, (value) => Settings.showDefaultTreeIcons = value);
			if (Settings.exportPreset == ExportPreset.Website)
			{
				SettingsPage.createToggle(section, 'Search bar', () => Settings.addSearchBar, (value) => Settings.addSearchBar = value);
				SettingsPage.createToggle(section, 'Graph view', () => Settings.addGraphView, (value) => Settings.addGraphView = value);
				let graphViewSection = SettingsPage.createSection(section, 'Graph View Settings', 'Control the behavior of the graph view simulation');

				new Setting(graphViewSection)
					.setName('Attraction Force')
					.setDesc("How much should linked nodes attract each other? This will make the graph appear more clustered.")
					.addSlider((slider) => slider
						.setLimits(0, 100, 1)
						.setValue(Settings.graphAttractionForce / (2 / 100))
						.setDynamicTooltip()
						.onChange(async (value) => {
							// remap to 0 - 2;
							let remapMultiplier = 2 / 100;
							Settings.graphAttractionForce = value * remapMultiplier;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);

				new Setting(graphViewSection)
					.setName('Link Length')
					.setDesc("How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.")
					.addSlider((slider) => slider
						.setLimits(0, 100, 1)
						.setValue(Settings.graphLinkLength)
						.setDynamicTooltip()
						.onChange(async (value) => {
							Settings.graphLinkLength = value;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);

				new Setting(graphViewSection)
					.setName('Repulsion Force')
					.setDesc("How much should nodes repel each other? This will make the graph appear more spread out.")
					.addSlider((slider) => slider
						.setLimits(0, 100, 1)
						.setValue(Settings.graphRepulsionForce / 3)
						.setDynamicTooltip()
						.onChange(async (value) => {
							Settings.graphRepulsionForce = value * 3;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);

				new Setting(graphViewSection)
					.setName('Central Force')
					.setDesc("How much should nodes be attracted to the center? This will make the graph appear more dense and circular.")
					.addSlider((slider) => slider
						.setLimits(0, 100, 1)
						.setValue(Settings.graphCentralForce / (5 / 100))
						.setDynamicTooltip()
						.onChange(async (value) => {
							// remap to 0 - 5;
							let remapMultiplier = 5 / 100;
							Settings.graphCentralForce = value * remapMultiplier;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);

				new Setting(graphViewSection)
					.setName('Max Node Radius')
					.setDesc("How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.")
					.addSlider((slider) => slider
						.setLimits(3, 15, 1)
						.setValue(Settings.graphMaxNodeSize)
						.setDynamicTooltip()
						.onChange(async (value) => {
							Settings.graphMaxNodeSize = value;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);

				new Setting(graphViewSection)
					.setName('Min Node Radius')
					.setDesc("How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.")
					.addSlider((slider) => slider
						.setLimits(3, 15, 1)
						.setValue(Settings.graphMinNodeSize)
						.setDynamicTooltip()
						.onChange(async (value) => {
							Settings.graphMinNodeSize = value;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);

				new Setting(graphViewSection)
					.setName('Edge Pruning Factor')
					.setDesc("Edges with a length above this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.")
					.addSlider((slider) => slider
						.setLimits(0, 100, 1)
						.setValue(100 - Settings.graphEdgePruning)
						.setDynamicTooltip()
						.onChange(async (value) => {
							Settings.graphEdgePruning = 100 - value;
							await SettingsPage.saveSettings();
						})
						.showTooltip()
					);
			
			}

			let iconTutorial = new Setting(section)
			.setName('Custom icons')
			.setDesc(
`Use the 'Iconize' plugin to add custom icons to your files and folders.
Or set the 'icon' property of your file to an emoji or lucide icon name.
This feature does not require "File & folder icons" to be enbaled.`);
			iconTutorial.infoEl.style.whiteSpace = "pre-wrap";

			new Setting(section)
				.setName('Icon emoji style')
				.addDropdown((dropdown) =>
				{
					for (let style in EmojiStyle) dropdown.addOption(style, style);
					dropdown.setValue(Settings.emojiStyle);
					dropdown.onChange(async (value) => {
						Settings.emojiStyle = value as EmojiStyle;
						await SettingsPage.saveSettings();
					});
				});

			SettingsPage.createText(section, 'Page title property', () => Settings.titleProperty, (value) => Settings.titleProperty = value,
						"Override a specific file's title / name by defining this property in the frontmatter.");

			SettingsPage.createFileInput(section, () => Settings.customHeadContentPath, (value) => Settings.customHeadContentPath = value,
			{
				name: 'Custom head content',
				description: 'Custom scripts, styles, or anything else (html file)',
				placeholder: 'Path to html formatted file...',
				defaultPath: Path.vaultPath,
				validation: (path) => path.validate(
					{
						allowEmpty: true,
						allowAbsolute: true,
						allowRelative: true,
						allowFiles: true,
						requireExists: true,
						requireExtentions: ["html", "htm", "txt"]
					}),
			});

			SettingsPage.createFileInput(section, () => Settings.faviconPath, (value) => Settings.faviconPath = value,
			{
				name: 'Favicon path',
				description: 'Add a custom favicon image to the website',
				placeholder: 'Path to image file...',
				defaultPath: Path.vaultPath,
				validation: (path) => path.validate(
					{
						allowEmpty: true,
						allowAbsolute: true,
						allowRelative: true,
						allowFiles: true,
						requireExists: true,
						requireExtentions: ["png", "ico", "jpg", "jpeg", "svg"]
					}),
			});

			
		}

		//#endregion

		//#region Page Behaviors

		let section;

		if (Settings.exportPreset != ExportPreset.RawDocuments)
		{
			
			SettingsPage.createDivider(contentEl);

			section = SettingsPage.createSection(contentEl, 'Page Behaviors', 'Change the behavior of included page features');
			
			new Setting(section)
				.setName('Min Outline Collapse Depth')
				.setDesc('Only allow outline items to be collapsed if they are at least this many levels deep in the tree.')
				.addDropdown((dropdown) => dropdown.addOption('1', '1').addOption('2', '2').addOption('100', 'No Collapse')
					.setValue(Settings.minOutlineCollapse.toString())
					.onChange(async (value) => {
						Settings.minOutlineCollapse = parseInt(value);
						await SettingsPage.saveSettings();
			}));
			
			SettingsPage.createToggle(section, 'Start Outline Collapsed', () => Settings.startOutlineCollapsed, (value) => Settings.startOutlineCollapsed = value,
							  'All outline items will be collapsed by default.');

			SettingsPage.createToggle(section, 'Allow folding headings', () => Settings.allowFoldingHeadings, (value) => Settings.allowFoldingHeadings = value,
							  'Fold headings using an arrow icon, like in Obsidian.');

			SettingsPage.createToggle(section, 'Allow folding lists', () => Settings.allowFoldingLists, (value) => Settings.allowFoldingLists = value,
							  'Fold lists using an arrow icon, like in Obsidian.');

			SettingsPage.createToggle(section, 'Allow resizing sidebars', () => Settings.allowResizingSidebars, (value) => Settings.allowResizingSidebars = value,
							  'Allow the user to resize the sidebar width.');
		}

		//#endregion

		//#region Layout Options

		SettingsPage.createDivider(contentEl);


		section = SettingsPage.createSection(contentEl, 'Layout Options', 'Set document and sidebar widths');

		new Setting(section)
			.setName('Document Width')
			.setDesc('Sets the line width of the exported document in css units. (ex. 600px, 50em)')
			.addText((text) => text
				.setValue(Settings.documentWidth)
				.setPlaceholder('40em')
				.onChange(async (value) => {
					Settings.documentWidth = value;
					await SettingsPage.saveSettings();
				}
				))
			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
				Settings.documentWidth = "";
				SettingsPage.saveSettings();
				this.display();
			}));

		new Setting(section)
			.setName('Sidebar Width')
			.setDesc('Sets the width of the sidebar in css units. (ex. 20em, 200px)')
			.addText((text) => text
				.setValue(Settings.sidebarWidth)
				.setPlaceholder('20em')
				.onChange(async (value) => {
					Settings.sidebarWidth = value;
					await SettingsPage.saveSettings();
				}
				))
			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
				Settings.sidebarWidth = "";
				SettingsPage.saveSettings();
				this.display();
			}));

		//#endregion

		//#region Export Options

		SettingsPage.createDivider(contentEl);


		section = SettingsPage.createSection(contentEl, 'Export Options', 'Change the behavior of the export process.');

		SettingsPage.createToggle(section, 'Only export modfied files', () => Settings.onlyExportModified, (value) => Settings.onlyExportModified = value,
						'Only generate new html for files which have been modified since the last export.');
		SettingsPage.createToggle(section, 'Delete old files', () => Settings.deleteOldFiles, (value) => Settings.deleteOldFiles = value,
						'Delete files from a previous export that are no longer being exported.');
		SettingsPage.createToggle(section, 'Minify HTML', () => Settings.minifyHTML, (value) => Settings.minifyHTML = value,
						'Minify HTML to make it load faster.');

		new Setting(section)
			.setName('Log Level')
			.setDesc('Set the level of logging to display in the export log.')
			.addDropdown((dropdown) => dropdown
				.addOption('all', 'All')
				.addOption('warning', 'Warning')
				.addOption('error', 'Error')
				.addOption('fatal', 'Only Fatal Errors')
				.setValue(Settings.logLevel)
				.onChange(async (value: "all" | "warning" | "error" | "fatal" | "none") =>
				{
					Settings.logLevel = value;
					await SettingsPage.saveSettings();
				}));

		//#endregion

		//#region Asset Settings

		SettingsPage.createDivider(contentEl);

		section = SettingsPage.createSection(contentEl, 'Asset Options', 'Add plugin styles, or make the page offline compatible.');

		SettingsPage.createToggle(section, 'Make Offline Compatible', () => Settings.makeOfflineCompatible, (value) => Settings.makeOfflineCompatible = value,
						'Download any online assets / images / scripts so the page can be viewed offline. Or so the website does not depend on a CDN.');
		SettingsPage.createToggle(section, 'Include Svelte CSS', () => Settings.includeSvelteCSS, (value) => Settings.includeSvelteCSS = value,
			'Include the CSS from any plugins that use the svelte framework. These can not be chosen individually because their styles are not associated with their respective plugins.');

		new Setting(section)
			.setName('Include CSS from Plugins')
			.setDesc('Include the CSS from the following plugins in the exported HTML. If plugin features aren\'t rendering correctly, try adding the plugin to this list. Avoid adding plugins unless you specifically notice a problem, because more CSS will increase the loading time of your page.')

		let pluginsList = new FlowList(section);
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

			let isChecked = Settings.includePluginCSS.match(new RegExp(`^${plugin}`, 'm')) != null;

			pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) => {
				Settings.includePluginCSS = pluginsList.checkedList.join('\n');
				SettingsPage.saveSettings();
			});
		});

		//#endregion

		//#region Advanced

		SettingsPage.createDivider(contentEl);
		section = SettingsPage.createSection(contentEl, 'Metadata', 'Control general site data and RSS feed creation');

		SettingsPage.createText(section, 'Public site URL', () => Settings.siteURL, (value) => Settings.siteURL = ((value.endsWith("/") || value == "") ? value : value + "/").trim(),
					'The url that this site will be hosted at. This is needed to reference links and images in metadata and RSS. (Because these links cannot be relative)', 
					(value) => (value.startsWith("http://") || value.startsWith("https://") || value.trim() == "") ? "" : "URL must start with 'http://' or 'https://'");	
		
		SettingsPage.createText(section, 'Author Name', () => Settings.authorName, (value) => Settings.authorName = value,
					'The default name of the author of the site');

		SettingsPage.createText(section, 'Vault Title', () => Settings.vaultTitle, (value) => Settings.vaultTitle = value,
					'The title of the vault');

		SettingsPage.createToggle(section, 'Create RSS feed', () => Settings.addRSSFeed, (value) => Settings.addRSSFeed = value,
					`Create an RSS feed for the website located at ${Settings.siteURL}lib/rss.xml`);

		let summaryTutorial = new Setting(section)
		.setName('Metadata Properties')
		.setDesc(
`Use the 'description' or 'summary' property to set a custom summary of a page.
Use the 'author' property to set the author of a specific page.`);
		summaryTutorial.infoEl.style.whiteSpace = "pre-wrap";

		
		//#endregion

		//#region Experimental
		

		// if (Settings.exportPreset == ExportPreset.Website)
		// {
		// 	let experimentalContainer = contentEl.createDiv();
		// 	let experimentalHR1 = experimentalContainer.createEl('hr');
		// 	let experimentalHeader = experimentalContainer.createEl('span', { text: 'Experimental' });
		// 	let experimentalHR2 = experimentalContainer.createEl('hr');

		// 	experimentalContainer.style.display = 'flex';
		// 	experimentalContainer.style.marginTop = '5em';
		// 	experimentalContainer.style.alignItems = 'center';

		// 	experimentalHR1.style.borderColor = "var(--color-red)";
		// 	experimentalHR2.style.borderColor = "var(--color-red)";
		// 	experimentalHeader.style.color = "var(--color-red)";

		// 	experimentalHR1.style.flexGrow = "1";
		// 	experimentalHR2.style.flexGrow = "1";
		// 	experimentalHeader.style.flexGrow = "0.1";
		// 	experimentalHeader.style.textAlign = "center";

		// 	let experimentalHREnd = contentEl.createEl('hr');
		// 	experimentalHREnd.style.borderColor = "var(--color-red)";
		// }

		//#endregion

	}

	// #region Class Functions and Variables

	static settings: Settings = DEFAULT_SETTINGS;
	static plugin: Plugin;
	static loaded = false;


	private blacklistedPluginIDs: string[] = [];
	public async getBlacklistedPluginIDs(): Promise<string[]> 
	{
		if (this.blacklistedPluginIDs.length > 0) return this.blacklistedPluginIDs;
		this.blacklistedPluginIDs = pluginStylesBlacklist.replaceAll("\r", "").split("\n");

		return this.blacklistedPluginIDs;
	}

	constructor(plugin: Plugin) {
		super(app, plugin);
		SettingsPage.plugin = plugin;
	}

	static async loadSettings() 
	{
		let loadedSettings = await SettingsPage.plugin.loadData();
		Object.assign(Settings, DEFAULT_SETTINGS, loadedSettings);
		await migrateSettings();
		SettingsPage.loaded = true;
	}

	static async saveSettings() {
		await SettingsPage.plugin.saveData(Object.assign({}, Settings));
	}

	static renameFile(file: TFile, oldPath: string)
	{
		let oldPathParsed = new Path(oldPath).asString;
		Settings.filesToExport.forEach((fileList) =>
		{
			let index = fileList.indexOf(oldPathParsed);
			if (index >= 0)
			{
				fileList[index] = file.path;
			}
		});

		SettingsPage.saveSettings();
	}

	static async updateSettings(usePreviousSettings: boolean = false, overrideFiles: TFile[] | undefined = undefined): Promise<ExportInfo | undefined>
	{
		if (!usePreviousSettings) 
		{
			let modal = new ExportModal();
			if(overrideFiles) modal.overridePickedFiles(overrideFiles);
			return await modal.open();
		}
		
		let files = Settings.filesToExport[0];
		let path = new Path(Settings.exportPath);
		if ((files.length == 0 && overrideFiles == undefined) || !path.exists || !path.isAbsolute || !path.isDirectory)
		{
			new Notice("Please set the export path and files to export in the settings first.", 5000);
			let modal = new ExportModal();
			if(overrideFiles) modal.overridePickedFiles(overrideFiles);
			return await modal.open();
		}

		return undefined;
	}

	static getFilesToExport(): TFile[]
	{
		let files: TFile[] = [];

		let allFiles = app.vault.getFiles();
		let exportPaths = Settings.filesToExport[0];
		if (!exportPaths) return [];

		for (let path of exportPaths)
		{
			let file = app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) files.push(file);
			else if (file instanceof TFolder)
			{
				let newFiles = allFiles.filter((f) => f.path.startsWith(file?.path ?? "*"));
				files.push(...newFiles);
			}
		};

		return files;
	}

	public static createDivider(container: HTMLElement)
	{
		let hr = container.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--interactive-accent)";
		hr.style.opacity = "0.5";
	}

	public static createToggle(container: HTMLElement, name: string, get: () => boolean, set: (value: boolean) => void, desc: string = ""): Setting
	{
		let setting = new Setting(container);
		setting.setName(name)
		if (desc != "") setting.setDesc(desc);
		setting.addToggle((toggle) => toggle
			// @ts-ignore
			.setValue(get())
			.onChange(async (value) => {
				// @ts-ignore
				set(value);
				await SettingsPage.saveSettings();
			}));
		return setting;
	}

	public static createText(container: HTMLElement, name: string, get: () => string, set: (value: string) => void, desc: string = "", validation?: (value: string) => string): Setting
	{
		let setting = new Setting(container);
		let errorText = this.createError(container);

		let value = get();
		if (value != "") errorText.setText(validation ? validation(value) : "");
		
		setting.setName(name)
		if (desc != "") setting.setDesc(desc);
		setting.addText((text) => text
			.setValue(value)
			.onChange(async (value) => 
			{
				let error = validation ? validation(value) : "";
				if (error == "")
				{
					set(value);
					await SettingsPage.saveSettings();
				}

				errorText.setText(error);
			}));

		return setting;
	}

	public static createError(container: HTMLElement): HTMLElement
	{
		let error = container.createDiv({ cls: 'setting-item-description' });
		error.style.color = "var(--color-red)";
		error.style.marginBottom = "0.75rem";
		return error;
	}

	public static createFileInput(container: HTMLElement, get: () => string, set: (value: string) => void, options?: {name?: string, description?: string, placeholder?: string, defaultPath?: Path, pickFolder?: boolean, validation?: (path: Path) => {valid: boolean, isEmpty: boolean, error: string}, browseButton?: boolean, onChanged?: (path: Path)=>void}): {fileInput: Setting, textInput: TextComponent, browseButton: HTMLElement | undefined}
	{
		let name = options?.name ?? "";
		let description = options?.description ?? "";
		let placeholder = options?.placeholder ?? "Path to file...";
		let defaultPath = options?.defaultPath ?? Path.vaultPath;
		let pickFolder = options?.pickFolder ?? false;
		let validation = options?.validation ?? ((path) => ({valid: true, isEmpty: false, error: ""}));
		let browseButton = options?.browseButton ?? true;
		let onChanged = options?.onChanged;

		let headContentErrorMessage = this.createError(container);
		if (get().trim() != "")
		{
			let tempPath = new Path(get());
			headContentErrorMessage.setText(validation(tempPath).error);
		}

		let headContentInput : TextComponent | undefined = undefined;

		let fileInput = new Setting(container);
		if(name != "") fileInput.setName(name);
		if (description != "") fileInput.setDesc(description);
		if (name == "" && description == "") fileInput.infoEl.style.display = "none";

		let textEl: TextComponent;
		fileInput.addText((text) => 
		{
			textEl = text;
			headContentInput = text;
			text.inputEl.style.width = '100%';
			text.setPlaceholder(placeholder)
				.setValue(get())
				.onChange(async (value) => 
				{
					let path = new Path(value);
					let valid = validation(path);
					headContentErrorMessage.setText(valid.error);
					if (valid.valid) 
					{
						headContentErrorMessage.setText("");
						set(value.replaceAll("\"", ""));
						text.setValue(get());
						await SettingsPage.saveSettings();
					}

					if (onChanged) onChanged(path);
				});
		});

		let browseButtonEl = undefined;
		if(browseButton)
		{
			fileInput.addButton((button) =>
			{
				browseButtonEl = button.buttonEl;
				button.setButtonText('Browse').onClick(async () => 
				{
					let path = pickFolder ? await Utils.showSelectFolderDialog(defaultPath) : await Utils.showSelectFileDialog(defaultPath);
					if (!path) return;
					
					set(path.asString);
					let valid = validation(path);
					headContentErrorMessage.setText(valid.error);
					if (valid.valid)
					{
						await SettingsPage.saveSettings();
					}

					if (onChanged) onChanged(path);

					headContentInput?.setValue(get());
				});
			});
		}

		container.appendChild(headContentErrorMessage);

		return {fileInput: fileInput, textInput: textEl!, browseButton: browseButtonEl};
	}

	public static createSection(container: HTMLElement, name: string, desc: string): HTMLElement
	{
		let section = container.createEl('details');
		let summary = section.createEl('summary');
		summary.style.display = "block";
		summary.style.marginLeft = "-1em";
		section.style.paddingLeft = "2em";
		section.style.borderLeft = "1px solid var(--interactive-accent)";

		new Setting(summary)
			.setName(name)
			.setDesc(desc)
			.setHeading()

		return section;
	}

	// #endregion
}
