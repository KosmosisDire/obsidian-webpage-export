import { Path } from "scripts/utils/path";
import { MarkdownRenderer } from "./markdown-renderer";

export namespace RenderLog
{
    export function log(messageTitle: string, message: string)
    {
        pullPathLogs();
        console.log(messageTitle + ": \n" + message);
        MarkdownRenderer._reportInfo(messageTitle, message);
    }

    export function warning(messageTitle: string, message: string)
    {
        pullPathLogs();
        console.warn(messageTitle + ": \n" + message);
        MarkdownRenderer._reportWarning(messageTitle, message);
    }

    export function error(messageTitle: string, message: string, fatal: boolean = false)
    {
        pullPathLogs();
        console.error(messageTitle + ": \n" + message);
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

    export function testThrowError(chance: number)
    {
        if (Math.random() < chance)
        {
            throw new Error("Test error");
        }
    }
}