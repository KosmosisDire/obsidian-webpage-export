import HTMLExportPlugin from "plugin/main"
import { DEFAULT_SETTINGS, Settings, SettingsPage } from "./settings"
import { ExportLog } from "plugin/render-api/render-api";
import { Notice } from "obsidian";


export async function migrateSettings()
{
	if (Settings.settingsVersion == HTMLExportPlugin.pluginVersion) return;

	new Notice("Webpage HTML Export settings have been updated to a new version. Please check your settings in case any have been reset.", 0);

	try
	{
		const validSettings = Object.keys(DEFAULT_SETTINGS);

		const savedSettings = JSON.parse(JSON.stringify(Object.assign({}, Settings)));
		Object.assign(Settings, DEFAULT_SETTINGS);
		for (const settingName of validSettings)
		{
			const savedSetting = savedSettings[settingName];
			// @ts-ignore
			Settings[settingName] = savedSetting === undefined ? DEFAULT_SETTINGS[settingName] : savedSetting;
 
			if (savedSettings[settingName] === undefined)
			{
				new Notice(`Reset ${settingName} to default value.`, 0);
			}
		}

		Settings.settingsVersion = HTMLExportPlugin.pluginVersion;
	}
	catch (e)
	{
		ExportLog.error(e, "Failed to migrate settings, resetting to default settings.");
		new Notice("⚠️ Failed to migrate Webpage HTML Export settings, resetting to default settings!", 0);
		Object.assign(Settings, DEFAULT_SETTINGS);
	}

	// reapply export preset
	switch (Settings.exportPreset)
	{
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

	await SettingsPage.saveSettings();
}
