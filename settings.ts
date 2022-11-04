import { App, Modal, Plugin, Setting} from 'obsidian';
import { Utils } from 'main';

export interface ExportSettingsData 
{
	singleFile: boolean;
    uzeZip: boolean;
    addDarkModeToggle: boolean;
    includeOutline: boolean;
    customLineWidth: number;
    lastExportPath: string;
}

const DEFAULT_SETTINGS: ExportSettingsData = 
{
	singleFile: true,
    uzeZip: false,
    addDarkModeToggle: true,
    includeOutline: true,
    customLineWidth: 0,
    lastExportPath: ''
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

		contentEl.createEl('h2', {text: 'HTML Webpage Export Settings'});

		new Setting(contentEl)
			.setName('Export Single HTML File')
			.setDesc('Will export the HTML with all styles and scripts inlined. If unchecked, will export the .html, .css, and .js files separately.')
			.addToggle((toggle) => toggle
                .setValue(ExportSettings.settings.singleFile)
				.onChange(async (value) => 
                {
					ExportSettings.settings.singleFile = value;
					await ExportSettings.saveSettings();
				}));

        new Setting(contentEl)
            .setName('Use .zip for multiple files')
            .setDesc('(Only when Single HTML File is turned off) Will export a .zip file with all the seperate files. If unchecked, will export the other files alongside the .html file in the same folder.')
            .addToggle((toggle) => toggle
                .setValue(ExportSettings.settings.uzeZip)
                .onChange(async (value) =>
                {
                    ExportSettings.settings.uzeZip = value;
                    await ExportSettings.saveSettings();
                }));

        new Setting(contentEl)
            .setName('Add Dark Mode Toggle')
            .setDesc('Will replace any occurrence of /theme-toggle in the document with a dark mode toggle. If no occurrences are found, it will be fixed to the top left of the viewport.')
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