import { Modal, Setting, TextComponent } from "obsidian";
import { SettingsPage } from "./settings";
import { Path } from "plugin/utils/path";
import { FileDialogs } from "plugin/utils/file-dialogs";
import { FeatureOptions } from "shared/website-data";
import { descriptions as settingDescriptions } from "./setting-descriptions";

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
	const setting = new Setting(container);
	setting.setName(name)
	if (desc != "") setting.setDesc(desc);
	setting.addDropdown((dropdown) => dropdown
		.addOptions(options)
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

export function createFileInput(container: HTMLElement, get: () => string, set: (value: string) => void, options?: {name?: string, description?: string, placeholder?: string, defaultPath?: Path, pickFolder?: boolean, validation?: (path: Path) => {valid: boolean, isEmpty: boolean, error: string}, browseButton?: boolean, onChanged?: (path: Path)=>void}): {fileInput: Setting, textInput: TextComponent, browseButton: HTMLElement | undefined}
{
	const getSafe = () => new Path(get() ?? "").makePlatformSafe();
	const setSafe = (value: string) => set(new Path(value).makePlatformSafe().path);

	const name = options?.name ?? "";
	const description = options?.description ?? "";
	const placeholder = options?.placeholder ?? "Path to file...";
	const defaultPath = options?.defaultPath ?? Path.vaultPath;
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
			button.setButtonText('Browse').onClick(async () => 
			{
				const path = pickFolder ? await FileDialogs.showSelectFolderDialog(defaultPath) : await FileDialogs.showSelectFileDialog(defaultPath);
				if (!path) return;
				
				setSafe(path.path);
				const valid = validation(path);
				errorMessage.setText(valid.error);
				if (valid.valid)
				{
					await SettingsPage.saveSettings();
				}

				textInput?.setValue(getSafe().path);
				
				if (onChanged) onChanged(path);
				textInput?.onChanged();
			});
		});
	}

	container.appendChild(errorMessage);

	return {fileInput: fileInput, textInput: textEl!, browseButton: browseButtonEl};
}

export function createSection(container: HTMLElement, name: string, desc: string): HTMLElement
{
	const section = container.createEl('details');
	const summary = section.createEl('summary');
	summary.style.display = "block";
	summary.style.marginLeft = "-1em";
	section.style.paddingLeft = "2em";
	section.style.borderLeft = "1px solid var(--interactive-accent)";

	new Setting(summary)
		.setName(name)
		.setDesc(desc)
		.setHeading()

	return section;
}

export function generateSettingsFromObject(obj: any, container: HTMLElement, pullDescription: boolean = true)
{
	for (const key in obj)
	{
		const value = obj[key];
		const type = typeof value;

		let description = "no description";
		if (pullDescription)
		{
			const desc = settingDescriptions[key];
			if (desc) description = desc;
			else 
			{
				console.warn(`No description found for setting, ${key}`);
			}
		}
		
		let name = key;
		if (name == "enabled" || name == "includePath" || name == "parentSelector") continue;

		// convert name from camel case to sentence case
		name = name.replace(/([A-Z][a-z0-9])/gm, " $1").toLowerCase();
		name = name.charAt(0).toUpperCase() + name.substring(1)

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
				this.generateSettingsFromObject(value, createSection(container, name, description), pullDescription);
				break;
		}
	}
}

export function createFeatureSetting(container: HTMLElement, name: string, feature: FeatureOptions, desc: string)
{
	new Setting(container).setName(name).setDesc(desc)
		.addToggle(toggle => 
		{
			toggle.setValue(feature.enabled)
			toggle.onChange((value) => 
			{
				feature.enabled = value;
				SettingsPage.saveSettings();
			});
		})
		.addExtraButton(button => 
			{
				button.setIcon("settings")
				button.onClick(() => 
				{
					// create a modal with all the feature's properties as settings
					let modal = new Modal(app);
					let contentEl = modal.contentEl;
					modal.open()
					contentEl.createEl("h2", {text: name});
					generateSettingsFromObject(feature, contentEl);
				})
			}
		)
}
