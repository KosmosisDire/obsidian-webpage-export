import { Path } from "scripts/utils/path";
import { _MarkdownRendererInternal } from "scripts/render-api";
import { Settings, SettingsPage } from "scripts/settings/settings";

export namespace ExportLog
{
    export let fullLog: string = "";

    function logToString(message: any, title: string)
    {
        let messageString = (typeof message === "string") ? message : JSON.stringify(message).replaceAll("\n", "\n\t\t");
        let titleString = title != "" ? title + "\t" : "";
        let log = `${titleString}${messageString}\n`;
        return log;
    }

    function humanReadableJSON(object: any)
    {
        let string = JSON.stringify(object, null, 2).replaceAll(/\"|\{|\}|,/g, "").split("\n").map((s) => s.trim()).join("\n\t");
        // make the properties into a table
        let lines = string.split("\n");
        lines = lines.filter((line) => line.contains(":"));
        let names = lines.map((line) => line.split(":")[0] + " ");
        let values = lines.map((line) => line.split(":").slice(1).join(":"));
        let maxLength = Math.max(...names.map((name) => name.length)) + 3;
        let table = "";
        for (let i = 0; i < names.length; i++)
        {
            let padString = i % 2 == 0 ? "-" : " ";
            table += `${names[i].padEnd(maxLength, padString)}${values[i]}\n`;
        }

        return table;
    }

    export function log(message: any, messageTitle: string = "")
    {
        pullPathLogs();

        messageTitle = `[INFO] ${messageTitle}`
        fullLog += logToString(message, messageTitle);

		if(SettingsPage.loaded && !(Settings.logLevel == "all")) return;

        if (messageTitle != "") console.log(messageTitle + " ", message);
        else console.log(message);
        _MarkdownRendererInternal._reportInfo(messageTitle, message);
    }

    export function warning(message: any, messageTitle: string = "")
    {
        pullPathLogs();

        messageTitle = `[WARNING] ${messageTitle}`
        fullLog += logToString(message, messageTitle);

		if(SettingsPage.loaded && !["warning", "all"].contains(Settings.logLevel)) return;

        if (messageTitle != "") console.warn(messageTitle + " ", message);
        else console.warn(message);
        _MarkdownRendererInternal._reportWarning(messageTitle, message);
    }

    export function error(message: any, messageTitle: string = "", fatal: boolean = false)
    {
        pullPathLogs();

        messageTitle = (fatal ? "[FATAL ERROR] " : "[ERROR] ") + messageTitle;
        fullLog += logToString(message, messageTitle);

        if (SettingsPage.loaded && !fatal && !["error", "warning", "all"].contains(Settings.logLevel)) return;
		
        if (fatal && messageTitle == "Error") messageTitle = "Fatal Error";

        if (messageTitle != "") console.error(messageTitle + " ", message);
        else console.error(message);

        _MarkdownRendererInternal._reportError(messageTitle, message, fatal);
    }

    export function progress(complete: number, total:number, message: string, subMessage: string, progressColor: string = "var(--interactive-accent)")
    {
        pullPathLogs();
		if (total == 0)
		{
			complete = 1;
			total = 1;
		}
        _MarkdownRendererInternal._reportProgress(complete, total, message, subMessage, progressColor);
    }

    function pullPathLogs()
    {
        let logs = Path.dequeueLog();
        for (let thisLog of logs)
        {
            switch (thisLog.type)
            {
                case "info":
                    log(thisLog.message, thisLog.title);
                    break;
                case "warn":
                    warning(thisLog.message, thisLog.title);
                    break;
                case "error":
                    error(thisLog.message, thisLog.title, false);
                    break;
                case "fatal":
                    error(thisLog.message, thisLog.title, true);
                    break;
            }
        }
    }

    export function getDebugInfo()
    {
        let debugInfo = "";

        debugInfo += `Log:\n${fullLog}\n\n`;

        let settingsCopy = Object.assign({}, Settings);
        //@ts-ignore
        settingsCopy.filesToExport = settingsCopy.filesToExport[0].length;
        settingsCopy.includePluginCSS = settingsCopy.includePluginCSS.split("\n").length + " plugins included";

        debugInfo += `Settings:\n${humanReadableJSON(settingsCopy)}\n\n`;

        // @ts-ignore
        let loadedPlugins = Object.values(app.plugins.plugins).filter((plugin) => plugin._loaded == true).map((plugin) => plugin.manifest.name).join("\n\t");
        debugInfo += `Enabled Plugins:\n\t${loadedPlugins}`;

        return debugInfo;
    }

    export function testThrowError(chance: number)
    {
        if (Math.random() < chance)
        {
            throw new Error("Test error");
        }
    }
}
