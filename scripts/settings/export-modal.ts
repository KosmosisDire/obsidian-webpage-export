import { Modal, Setting } from 'obsidian';
import { Utils } from '../utils/utils';
import HTMLExportPlugin from '../main';
import { MainSettings } from './main-settings';
import { FilePicker } from './file-picker';

export class ExportModal extends Modal {
	static isClosed: boolean = true;
	static canceled: boolean = true;
	static filePickerModal: HTMLElement;

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

		ExportModal.filePickerModal = this.containerEl.createDiv({ cls: 'modal' });
		this.containerEl.insertBefore(ExportModal.filePickerModal, this.modalEl);
		ExportModal.filePickerModal.style.position = 'relative';
		ExportModal.filePickerModal.style.zIndex = "1";
		ExportModal.filePickerModal.style.width = "20em";
		ExportModal.filePickerModal.style.margin = "10px";
		let container = ExportModal.filePickerModal.createDiv({ cls: 'modal-content tree-container file-tree mod-nav-indicator' });
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
		

		let fileTree = FilePicker.getFileSelectTree(app.vault.getFiles());
		fileTree.buildTree(scrollArea);


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
				.setValue(MainSettings.settings.openAfterExport)
				.onChange(async (value) => {
					MainSettings.settings.openAfterExport = value;
					await MainSettings.saveSettings();
				}));

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


		ExportModal.filePickerModal.style.height = this.modalEl.clientHeight + "px";
		


		await Utils.waitUntil(() => ExportModal.isClosed, 60 * 60 * 1000, 10);

		return { canceled: ExportModal.canceled };
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		ExportModal.isClosed = true;
		ExportModal.filePickerModal.remove();
	}
}
