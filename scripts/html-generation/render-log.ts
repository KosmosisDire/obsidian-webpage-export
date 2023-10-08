import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "./markdown-renderer";
import { MainSettings } from "scripts/settings/main-settings";
import HTMLExportPlugin from "scripts/main";
import { Plugin } from "obsidian";

export namespace RenderLog
{
    export let fullLog: string = "";

    export function log(message: any, messageTitle: string = "")
    {
        pullPathLogs();
        fullLog += messageTitle + ": \n" + JSON.stringify(message).replaceAll("\n", "\n\t\t") + "\n\n";

		if(MainSettings.loaded && !(MainSettings.settings.logLevel == "all")) return;

        if (messageTitle != "") console.info(messageTitle + " ", message);
        else console.info(message);
        MarkdownRenderer._reportInfo(messageTitle, message);
    }

    export function warning(message: any, messageTitle: string = "")
    {
        pullPathLogs();
        fullLog += messageTitle + ": \n" + JSON.stringify(message).replaceAll("\n", "\n\t\t") + "\n\n";

		if(MainSettings.loaded && !["warning", "all"].contains(MainSettings.settings.logLevel)) return;

        if (messageTitle != "") console.warn(messageTitle + " ", message);
        else console.warn(message);
        MarkdownRenderer._reportWarning(messageTitle, message);
    }

    export function error(message: any, messageTitle: string = "", fatal: boolean = false)
    {
        pullPathLogs();
        fullLog += messageTitle + ": \n" + JSON.stringify(message).replaceAll("\n", "\n\t\t") + "\n\n";

        if (MainSettings.loaded && !fatal && !["error", "warning", "all"].contains(MainSettings.settings.logLevel)) return;
		
        if (fatal && messageTitle == "Error") messageTitle = "Fatal Error";

        if (messageTitle != "") console.error(messageTitle + " ", message);
        else console.error(message);

        MarkdownRenderer._reportError(messageTitle, message, fatal);
    }

    export function progress(complete: number, total:number, message: string, subMessage: string, progressColor: string = "var(--color-accent)")
    {
        pullPathLogs();
        MarkdownRenderer._reportProgress(complete, total, message, subMessage, progressColor);
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

    function getDebugInfo()
    {
        let debugInfo = "";

        debugInfo += `${fullLog}\n\n\n`;
        debugInfo += `Plugin Version: ${MainSettings.settings.settingsVersion}\n`;
        debugInfo += `Updated From: ${MainSettings.settings.upgradedFrom}\n`;
        debugInfo += `Settings:\n ${JSON.stringify(MainSettings.settings, null, 2).split("\n").join("\n\t\t")}\n\n`;

        // @ts-ignore
        let loadedPlugins = Object.values(app.plugins.plugins).filter((plugin) => plugin._loaded == true).map((plugin) => plugin.manifest.name).join("\n\t\t");
        debugInfo += `Enabled Plugins:\n ${loadedPlugins}\n\n`;

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
