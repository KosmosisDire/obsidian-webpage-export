import { ButtonComponent, Modal, Setting, TFile, TextComponent } from 'obsidian';
import { Utils } from '../utils/utils';
import HTMLExportPlugin from '../main';
import { MainSettings } from './main-settings';
import { FilePickerTree } from '../objects/file-picker';
import { Path } from 'scripts/utils/path';

export interface ExportInfo
{
	canceled: boolean;
	pickedFiles: TFile[];
	exportPath: Path;
	validPath: boolean;
}


export class ExportModal extends Modal 
{
	private isClosed: boolean = true;
	private canceled: boolean = true;
	private filePickerModalEl: HTMLElement;
	private filePicker: FilePickerTree;
	private pickedFiles: TFile[] | undefined = undefined;
	private validPath: boolean = true;

	public exportInfo: ExportInfo;

	constructor() {
		super(app);
	}

	overridePickedFiles(files: TFile[])
	{
		this.pickedFiles = files;
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

		if(!this.filePickerModalEl)
		{
			this.filePickerModalEl = this.containerEl.createDiv({ cls: 'modal' });
			this.containerEl.insertBefore(this.filePickerModalEl, this.modalEl);
			this.filePickerModalEl.style.position = 'relative';
			this.filePickerModalEl.style.zIndex = "1";
			this.filePickerModalEl.style.width = "20em";
			this.filePickerModalEl.style.padding = "0";
			this.filePickerModalEl.style.margin = "10px";
			this.filePickerModalEl.style.maxHeight = "80%";
			this.filePickerModalEl.style.boxShadow = "0 0 7px 1px inset #00000060";

			let container = this.filePickerModalEl.createDiv({ cls: 'modal-content tree-container file-tree mod-nav-indicator' });
			container.style.height = "100%";
			container.style.width = "100%";
			container.style.padding = "0";
			container.style.margin = "0";
			container.style.display = "flex";
			container.style.flexDirection = "column";
			container.style.alignItems = "flex-end";
			
			let scrollArea = container.createDiv({ cls: 'tree-scroll-area' });
			scrollArea.style.height = "100%";
			scrollArea.style.width = "100%";
			scrollArea.style.overflowY = "auto";
			scrollArea.style.overflowX = "hidden";
			scrollArea.style.padding = "1em";
			scrollArea.style.boxShadow = "0 0 7px 1px inset #00000060";

			this.filePicker = new FilePickerTree(app.vault.getFiles(), true, true);
			this.filePicker.generateWithItemsClosed = true;
			await this.filePicker.generateTree(scrollArea);
			if(MainSettings.settings.filesToExport[0].length > 0) 
			{
				let filesToPick = this.pickedFiles?.map(file => new Path(file.path)) ?? MainSettings.settings.filesToExport[0].map(path => new Path(path));
				this.filePicker.setSelectedFiles(filesToPick);
			}

			let saveFiles = new Setting(container).addButton((button) => 
			{
				button.setButtonText("Save").onClick(async () =>
				{
					MainSettings.settings.filesToExport[0] = this.filePicker.getSelectedFiles().map(file => file.path);
					await MainSettings.saveSettings();
				});
			});

			saveFiles.settingEl.style.border = "none";
			saveFiles.settingEl.style.marginRight = "1em";
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
							await MainSettings.saveSettings();

							break;
						case 'website':
							MainSettings.settings.inlineCSS = false;
							MainSettings.settings.inlineJS = false;
							MainSettings.settings.inlineImages = false;
							MainSettings.settings.makeNamesWebStyle = true;
							MainSettings.settings.includeGraphView = true;
							MainSettings.settings.includeFileTree = true;
							await MainSettings.saveSettings();

							break;
					}

					this.open();
				}
				));

		new Setting(contentEl)
			.setName('Only Export Modified')
			.setDesc('Disable this to do a full re-export. If you have an existing vault since before this feature was introduced, please do a full re-export before turning this on!')
			.addToggle((toggle) => toggle
				.setValue(MainSettings.settings.incrementalExport)
				.onChange(async (value) => {
					MainSettings.settings.incrementalExport = value;
					await MainSettings.saveSettings();
		}));

		new Setting(contentEl)
			.setName('Delete Old Files')
			.setDesc('Delete *ALL* files in the export directory that are not included in this export.')
			.addToggle((toggle) => toggle
				.setValue(MainSettings.settings.deleteOldExportedFiles)
				.onChange(async (value) => {
					MainSettings.settings.deleteOldExportedFiles = value;
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

		let tempPath = new Path(MainSettings.settings.exportPath);
		if(!tempPath.isDirectory) errorMessage.setText("Path must be a directory!");
		else if(!tempPath.isAbsolute) errorMessage.setText("Path must be absolute!");
		else if(!tempPath.exists) errorMessage.setText("Path does not exist!");

		if(errorMessage.innerText != "") 
		{
			this.validPath = false;
		}

		let exportButton : ButtonComponent | undefined = undefined;
		let pathInput : TextComponent | undefined = undefined;

		function setExportDisabled(disabled: boolean)
		{
			if(exportButton) 
			{
				exportButton.setDisabled(disabled);
				if (exportButton.disabled) exportButton.buttonEl.style.opacity = "0.5";
				else exportButton.buttonEl.style.opacity = "1";
			}
		}

		new Setting(contentEl)
			.setName('')
			.setHeading()
			.addText((text) => 
			{
				pathInput = text;
				text.inputEl.style.width = '100%';
				text.setPlaceholder('Enter an absolute export directory path')
					.setValue(MainSettings.settings.exportPath)
					.onChange(async (value) => 
					{
						let path = new Path(value);
						if(!path.isDirectory) errorMessage.setText("Path must be a directory!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else if(!path.exists) errorMessage.setText("Path does not exist!");
						else
						{
							errorMessage.setText("");
							MainSettings.settings.exportPath = value.replaceAll("\"", "");
							text.setValue(MainSettings.settings.exportPath);
							this.validPath = true;
							await MainSettings.saveSettings();
						}

						setExportDisabled(!path.isDirectory || !path.isAbsolute || !path.exists);
					});
			})
			.addButton((button) =>
			{
				button.setButtonText('Browse').onClick(async () => 
				{
					let ideal = Utils.idealDefaultPath();
					let path = (await Utils.showSelectFolderDialog(ideal))?.directory;
					if (path) 
					{
						MainSettings.settings.exportPath = path.directory.asString;
						await MainSettings.saveSettings();

						setExportDisabled(!path.isDirectory || !path.isAbsolute || !path.exists);

						if(!path.isDirectory) errorMessage.setText("Path must be a directory!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else if(!path.exists) errorMessage.setText("Path does not exist!");
						else errorMessage.setText("");

						pathInput?.setValue(MainSettings.settings.exportPath);
					}
				});
			})
			.addButton((button) => 
			{
				exportButton = button;
				setExportDisabled(!this.validPath);
				button.setButtonText('Export').onClick(async () => 
				{
					this.canceled = false;
					this.close();
				});
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

		await Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 10);
		
		this.pickedFiles = this.filePicker.getSelectedFiles();
		this.filePickerModalEl.remove();
		this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(MainSettings.settings.exportPath), validPath: this.validPath};

		return this.exportInfo;
	}

	onClose() 
	{
		const { contentEl } = this;
		contentEl.empty();
		this.isClosed = true;
	}
}
