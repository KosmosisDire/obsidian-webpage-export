import HTMLExportPlugin from "scripts/main"
import { DEFAULT_SETTINGS, Settings, SettingsPage } from "./settings"
import { ExportLog } from "scripts/html-generation/render-log";
import { Notice } from "obsidian";


export async function migrateSettings()
{
	if (Settings.settingsVersion == HTMLExportPlugin.pluginVersion) return;

	new Notice("Webpage HTML Export settings have been updated to a new version. Please update your settings if any have been reset.", 10000);

	var settingsToSave = 
	[
		"filesToExport",
		"exportPath",
		"includePluginCSS",
		"includeGraphView",
		"graphMaxNodeSize",
		"graphMinNodeSize",
		"graphEdgePruning",
		"graphCentralForce",
		"graphRepulsionForce",
		"graphLinkLength",
		"graphAttractionForce",
	]

	try
	{
		var savedSettings = JSON.parse(JSON.stringify(Object.assign({}, Settings)));
		Object.assign(Settings, DEFAULT_SETTINGS);
		for (var i = 0; i < settingsToSave.length; i++)
		{
			var settingName = settingsToSave[i]; 
			// @ts-ignore
			Settings[settingName] = savedSettings[settingName];
		}

		Settings.settingsVersion = HTMLExportPlugin.pluginVersion;
	}
	catch (e)
	{
		ExportLog.error(e, "Failed to migrate settings, resetting to default settings.");
		Object.assign(Settings, DEFAULT_SETTINGS);
	}

	await SettingsPage.saveSettings();

	return;
}
