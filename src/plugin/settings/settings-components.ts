import { getIcon, Modal, Setting, TextComponent } from "obsidian";
import { Settings, SettingsPage } from "./settings";
import { Path } from "src/plugin/utils/path";
import { FileDialogs } from "src/plugin/utils/file-dialogs";
import { FeatureOptions, FeatureRelation, FeatureSettingInfo } from "src/shared/features/feature-options-base";
import { ExportPipelineOptions } from "src/plugin/website/pipeline-options";
import { i18n } from "../translations/language";

export function createDivider(container: HTMLElement)
{
	const hr = container.createEl("hr");
	hr.style.marginTop = "20px";
	hr.style.marginBottom = "20px";
	hr.style.borderColor = "var(--interactive-accent)";
	hr.style.opacity = "0.5";
}

export function createToggle(container: HTMLElement, name: string, get: () => boolean, set: (value: boolean) => void, desc: string = ""): Setting
{
	const setting = new Setting(container);
	setting.setName(name)
	if (desc != "") setting.setDesc(desc);
	setting.addToggle((toggle) => toggle
		// @ts-ignore
		.setValue(get())
		.onChange(async (value) => {
			// @ts-ignore
			set(value);
			await SettingsPage.saveSettings();
		}));
	return setting;
}

export function createText(container: HTMLElement, name: string, get: () => string, set: (value: string) => void, desc: string = "", validation?: (value: string) => string): Setting
{
	const setting = new Setting(container);
	const errorText = createError(container);

	const value = get();
	if (value != "") errorText.setText(validation ? validation(value) : "");
	
	setting.setName(name)
	if (desc != "") setting.setDesc(desc);
	setting.addText((text) => text
		.setValue(value)
		.onChange(async (value) => 
		{
			const error = validation ? validation(value) : "";
			if (error == "")
			{
				set(value);
				await SettingsPage.saveSettings();
			}

			errorText.setText(error);
		}));

	return setting;
}

export function createDropdown(container: HTMLElement, name: string, get: () => string, set: (value: string) => void, options: Record<string, string>, desc: string = ""): Setting
{
	// swap the record keys and values
	const newOptions: Record<string, string> = {};
	for (const key in options)
	{
		newOptions[options[key]] = key;
	}

	const setting = new Setting(container);
	setting.setName(name)
	if (desc != "") setting.setDesc(desc);
	setting.addDropdown((dropdown) => dropdown
		.addOptions(newOptions)
		.setValue(get())
		.onChange(async (value) => 
		{
			set(value);
			await SettingsPage.saveSettings();
		}));
	return setting;
}

export function createError(container: HTMLElement): HTMLElement
{
	const error = container.createDiv({ cls: 'setting-item-description' });
	error.style.color = "var(--color-red)";
	error.style.marginBottom = "0.75rem";
	return error;
}

export function createFileInput(container: HTMLElement, get: () => string, set: (value: string) => void, 
options?: {name?: string, description?: string, placeholder?: string, defaultPath?: Path, makeRelativeToVault?: boolean, pickFolder?: boolean, validation?: (path: Path) => {valid: boolean, isEmpty: boolean, error: string}, browseButton?: boolean, onChanged?: (path: Path)=>void}): {fileInput: Setting, textInput: TextComponent, browseButton: HTMLElement | undefined}
{
	const getSafe = () => new Path(get() ?? "").makePlatformSafe();
	const setSafe = (value: string) => set(new Path(value).makePlatformSafe().path);

	const name = options?.name ?? ""; 
	const description = options?.description ?? "";
	const placeholder = options?.placeholder ?? "Path to file...";
	const defaultPath = options?.defaultPath ?? Path.vaultPath;
	const makeRelativeToVault = options?.makeRelativeToVault ?? false;
	const pickFolder = options?.pickFolder ?? false;
	const validation = options?.validation ?? ((path) => ({valid: true, isEmpty: false, error: ""}));
	const browseButton = options?.browseButton ?? true;
	const onChanged = options?.onChanged;

	const errorMessage = createError(container);
	if (!getSafe().isEmpty)
	{
		errorMessage.setText(validation(getSafe()).error);
	}

	let textInput : TextComponent | undefined = undefined;

	const fileInput = new Setting(container);
	if(name != "") fileInput.setName(name);
	if (description != "") fileInput.setDesc(description);
	if (name == "" && description == "") fileInput.infoEl.style.display = "none";

	let textEl: TextComponent;
	fileInput.addText((text) => 
	{
		textEl = text;
		textInput = text;
		text.inputEl.style.width = '100%';
		text.setPlaceholder(placeholder)
			.setValue(getSafe().path)
			.onChange(async (value) => 
			{
				const path = new Path(value).makePlatformSafe();
				const valid = validation(path);
				errorMessage.setText(valid.error);
				if (valid.valid) 
				{
					errorMessage.setText("");
					setSafe(value.replaceAll("\"", ""));
					await SettingsPage.saveSettings();
				}

				if (onChanged) onChanged(path);
			});
	});

	let browseButtonEl = undefined;
	if(browseButton)
	{
		fileInput.addButton((button) =>
		{
			browseButtonEl = button.buttonEl;
			button.setButtonText(i18n.browse).onClick(async () => 
			{
				let path = pickFolder ? await FileDialogs.showSelectFolderDialog(defaultPath) : await FileDialogs.showSelectFileDialog(defaultPath);
				
				if (!path) return;
				
				if (makeRelativeToVault)
					path = Path.getRelativePathFromVault(path, true);

				path.makePlatformSafe();

				const valid = validation(path);
				errorMessage.setText(valid.error);
				if (valid.valid)
				{
					setSafe(path.path);
					await SettingsPage.saveSettings();
					textInput?.setValue(path.path);
				}
				
				if (onChanged) onChanged(path);
				// textInput?.onChanged();
			});
		});
	}

	container.appendChild(errorMessage);

	return {fileInput: fileInput, textInput: textEl!, browseButton: browseButtonEl};
}

export function createSection(container: HTMLElement, name: string, desc: string): HTMLElement
{
	return createSectionGetSettings(container, name, desc).section
}

export function createSectionGetSettings(container: HTMLElement, name: string, desc: string): {section: HTMLElement, sectionSetting: Setting}
{
	const section = container.createEl('details');
	section.classList.add('settings-section');
	const summary = section.createEl('summary');
	summary.prepend(getIcon("chevron-right") as SVGElement);


	const setting = new Setting(summary)
		.setName(name)
		.setDesc(desc)
		.setHeading()

	return {section: section, sectionSetting: setting}
}

export function generateSettingsFromObject(obj: any, container: HTMLElement)
{
	for (const key in obj)
	{
		const value = obj[key];
		const type = typeof value;
		const settinginfo: FeatureSettingInfo = obj["info_" + key];
		
		if (!settinginfo)
		{
			continue;
		}

		if (settinginfo.show === false) continue;

		let description = settinginfo.description || "";
				
		let name = settinginfo.name;
		if (!name || name == "")
		{
			name = key;
			// convert name from camel case to sentence case
			name = name.replace(/([A-Z][a-z0-9])/gm, " $1").toLowerCase();
			name = name.charAt(0).toUpperCase() + name.substring(1)
		}
		
		if (settinginfo.dropdownOptions)
		{
			createDropdown(container, name, () => value, (v) => obj[key] = v, settinginfo.dropdownOptions, description);
			continue;
		}

		if (settinginfo.fileInputOptions)
		{
			createFileInput(container, () => value, (v: string) => obj[key] = v,
			{
				name: name,
				description: description,
				placeholder: settinginfo.placeholder,
				defaultPath: new Path(settinginfo.fileInputOptions.defaultPath ?? Path.vaultPath.path),
				makeRelativeToVault: settinginfo.fileInputOptions?.makeRelativeToVault,
				pickFolder: settinginfo.fileInputOptions?.pickFolder,
				validation: (path: Path) => {return settinginfo.fileInputOptions?.validation ? (settinginfo.fileInputOptions?.validation(path.path) ?? {valid: true, isEmpty: false, error: ""}) : {valid: true, isEmpty: false, error: ""}},
				browseButton: settinginfo.fileInputOptions?.browseButton,
				onChanged: (path: Path) => {if(settinginfo.fileInputOptions?.onChanged) settinginfo.fileInputOptions?.onChanged(path.path)}
			});

			continue;
		}

		if (Array.isArray(value))
		{
			const {section, sectionSetting} = createSectionGetSettings(container, name, description + " (Array with length: " + value.length + ")");
	
			for (let i = 0; i < value.length; i++)
			{
				const type = typeof value[i];
				name = "Element " + (i + 1);
				description = "";
				switch (type)
				{
					case "boolean":
						createToggle(section, name, () => value[i], (v) => obj[key][i] = v, description);
						break;
					case "string":
						createText(section, name, () => value[i], (v) => obj[key][i] = v, description);
						break;
					case "number":
						createText(section, name, () => value[i].toString(), (v) => obj[key][i] = parseFloat(v), description);
						break;
					case "object":
						generateSettingsFromObject(value[i], createSection(section, name, description));
						break;
				}
			}

			
			sectionSetting.addExtraButton(button => button
				.setIcon("plus")
				.setTooltip("Add element")
				.onClick(() => 
				{
					setTimeout(() => section.setAttribute("open", "open"), 0);
					const prevItem = obj[key].length > 0 ? obj[key][obj[key].length - 1] : {};
					const copy = SettingsPage.deepCopy(prevItem);
					obj[key].push(copy);
					name = "Element " + (obj[key].length);
					description = "";
					generateSettingsFromObject(copy, createSection(section, name, description));
					SettingsPage.saveSettings();

					const descArr = sectionSetting.descEl.innerText.split("(");
					descArr[descArr.length - 1] = "Array with length: " + obj[key].length + ")";
					sectionSetting.descEl.innerText = descArr.join("(");
				}));

			sectionSetting.addExtraButton(button => button
				.setIcon("minus")
				.setTooltip("Remove element")
				.onClick(() => 
				{
					setTimeout(() => section.setAttribute("open", "open"), 0);
					if (obj[key].length <= 1) 
						return;

					obj[key].pop();
					section.children[section.children.length - 1].remove();
					SettingsPage.saveSettings();

					const descArr = sectionSetting.descEl.innerText.split("(");
					descArr[descArr.length - 1] = "Array with length: " + obj[key].length + ")";
					sectionSetting.descEl.innerText = descArr.join("(");
				}));


			continue;
		}

		switch (type)
		{
			case "boolean":
				createToggle(container, name, () => value, (v) => obj[key] = v, description);
				break;
			case "string":
				createText(container, name, () => value, (v) => obj[key] = v, description);
				break;
			case "number":
				createText(container, name, () => value.toString(), (v) => obj[key] = parseFloat(v), description);
				break;
			case "object":
				generateSettingsFromObject(value, createSection(container, name, description));
				break;
		}
	}
}

export function createFeatureSetting(container: HTMLElement, name: string, feature: FeatureOptions, desc: string, addSettings?: (container: HTMLElement) => void)
{
	let setting = new Setting(container).setName(name).setDesc(desc);

	setting.setDisabled(feature.unavailable);
	setting.setTooltip(feature.unavailable ? i18n.settings.unavailableSetting.format(Settings.exportPreset) : "", {delay: 0});
	
	if (!feature.alwaysEnabled)
	{
		setting.addToggle(toggle => 
		{
			toggle.setTooltip(feature.unavailable ? i18n.settings.unavailableSetting.format(Settings.exportPreset) : "", {delay: 0});
			toggle.setDisabled(feature.unavailable);
			toggle.setValue(feature.enabled)
			toggle.onChange((value) => 
			{
				feature.enabled = value;
				SettingsPage.saveSettings();
			});
		});
	}

	// Always add the settings button to maintain consistent spacing
	setting.addExtraButton(button => 
	{
		button.setIcon("settings");
		
		if (feature.hideSettingsButton)
		{
			// Make the button invisible and non-interactive but still take up space
			button.extraSettingsEl.style.opacity = "0";
			button.extraSettingsEl.style.pointerEvents = "none";
			button.extraSettingsEl.style.cursor = "default";
		}
		else
		{
			button.setTooltip(feature.unavailable ? i18n.settings.unavailableSetting.format(Settings.exportPreset) : "", {delay: 0});
			button.setDisabled(feature.unavailable);
			button.onClick(() => 
			{
				// create a modal with all the feature's properties as settings
				let modal = new Modal(app);
				let contentEl = modal.contentEl;
				modal.open()
				modal.setTitle(name);
				generateSettingsFromObject(feature, contentEl);
				if (addSettings) addSettings(contentEl);
			})
		}
	});
}
