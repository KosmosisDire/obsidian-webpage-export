import { Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, getIcon } from 'obsidian';
import { Path } from 'src/plugin/utils/path';
import pluginStylesBlacklist from 'src/assets/third-party-styles-blacklist.txt';
import { ExportLog } from 'src/plugin/render-api/render-api';
import { createDivider, createFeatureSetting, createSection, createToggle }  from './settings-components';
import { ExportPipelineOptions } from "src/plugin/website/pipeline-options.js";
import { FlowList } from 'src/plugin/features/flow-list';
import { i18n } from '../translations/language';

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
		Settings.exportOptions.inlineHTML = false;
		Settings.exportOptions.inlineJS = true;
		Settings.exportOptions.inlineMedia = true;
		Settings.exportOptions.inlineOther = true;
		Settings.exportOptions.slugifyPaths = true;
		Settings.exportOptions.graphViewOptions.enabled = true;
		Settings.exportOptions.fileNavigationOptions.enabled = true;
		Settings.exportOptions.searchOptions.enabled = true;
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

		const lang = i18n.settings;

		// #region Settings Header

		container.empty();

		const header = container.createEl('h2', { text: lang.title });
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
		const supportHeader = container.createDiv({ text: lang.support, cls: "setting-item-description" });
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
		const debugHeader = container.createDiv({ text: lang.debug, cls: "setting-item-description" });
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
		
		let section = createSection(container, lang.pageFeatures.title, lang.pageFeatures.description);
		
		createFeatureSetting(section, lang.document.title, 			Settings.exportOptions.documentOptions,			lang.document.description);
		createFeatureSetting(section, lang.sidebars.title, 			Settings.exportOptions.sidebarOptions,			lang.sidebars.description);
		createFeatureSetting(section, lang.fileNavigation.title,	Settings.exportOptions.fileNavigationOptions,	lang.fileNavigation.description);
		createFeatureSetting(section, lang.outline.title,			Settings.exportOptions.outlineOptions,			lang.outline.description);
		createFeatureSetting(section, lang.graphView.title, 		Settings.exportOptions.graphViewOptions,		lang.graphView.description);
		createFeatureSetting(section, lang.search.title,			Settings.exportOptions.searchOptions,			lang.search.description);
		createFeatureSetting(section, lang.themeToggle.title,		Settings.exportOptions.themeToggleOptions,		lang.themeToggle.description);
		createFeatureSetting(section, lang.customHead.title,		Settings.exportOptions.customHeadOptions,		lang.customHead.description);
		createFeatureSetting(section, lang.backlinks.title,			Settings.exportOptions.backlinkOptions,			lang.backlinks.description);
		createFeatureSetting(section, lang.tags.title,				Settings.exportOptions.tagOptions,				lang.tags.description);
		createFeatureSetting(section, lang.aliases.title,			Settings.exportOptions.aliasOptions,			lang.aliases.description);
		createFeatureSetting(section, lang.properties.title,		Settings.exportOptions.propertiesOptions,		lang.properties.description);
		
		// #endregion


		//#region Asset Settings

		createDivider(container);

		section = createSection(container, lang.assetOptions.title,
			lang.assetOptions.description);

		createToggle(section, lang.makeOfflineCompatible.title,
			 () => Settings.exportOptions.offlineResources,
			  (value) => Settings.exportOptions.offlineResources = value,
						lang.makeOfflineCompatible.description);
		createToggle(section, lang.includeSvelteCSS.title,
			 () => Settings.exportOptions.includeSvelteCSS,
			  (value) => Settings.exportOptions.includeSvelteCSS = value,
			  lang.includeSvelteCSS.description);

		new Setting(section)
			.setName(lang.includePluginCSS.title)
			.setDesc(lang.includePluginCSS.description)

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
