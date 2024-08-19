import { Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, getIcon } from 'obsidian';
import { Path } from 'plugin/utils/path';
import pluginStylesBlacklist from 'assets/third-party-styles-blacklist.txt';
import { ExportLog } from 'plugin/render-api/render-api';
import { createDivider, createFeatureSetting, createSection, createToggle }  from './settings-components';
import { ExportPipelineOptions } from "plugin/website/pipeline-options.js";
import { FlowList } from 'plugin/features/flow-list';

// #region Settings Definition

export enum ExportPreset
{
	Online = "online",
	Local = "local",
	RawDocuments = "raw-documents",
}

export enum LogLevel
{
	All = "all",
	Warning = "warning",
	Error = "error",
	Fatal = "fatal",
	None = "none",
}

export class Settings
{
	public static settingsVersion: string = "0.0.0";

	public static exportOptions: ExportPipelineOptions = new ExportPipelineOptions();

	public static logLevel: LogLevel = LogLevel.Warning;
	public static titleProperty: string = "title";
	public static onlyExportModified: boolean = true;
	public static deleteOldFiles: boolean = true;
	public static exportPreset: ExportPreset = ExportPreset.Online;
	public static openAfterExport: boolean = true;

	// Graph View Settings
	public static filePickerBlacklist: string[] = ["(^|\\/)node_modules\\/","(^|\\/)dist\\/","(^|\\/)dist-ssr\\/","(^|\\/)\\.vscode\\/"]; // ignore node_modules, dist, and .vscode
	public static filePickerWhitelist: string[] = ["\\.\\w+$"]; // only include files with extensions

	public static async onlinePreset()
	{
		Settings.exportOptions.inlineCSS = false;
		Settings.exportOptions.inlineFonts = false;
		Settings.exportOptions.inlineHTML = false;
		Settings.exportOptions.inlineJS = false;
		Settings.exportOptions.inlineMedia = false;
		Settings.exportOptions.inlineOther = false;

		Settings.exportOptions.slugifyPaths = true;
		Settings.exportOptions.graphViewOptions.enabled = true;
		Settings.exportOptions.fileNavigationOptions.enabled = true;
		Settings.exportOptions.searchOptions.enabled = true;
		Settings.exportOptions.addRSS = true;
		Settings.exportOptions.combineAsSingleFile = false;

		await SettingsPage.saveSettings();
	}

	public static async localPreset()
	{
		Settings.exportOptions.inlineCSS = true;
		Settings.exportOptions.inlineFonts = true;
		Settings.exportOptions.inlineHTML = true;
		Settings.exportOptions.inlineJS = true;
		Settings.exportOptions.inlineMedia = true;
		Settings.exportOptions.inlineOther = true;
		Settings.exportOptions.slugifyPaths = false;
		Settings.exportOptions.graphViewOptions.enabled = false;
		Settings.exportOptions.fileNavigationOptions.enabled = false;
		Settings.exportOptions.searchOptions.enabled = false;
		Settings.exportOptions.addRSS = false;
		Settings.exportOptions.combineAsSingleFile = true;

		await SettingsPage.saveSettings();
	}

	public static async rawDocumentsPreset()
	{
		Settings.exportOptions.inlineCSS = true;
		Settings.exportOptions.inlineFonts = true;
		Settings.exportOptions.inlineHTML = true;
		Settings.exportOptions.inlineJS = true;
		Settings.exportOptions.inlineMedia = true;
		Settings.exportOptions.inlineOther = true;
		Settings.exportOptions.slugifyPaths = false;
		Settings.exportOptions.graphViewOptions.enabled = false;
		Settings.exportOptions.fileNavigationOptions.enabled = false;
		Settings.exportOptions.searchOptions.enabled = false;
		Settings.exportOptions.addRSS = false;
		Settings.exportOptions.combineAsSingleFile = false;

		await SettingsPage.saveSettings();
	}

	static getAllFilesFromPaths(paths: string[]): string[]
	{
		const files: string[] = [];

		const allFilePaths = app.vault.getFiles().map(f => f.path);
		if (!paths || paths.length == 0) return allFilePaths;

		for (const path of paths)
		{
			const file = app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) files.push(file.path);
			else if (file instanceof TFolder)
			{
				const newFiles = allFilePaths.filter((f) => f.startsWith(file?.path ?? "*"));
				files.push(...newFiles);
			}
		};

		return files;
	}

	static getFilesToExport(): TFile[]
	{
		return this.getAllFilesFromPaths(Settings.exportOptions.filesToExport).map(p => app.vault.getFileByPath(p)).filter(f => f) as TFile[];
	}

	
}

// #endregion

export class SettingsPage extends PluginSettingTab
{

	display() 
	{
		const { containerEl: container } = this;

		// #region Settings Header

		container.empty();

		const header = container.createEl('h2', { text: 'HTML Export Settings' });
		header.style.display = 'block';
		header.style.marginBottom = '15px';

		const supportContainer = container.createDiv();
		supportContainer.style.marginBottom = '15px';
		const supportLink = container.createEl('a');
		const buttonColor = "3ebba4";
		const buttonTextColor = "ffffff";
		// @ts-ignore
		supportLink.href = `href="https://www.buymeacoffee.com/nathangeorge"`;
		supportLink.style.height = "40px"
		supportLink.innerHTML = `<img style="height:40px;" src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=nathangeorge&button_colour=${buttonColor}&font_colour=${buttonTextColor}&font_family=Poppins&outline_colour=${buttonTextColor}&coffee_colour=FFDD00">`;
		const supportHeader = container.createDiv({ text: 'Support the continued development of this plugin.', cls: "setting-item-description" });
		supportHeader.style.display = 'block';

		supportContainer.style.display = 'grid';
		supportContainer.style.gridTemplateColumns = "0.5fr 0.5fr";
		supportContainer.style.gridTemplateRows = "40px 20px";
		supportContainer.appendChild(supportLink); 

		// debug info button
		const debugInfoButton = container.createEl('button');
		const bugIcon = getIcon('bug');
		if (bugIcon) debugInfoButton.appendChild(bugIcon);
		debugInfoButton.style.height = '100%';
		debugInfoButton.style.aspectRatio = '1/1';
		debugInfoButton.style.justifySelf = 'end';
		const debugHeader = container.createDiv({ text: 'Copy debug info to clipboard', cls: "setting-item-description" });
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

		createDivider(container);

		let section = createSection(container, 'Page Features', 'Control various features of the exported page.');

		createFeatureSetting(section, "Sidebars", Settings.exportOptions.sidebarOptions, 
		"Holds all the other features like the file nav, outline, theme toggle, graph view, etc...");
		
		createFeatureSetting(section, "File Navigation", Settings.exportOptions.fileNavigationOptions, 
		"Shows a file tree used to explore the exported vault.");

		createFeatureSetting(section, "Outline", Settings.exportOptions.outlineOptions, 
		"Shows a list of the open document's headers.");

		createFeatureSetting(section, "Graph View", Settings.exportOptions.graphViewOptions, 
		"Shows a visual, interactive representation of your vault. (NOTE: this is only available for exports hosted on a web server)");

		createFeatureSetting(section, "Search Bar", Settings.exportOptions.searchOptions, 
		"Allows you search the vault, listing matching files and headers. (NOTE: this is only available for exports hosted on a web server)");

		createFeatureSetting(section, "Theme Toggle", Settings.exportOptions.themeToggleOptions, 
		"Allows you to switch between dark and light theme dynamically.");

		createFeatureSetting(section, "Custom Head Content", Settings.exportOptions.customHeadOptions,
		"Insert a given .html file onto the page which can include custom JS or CSS");

		createFeatureSetting(section, "Backlinks", Settings.exportOptions.backlinkOptions,
		"Displays all the documents which link to the currently opened document.");

		createFeatureSetting(section, "Tags", Settings.exportOptions.tagOptions,
		"Displays the tags for the currently opened document.");

		createFeatureSetting(section, "Aliases", Settings.exportOptions.aliasOptions,
		"Displays the aliases for the currently opened document.");

		createFeatureSetting(section, "Properties", Settings.exportOptions.propertiesOptions,
		"Displays all the properties of the currently opened document as a table.");
		
		// #endregion


		//#region Asset Settings

		createDivider(container);

		section = createSection(container, 'Asset Options', 'Add plugin styles, or make the page offline compatible.');

		createToggle(section, 'Make Offline Compatible', () => Settings.exportOptions.offlineResources, (value) => Settings.exportOptions.offlineResources = value,
						'Download any online assets / images / scripts so the page can be viewed offline. Or so the website does not depend on a CDN.');
		createToggle(section, 'Include Svelte CSS', () => Settings.exportOptions.includeSvelteCSS, (value) => Settings.exportOptions.includeSvelteCSS = value,
			'Include the CSS from any plugins that use the svelte framework. These can not be chosen individually because their styles are not associated with their respective plugins.');

		new Setting(section)
			.setName('Include CSS from Plugins')
			.setDesc('Include the CSS from the following plugins in the exported HTML. If plugin features aren\'t rendering correctly, try adding the plugin to this list. Avoid adding plugins unless you specifically notice a problem, because more CSS will increase the loading time of your page.')

		const pluginsList = new FlowList();
		pluginsList.generate(section);
		this.getPluginIDs().forEach(async (plugin) => 
		{
			//@ts-ignore
			const pluginManifest = app.plugins.manifests[plugin];
			if (!pluginManifest) return;

			if ((await this.getBlacklistedPluginIDs()).contains(pluginManifest.id)) {
				return;
			}

			const pluginDir = pluginManifest.dir;
			if (!pluginDir) return;
			const pluginPath = new Path(pluginDir);

			const hasCSS = pluginPath.joinString('styles.css').exists;
			if (!hasCSS) return;

			const isChecked = Settings.exportOptions.includePluginCSS.contains(plugin);

			pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) => {
				Settings.exportOptions.includePluginCSS = pluginsList.checkedList;
				SettingsPage.saveSettings();
			});
		});

		//#endregion


// 		if (Settings.exportPreset != ExportPreset.RawDocuments)
// 		{
// 			createDivider(contentEl);
// 			const section = createSection(contentEl, 'Page Features', 'Control the visibility of different page features');

// 			createToggle(section, 'Theme toggle', () => Settings.exportOptions.themeToggleOptions.enabled, (value) => Settings.exportOptions.themeToggleOptions.enabled = value);
// 			createToggle(section, 'Document outline / table of contents', () => Settings.exportOptions.outlineOptions.enabled, (value) => Settings.exportOptions.outlineOptions.enabled = value);
// 			createToggle(section, 'File navigation tree', () => Settings.exportOptions.fileNavigationOptions.enabled, (value) => Settings.exportOptions.fileNavigationOptions.enabled = value);
// 			createToggle(section, 'File icons', () => Settings.exportOptions.fileNavigationOptions.showDefaultFileIcons, (value) => Settings.exportOptions.fileNavigationOptions.showDefaultFileIcons = value);
// 			createToggle(section, 'Folder icons', () => Settings.exportOptions.fileNavigationOptions.showDefaultFolderIcons, (value) => Settings.exportOptions.fileNavigationOptions.showDefaultFolderIcons = value);
			
// 			if (Settings.exportPreset == ExportPreset.Online)
// 			{
// 				createToggle(section, 'Search bar', () => Settings.exportOptions.addSearch, (value) => Settings.exportOptions.addSearch = value);
// 				createToggle(section, 'Graph view', () => Settings.exportOptions.addGraphView, (value) => Settings.exportOptions.addGraphView = value);
// 				const graphViewSection = createSection(section, 'Graph View Settings', 'Control the behavior of the graph view simulation');

// 				new Setting(graphViewSection)
// 					.setName('Attraction Force')
// 					.setDesc("How much should linked nodes attract each other? This will make the graph appear more clustered.")
// 					.addSlider((slider) => slider
// 						.setLimits(0, 100, 1)
// 						.setValue(Settings.exportOptions.graphViewOptions.attractionForce / (2 / 100))
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							// remap to 0 - 2;
// 							const remapMultiplier = 2 / 100;
// 							Settings.exportOptions.graphViewOptions.attractionForce = value * remapMultiplier;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);

// 				new Setting(graphViewSection)
// 					.setName('Link Length')
// 					.setDesc("How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.")
// 					.addSlider((slider) => slider
// 						.setLimits(0, 100, 1)
// 						.setValue(Settings.exportOptions.graphViewOptions.linkLength)
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							Settings.exportOptions.graphViewOptions.linkLength = value;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);

// 				new Setting(graphViewSection)
// 					.setName('Repulsion Force')
// 					.setDesc("How much should nodes repel each other? This will make the graph appear more spread out.")
// 					.addSlider((slider) => slider
// 						.setLimits(0, 100, 1)
// 						.setValue(Settings.exportOptions.graphViewOptions.repulsionForce / 3)
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							Settings.exportOptions.graphViewOptions.repulsionForce = value * 3;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);

// 				new Setting(graphViewSection)
// 					.setName('Central Force')
// 					.setDesc("How much should nodes be attracted to the center? This will make the graph appear more dense and circular.")
// 					.addSlider((slider) => slider
// 						.setLimits(0, 100, 1)
// 						.setValue(Settings.exportOptions.graphViewOptions.centralForce / (5 / 100))
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							// remap to 0 - 5;
// 							const remapMultiplier = 5 / 100;
// 							Settings.exportOptions.graphViewOptions.centralForce = value * remapMultiplier;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);

// 				new Setting(graphViewSection)
// 					.setName('Max Node Radius')
// 					.setDesc("How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.")
// 					.addSlider((slider) => slider
// 						.setLimits(3, 15, 1)
// 						.setValue(Settings.exportOptions.graphViewOptions.maxNodeRadius)
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							Settings.exportOptions.graphViewOptions.maxNodeRadius = value;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);

// 				new Setting(graphViewSection)
// 					.setName('Min Node Radius')
// 					.setDesc("How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.")
// 					.addSlider((slider) => slider
// 						.setLimits(3, 15, 1)
// 						.setValue(Settings.exportOptions.graphViewOptions.minNodeRadius)
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							Settings.exportOptions.graphViewOptions.minNodeRadius = value;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);

// 				new Setting(graphViewSection)
// 					.setName('Edge Pruning Factor')
// 					.setDesc("Edges with a length above this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.")
// 					.addSlider((slider) => slider
// 						.setLimits(0, 100, 1)
// 						.setValue(100 - Settings.exportOptions.graphViewOptions.edgePruning)
// 						.setDynamicTooltip()
// 						.onChange(async (value) => {
// 							Settings.exportOptions.graphViewOptions.edgePruning = 100 - value;
// 							await SettingsPage.saveSettings();
// 						})
// 						.showTooltip()
// 					);
			
// 			}

// 			const iconTutorial = new Setting(section)
// 			.setName('Custom icons')
// 			.setDesc(
// `Use the 'Iconize' plugin to add custom icons to your files and folders.
// Or set the 'icon' property of your file to an emoji or lucide icon name.
// This feature does not require "File & folder icons" to be enbaled.`);
// 			iconTutorial.infoEl.style.whiteSpace = "pre-wrap";

// 			new Setting(section)
// 				.setName('Icon emoji style')
// 				.addDropdown((dropdown) =>
// 				{
// 					for (const style in EmojiStyle) dropdown.addOption(style, style);
// 					dropdown.setValue(Settings.exportOptions.emojiStyle);
// 					dropdown.onChange(async (value) => {
// 						Settings.exportOptions.emojiStyle = value as EmojiStyle;
// 						await SettingsPage.saveSettings();
// 					});
// 				});

// 			createFileInput(section, () => Settings.exportOptions.customHeadContentPath, (value) => Settings.exportOptions.customHeadContentPath = value,
// 			{
// 				name: 'Custom head content',
// 				description: 'Custom scripts, styles, or anything else (html file).',
// 				placeholder: 'Relative or absolute path to a file...',
// 				defaultPath: Path.vaultPath,
// 				validation: (path) => path.validate(
// 					{
// 						allowEmpty: true,
// 						allowAbsolute: true,
// 						allowRelative: true,
// 						allowFiles: true,
// 						requireExists: true,
// 						requireExtentions: ["html", "htm", "txt"]
// 					}),
// 			});

// 			createFileInput(section, () => Settings.exportOptions.faviconPath, (value) => Settings.exportOptions.faviconPath = value,
// 			{
// 				name: 'Favicon path',
// 				description: 'Add a custom favicon image to the website.',
// 				placeholder: 'Relative or absolute path to an image...',
// 				defaultPath: Path.vaultPath,
// 				validation: (path) => path.validate(
// 					{
// 						allowEmpty: true,
// 						allowAbsolute: true,
// 						allowRelative: true,
// 						allowFiles: true,
// 						requireExists: true,
// 						requireExtentions: ["png", "ico", "jpg", "jpeg", "svg"]
// 					}),
// 			});

			
// 		}

// 		//#endregion

// 		//#region Page Behaviors

// 		let section;

// 		if (Settings.exportOptions.exportPreset != ExportPreset.RawDocuments)
// 		{
			
// 			createDivider(contentEl);

// 			section = createSection(contentEl, 'Page Behaviors', 'Change the behavior of included page features');
			
// 			new Setting(section)
// 				.setName('Min Outline Collapse Depth')
// 				.setDesc('Only allow outline items to be collapsed if they are at least this many levels deep in the tree.')
// 				.addDropdown((dropdown) => dropdown.addOption('1', '1').addOption('2', '2').addOption('100', 'No Collapse')
// 					.setValue(Settings.exportOptions.minOutlineCollapse.toString())
// 					.onChange(async (value) => {
// 						Settings.exportOptions.minOutlineCollapse = parseInt(value);
// 						await SettingsPage.saveSettings();
// 			}));
			
// 			createToggle(section, 'Start Outline Collapsed', () => Settings.exportOptions.startOutlineCollapsed, (value) => Settings.exportOptions.startOutlineCollapsed = value,
// 							  'All outline items will be collapsed by default.');

// 			createToggle(section, 'Relative Outline Links', () => Settings.exportOptions.relativeOutlineLinks, (value) => Settings.exportOptions.relativeOutlineLinks = value,
// 							  '(NOT RECCOMENDED!) Make links in the outline relative to the current page. This will break the ability to copy the header links from the outline, but allows you to move the file and still have the links work.');

// 			createToggle(section, 'Allow folding headings', () => Settings.exportOptions.allowFoldingHeadings, (value) => Settings.exportOptions.allowFoldingHeadings = value,
// 							  'Fold headings using an arrow icon, like in Obsidian.');

// 			createToggle(section, 'Allow folding lists', () => Settings.exportOptions.allowFoldingLists, (value) => Settings.exportOptions.allowFoldingLists = value,
// 							  'Fold lists using an arrow icon, like in Obsidian.');

// 			createToggle(section, 'Allow resizing sidebars', () => Settings.exportOptions.allowResizingSidebars, (value) => Settings.exportOptions.allowResizingSidebars = value,
// 							  'Allow the user to resize the sidebar width.');
// 		}

// 		//#endregion

// 		//#region Layout Options

// 		createDivider(contentEl);
		

// 		section = createSection(contentEl, 'Layout Options', 'Set document and sidebar widths');

// 		new Setting(section)
// 			.setName('Document Width')
// 			.setDesc('Sets the line width of the exported document in css units. (ex. 600px, 50em)')
// 			.addText((text) => text
// 				.setValue(Settings.exportOptions.obsidian-documentWidth)
// 				.setPlaceholder('40em')
// 				.onChange(async (value) => {
// 					Settings.exportOptions.obsidian-documentWidth = value;
// 					await SettingsPage.saveSettings();
// 				}
// 				))
// 			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
// 				Settings.exportOptions.obsidian-documentWidth = "";
// 				SettingsPage.saveSettings();
// 				this.display();
// 			}));

// 		new Setting(section)
// 			.setName('Sidebar Width')
// 			.setDesc('Sets the width of the sidebar in css units. (ex. 20em, 200px)')
// 			.addText((text) => text
// 				.setValue(Settings.exportOptions.sidebarWidth)
// 				.setPlaceholder('20em')
// 				.onChange(async (value) => {
// 					Settings.exportOptions.sidebarWidth = value;
// 					await SettingsPage.saveSettings();
// 				}
// 				))
// 			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() => {
// 				Settings.exportOptions.sidebarWidth = "";
// 				SettingsPage.saveSettings();
// 				this.display();
// 			}));

// 		//#endregion

// 		//#region Export Options

// 		createDivider(contentEl);


// 		section = createSection(contentEl, 'Export Options', 'Change the behavior of the export process.');

// 		createToggle(section, 'Only export modfied files', () => Settings.exportOptions.onlyExportModified, (value) => Settings.exportOptions.onlyExportModified = value,
// 						'Only generate new html for files which have been modified since the last export.');
// 		createToggle(section, 'Delete old files', () => Settings.exportOptions.deleteOldFiles, (value) => Settings.exportOptions.deleteOldFiles = value,
// 						'Delete files from a previous export that are no longer being exported.');
// 		createToggle(section, 'Minify HTML', () => Settings.exportOptions.minifyHTML, (value) => Settings.exportOptions.minifyHTML = value,
// 						'Minify HTML to make it load faster.');

// 		new Setting(section)
// 			.setName('Log Level')
// 			.setDesc('Set the level of logging to display in the export log.')
// 			.addDropdown((dropdown) => dropdown
// 				.addOption('all', 'All')
// 				.addOption('warning', 'Warning')
// 				.addOption('error', 'Error')
// 				.addOption('fatal', 'Only Fatal Errors')
// 				.setValue(Settings.exportOptions.logLevel)
// 				.onChange(async (value: "all" | "warning" | "error" | "fatal" | "none") =>
// 				{
// 					Settings.exportOptions.logLevel = value;
// 					await SettingsPage.saveSettings();
// 				}));

// 		//#endregion



// 		//#region Advanced

// 		createDivider(contentEl);
// 		section = createSection(contentEl, 'Metadata', 'Control general site data and RSS feed creation');

// 		createText(section, 'Public site URL', () => Settings.exportOptions.siteURL, (value) => Settings.exportOptions.siteURL = ((value.endsWith("/") || value == "") ? value : value + "/").trim(),
// 					'The url that this site will be hosted at. This is needed to reference links and images in metadata and RSS. (Because these links cannot be relative)', 
// 					(value) => (value.startsWith("http://") || value.startsWith("https://") || value.trim() == "") ? "" : "URL must start with 'http://' or 'https://'");	
		
// 		createText(section, 'Author Name', () => Settings.exportOptions.authorName, (value) => Settings.exportOptions.authorName = value,
// 					'The default name of the author of the site');

// 		createText(section, 'Vault Title', () => Settings.exportOptions.vaultTitle, (value) => Settings.exportOptions.vaultTitle = value,
// 					'The title of the vault');

// 		createToggle(section, 'Create RSS feed', () => Settings.exportOptions.addRSSFeed, (value) => Settings.exportOptions.addRSSFeed = value,
// 					`Create an RSS feed for the website located at ${Settings.exportOptions.siteURL}lib/rss.xml`);

// 		const summaryTutorial = new Setting(section)
// 		.setName('Metadata Properties')
// 		.setDesc(
// `Use the 'description' or 'summary' property to set a custom summary of a page.
// Use the 'author' property to set the author of a specific page.`);
// 		summaryTutorial.infoEl.style.whiteSpace = "pre-wrap";

// 		createText(section, 'Page title property', () => Settings.exportOptions.titleProperty, (value) => Settings.exportOptions.titleProperty = value,
// 						"Override a specific file's title / name by defining this property in the frontmatter.");

		
// 		//#endregion

	}

	// #region Class Functions and Variables
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

	getPluginIDs(): string[]
	{
		/*@ts-ignore*/
		const pluginsArray: string[] = Array.from(app.plugins.enabledPlugins.values()) as string[];
		for (let i = 0; i < pluginsArray.length; i++)
		{
			/*@ts-ignore*/
			if (app.plugins.manifests[pluginsArray[i]] == undefined)
			{
				pluginsArray.splice(i, 1);
				i--;
			}
		}

		return pluginsArray;
	}

	static deepAssign(truth: any, source: any)
	{
		if (!source) return;
		let objects = Object.values(truth);
		let keys = Object.keys(truth);
		for (let i = 0; i < objects.length; i++)
		{
			let key = keys[i];
			let type = typeof objects[i];
			if (type == "object" && source[key] != undefined)
			{
				if (Array.isArray(objects[i]))
				{
					truth[key] = source[key];
				}
				else
				{
					SettingsPage.deepAssign(objects[i], source[key]);
				}
			}
			else if (source[key] != undefined)
			{
				truth[key] = source[key];
			}
		}

		return truth;
	}

	static deepCopy(truth: any): any
	{
		return JSON.parse(JSON.stringify(truth));
	}

	static deepRemoveStartingWith(truth: any, prefix: string): any
	{
		const keys = Object.keys(truth);
		for (let i = 0; i < keys.length; i++)
		{
			if (keys[i].startsWith(prefix))
			{
				delete truth[keys[i]];
			}

			let type = typeof truth[keys[i]];
			if (type == "object")
			{
				SettingsPage.deepRemoveStartingWith(truth[keys[i]], prefix);
			}
		}
		return truth;
	}

	static async loadSettings() 
	{
		const loadedSettings = await SettingsPage.plugin.loadData();
		console.log(loadedSettings);
		// do a deep object assign so any non exisant values anywhere in the default settings are preserved
		SettingsPage.deepAssign(Settings, loadedSettings);
		SettingsPage.saveSettings();
		SettingsPage.loaded = true;
	}

	static async saveSettings() 
	{
		let copy = SettingsPage.deepCopy({...Settings});
		copy = SettingsPage.deepRemoveStartingWith(copy, "info_");
		await SettingsPage.plugin.saveData(copy);
	}

	static renameFile(file: TFile, oldPath: string)
	{
		const oldPathParsed = new Path(oldPath).path;
		let fileList = Settings.exportOptions.filesToExport;
		const index = fileList.indexOf(oldPathParsed);
		if (index >= 0)
		{
			fileList[index] = file.path;
		}

		SettingsPage.saveSettings();
	}

	// #endregion
}
