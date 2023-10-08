import { __awaiter } from "tslib";
import { TextFileView } from 'obsidian';
import { Path } from './path';
import { RenderLog } from '../html-generation/render-log';
import { MainSettings } from 'scripts/settings/main-settings';
/* @ts-ignore */
const dialog = require('electron').remote.dialog;
export class Utils {
    static delay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => setTimeout(resolve, ms));
        });
    }
    static padStringBeggining(str, length, char) {
        return char.repeat(length - str.length) + str;
    }
    static sampleCSSColorHex(variable, testParentEl) {
        let testEl = document.createElement('div');
        testEl.style.setProperty('display', 'none');
        testEl.style.setProperty('color', 'var(' + variable + ')');
        testParentEl.appendChild(testEl);
        let col = getComputedStyle(testEl).color;
        let opacity = getComputedStyle(testEl).opacity;
        testEl.remove();
        function toColorObject(str) {
            var match = str.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
            return match ? {
                red: parseInt(match[1]),
                green: parseInt(match[2]),
                blue: parseInt(match[3]),
                alpha: 1
            } : null;
        }
        var color = toColorObject(col), alpha = parseFloat(opacity);
        return isNaN(alpha) && (alpha = 1),
            color ? {
                a: alpha * color.alpha,
                hex: Utils.padStringBeggining(color.red.toString(16), 2, "0") + Utils.padStringBeggining(color.green.toString(16), 2, "0") + Utils.padStringBeggining(color.blue.toString(16), 2, "0")
            } : {
                a: alpha,
                hex: "ffffff"
            };
    }
    ;
    static changeViewMode(view, modeName) {
        return __awaiter(this, void 0, void 0, function* () {
            /*@ts-ignore*/
            const mode = view.modes[modeName];
            /*@ts-ignore*/
            mode && (yield view.setMode(mode));
        });
    }
    ;
    static showSaveDialog(defaultPath, defaultFileName, showAllFilesOption = true) {
        return __awaiter(this, void 0, void 0, function* () {
            // get paths
            let absoluteDefaultPath = defaultPath.directory.absolute().joinString(defaultFileName);
            // add filters
            let filters = [{
                    name: Utils.trimStart(absoluteDefaultPath.extension, ".").toUpperCase() + " Files",
                    extensions: [Utils.trimStart(absoluteDefaultPath.extension, ".")]
                }];
            if (showAllFilesOption) {
                filters.push({
                    name: "All Files",
                    extensions: ["*"]
                });
            }
            // show picker
            let picker = yield dialog.showSaveDialog({
                defaultPath: absoluteDefaultPath.asString,
                filters: filters,
                properties: ["showOverwriteConfirmation"]
            });
            if (picker.canceled)
                return;
            let pickedPath = new Path(picker.filePath);
            MainSettings.settings.exportPath = pickedPath.asString;
            MainSettings.saveSettings();
            return pickedPath;
        });
    }
    static showSelectFolderDialog(defaultPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!defaultPath.exists)
                defaultPath = Path.vaultPath;
            // show picker
            let picker = yield dialog.showOpenDialog({
                defaultPath: defaultPath.directory.asString,
                properties: ["openDirectory"]
            });
            if (picker.canceled)
                return;
            let path = new Path(picker.filePaths[0]);
            MainSettings.settings.exportPath = path.directory.asString;
            MainSettings.saveSettings();
            return path;
        });
    }
    static showSelectFileDialog(defaultPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!defaultPath.exists)
                defaultPath = Path.vaultPath;
            // show picker
            let picker = yield dialog.showOpenDialog({
                defaultPath: defaultPath.directory.asString,
                properties: ["openFile"]
            });
            if (picker.canceled)
                return;
            let path = new Path(picker.filePaths[0]);
            return path;
        });
    }
    static idealDefaultPath() {
        let lastPath = new Path(MainSettings.settings.exportPath);
        if (lastPath.asString != "" && lastPath.exists) {
            return lastPath.directory;
        }
        return Path.vaultPath;
    }
    static downloadFiles(files, rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!rootPath.isAbsolute)
                throw new Error("folderPath must be absolute: " + rootPath.asString);
            RenderLog.progress(0, files.length, "Saving HTML files to disk", "...", "var(--color-green)");
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                try {
                    yield file.download(rootPath.directory);
                    RenderLog.progress(i + 1, files.length, "Saving HTML files to disk", "Saving: " + file.filename, "var(--color-green)");
                }
                catch (e) {
                    RenderLog.error(e.stack, "Could not save file: " + file.filename);
                    continue;
                }
            }
        });
    }
    //async function that awaits until a condition is met
    static waitUntil(condition, timeout = 1000, interval = 100) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let timer = 0;
                let intervalId = setInterval(() => {
                    if (condition()) {
                        clearInterval(intervalId);
                        resolve(true);
                    }
                    else {
                        timer += interval;
                        if (timer >= timeout) {
                            clearInterval(intervalId);
                            resolve(false);
                        }
                    }
                }, interval);
            });
        });
    }
    static getPluginIDs() {
        /*@ts-ignore*/
        let pluginsArray = Array.from(app.plugins.enabledPlugins.values());
        for (let i = 0; i < pluginsArray.length; i++) {
            /*@ts-ignore*/
            if (app.plugins.manifests[pluginsArray[i]] == undefined) {
                pluginsArray.splice(i, 1);
                i--;
            }
        }
        return pluginsArray;
    }
    static getPluginManifest(pluginID) {
        var _a;
        // @ts-ignore
        return (_a = app.plugins.manifests[pluginID]) !== null && _a !== void 0 ? _a : null;
    }
    static getActiveTextView() {
        let view = app.workspace.getActiveViewOfType(TextFileView);
        if (!view) {
            return null;
        }
        return view;
    }
    static trimEnd(inputString, trimString) {
        if (inputString.endsWith(trimString)) {
            return inputString.substring(0, inputString.length - trimString.length);
        }
        return inputString;
    }
    static trimStart(inputString, trimString) {
        if (inputString.startsWith(trimString)) {
            return inputString.substring(trimString.length);
        }
        return inputString;
    }
    static openPath(path) {
        return __awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            yield window.electron.remote.shell.openPath(path.asString);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFpQyxZQUFZLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDdkUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUM5QixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFMUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRTlELGdCQUFnQjtBQUNoQixNQUFNLE1BQU0sR0FBb0IsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFFbEUsTUFBTSxPQUFPLEtBQUs7SUFFakIsTUFBTSxDQUFPLEtBQUssQ0FBRSxFQUFVOztZQUU3QixPQUFPLElBQUksT0FBTyxDQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBRSxDQUFDO1FBQzFELENBQUM7S0FBQTtJQUVELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFXLEVBQUUsTUFBYyxFQUFFLElBQVk7UUFFbEUsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO0lBQy9DLENBQUM7SUFFRCxNQUFNLENBQUMsaUJBQWlCLENBQUMsUUFBZ0IsRUFBRSxZQUF5QjtRQUVuRSxJQUFJLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzNDLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM1QyxNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxHQUFHLFFBQVEsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUMzRCxZQUFZLENBQUMsV0FBVyxD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QU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQW1CLEVBQUUsVUFBa0I7UUFFdkQsSUFBSSxXQUFXLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxFQUN0QztZQUNDLE9BQU8sV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDaEQ7UUFFRCxPQUFPLFdBQVcsQ0FBQztJQUNwQixDQUFDO0lBRUQsTUFBTSxDQUFPLFFBQVEsQ0FBQyxJQUFVOztZQUUvQixhQUFhO1lBQ2IsTUFBTSxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1RCxDQUFDO0tBQUE7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7ICBNYXJrZG93blZpZXcsIFBsdWdpbk1hbmlmZXN0LCBUZXh0RmlsZVZpZXcgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCB7IFBhdGggfSBmcm9tICcuL3BhdGgnO1xyXG5pbXBvcnQgeyBSZW5kZXJMb2cgfSBmcm9tICcuLi9odG1sLWdlbmVyYXRpb24vcmVuZGVyLWxvZyc7XHJcbmltcG9ydCB7IERvd25sb2FkYWJsZSB9IGZyb20gJy4vZG93bmxvYWRhYmxlJztcclxuaW1wb3J0IHsgTWFpblNldHRpbmdzIH0gZnJvbSAnc2NyaXB0cy9zZXR0aW5ncy9tYWluLXNldHRpbmdzJztcclxuXHJcbi8qIEB0cy1pZ25vcmUgKi9cclxuY29uc3QgZGlhbG9nOiBFbGVjdHJvbi5EaWFsb2cgPSByZXF1aXJlKCdlbGVjdHJvbicpLnJlbW90ZS5kaWFsb2c7XHJcblxyXG5leHBvcnQgY2xhc3MgVXRpbHNcclxue1xyXG5cdHN0YXRpYyBhc3luYyBkZWxheSAobXM6IG51bWJlcilcclxuXHR7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoIHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykgKTtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBwYWRTdHJpbmdCZWdnaW5pbmcoc3RyOiBzdHJpbmcsIGxlbmd0aDogbnVtYmVyLCBjaGFyOiBzdHJpbmcpXHJcblx0e1xyXG5cdFx0cmV0dXJuIGNoYXIucmVwZWF0KGxlbmd0aCAtIHN0ci5sZW5ndGgpICsgc3RyO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIHNhbXBsZUNTU0NvbG9ySGV4KHZhcmlhYmxlOiBzdHJpbmcsIHRlc3RQYXJlbnRFbDogSFRNTEVsZW1lbnQpOiB7IGE6IG51bWJlciwgaGV4OiBzdHJpbmcgfVxyXG5cdHtcclxuXHRcdGxldCB0ZXN0RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHRcdHRlc3RFbC5zdHlsZS5zZXRQcm9wZXJ0eSgnZGlzcGxheScsICdub25lJyk7XHJcblx0XHR0ZXN0RWwuc3R5bGUuc2V0UHJvcGVydHkoJ2NvbG9yJywgJ3ZhcignICsgdmFyaWFibGUgKyAnKScpO1xyXG5cdFx0dGVzdFBhcmVudEVsLmFwcGVuZENoaWxkKHRlc3RFbCk7XHJcblxyXG5cdFx0bGV0IGNvbCA9IGdldENvbXB1dGVkU3R5bGUodGVzdEVsKS5jb2xvcjtcclxuXHRcdGxldCBvcGFjaXR5ID0gZ2V0Q29tcHV0ZWRTdHlsZSh0ZXN0RWwpLm9wYWNpdHk7XHJcblxyXG5cdFx0dGVzdEVsLnJlbW92ZSgpO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHRvQ29sb3JPYmplY3Qoc3RyOiBzdHJpbmcpXHJcblx0XHR7XHJcblx0XHRcdHZhciBtYXRjaCA9IHN0ci5tYXRjaCgvcmdiP1xcKChcXGQrKSxcXHMqKFxcZCspLFxccyooXFxkKylcXCkvKTtcclxuXHRcdFx0cmV0dXJuIG1hdGNoID8ge1xyXG5cdFx0XHRcdHJlZDogcGFyc2VJbnQobWF0Y2hbMV0pLFxyXG5cdFx0XHRcdGdyZWVuOiBwYXJzZUludChtYXRjaFsyXSksXHJcblx0XHRcdFx0Ymx1ZTogcGFyc2VJbnQobWF0Y2hbM10pLFxyXG5cdFx0XHRcdGFscGhhOiAxXHJcblx0XHRcdH0gOiBudWxsXHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNvbG9yID0gdG9Db2xvck9iamVjdChjb2wpLCBhbHBoYSA9IHBhcnNlRmxvYXQob3BhY2l0eSk7XHJcblx0XHRyZXR1cm4gaXNOYU4oYWxwaGEpICYmIChhbHBoYSA9IDEpLFxyXG5cdFx0Y29sb3IgPyB7XHJcblx0XHRcdGE6IGFscGhhICogY29sb3IuYWxwaGEsXHJcblx0XHRcdGhleDogVXRpbHMucGFkU3RyaW5nQmVnZ2luaW5nKGNvbG9yLnJlZC50b1N0cmluZygxNiksIDIsIFwiMFwiKSArIFV0aWxzLnBhZFN0cmluZ0JlZ2dpbmluZyhjb2xvci5ncmVlbi50b1N0cmluZygxNiksIDIsIFwiMFwiKSArIFV0aWxzLnBhZFN0cmluZ0JlZ2dpbmluZyhjb2xvci5ibHVlLnRvU3RyaW5nKDE2KSwgMiwgXCIwXCIpXHJcblx0XHR9IDoge1xyXG5cdFx0XHRhOiBhbHBoYSxcclxuXHRcdFx0aGV4OiBcImZmZmZmZlwiXHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0c3RhdGljIGFzeW5jIGNoYW5nZVZpZXdNb2RlKHZpZXc6IE1hcmtkb3duVmlldywgbW9kZU5hbWU6IFwicHJldmlld1wiIHwgXCJzb3VyY2VcIilcclxuXHR7XHJcblx0XHQvKkB0cy1pZ25vcmUqL1xyXG5cdFx0Y29uc3QgbW9kZSA9IHZpZXcubW9kZXNbbW9kZU5hbWVdOyBcclxuXHRcdC8qQHRzLWlnbm9yZSovXHJcblx0XHRtb2RlICYmIGF3YWl0IHZpZXcuc2V0TW9kZShtb2RlKTtcclxuXHR9O1xyXG5cclxuXHRzdGF0aWMgYXN5bmMgc2hvd1NhdmVEaWFsb2coZGVmYXVsdFBhdGg6IFBhdGgsIGRlZmF1bHRGaWxlTmFtZTogc3RyaW5nLCBzaG93QWxsRmlsZXNPcHRpb246IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxQYXRoIHwgdW5kZWZpbmVkPlxyXG5cdHtcclxuXHRcdC8vIGdldCBwYXRoc1xyXG5cdFx0bGV0IGFic29sdXRlRGVmYXVsdFBhdGggPSBkZWZhdWx0UGF0aC5kaXJlY3RvcnkuYWJzb2x1dGUoKS5qb2luU3RyaW5nKGRlZmF1bHRGaWxlTmFtZSk7XHJcblx0XHRcclxuXHRcdC8vIGFkZCBmaWx0ZXJzXHJcblx0XHRsZXQgZmlsdGVycyA9IFt7XHJcblx0XHRcdG5hbWU6IFV0aWxzLnRyaW1TdGFydChhYnNvbHV0ZURlZmF1bHRQYXRoLmV4dGVuc2lvbiwgXCIuXCIpLnRvVXBwZXJDYXNlKCkgKyBcIiBGaWxlc1wiLFxyXG5cdFx0XHRleHRlbnNpb25zOiBbVXRpbHMudHJpbVN0YXJ0KGFic29sdXRlRGVmYXVsdFBhdGguZXh0ZW5zaW9uLCBcIi5cIildXHJcblx0XHR9XTtcclxuXHJcblx0XHRpZiAoc2hvd0FsbEZpbGVzT3B0aW9uKVxyXG5cdFx0e1xyXG5cdFx0XHRmaWx0ZXJzLnB1c2goe1xyXG5cdFx0XHRcdG5hbWU6IFwiQWxsIEZpbGVzXCIsXHJcblx0XHRcdFx0ZXh0ZW5zaW9uczogW1wiKlwiXVxyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBzaG93IHBpY2tlclxyXG5cdFx0bGV0IHBpY2tlciA9IGF3YWl0IGRpYWxvZy5zaG93U2F2ZURpYWxvZyh7XHJcblx0XHRcdGRlZmF1bHRQYXRoOiBhYnNvbHV0ZURlZmF1bHRQYXRoLmFzU3RyaW5nLFxyXG5cdFx0XHRmaWx0ZXJzOiBmaWx0ZXJzLFxyXG5cdFx0XHRwcm9wZXJ0aWVzOiBbXCJzaG93T3ZlcndyaXRlQ29uZmlybWF0aW9uXCJdXHJcblx0XHR9KVxyXG5cclxuXHRcdGlmIChwaWNrZXIuY2FuY2VsZWQpIHJldHVybjtcclxuXHRcdFxyXG5cdFx0bGV0IHBpY2tlZFBhdGggPSBuZXcgUGF0aChwaWNrZXIuZmlsZVBhdGgpO1xyXG5cdFx0TWFpblNldHRpbmdzLnNldHRpbmdzLmV4cG9ydFBhdGggPSBwaWNrZWRQYXRoLmFzU3RyaW5nO1xyXG5cdFx0TWFpblNldHRpbmdzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gcGlja2VkUGF0aDtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBhc3luYyBzaG93U2VsZWN0Rm9sZGVyRGlhbG9nKGRlZmF1bHRQYXRoOiBQYXRoKTogUHJvbWlzZTxQYXRoIHwgdW5kZWZpbmVkPlxyXG5cdHtcclxuXHRcdGlmKCFkZWZhdWx0UGF0aC5leGlzdHMpIGRlZmF1bHRQYXRoID0gUGF0aC52YXVsdFBhdGg7XHJcblxyXG5cdFx0Ly8gc2hvdyBwaWNrZXJcclxuXHRcdGxldCBwaWNrZXIgPSBhd2FpdCBkaWFsb2cuc2hvd09wZW5EaWFsb2coe1xyXG5cdFx0XHRkZWZhdWx0UGF0aDogZGVmYXVsdFBhdGguZGlyZWN0b3J5LmFzU3RyaW5nLFxyXG5cdFx0XHRwcm9wZXJ0aWVzOiBbXCJvcGVuRGlyZWN0b3J5XCJdXHJcblx0XHR9KTtcclxuXHJcblx0XHRpZiAocGlja2VyLmNhbmNlbGVkKSByZXR1cm47XHJcblxyXG5cdFx0bGV0IHBhdGggPSBuZXcgUGF0aChwaWNrZXIuZmlsZVBhdGhzWzBdKTtcclxuXHRcdE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQYXRoID0gcGF0aC5kaXJlY3RvcnkuYXNTdHJpbmc7XHJcblx0XHRNYWluU2V0dGluZ3Muc2F2ZVNldHRpbmdzKCk7XHJcblxyXG5cdFx0cmV0dXJuIHBhdGg7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgYXN5bmMgc2hvd1NlbGVjdEZpbGVEaWFsb2coZGVmYXVsdFBhdGg6IFBhdGgpOiBQcm9taXNlPFBhdGggfCB1bmRlZmluZWQ+XHJcblx0e1xyXG5cdFx0aWYoIWRlZmF1bHRQYXRoLmV4aXN0cykgZGVmYXVsdFBhdGggPSBQYXRoLnZhdWx0UGF0aDtcclxuXHJcblx0XHQvLyBzaG93IHBpY2tlclxyXG5cdFx0bGV0IHBpY2tlciA9IGF3YWl0IGRpYWxvZy5zaG93T3BlbkRpYWxvZyh7XHJcblx0XHRcdGRlZmF1bHRQYXRoOiBkZWZhdWx0UGF0aC5kaXJlY3RvcnkuYXNTdHJpbmcsXHJcblx0XHRcdHByb3BlcnRpZXM6IFtcIm9wZW5GaWxlXCJdXHJcblx0XHR9KTtcclxuXHJcblx0XHRpZiAocGlja2VyLmNhbmNlbGVkKSByZXR1cm47XHJcblxyXG5cdFx0bGV0IHBhdGggPSBuZXcgUGF0aChwaWNrZXIuZmlsZVBhdGhzWzBdKTtcclxuXHRcdHJldHVybiBwYXRoO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGlkZWFsRGVmYXVsdFBhdGgoKSA6IFBhdGhcclxuXHR7XHJcblx0XHRsZXQgbGFzdFBhdGggPSBuZXcgUGF0aChNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UGF0aCk7XHJcblxyXG5cdFx0aWYgKGxhc3RQYXRoLmFzU3RyaW5nICE9IFwiXCIgJiYgbGFzdFBhdGguZXhpc3RzKVxyXG5cdFx0e1xyXG5cdFx0XHRyZXR1cm4gbGFzdFBhdGguZGlyZWN0b3J5O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBQYXRoLnZhdWx0UGF0aDtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBhc3luYyBkb3dubG9hZEZpbGVzKGZpbGVzOiBEb3dubG9hZGFibGVbXSwgcm9vdFBhdGg6IFBhdGgpXHJcblx0e1xyXG5cdFx0aWYgKCFyb290UGF0aC5pc0Fic29sdXRlKSB0aHJvdyBuZXcgRXJyb3IoXCJmb2xkZXJQYXRoIG11c3QgYmUgYWJzb2x1dGU6IFwiICsgcm9vdFBhdGguYXNTdHJpbmcpO1xyXG5cclxuXHRcdFJlbmRlckxvZy5wcm9ncmVzcygwLCBmaWxlcy5sZW5ndGgsIFwiU2F2aW5nIEhUTUwgZmlsZXMgdG8gZGlza1wiLCBcIi4uLlwiLCBcInZhcigtLWNvbG9yLWdyZWVuKVwiKVxyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgZmlsZSA9IGZpbGVzW2ldO1xyXG5cclxuXHRcdFx0dHJ5XHJcblx0XHRcdHtcclxuXHRcdFx0XHRhd2FpdCBmaWxlLmRvd25sb2FkKHJvb3RQYXRoLmRpcmVjdG9yeSk7XHJcblx0XHRcdFx0UmVuZGVyTG9nLnByb2dyZXNzKGkrMSwgZmlsZXMubGVuZ3RoLCBcIlNhdmluZyBIVE1MIGZpbGVzIHRvIGRpc2tcIiwgXCJTYXZpbmc6IFwiICsgZmlsZS5maWxlbmFtZSwgXCJ2YXIoLS1jb2xvci1ncmVlbilcIik7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2F0Y2ggKGUpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRSZW5kZXJMb2cuZXJyb3IoZS5zdGFjaywgXCJDb3VsZCBub3Qgc2F2ZSBmaWxlOiBcIiArIGZpbGUuZmlsZW5hbWUpO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRcclxuXHR9XHJcblxyXG5cdC8vYXN5bmMgZnVuY3Rpb24gdGhhdCBhd2FpdHMgdW50aWwgYSBjb25kaXRpb24gaXMgbWV0XHJcblx0c3RhdGljIGFzeW5jIHdhaXRVbnRpbChjb25kaXRpb246ICgpID0+IGJvb2xlYW4sIHRpbWVvdXQ6IG51bWJlciA9IDEwMDAsIGludGVydmFsOiBudW1iZXIgPSAxMDApOiBQcm9taXNlPGJvb2xlYW4+XHJcblx0e1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0bGV0IHRpbWVyID0gMDtcclxuXHRcdFx0bGV0IGludGVydmFsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcblx0XHRcdFx0aWYgKGNvbmRpdGlvbigpKSB7XHJcblx0XHRcdFx0XHRjbGVhckludGVydmFsKGludGVydmFsSWQpO1xyXG5cdFx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGltZXIgKz0gaW50ZXJ2YWw7XHJcblx0XHRcdFx0XHRpZiAodGltZXIgPj0gdGltZW91dCkge1xyXG5cdFx0XHRcdFx0XHRjbGVhckludGVydmFsKGludGVydmFsSWQpO1xyXG5cdFx0XHRcdFx0XHRyZXNvbHZlKGZhbHNlKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIGludGVydmFsKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGdldFBsdWdpbklEcygpOiBzdHJpbmdbXVxyXG5cdHtcclxuXHRcdC8qQHRzLWlnbm9yZSovXHJcblx0XHRsZXQgcGx1Z2luc0FycmF5OiBzdHJpbmdbXSA9IEFycmF5LmZyb20oYXBwLnBsdWdpbnMuZW5hYmxlZFBsdWdpbnMudmFsdWVzKCkpIGFzIHN0cmluZ1tdO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBwbHVnaW5zQXJyYXkubGVuZ3RoOyBpKyspXHJcblx0XHR7XHJcblx0XHRcdC8qQHRzLWlnbm9yZSovXHJcblx0XHRcdGlmIChhcHAucGx1Z2lucy5tYW5pZmVzdHNbcGx1Z2luc0FycmF5W2ldXSA9PSB1bmRlZmluZWQpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRwbHVnaW5zQXJyYXkuc3BsaWNlKGksIDEpO1xyXG5cdFx0XHRcdGktLTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwbHVnaW5zQXJyYXk7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgZ2V0UGx1Z2luTWFuaWZlc3QocGx1Z2luSUQ6IHN0cmluZyk6IFBsdWdpbk1hbmlmZXN0IHwgbnVsbFxyXG5cdHtcclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdHJldHVybiBhcHAucGx1Z2lucy5tYW5pZmVzdHNbcGx1Z2luSURdID8/IG51bGw7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgZ2V0QWN0aXZlVGV4dFZpZXcoKTogVGV4dEZpbGVWaWV3IHwgbnVsbFxyXG5cdHtcclxuXHRcdGxldCB2aWV3ID0gYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKFRleHRGaWxlVmlldyk7XHJcblx0XHRpZiAoIXZpZXcpXHJcblx0XHR7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB2aWV3O1xyXG5cdH1cclxuXHJcblx0c3RhdGljIHRyaW1FbmQoaW5wdXRTdHJpbmc6IHN0cmluZywgdHJpbVN0cmluZzogc3RyaW5nKTogc3RyaW5nXHJcblx0e1xyXG5cdFx0aWYgKGlucHV0U3RyaW5nLmVuZHNXaXRoKHRyaW1TdHJpbmcpKVxyXG5cdFx0e1xyXG5cdFx0XHRyZXR1cm4gaW5wdXRTdHJpbmcuc3Vic3RyaW5nKDAsIGlucHV0U3RyaW5nLmxlbmd0aCAtIHRyaW1TdHJpbmcubGVuZ3RoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaW5wdXRTdHJpbmc7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgdHJpbVN0YXJ0KGlucHV0U3RyaW5nOiBzdHJpbmcsIHRyaW1TdHJpbmc6IHN0cmluZyk6IHN0cmluZ1xyXG5cdHtcclxuXHRcdGlmIChpbnB1dFN0cmluZy5zdGFydHNXaXRoKHRyaW1TdHJpbmcpKVxyXG5cdFx0e1xyXG5cdFx0XHRyZXR1cm4gaW5wdXRTdHJpbmcuc3Vic3RyaW5nKHRyaW1TdHJpbmcubGVuZ3RoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaW5wdXRTdHJpbmc7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgYXN5bmMgb3BlblBhdGgocGF0aDogUGF0aClcclxuXHR7XHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRhd2FpdCB3aW5kb3cuZWxlY3Ryb24ucmVtb3RlLnNoZWxsLm9wZW5QYXRoKHBhdGguYXNTdHJpbmcpO1xyXG5cdH1cclxufVxyXG4iXX0=