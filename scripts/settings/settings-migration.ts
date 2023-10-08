import HTMLExportPlugin from "scripts/main"
import { MainSettings, MainSettingsData } from "./main-settings"
import { RenderLog } from "scripts/html-generation/render-log";


export async function migrateSettings(settings: MainSettingsData)
{
    if (settings.settingsVersion == HTMLExportPlugin.pluginVersion) return;

    if ((settings.settingsVersion == "1.7.3" || settings.settingsVersion == "0.0.0") && HTMLExportPlugin.pluginVersion == "1.7.4")
    {
        settings.incrementalExport = false;
        settings.deleteOldExportedFiles = false;
    }

    RenderLog.log("Migrating webpage-html-export settings from " + settings.settingsVersion + " to " + HTMLExportPlugin.pluginVersion);
    settings.upgradedFrom = settings.settingsVersion;
    settings.settingsVersion = HTMLExportPlugin.pluginVersion;

    await MainSettings.saveSettings();
}