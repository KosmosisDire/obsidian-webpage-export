import { Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Path, Utils } from './utils';
import { writeFile } from "fs/promises";
import { HTMLGenerator } from './html-gen';
import HTMLExportPlugin from './main';

export interface ExportSettingsData 
{
	inlineCSS: boolean;
	inlineJS: boolean;
	inlineImages: boolean;
	includePluginCSS: string;

	makeNamesWebStyle: boolean;
	allowFoldingHeadings: boolean;
	addFilenameTitle: boolean;

	exportInBackground: boolean;
	beautifyHTML: boolean;

	graphAttractionForce: number;
    graphLinkLength: number;
    graphRepulsionForce: number;
    graphCentralForce: number;
    graphEdgePruning: number;
	graphMinNodeSize: number;
	graphMaxNodeSize: number;

	addDarkModeToggle: boolean;
	includeOutline: boolean;
	includeGraphView: boolean;
	customLineWidth: string;
	openAfterExport: boolean;
	keepNestedFolderStructure: boolean;

	lastExportPath: string;
}

const DEFAULT_SETTINGS: ExportSettingsData =
{
	inlineCSS: true,
	inlineJS: true,
	inlineImages: true,
	includePluginCSS: '',

	makeNamesWebStyle: true,
	allowFoldingHeadings: true,
	addFilenameTitle: true,

	exportInBackground: true,
	beautifyHTML: false,

	graphAttractionForce: 50,
	graphLinkLength: 10,
	graphRepulsionForce: 60,
	graphCentralForce: 20,
	graphEdgePruning: 100,
	graphMinNodeSize: 5,
	graphMaxNodeSize: 10,

	addDarkModeToggle: true,
	includeOutline: true,
	includeGraphView: false,
	customLineWidth: "",
	openAfterExport: true,
	keepNestedFolderStructure: false,

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
		
		let blacklist = await Utils.getText(HTMLGenerator.assetsPath.joinString("third-party-styles-blacklist.txt"));
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
		await writeFile(HTMLGenerator.assetsPath.joinString("third-party-styles-blacklist.txt").asString, thirdPartyStylesBlacklistText).catch((err) => { console.log(err); });
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

		let buttonColor = Utils.sampleCSSColorHex("--color-accent", document.body).hex;
		let buttonTextColor = Utils.sampleCSSColorHex("--text-on-accent", document.body).hex;
		let buttonOutlineColor = Utils.sampleCSSColorHex("--modal-border-color", document.body).hex;
		console.log(buttonTextColor);
		// @ts-ignore
		supportLink.outerHTML = `<a href="https://www.buymeacoffee.com/nathangeorge"><img style="height:40px;" src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=nathangeorge&button_colour=${buttonColor}&font_colour=${buttonTextColor}&font_family=Poppins&outline_colour=${buttonTextColor}&coffee_colour=FFDD00"></a>`;
		let supportHeader = containerEl.createDiv({ text: 'Support the continued development of this plugin.', cls: "setting-item-description"});
		supportHeader.style.display = 'block';
		supportHeader.style.marginBottom = '20px';
		
		let hr = containerEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(containerEl)
			.setName('Inlining Options:')
			.setDesc("If all three of these are on the html files will be completely self-contained.")
			.setHeading()

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
		

		hr = containerEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(containerEl)
			.setName('Formatting Options:')
			.setHeading()
		
		new Setting(containerEl)
			.setName('Make names web style')
			.setDesc('Make the names of files and folders lowercase and replace spaces with dashes.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.makeNamesWebStyle)
				.onChange(async (value) =>
				{
					ExportSettings.settings.makeNamesWebStyle = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Allow Folding Headings')
			.setDesc('Allow headings to be folded with an arrow icon beside each heading, just as in Obsidian.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.allowFoldingHeadings)
				.onChange(async (value) =>
				{
					ExportSettings.settings.allowFoldingHeadings = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Add Filename as Title')
			.setDesc('If the first header is not an H1, include the file name as a title at the top of the page.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.addFilenameTitle)
				.onChange(async (value) =>
				{
					ExportSettings.settings.addFilenameTitle = value;
					await ExportSettings.saveSettings();
				}));


		hr = containerEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(containerEl)
			.setName('Export Options:')
			.setHeading()
		
		new Setting(containerEl)
			.setName('Export in Background')
			.setDesc('Export files in the background, this improves export times a HUGE amount and allows the files to export completely in the background.\n\nAs this is new, if you are encountering issues you can try turning this off, and report an issue on Github. There are a few types of embedded content it does not support yet.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.exportInBackground)
				.onChange(async (value) =>
				{
					ExportSettings.settings.exportInBackground = value;
					await ExportSettings.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Beautify HTML')
			.setDesc('Beautify the HTML text to make it more human readable at the cost of export speed.')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.beautifyHTML)
				.onChange(async (value) =>
				{
					ExportSettings.settings.beautifyHTML = value;
					await ExportSettings.saveSettings();
				}));


		hr = containerEl.createEl("hr");
		hr.style.marginTop = "20px";
		hr.style.marginBottom = "20px";
		hr.style.borderColor = "var(--color-accent)";
		hr.style.opacity = "0.5";
		new Setting(containerEl)
			.setName('Include Plugin CSS')
			.setDesc('Include the CSS from the following plugins in the exported HTML. If plugin features aren\'t rendering correctly, try adding the plugin to this list.')
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

			let pluginDir = pluginManifest.dir;
			if (!pluginDir) return;
			let pluginPath = new Path(pluginDir);

			let hasCSS = pluginPath.joinString('styles.css').exists;
			if (!hasCSS) return;

			let isChecked = ExportSettings.settings.includePluginCSS.match(new RegExp(`^${plugin}`, 'm')) != null;

			pluginsList.addItem(pluginManifest.name, plugin, isChecked, (value) =>
			{
				ExportSettings.settings.includePluginCSS = pluginsList.checkedList.join('\n');
				ExportSettings.saveSettings();
			});
		});
				

		let experimentalContainer = containerEl.createDiv();
		let experimentalHR1 = experimentalContainer.createEl('hr');
		let experimentalHeader = experimentalContainer.createEl('h2', { text: 'Experimental'});
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


		new Setting(containerEl)
			.setName('Graph View (PLEASE READ DESCRIPTION)')
			.setDesc('This CANNOT be used with the file:// protocol, the assets for this also will not be inlined into the HTML file at this point.')
			.setHeading()

		new Setting(containerEl)
			.setName('Include global graph view')
			.setDesc('Include an interactive graph view sim of the WHOLE vault similar to obsidian\'s. ')
			.addToggle((toggle) => toggle
				.setValue(ExportSettings.settings.includeGraphView)
				.onChange(async (value) =>
				{
					ExportSettings.settings.includeGraphView = value;
					await ExportSettings.saveSettings();
				}
				));

		new Setting(containerEl)
			.setName('Graph View Settings')
			.setDesc('Settings to control the behavior and look of the graph view. For now there is no live preview of this, so you must export your files to see your changes.')
			.setHeading()
			
		new Setting(containerEl)
			.setName('Attraction Force')
			.setDesc("How much should linked nodes attract each other? This will make the graph appear more clustered.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphAttractionForce / (2 / 100))
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					// remap to 0 - 2;
					let remapMultiplier = 2 / 100;
					ExportSettings.settings.graphAttractionForce = value * remapMultiplier;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(containerEl)
			.setName('Link Length')
			.setDesc("How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphLinkLength)
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					ExportSettings.settings.graphLinkLength = value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);
		
		new Setting(containerEl)
			.setName('Repulsion Force')
			.setDesc("How much should nodes repel each other? This will make the graph appear more spread out.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphRepulsionForce / 3)
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					ExportSettings.settings.graphRepulsionForce = value * 3;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(containerEl)
			.setName('Central Force')
			.setDesc("How much should nodes be attracted to the center? This will make the graph appear more dense and circular.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(ExportSettings.settings.graphCentralForce / (5 / 100))
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					// remap to 0 - 5;
					let remapMultiplier = 5 / 100;
					ExportSettings.settings.graphCentralForce = value * remapMultiplier;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(containerEl)
			.setName('Max Node Radius')
			.setDesc("How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.")
			.addSlider((slider) => slider
				.setLimits(3, 15, 1)
				.setValue(ExportSettings.settings.graphMaxNodeSize)
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					ExportSettings.settings.graphMaxNodeSize = value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(containerEl)
			.setName('Min Node Radius')
			.setDesc("How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.")
			.addSlider((slider) => slider
				.setLimits(3, 15, 1)
				.setValue(ExportSettings.settings.graphMinNodeSize)
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					ExportSettings.settings.graphMinNodeSize = value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		new Setting(containerEl)
			.setName('Edge Pruning Factor')
			.setDesc("Edges with a length above this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.")
			.addSlider((slider) => slider
				.setLimits(0, 100, 1)
				.setValue(100 - ExportSettings.settings.graphEdgePruning)
				.setDynamicTooltip()
				.onChange(async (value) =>
				{
					ExportSettings.settings.graphEdgePruning = 100 - value;
					await ExportSettings.saveSettings();
				})
				.showTooltip()
			);

		let experimentalHREnd = containerEl.createEl('hr');
		experimentalHREnd.style.borderColor = "var(--color-red)";
		
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

		if (HTMLExportPlugin.updateInfo.updateAvailable)
		{
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
			width: fit-content;`)
		}

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
