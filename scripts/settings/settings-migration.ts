import HTMLExportPlugin from "scripts/main"
import { DEFAULT_SETTINGS, MainSettings } from "./main-settings"
import { RenderLog } from "scripts/html-generation/render-log";


export async function migrateSettings()
{
	if (MainSettings.settings.settingsVersion == HTMLExportPlugin.pluginVersion) return;

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

	var savedSettings = JSON.parse(JSON.stringify(MainSettings.settings));
	MainSettings.settings = DEFAULT_SETTINGS;
	for (var i = 0; i < settingsToSave.length; i++)
	{
		var settingName = settingsToSave[i];
		// @ts-ignore
		MainSettings.settings[settingName] = savedSettings[settingName];
		// @ts-ignore
		console.log(settingName, MainSettings.settings[settingName]);
	}

	MainSettings.settings.settingsVersion = HTMLExportPlugin.pluginVersion;

	await MainSettings.saveSettings();

	return;
}
