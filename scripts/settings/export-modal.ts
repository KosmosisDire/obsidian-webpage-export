import { Modal, Setting, TFile } from 'obsidian';
import { Utils } from '../utils/utils';
import HTMLExportPlugin from '../main';
import { MainSettings } from './main-settings';
import { FilePicker } from './file-picker';
import { Path } from 'scripts/utils/path';

export interface ExportInfo
{
	canceled: boolean;
	pickedFiles: TFile[];
	exportPath: Path;
}


export class ExportModal extends Modal 
{
	private isClosed: boolean = true;
	private canceled: boolean = true;
	private filePickerModalEl: HTMLElement;
	private filePicker: FilePicker;
	private pickedFiles: TFile[];

	public exportInfo: ExportInfo;

	constructor() {
		super(app);
	}

	/**
	 * @brief Opens the modal and async blocks until the modal is closed.
	 * @returns True if the EXPORT button was pressed, false is the export was canceled.
	 * @override
	*/
	async open(): Promise<ExportInfo> 
	{
		this.isClosed = false;
		this.canceled = true;

		super.open();

		let modalDivider: HTMLElement | undefined = undefined; // divider in between the main modal and the file picker modal
		if(!this.filePickerModalEl)
		{
			this.filePickerModalEl = this.containerEl.createDiv({ cls: 'modal' });
			modalDivider = this.containerEl.createDiv();
			this.containerEl.insertBefore(this.filePickerModalEl, this.modalEl);
			this.containerEl.insertBefore(modalDivider, this.modalEl);
			this.filePickerModalEl.style.position = 'relative';
			this.filePickerModalEl.style.zIndex = "1";
			this.filePickerModalEl.style.width = "20em";
			this.filePickerModalEl.style.padding = "0";
			this.filePickerModalEl.style.margin = "10px";
			this.filePickerModalEl.style.maxHeight = "80%";
			let container = this.filePickerModalEl.createDiv({ cls: 'modal-content tree-container file-tree mod-nav-indicator' });
			container.style.height = "100%";
			container.style.width = "100%";
			container.style.padding = "0";
			container.style.margin = "0";
			
			let scrollArea = container.createDiv({ cls: 'tree-scroll-area' });
			scrollArea.style.height = "100%";
			scrollArea.style.width = "100%";
			scrollArea.style.overflowY = "auto";
			scrollArea.style.overflowX = "hidden";
			scrollArea.style.padding = "1em";
			scrollArea.style.boxShadow = "0 0 7px 1px inset #00000060";

			modalDivider.style.width = "2px";
			modalDivider.style.opacity = "0.4";
			modalDivider.style.backgroundColor = "var(--text-faint)";
			modalDivider.style.zIndex = "2";
			modalDivider.style.marginLeft = "0.4em";
			modalDivider.style.marginRight = "1em";
			modalDivider.style.maxHeight = "75%";
			

			this.filePicker = FilePicker.getFileSelectTree(app.vault.getFiles());
			this.filePicker.buildTree(scrollArea);
		}


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
			width: fit-content;
			white-space: pre-wrap;`)
		}

		// let hr = contentEl.createEl("hr");
		// hr.style.marginTop = "20px";
		// hr.style.marginBottom = "20px";
		// hr.style.borderColor = "var(--color-accent)";
		// hr.style.opacity = "0.5";

		// contentEl.createEl('h3', { text: 'Basic Options:' });

		new Setting(contentEl)
			.setName('Export Presets')
			.setHeading()
			.addDropdown((dropdown) => dropdown
				.addOption('website', 'Multi-File Website')
				.addOption('documents', 'Self-contained Documents')
				.setValue(MainSettings.settings.exportPreset)
				.onChange(async (value) => 
				{
					MainSettings.settings.exportPreset = value;

					switch (value) {
						case 'documents':
							MainSettings.settings.inlineCSS = true;
							MainSettings.settings.inlineJS = true;
							MainSettings.settings.inlineImages = true;
							MainSettings.settings.makeNamesWebStyle = false;
							MainSettings.settings.includeGraphView = false;
							MainSettings.settings.includeFileTree = false;
							await MainSettings.saveSettings();

							break;
						case 'website':
							MainSettings.settings.inlineCSS = false;
							MainSettings.settings.inlineJS = false;
							MainSettings.settings.inlineImages = false;
							MainSettings.settings.makeNamesWebStyle = true;
							MainSettings.settings.includeGraphView = false;
							MainSettings.settings.includeFileTree = true;
							await MainSettings.saveSettings();

							break;
					}

					this.open();
				}
				));

// 		contentEl.createDiv().outerHTML = 
// 		`
// 		<div class="setting-item-description" style="white-space: pre-wrap; margin-bottom: 1em;
// 		">Multi-File Website: For multiple files as a website.
// Self-contained Documents: For documents which should each be self contained as one file.

// <em>For more control open the plugin settings from the button at the bottom of this popup.</em></div>`


		new Setting(contentEl)
			.setName('Only Export Modified')
			.setDesc('Disable this to do a full re-export.')
			.addToggle((toggle) => toggle
				.setValue(MainSettings.settings.incrementalExport)
				.onChange(async (value) => {
					MainSettings.settings.incrementalExport = value;
					await MainSettings.saveSettings();
		}));

		new Setting(contentEl)
			.setName('Open after export')
			.addToggle((toggle) => toggle
				.setTooltip('Open the exported file after exporting.')
				.setValue(MainSettings.settings.openAfterExport)
				.onChange(async (value) => {
					MainSettings.settings.openAfterExport = value;
					await MainSettings.saveSettings();
		}));

		let errorMessage = contentEl.createDiv({ cls: 'setting-item-description' });
		errorMessage.style.color = "var(--color-red)";
		errorMessage.style.marginBottom = "0.75rem";

		new Setting(contentEl)
			.setName('')
			.setHeading()
			.addText((text) => 
			{
				text.inputEl.style.width = '100%';
				text.setPlaceholder('Enter an absolute export directory path')
					.setValue(MainSettings.settings.lastExportPath)
					.onChange(async (value) => 
					{
						let path = new Path(value);
						if(!path.isDirectory) errorMessage.setText("Path must be a directory!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else
						{
							errorMessage.setText("");
							MainSettings.settings.lastExportPath = value.replaceAll("\"", "");
							text.setValue(MainSettings.settings.lastExportPath);
							await MainSettings.saveSettings();
						}
					});
			})
			.addButton((button) =>
			{
				button.setButtonText('Browse').onClick(async () => 
				{
					let ideal = Utils.idealDefaultPath();
					let path = await Utils.showSelectFolderDialog(ideal)
					if (path) 
					{
						MainSettings.settings.lastExportPath = path.directory.asString;
						await MainSettings.saveSettings();
						this.open();
					}
				});
			})
			.addButton((button) => 
			{
				button.setButtonText('Export').onClick(async () => 
				{
					this.canceled = false;
					this.close();
				});

				// button.buttonEl.style.marginRight = 'auto';
				// button.buttonEl.style.marginLeft = 'auto';
				// button.buttonEl.style.width = '-webkit-fill-available';
				// button.buttonEl.style.marginBottom = '2em';
		});

		contentEl.appendChild(errorMessage);

		new Setting(contentEl)
			.setDesc("More options located on the plugin settings page.")
			.addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() => {
				//@ts-ignore
				app.setting.open();
				//@ts-ignore
				app.setting.openTabById('webpage-html-export');
		}));


		this.filePickerModalEl.style.height = this.modalEl.clientHeight * 2 + "px";
		if(modalDivider) modalDivider.style.height = this.modalEl.clientHeight * 1.9 + "px";

		await Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 10);
		
		this.pickedFiles = this.filePicker.getSelectedFiles();
		this.filePickerModalEl.remove();
		this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(MainSettings.settings.lastExportPath)};

		return this.exportInfo;
	}

	onClose() 
	{
		const { contentEl } = this;
		contentEl.empty();
		this.isClosed = true;
	}
}
