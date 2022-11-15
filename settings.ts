import { App, Modal, Plugin, Setting} from 'obsidian';
import { Utils } from 'main';

export interface ExportSettingsData 
{
    inlineCSS: boolean;
    inlineJS: boolean;
    inlineImages: boolean;

    uzeZip: boolean;
    addDarkModeToggle: boolean;
    includeOutline: boolean;
    customLineWidth: number;
    lastExportPath: string;

    customJS: string;
    customCSS: string;

    includePluginCSS: string;
}

const DEFAULT_SETTINGS: ExportSettingsData = 
{
    inlineCSS: true,
    inlineJS: true,
    inlineImages: true,

    uzeZip: false,
    addDarkModeToggle: true,
    includeOutline: true,
    customLineWidth: 0,
    lastExportPath: '',

    customJS: '',
    customCSS: '',

    includePluginCSS: ''
}

export class ExportSettings extends Modal
{
    static settings: ExportSettingsData = DEFAULT_SETTINGS;
    static plugin: Plugin;
    static isClosed: boolean = true;
    static success: boolean = false;

	constructor(plugin: Plugin) 
	{
		super(plugin.app);
        ExportSettings.plugin = plugin;
	}

    static async loadSettings() 
    {
		ExportSettings.settings = Object.assign({}, DEFAULT_SETTINGS, await ExportSettings.plugin.loadData());
	}

	static async saveSettings() 
    {
		await ExportSettings.plugin.saveData(ExportSettings.settings);
	}

    /**
     * @brief Opens the modal and async blocks until the modal is closed.
     * @returns True if the EXPORT button was pressed, false is the export was canceled.
     * @override
    */
    async open(): Promise<boolean>
    {
        super.open();
        ExportSettings.isClosed = false;

        const {contentEl} = this;

		contentEl.empty();

		contentEl.createEl('h2', {text: 'HTML Webpage Settings'});

        contentEl.createEl('h3', {text: 'Inlining Options:'});
        
        new Setting(contentEl)
            .setName('Inline CSS')
            .setDesc('Inline the CSS into the HTML file.')
            .addToggle((toggle) => toggle
                .setValue(ExportSettings.settings.inlineCSS)
                .onChange(async (value) =>
                {
                    ExportSettings.settings.inlineCSS = value;
                    await ExportSettings.saveSettings();
                }));

        new Setting(contentEl)
            .setName('Inline JS')
            .setDesc('Inline the JS into the HTML file.')
            .addToggle((toggle) => toggle
                .setValue(ExportSettings.settings.inlineJS)
                .onChange(async (value) =>
                {
                    ExportSettings.settings.inlineJS = value;
                    await ExportSettings.saveSettings();
                }));

        new Setting(contentEl)
            .setName('Inline Images')
            .setDesc('Inline the images into the HTML file.')
            .addToggle((toggle) => toggle
                .setValue(ExportSettings.settings.inlineImages)
                .onChange(async (value) =>
                {
                    ExportSettings.settings.inlineImages = value;
                    await ExportSettings.saveSettings();
                }));
        

        contentEl.createEl('h3', {text: 'Special Features:'});

        new Setting(contentEl)
            .setName('Add Dark Mode Toggle')
            .setDesc('Adds a fixed theme toggle to the top of any page that doesn\'t already have a toggle embedded with `theme-toggle`.')
            .addToggle((toggle) => toggle
                .setValue(ExportSettings.settings.addDarkModeToggle)
                .onChange(async (value) =>
                {
                    ExportSettings.settings.addDarkModeToggle = value;
                    await ExportSettings.saveSettings();
                }));

        new Setting(contentEl)
            .setName('Include Document Outline')
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
            .setName('Custom Line Width')
            .setDesc('Will set the line width of the document to the specified value. If set to 0, will use whatever the current line width is.')
            .addText((text) => text
                .setValue(ExportSettings.settings.customLineWidth.toString())
                .onChange(async (value) =>
                {
                    ExportSettings.settings.customLineWidth = parseInt(value);
                    await ExportSettings.saveSettings();
                }
            ));
        
        contentEl.createEl('h3', {text: 'Export Options:'});

        // new Setting(contentEl)
        // .setName('Export to ZIP')
        // .setDesc('Will export a .zip file rather than putting all the files loose in the chosen folder.')
        // .addToggle((toggle) => toggle
        //     .setValue(ExportSettings.settings.uzeZip)
        //     .onChange(async (value) =>
        //     {
        //         ExportSettings.settings.uzeZip = value;
        //         await ExportSettings.saveSettings();
        //     }));

        new Setting(contentEl)
            .setName('Include Plugin CSS')
            .setDesc('Will include the CSS from the plugins listed below. Please write out the plugin\'s ID / folder name exactly each on a new line.')
            .addTextArea((text) => text
                .setValue(ExportSettings.settings.includePluginCSS)
                .onChange(async (value) =>
                {
                    ExportSettings.settings.includePluginCSS = value;
                    await ExportSettings.saveSettings();
                }
            ));

        new Setting(contentEl)
            .setName('Start Export')
            .addButton((button) => button
                .setButtonText('Export')
                .onClick(async () =>
                {
                    this.close();
                    ExportSettings.success = true;
                }
            ));

        await Utils.waitUntil(() => ExportSettings.isClosed, 60 * 60 * 1000, 200);

        return ExportSettings.success;
    }

	onClose()
    {
		const {contentEl} = this;
		contentEl.empty();
        ExportSettings.isClosed = true;
        ExportSettings.success = false;
	}
}