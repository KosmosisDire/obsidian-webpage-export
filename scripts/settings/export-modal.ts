import { ButtonComponent, Modal, Setting, TFile, TextComponent } from 'obsidian';
import { Utils } from '../utils/utils';
import HTMLExportPlugin from '../main';
import { ExportPreset, Settings } from './settings';
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
	public static title: string = "Export to HTML";

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

			let container = this.filePickerModalEl.createDiv({ cls: 'modal-content tree-container mod-root file-picker-tree file-tree mod-nav-indicator' });
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
			this.filePicker.showFileExtentionTags = true;
			this.filePicker.hideFileExtentionTags = ["md"];
			await this.filePicker.generateTree(scrollArea);
			
			if((this.pickedFiles?.length ?? 0 > 0) || Settings.settings.filesToExport[0].length > 0) 
			{
				let filesToPick = this.pickedFiles?.map(file => file.path) ?? Settings.settings.filesToExport[0];
				this.filePicker.setSelectedFiles(filesToPick);
			}

			let saveFiles = new Setting(container).addButton((button) => 
			{
				button.setButtonText("Save").onClick(async () =>
				{
					Settings.settings.filesToExport[0] = this.filePicker.getSelectedFilesSavePaths();
					await Settings.saveSettings();
				});
			});

			saveFiles.settingEl.style.border = "none";
			saveFiles.settingEl.style.marginRight = "1em";
		}


		const { contentEl } = this;

		contentEl.empty();

		this.titleEl.setText(ExportModal.title);

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

		let modeDescriptions = 
		{
			"website": "This will export a file structure suitable for uploading to your own web server.",
			"documents": "This will export self-contained, but slow loading and large, html documents.",
			"raw-documents": "This will export raw, self-contained documents without the website layout. This is useful for sharing individual notes, or printing."
		}

		let exportModeSetting = new Setting(contentEl)
			.setName('Export Mode')
			// @ts-ignore
			.setDesc(modeDescriptions[Settings.settings.exportPreset] + "\n\nSome options are only available in certain modes.")
			.setHeading()
			.addDropdown((dropdown) => dropdown
				.addOption('website', 'Online Web Server')
				.addOption('documents', 'HTML Documents')
				.addOption('raw-documents', 'Raw HTML Documents')
				.setValue(["website", "documents", "raw-documents"].contains(Settings.settings.exportPreset) ? Settings.settings.exportPreset : 'website')
				.onChange(async (value) =>
				{
					Settings.settings.exportPreset = value as ExportPreset;

					switch (value) {
						case 'website':
							Settings.settings.inlineAssets = false;
							Settings.settings.makeNamesWebStyle = true;
							Settings.settings.includeGraphView = true;
							Settings.settings.includeFileTree = true;
							Settings.settings.includeSearchBar = true;
							await Settings.saveSettings();

							break;
						case 'documents':
							Settings.settings.inlineAssets = true;
							Settings.settings.makeNamesWebStyle = false;
							Settings.settings.includeFileTree = true;
							Settings.settings.includeGraphView = false;
							Settings.settings.includeSearchBar = false;
							await Settings.saveSettings();

							break;
						case 'raw-documents':
							Settings.settings.inlineAssets = true;
							Settings.settings.makeNamesWebStyle = false;
							Settings.settings.includeGraphView = false;
							Settings.settings.includeFileTree = false;
							Settings.settings.includeSearchBar = false;
							await Settings.saveSettings();

							break;
					}

					this.open();
				}
				));
		exportModeSetting.descEl.style.whiteSpace = "pre-wrap";

		new Setting(contentEl)
			.setName('Open after export')
			.addToggle((toggle) => toggle
				.setTooltip('Open the exported file after exporting.')
				.setValue(Settings.settings.openAfterExport)
				.onChange(async (value) => {
					Settings.settings.openAfterExport = value;
					await Settings.saveSettings();
		}));

		let errorMessage = contentEl.createDiv({ cls: 'setting-item-description' });
		errorMessage.style.color = "var(--color-red)";
		errorMessage.style.marginBottom = "0.75rem";

		let tempPath = new Path(Settings.settings.exportPath);
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
					.setValue(Settings.settings.exportPath)
					.onChange(async (value) => 
					{
						let path = new Path(value);
						if(!path.isDirectory) errorMessage.setText("Path must be a directory!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else if(!path.exists) errorMessage.setText("Path does not exist!");
						else
						{
							errorMessage.setText("");
							Settings.settings.exportPath = value.replaceAll("\"", "");
							text.setValue(Settings.settings.exportPath);
							this.validPath = true;
							await Settings.saveSettings();
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
						Settings.settings.exportPath = path.directory.asString;
						await Settings.saveSettings();

						setExportDisabled(!path.isDirectory || !path.isAbsolute || !path.exists);

						if(!path.isDirectory) errorMessage.setText("Path must be a directory!");
						else if(!path.isAbsolute) errorMessage.setText("Path must be absolute!");
						else if(!path.exists) errorMessage.setText("Path does not exist!");
						else errorMessage.setText("");

						pathInput?.setValue(Settings.settings.exportPath);
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

		await Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 1);
		
		this.pickedFiles = this.filePicker.getSelectedFiles();
		this.filePickerModalEl.remove();
		this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(Settings.settings.exportPath), validPath: this.validPath};

		return this.exportInfo;
	}

	onClose() 
	{
		const { contentEl } = this;
		contentEl.empty();
		this.isClosed = true;
		ExportModal.title = "Export to HTML";
	}
}
