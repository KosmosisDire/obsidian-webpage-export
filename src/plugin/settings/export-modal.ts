import { ButtonComponent, Modal, Setting, TFile } from 'obsidian';
import { Utils } from 'plugin/utils/utils';
import HTMLExportPlugin from 'plugin/main';
import { ExportPreset, Settings, SettingsPage } from './settings';
import { FilePickerTree } from 'plugin/features/file-picker';
import { Path } from 'plugin/utils/path';
import { FileDialogs } from 'plugin/utils/file-dialogs';
import { createFileInput, createToggle } from './settings-components';
import { Website } from 'plugin/website/website';
import { Index } from 'plugin/website';

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
			this.filePickerModalEl.style.width = "25em";
			this.filePickerModalEl.style.padding = "0";
			this.filePickerModalEl.style.margin = "10px";
			this.filePickerModalEl.style.maxHeight = "80%";
			this.filePickerModalEl.style.boxShadow = "0 0 7px 1px inset #00000060";
			
			const scrollArea = this.filePickerModalEl.createDiv({ cls: 'tree-scroll-area' });
			scrollArea.style.height = "100%";
			scrollArea.style.width = "100%";
			scrollArea.style.overflowY = "auto";
			scrollArea.style.overflowX = "hidden";
			scrollArea.style.padding = "1em";
			scrollArea.style.boxShadow = "0 0 7px 1px inset #00000060";

			const paths = app.vault.getFiles().map(file => new Path(file.path));
			this.filePicker = new FilePickerTree(paths, true, true);
			this.filePicker.regexBlacklist.push(...Settings.filePickerBlacklist);
			this.filePicker.regexBlacklist.push(...[Settings.exportOptions.customHeadPath, Settings.exportOptions.faviconPath]);
			this.filePicker.regexWhitelist.push(...Settings.filePickerWhitelist);
			
			this.filePicker.generateWithItemsClosed = true;
			this.filePicker.showFileExtentionTags = true;
			this.filePicker.hideFileExtentionTags = ["md"];
			this.filePicker.title = "Select all files in exported vault";
			this.filePicker.class = "file-picker";
			await this.filePicker.generate(scrollArea);
			
			if((this.pickedFiles?.length ?? 0 > 0) || Settings.exportOptions.filesToExport.length > 0) 
			{
				const filesToPick = this.pickedFiles?.map(file => file.path) ?? Settings.exportOptions.filesToExport;
				this.filePicker.setSelectedFiles(filesToPick);
			}

			const saveFiles = new Setting(this.filePickerModalEl).addButton((button) => 
			{
				button.setButtonText("Save").onClick(async () =>
				{
					Settings.exportOptions.filesToExport = this.filePicker.getSelectedFilesSavePaths();
					await SettingsPage.saveSettings();
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
			const updateNotice = contentEl.createEl('strong', { text: `Update Available: ${HTMLExportPlugin.updateInfo.currentVersion} ⟶ ${HTMLExportPlugin.updateInfo.latestVersion}` });
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
			const updateNotes = contentEl.createEl('div', { text: HTMLExportPlugin.updateInfo.updateNote });
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

		const modeDescriptions = 
		{
			"online": "Use this if your files will be accessed online (via an http server).",
			"local": "This will export a single (large) html file containing the whole export. Only use this for offline sharing.",
			"raw-documents": "Export plain html documents with simple style and scripts but no additional features."
		}

		const exportModeSetting = new Setting(contentEl)
			.setName('Export Mode')
			// @ts-ignore
			.setDesc(modeDescriptions[Settings.exportPreset] + "\n\nSome options are only available in certain modes.")
			.setHeading()
			.addDropdown((dropdown) => dropdown
				.addOption('online', 'Online Website')
				.addOption('local', 'Local Website')
				.addOption('raw-documents', 'Raw HTML Documents')
				.setValue(["online", "local", "raw-documents"].contains(Settings.exportPreset) ? Settings.exportPreset : 'website')
				.onChange(async (value) =>
				{
					Settings.exportPreset = value as ExportPreset;

					switch (value) {
						case 'online':
							await Settings.onlinePreset();
							break;
						case 'local':
							await Settings.localPreset();
							break;
						case 'raw-documents':
							await Settings.rawDocumentsPreset();
							break;
					}

					this.open();
				}
				));
		exportModeSetting.descEl.style.whiteSpace = "pre-wrap";

		

		// add purge export button
		new Setting(contentEl)
			
			.addButton((button) => button
			.setButtonText('Clear Cache')
			.onClick(async () =>
			{
				// create a modal to confirm the deletion
				const confirmModal = new Modal(app);
				confirmModal.titleEl.setText("Are you sure?");
				confirmModal.contentEl.createEl('p', { text: "This will delete the site metadata (but not all the exported html)." });
				confirmModal.contentEl.createEl('p', { text: "This will force the site to re-export all files." });
				confirmModal.contentEl.createEl('p', { text: "Also if you change which files are selected for export before exporting again some files may be left on your file system unused." });
				confirmModal.contentEl.createEl('p', { text: "This action cannot be undone." });
				confirmModal.open();

				new Setting(confirmModal.contentEl)
				.addButton((button) => button
				.setButtonText('Cancel')
				.onClick(() => confirmModal.close()))
				.addButton((button) => button
				.setButtonText('Clear Cache')
				.onClick(async () =>
				{
					const path = new Path(exportPathInput.textInput.getValue());
					const website = await new Website(path).load();
					await website.index.clearCache();
					onChanged(path);
					confirmModal.close();
				}));
			}))

			.addButton((button) => button
			.setButtonText('Purge & Delete')
			.onClick(async () =>
			{
				// create a modal to confirm the deletion
				const confirmModal = new Modal(app);
				confirmModal.titleEl.setText("Are you sure?");
				confirmModal.contentEl.createEl('p', { text: "This will delete the entire site and all it's files." });
				confirmModal.contentEl.createEl('p', { text: "This action cannot be undone." });
				confirmModal.open();

				new Setting(confirmModal.contentEl)
				.addButton((button) => button
				.setButtonText('Cancel')
				.onClick(() => confirmModal.close()))
				.addButton((button) => button
				.setButtonText('Purge & Delete')
				.onClick(async () =>
				{
					const path = new Path(exportPathInput.textInput.getValue());
					const website = await new Website(path).load();
					await website.index.purge();
					onChanged(path);
					confirmModal.close();
				}));
			})).setDesc('Clear the site cache to re-export all files, or purge / delete the site with all it\'s files.');

		

		createToggle(contentEl, "Open after export", () => Settings.openAfterExport, (value) => Settings.openAfterExport = value);

		let exportButton : ButtonComponent | undefined = undefined;

		function setExportDisabled(disabled: boolean)
		{
			if(exportButton) 
			{
				exportButton.setDisabled(disabled);
				if (exportButton.disabled) exportButton.buttonEl.style.opacity = "0.5";
				else exportButton.buttonEl.style.opacity = "1";
			}
		}

		const validatePath = (path: Path) => path.validate(
			{
				allowEmpty: false,
				allowRelative: false,
				allowAbsolute: true,
				allowDirectories: true,
				allowTildeHomeDirectory: true,
				requireExists: true
			});

		const onChangedValidate = (path: Path) => (!validatePath(path).valid) ? setExportDisabled(true) : setExportDisabled(false);

		const exportPathInput = createFileInput(contentEl, () => Settings.exportOptions.exportPath, (value) => Settings.exportOptions.exportPath = value,
		{
			name: '',
			description: '',
			placeholder: 'Type or browse an export directory...',
			defaultPath: FileDialogs.idealDefaultPath(),
			pickFolder: true,
			validation: validatePath,
			onChanged: onChangedValidate
		});

		const { fileInput } = exportPathInput;
		
		fileInput.addButton((button) => {
			exportButton = button;
			setExportDisabled(!this.validPath);
			button.setButtonText('Export').onClick(async () => 
			{
				this.canceled = false;
				this.close();
			});
		});

		// add description of export at this path
		const exportDescription = contentEl.createEl('div', { text: 'Loading site at path...', cls: 'setting-item-description'});
		exportDescription.style.marginBottom = "1em";
		const onChanged = async (path: Path) =>
		{
			onChangedValidate(path);
			const valid = validatePath(path);
			this.validPath = valid.valid;
			if (!valid)
			{
				exportDescription.setText("");
				return
			}

			const website = new Website(path);
			const index = new Index();
			await index.load(website, website.exportOptions)

			if (!index.oldWebsiteData)
			{
				exportDescription.setText("This path currently contains no exported website.");
				return;
			}

			if (index.oldWebsiteData.pluginVersion != HTMLExportPlugin.pluginVersion)
			{
				exportDescription.setText("This path contains an export created with a different version of the plugin.");
				return;
			}

			const lastExportDate = new Date(index.oldWebsiteData.modifiedTime).toLocaleString();
			const lastExportFiles = index.oldWebsiteData.allFiles?.length;
			const lastExportName = index.oldWebsiteData.siteName;

			exportDescription.setText(`Path contains site: "${lastExportName}" with ${lastExportFiles} files last exported on ${lastExportDate}.`);
		}

		exportPathInput.textInput.onChange(() => onChanged(new Path(exportPathInput.textInput.getValue())));

		onChanged(new Path(exportPathInput.textInput.getValue()));

		this.filePickerModalEl.style.height = this.modalEl.clientHeight * 2 + "px";

		new Setting(contentEl)
		.setDesc("More options located on the plugin settings page.")
		.addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() => {
			//@ts-ignore
			app.setting.open();
			//@ts-ignore
			app.setting.openTabById('webpage-html-export');
		}));

		await Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 10);
		
		this.pickedFiles = this.filePicker.getSelectedFiles();
		this.filePickerModalEl.remove();
		this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(Settings.exportOptions.exportPath), validPath: this.validPath};

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
