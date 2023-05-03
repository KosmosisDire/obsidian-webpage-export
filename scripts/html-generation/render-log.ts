import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "./markdown-renderer";

export namespace RenderLog
{
    export function log(messageTitle: string, message: string)
    {
        MarkdownRenderer._reportInfo(messageTitle, message);
        console.log(messageTitle + ": \n" + message);
        pullPathLogs();
    }

    export function warning(messageTitle: string, message: string)
    {
        MarkdownRenderer._reportWarning(messageTitle, message);
        console.warn(messageTitle + ": \n" + message);
        pullPathLogs();
    }

    export function error(messageTitle: string, message: string, fatal: boolean = true)
    {
        MarkdownRenderer._reportError(messageTitle, message, fatal);
        console.error(messageTitle + ": \n" + message);
        pullPathLogs();
    }

    export function progress(complete: number, total:number, message: string, subMessage: string, progressColor: string = "var(--color-accent)")
    {
        MarkdownRenderer._reportProgress(complete, total, message, subMessage, progressColor);
        pullPathLogs();
    }

    function pullPathLogs()
    {
        let logs = Path.dequeueLog();
        for (let thisLog of logs)
        {
            switch (thisLog.type)
            {
                case "info":
                    log(thisLog.title, thisLog.message);
                    break;
                case "warn":
                    warning(thisLog.title, thisLog.message);
                    break;
                case "error":
                    error(thisLog.title, thisLog.message, false);
                    break;
                case "fatal":
                    error(thisLog.title, thisLog.message, true);
                    break;
            }
        }
    }
}