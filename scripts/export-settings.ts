import { App, ExtraButtonComponent, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Utils } from './utils';
import { writeFile } from "fs/promises";
import { HTMLGenerator } from './html-gen';

export interface ExportSettingsData 
{
	inlineCSS: boolean;
	inlineJS: boolean;
	inlineImages: boolean;
	makeNamesWebStyle: boolean;
	exportInBackground: boolean;
	includePluginCSS: string;

	addDarkModeToggle: boolean;
	includeOutline: boolean;
	includeGraphView: boolean;
	customLineWidth: string;
	openAfterExport: boolean;

	lastExportPath: string;
}

const DEFAULT_SETTINGS: ExportSettingsData =
{
	inlineCSS: true,
	inlineJS: true,
	inlineImages: true,
	makeNamesWebStyle: false,
	exportInBackground: false,
	includePluginCSS: '',

	addDarkModeToggle: true,
	includeOutline: true,
	includeGraphView: true,
	customLineWidth: "",
	openAfterExport: true,

	lastExportPath: '',
}

export class FlowList
{
	containerEl: HTMLElement;
	flowListEl: HTMLElement;
	checkedList: string[] = [];
	
	constructor(containerEl: HTMLElement)
	{
		this.containerEl = containerEl;
		this.flowListEl = this.containerEl.createDiv({ cls: 'flow-list' });

	}

	addItem(name: string, key: string, value: boolean, onChange: (value: boolean) => void): HTMLElement
	{
		let item = this.flowListEl.createDiv({ cls: 'flow-item' });
		let checkbox = item.createEl('input', { type: 'checkbox' });
		checkbox.checked = value;
		if(checkbox.checked) this.checkedList.push(key)
		
		checkbox.addEventListener('change', (evt) => 
		{
			if(checkbox.checked) 
			{
				if(!this.checkedList.includes(key))
					this.checkedList.push(key)
			}
			else 
			{
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



export class ExportSettings extends PluginSettingTab
{

	static settings: ExportSettingsData = DEFAULT_SETTINGS;
	static plugin: Plugin;

	private static thirdPartyStylesBlacklistURL: string = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/assets/third-party-styles-blacklist.txt";

	private blacklistedPluginIDs: string[] = [];
	public async getBlacklistedPluginIDs() : Promise<string[]>
	{
		if (this.blacklistedPluginIDs.length > 0) return this.blacklistedPluginIDs;
		
		let blacklist = await Utils.getText(Utils.joinPaths(HTMLGenerator.assetsPath, "third-party-styles-blacklist.txt"));
		if (blacklist)
		{
			this.blacklistedPluginIDs = blacklist.split("\n");
		}

		return this.blacklistedPluginIDs;
	}

	constructor(plugin: Plugin) 
	{
		super(app, plugin);
		ExportSettings.plugin = plugin;
	}

	static async loadSettings() 
	{
		ExportSettings.settings = Object.assign({}, DEFAULT_SETTINGS, await ExportSettings.plugin.loadData());
		ExportSettings.settings.customLineWidth = ExportSettings.settings.customLineWidth.toString();
		if (ExportSettings.settings.customLineWidth == "0") ExportSettings.settings.customLineWidth = ""; 

		//Download third-party-styles-blacklist.txt
		let thirdPartyStylesBlacklist = await fetch(ExportSettings.thirdPartyStylesBlacklistURL);
		let thirdPartyStylesBlacklistText = await thirdPartyStylesBlacklist.text();
		await writeFile(Utils.joinPaths(HTMLGenerator.assetsPath, "third-party-styles-blacklist.txt"), thirdPartyStylesBlacklistText).catch((err) => { console.log(err); });
	}

	static async saveSettings() 
	{
		await ExportSettings.plugin.saveData(ExportSettings.settings);
	}

	display()
	{
		const { containerEl } = this;

		containerEl.empty();

		let header = containerEl.createEl('h2', { text: 'HTML Export Settings' });
		header.style.display = 'block';
		header.style.marginBottom = '15px';

		let supportLink = containerEl.createEl('a');
		// @ts-ignore
		supportLink.outerHTML = `<a href="https://www.buymeacoffee.com/nathangeorge"><img style="height:40px;" src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=nathangeorge&button_colour=${app.vault.getConfig("accentColor").replace("#", "")}&font_colour=ffffff&font_family=Poppins&outline_colour=000000&coffee_colour=FFDD00"></a>`;
		let supportHeader = containerEl.createDiv({ text: 'Support my development of this plugin.', cls: "setting-item-description"});
		supportHeader.style.display = 'block';
		supportHeader.style.marginBottom = '20px';


		containerEl.createEl('h3', { text: 'Inlining Options:' });

		new Setting(containerEl)
			.setName('Inline CSS')
			.setDesc('Inline the CSS into the HTML file.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.inlineCSS)
				.onChange(async (value) =>
				{
					ExportSettings.settings.inlineCSS = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Inline JS')
			.setDesc('Inline the JS into the HTML file.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.inlineJS)
				.onChange(async (value) =>
				{
					ExportSettings.settings.inlineJS = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Inline Images')
			.setDesc('Inline the images into the HTML file.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.inlineImages)
				.onChange(async (value) =>
				{
					ExportSettings.settings.inlineImages = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Make names web style')
			.setHeading()
			.setDesc('Make the names of files and folders lowercase and replace spaces with dashes.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.makeNamesWebStyle)
				.onChange(async (value) =>
				{
					ExportSettings.settings.makeNamesWebStyle = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export in Background')
			.setHeading()
			.setDesc('Export files in the background, MUCH faster and less intrusive. However, embedded content may not be exported, like audio, GIFs, videos, some special plugin blocks, some images, etc.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.exportInBackground)
				.onChange(async (value) =>
				{
					ExportSettings.settings.exportInBackground = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include Plugin CSS')
			.setHeading()

		let pluginsList = new FlowList(containerEl);
		Utils.getPluginIDs().forEach(async (plugin) =>
		{
			let pluginManifest = Utils.getPluginManifest(plugin);
			if (!pluginManifest) return;

			if ((await this.getBlacklistedPluginIDs()).contains(pluginManifest.id))
			{
				return;
			}

			let pluginPath = pluginManifest.dir;
			if (!pluginPath) return;
			pluginPath = Utils.getAbsolutePath(pluginPath);
			if (!pluginPath) return;

			let hasCSS = Utils.pathExists(Utils.joinPaths(pluginPath, 'styles.css'), false);
			if (!hasCSS) return;

			let isChecked = ExportSettings.settings.includePluginCSS.match(new RegExp(`^${plugin}`, 'm')) != null;

			pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) =>
			{
				ExportSettings.settings.includePluginCSS = pluginsList.checkedList.join('\n');
				ExportSettings.saveSettings();
			});
		});
	}
}

export class ExportModal extends Modal
{
	static isClosed: boolean = true;
	static canceled: boolean = true;

	constructor()
	{
		super(app);
	}

	/**
	 * @brief Opens the modal and async blocks until the modal is closed.
	 * @returns True if the EXPORT button was pressed, false is the export was canceled.
	 * @override
	*/
	async open(): Promise<{canceled: boolean}>
	{
		ExportModal.isClosed = false;
		ExportModal.canceled = true;

		super.open();

		const { contentEl } = this;

		contentEl.empty();

		this.titleEl.setText('Export to HTML');

		contentEl.createEl('h3', { text: 'Document Settings:' });

		new Setting(contentEl)
			.setName('Add global theme toggle')
			.setDesc('Adds a fixed theme toggle to the top of any page that doesn\'t already have a toggle embedded with `theme-toggle`.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.addDarkModeToggle)
				.onChange(async (value) =>
				{
					ExportSettings.settings.addDarkModeToggle = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Include document outline')
			.setDesc('Will include an interactive document outline tree on the right side of the document.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeOutline)
				.onChange(async (value) =>
				{
					ExportSettings.settings.includeOutline = value;
					await ExportSettings.saveSettings();
				}
				));

		new Setting(contentEl)
			.setName('Include graph view')
			.setDesc('Will include an interactive graph view sim of the document simmilar to obsidian\'s.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeGraphView)
				.onChange(async (value) =>
				{
					ExportSettings.settings.includeGraphView = value;
					await ExportSettings.saveSettings();
				}
				));

		new Setting(contentEl)
			.setName('Page Width')
			.setTooltip('Sets the line width of the exported document. Use any css units.\nDefault units: px')
			.setHeading()
			.addText((text) => text
				.setValue(ExportSettings.settings.customLineWidth)
				.setPlaceholder('Leave blank for default')
				.onChange(async (value) =>
				{
					ExportSettings.settings.customLineWidth = value;
					await ExportSettings.saveSettings();
				}
			))
			.addExtraButton((button) => button.setIcon('reset').setTooltip('Reset to default').onClick(() =>
			{
				ExportSettings.settings.customLineWidth = "";
				ExportSettings.saveSettings();
				this.open();
			}));
			

		contentEl.createEl('h3', { text: 'Export Options:' });

		new Setting(contentEl)
			.setName('Open after export')
			.setHeading()
			.addToggle((toggle) => toggle
				.setTooltip('Open the exported file after exporting.')
				.setValue(ExportSettings.settings.openAfterExport)
				.onChange(async (value) =>
				{
					ExportSettings.settings.openAfterExport = value;
					await ExportSettings.saveSettings();
				})
			)

		new Setting(contentEl)
			.setName('')
			.setHeading()
			.addButton((button) => button
				.setButtonText('Export')
				.onClick(async () =>
				{
					ExportModal.canceled = false;
					this.close();
				})
			)

		new Setting(contentEl)
			.setDesc("More options located on the plugin settings page.")
			.addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() =>
			{
				//@ts-ignore
				app.setting.open();
				//@ts-ignore
      			app.setting.openTabById('webpage-html-export');
			}));


		await Utils.waitUntil(() => ExportModal.isClosed, 60 * 60 * 1000, 10);

		return { canceled: ExportModal.canceled };
	}

	onClose()
	{
		const { contentEl } = this;
		contentEl.empty();
		ExportModal.isClosed = true;
	}
}
