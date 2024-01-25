import HTMLExportPlugin from "scripts/main"
import { DEFAULT_SETTINGS, Settings } from "./settings"
import { RenderLog } from "scripts/html-generation/render-log";


export async function migrateSettings()
{
	if (Settings.settings.settingsVersion == HTMLExportPlugin.pluginVersion) return;

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
		var savedSettings = JSON.parse(JSON.stringify(Settings.settings));
		Settings.settings = DEFAULT_SETTINGS;
		for (var i = 0; i < settingsToSave.length; i++)
		{
			var settingName = settingsToSave[i]; 
			// @ts-ignore
			Settings.settings[settingName] = savedSettings[settingName];
		}

		Settings.settings.settingsVersion = HTMLExportPlugin.pluginVersion;
	}
	catch (e)
	{
		RenderLog.error(e, "Failed to migrate settings, resetting to default settings.");
		Settings.settings = DEFAULT_SETTINGS;
	}

	await Settings.saveSettings();

	return;
}
