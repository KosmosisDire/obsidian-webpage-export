import { __awaiter } from "tslib";
import { Notice } from "obsidian";
import { Path } from "./utils/path";
import { MainSettings } from "./settings/main-settings";
import { RenderLog } from "./html-generation/render-log";
import HTMLExportPlugin from "./main";
import { Utils } from "./utils/utils";
import { AssetHandler } from "./html-generation/asset-handler";
import { MarkdownRenderer } from "./html-generation/markdown-renderer";
import { promises as fs } from 'fs';
import { Website } from "./objects/website";
export class HTMLExporter {
    static export(usePreviousSettings = true, overrideFiles = undefined) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let info = yield MainSettings.updateSettings(usePreviousSettings, overrideFiles);
            if ((!info && !usePreviousSettings) || (info && info.canceled))
                return;
            let files = (_a = overrideFiles !== null && overrideFiles !== void 0 ? overrideFiles : info === null || info === void 0 ? void 0 : info.pickedFiles) !== null && _a !== void 0 ? _a : MainSettings.getFilesToExport();
            let exportPath = (_b = info === null || info === void 0 ? void 0 : info.exportPath) !== null && _b !== void 0 ? _b : new Path(MainSettings.settings.exportPath);
            let website = yield HTMLExporter.exportFiles(files, exportPath, true, MainSettings.settings.deleteOldExportedFiles);
            if (website) {
                new Notice("✅ Finished HTML Export:\n\n" + exportPath, 5000);
                if (MainSettings.settings.openAfterExport)
                    yield Utils.openPath(exportPath);
            }
        });
    }
    static exportFiles(files, destination, saveFiles, clearDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            var website = yield new Website().createWithFiles(files, destination);
            if (!website) {
                new Notice("❌ Export Cancelled", 5000);
                return;
            }
            if (clearDirectory && MainSettings.settings.exportPreset != "local")
                yield this.deleteNonExports(website.webpages, destination);
            if (saveFiles) {
                if (MainSettings.settings.exportPreset == "local") {
                    website.saveAsDatabase();
                    return website;
                }
                yield this.saveExports(website.webpages, destination);
            }
            MarkdownRenderer.endBatch();
            return website;
        });
    }
    static exportFolder(folder, rootExportPath, saveFiles, clearDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            let folderPath = new Path(folder.path);
            let allFiles = HTMLExportPlugin.plugin.app.vault.getFiles();
            let files = allFiles.filter((file) => new Path(file.path).directory.asString.startsWith(folderPath.asString));
            return yield this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
        });
    }
    static exportVault(rootExportPath, saveFiles, clearDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            let files = HTMLExportPlugin.plugin.app.vault.getFiles();
            return yield this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
        });
    }
    static saveExports(webpages, rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            let downloads = [];
            for (let i = 0; i < webpages.length; i++) {
                downloads.push(...webpages[i].downloads);
            }
            downloads.forEach((file) => {
                if (MainSettings.settings.makeNamesWebStyle) {
                    file.filename = Path.toWebStyle(file.filename);
                    file.relativeDownloadPath.makeWebStyle();
                }
            });
            downloads.push(...yield AssetHandler.getDownloads());
            downloads = downloads.filter((file, index) => downloads.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath && f.filename === file.filename) == index);
            yield Utils.downloadFiles(downloads, rootPath);
        });
    }
    static getAllFilesInFolderRecursive(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            let files = [];
            let folderFiles = yield fs.readdir(folder.asString);
            for (let i = 0; i < folderFiles.length; i++) {
                let file = folderFiles[i];
                let path = folder.joinString(file);
                RenderLog.progress(i, folderFiles.length, "Finding Old Files", "Searching: " + folder.asString, "var(--color-yellow)");
                if ((yield fs.stat(path.asString)).isDirectory()) {
                    files.push(...yield this.getAllFilesInFolderRecursive(path));
                }
                else {
                    files.push(path);
                }
            }
            return files;
        });
    }
    static getAllEmptyFoldersRecursive(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            let folders = [];
            let folderFiles = yield fs.readdir(folder.asString);
            for (let i = 0; i < folderFiles.length; i++) {
                let file = folderFiles[i];
                let path = folder.joinString(file);
                RenderLog.progress(i, folderFiles.length, "Finding Old Files", "Searching: " + folder.asString, "var(--color-yellow)");
                if ((yield fs.stat(path.asString)).isDirectory()) {
                    let subFolders = yield this.getAllEmptyFoldersRecursive(path);
                    if (subFolders.length == 0) {
                        let subFiles = yield fs.readdir(path.asString);
                        if (subFiles.length == 0)
                            folders.push(path);
                    }
                    else {
                        folders.push(...subFolders);
                    }
                }
            }
            return folders;
        });
    }
    static deleteNonExports(webpages, rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            // delete all files in root path that are not in exports
            let files = (yield this.getAllFilesInFolderRecursive(rootPath)).filter((file) => !file.makeUnixStyle().asString.contains(AssetHandler.mediaFolderName.makeUnixStyle().asString));
            RenderLog.log(files, "Deletion candidates");
            let toDelete = [];
            for (let i = 0; i < files.length; i++) {
                RenderLog.progress(i, files.length, "Finding Old Files", "Checking: " + files[i].asString, "var(--color-yellow)");
                let file = files[i];
                if (!webpages.find((exportedFile) => exportedFile.exportPathAbsolute.makeUnixStyle().asString == file.makeUnixStyle().asString)) {
                    for (let webpage of webpages) {
                        if (webpage.downloads.find((download) => download.relativeDownloadPath.makeUnixStyle().asString == file.makeUnixStyle().asString)) {
                            toDelete.push(file);
                            break;
                        }
                    }
                }
            }
            for (let i = 0; i < toDelete.length; i++) {
                let file = toDelete[i];
                RenderLog.progress(i, toDelete.length, "Deleting Old Files", "Deleting: " + file.asString, "var(--color-red)");
                yield fs.unlink(file.asString);
            }
            // delete all empty folders in root path
            let folders = (yield this.getAllEmptyFoldersRecursive(rootPath));
            for (let i = 0; i < folders.length; i++) {
                let folder = folders[i];
                RenderLog.progress(i, folders.length, "Deleting Empty Folders", "Deleting: " + folder.asString, "var(--color-purple)");
                yield fs.rmdir(folder.directory.asString);
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJleHBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFFLE1BQU0sRUFBa0IsTUFBTSxVQUFVLENBQUM7QUFFbEQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNwQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDeEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRXpELE9BQU8sZ0JBQWdCLE1BQU0sUUFBUSxDQUFDO0FBQ3RDLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDdEMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxRQUFRLElBQUksRUFBRSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3BDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUc1QyxNQUFNLE9BQU8sWUFBWTtJQUVqQixNQUFNLENBQU8sTUFBTSxDQUFDLHNCQUErQixJQUFJLEVBQUUsZ0JBQXFDLFNBQVM7OztZQUU3RyxJQUFJLElBQUksR0FBRyxNQUFNLFlBQVksQ0FBQyxjQUFjLENBQUMsbUJBQW1CLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDakYsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUFFLE9BQU87WUFFdkUsSUFBSSxLQUFLLEdBQUcsTUFBQSxhQUFhLGFBQWIsYUFBYSxjQUFiLGFBQWEsR0FBSSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsV0FBVyxtQ0FBSSxZQUFZLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZ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QUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBQy9HLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDL0I7WUFFRCx3Q0FBd0M7WUFDeEMsSUFBSSxPQUFPLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBRWpFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUN2QztnQkFDQyxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsd0JBQXdCLEVBQUUsWUFBWSxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUscUJBQXFCLENBQUMsQ0FBQztnQkFDdkgsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDMUM7UUFDRixDQUFDO0tBQUE7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5vdGljZSwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHsgV2VicGFnZSB9IGZyb20gXCIuL29iamVjdHMvd2VicGFnZVwiO1xyXG5pbXBvcnQgeyBQYXRoIH0gZnJvbSBcIi4vdXRpbHMvcGF0aFwiO1xyXG5pbXBvcnQgeyBNYWluU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5ncy9tYWluLXNldHRpbmdzXCI7XHJcbmltcG9ydCB7IFJlbmRlckxvZyB9IGZyb20gXCIuL2h0bWwtZ2VuZXJhdGlvbi9yZW5kZXItbG9nXCI7XHJcbmltcG9ydCB7IERvd25sb2FkYWJsZSB9IGZyb20gXCIuL3V0aWxzL2Rvd25sb2FkYWJsZVwiO1xyXG5pbXBvcnQgSFRNTEV4cG9ydFBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vdXRpbHMvdXRpbHNcIjtcclxuaW1wb3J0IHsgQXNzZXRIYW5kbGVyIH0gZnJvbSBcIi4vaHRtbC1nZW5lcmF0aW9uL2Fzc2V0LWhhbmRsZXJcIjtcclxuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gXCIuL2h0bWwtZ2VuZXJhdGlvbi9tYXJrZG93bi1yZW5kZXJlclwiO1xyXG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcclxuaW1wb3J0IHsgV2Vic2l0ZSB9IGZyb20gXCIuL29iamVjdHMvd2Vic2l0ZVwiO1xyXG5cclxuXHJcbmV4cG9ydCBjbGFzcyBIVE1MRXhwb3J0ZXJcclxue1xyXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgZXhwb3J0KHVzZVByZXZpb3VzU2V0dGluZ3M6IGJvb2xlYW4gPSB0cnVlLCBvdmVycmlkZUZpbGVzOiBURmlsZVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkKVxyXG5cdHtcclxuXHRcdGxldCBpbmZvID0gYXdhaXQgTWFpblNldHRpbmdzLnVwZGF0ZVNldHRpbmdzKHVzZVByZXZpb3VzU2V0dGluZ3MsIG92ZXJyaWRlRmlsZXMpO1xyXG5cdFx0aWYgKCghaW5mbyAmJiAhdXNlUHJldmlvdXNTZXR0aW5ncykgfHwgKGluZm8gJiYgaW5mby5jYW5jZWxlZCkpIHJldHVybjtcclxuXHJcblx0XHRsZXQgZmlsZXMgPSBvdmVycmlkZUZpbGVzID8/IGluZm8/LnBpY2tlZEZpbGVzID8/IE1haW5TZXR0aW5ncy5nZXRGaWxlc1RvRXhwb3J0KCk7XHJcblx0XHRsZXQgZXhwb3J0UGF0aCA9IGluZm8/LmV4cG9ydFBhdGggPz8gbmV3IFBhdGgoTWFpblNldHRpbmdzLnNldHRpbmdzLmV4cG9ydFBhdGgpO1xyXG5cclxuXHRcdGxldCB3ZWJzaXRlID0gYXdhaXQgSFRNTEV4cG9ydGVyLmV4cG9ydEZpbGVzKGZpbGVzLCBleHBvcnRQYXRoLCB0cnVlLCBNYWluU2V0dGluZ3Muc2V0dGluZ3MuZGVsZXRlT2xkRXhwb3J0ZWRGaWxlcyk7XHJcblx0XHRpZiAod2Vic2l0ZSlcclxuXHRcdHtcclxuXHRcdFx0bmV3IE5vdGljZShcIuKchSBGaW5pc2hlZCBIVE1MIEV4cG9ydDpcXG5cXG5cIiArIGV4cG9ydFBhdGgsIDUwMDApO1xyXG5cdFx0XHRpZiAoTWFpblNldHRpbmdzLnNldHRpbmdzLm9wZW5BZnRlckV4cG9ydCkgYXdhaXQgVXRpbHMub3BlblBhdGgoZXhwb3J0UGF0aCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGV4cG9ydEZpbGVzKGZpbGVzOiBURmlsZVtdLCBkZXN0aW5hdGlvbjogUGF0aCwgc2F2ZUZpbGVzOiBib29sZWFuLCBjbGVhckRpcmVjdG9yeTogYm9vbGVhbikgOiBQcm9taXNlPFdlYnNpdGUgfCB1bmRlZmluZWQ+XHJcblx0e1xyXG5cdFx0dmFyIHdlYnNpdGUgPSBhd2FpdCBuZXcgV2Vic2l0ZSgpLmNyZWF0ZVdpdGhGaWxlcyhmaWxlcywgZGVzdGluYXRpb24pO1xyXG5cclxuXHRcdGlmICghd2Vic2l0ZSlcclxuXHRcdHtcclxuXHRcdFx0bmV3IE5vdGljZShcIuKdjCBFeHBvcnQgQ2FuY2VsbGVkXCIsIDUwMDApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGNsZWFyRGlyZWN0b3J5ICYmIE1haW5TZXR0aW5ncy5zZXR0aW5ncy5leHBvcnRQcmVzZXQgIT0gXCJsb2NhbFwiKSBhd2FpdCB0aGlzLmRlbGV0ZU5vbkV4cG9ydHMod2Vic2l0ZS53ZWJwYWdlcywgZGVzdGluYXRpb24pO1xyXG5cdFx0aWYgKHNhdmVGaWxlcykgXHJcblx0XHR7XHJcblx0XHRcdGlmIChNYWluU2V0dGluZ3Muc2V0dGluZ3MuZXhwb3J0UHJlc2V0ID09IFwibG9jYWxcIikgXHJcblx0XHRcdHtcclxuXHRcdFx0XHR3ZWJzaXRlLnNhdmVBc0RhdGFiYXNlKCk7XHJcblx0XHRcdFx0cmV0dXJuIHdlYnNpdGU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGF3YWl0IHRoaXMuc2F2ZUV4cG9ydHMod2Vic2l0ZS53ZWJwYWdlcywgZGVzdGluYXRpb24pO1xyXG5cdFx0fVxyXG5cclxuXHRcdE1hcmtkb3duUmVuZGVyZXIuZW5kQmF0Y2goKTtcclxuXHJcblx0XHRyZXR1cm4gd2Vic2l0ZTtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgZXhwb3J0Rm9sZGVyKGZvbGRlcjogVEZvbGRlciwgcm9vdEV4cG9ydFBhdGg6IFBhdGgsIHNhdmVGaWxlczogYm9vbGVhbiwgY2xlYXJEaXJlY3Rvcnk6IGJvb2xlYW4pIDogUHJvbWlzZTxXZWJzaXRlIHwgdW5kZWZpbmVkPlxyXG5cdHtcclxuXHRcdGxldCBmb2xkZXJQYXRoID0gbmV3IFBhdGgoZm9sZGVyLnBhdGgpO1xyXG5cdFx0bGV0IGFsbEZpbGVzID0gSFRNTEV4cG9ydFBsdWdpbi5wbHVnaW4uYXBwLnZhdWx0LmdldEZpbGVzKCk7XHJcblx0XHRsZXQgZmlsZXMgPSBhbGxGaWxlcy5maWx0ZXIoKGZpbGUpID0+IG5ldyBQYXRoKGZpbGUucGF0aCkuZGlyZWN0b3J5LmFzU3RyaW5nLnN0YXJ0c1dpdGgoZm9sZGVyUGF0aC5hc1N0cmluZykpO1xyXG5cclxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmV4cG9ydEZpbGVzKGZpbGVzLCByb290RXhwb3J0UGF0aCwgc2F2ZUZpbGVzLCBjbGVhckRpcmVjdG9yeSk7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGV4cG9ydFZhdWx0KHJvb3RFeHBvcnRQYXRoOiBQYXRoLCBzYXZlRmlsZXM6IGJvb2xlYW4sIGNsZWFyRGlyZWN0b3J5OiBib29sZWFuKSA6IFByb21pc2U8V2Vic2l0ZSB8IHVuZGVmaW5lZD5cclxuXHR7XHJcblx0XHRsZXQgZmlsZXMgPSBIVE1MRXhwb3J0UGx1Z2luLnBsdWdpbi5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcclxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmV4cG9ydEZpbGVzKGZpbGVzLCByb290RXhwb3J0UGF0aCwgc2F2ZUZpbGVzLCBjbGVhckRpcmVjdG9yeSk7XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIHNhdmVFeHBvcnRzKHdlYnBhZ2VzOiBXZWJwYWdlW10sIHJvb3RQYXRoOiBQYXRoKVxyXG5cdHtcclxuXHRcdGxldCBkb3dubG9hZHM6IERvd25sb2FkYWJsZVtdID0gW107XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB3ZWJwYWdlcy5sZW5ndGg7IGkrKylcclxuXHRcdHtcclxuXHRcdFx0ZG93bmxvYWRzLnB1c2goLi4ud2VicGFnZXNbaV0uZG93bmxvYWRzKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb3dubG9hZHMuZm9yRWFjaCgoZmlsZSkgPT5cclxuXHRcdHtcclxuXHRcdFx0aWYoTWFpblNldHRpbmdzLnNldHRpbmdzLm1ha2VOYW1lc1dlYlN0eWxlKSBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGZpbGUuZmlsZW5hbWUgPSBQYXRoLnRvV2ViU3R5bGUoZmlsZS5maWxlbmFtZSk7XHJcblx0XHRcdFx0ZmlsZS5yZWxhdGl2ZURvd25sb2FkUGF0aC5tYWtlV2ViU3R5bGUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0ZG93bmxvYWRzLnB1c2goLi4uYXdhaXQgQXNzZXRIYW5kbGVyLmdldERvd25sb2FkcygpKTtcclxuXHJcblx0XHRkb3dubG9hZHMgPSBkb3dubG9hZHMuZmlsdGVyKChmaWxlLCBpbmRleCkgPT4gZG93bmxvYWRzLmZpbmRJbmRleCgoZikgPT4gZi5yZWxhdGl2ZURvd25sb2FkUGF0aCA9PSBmaWxlLnJlbGF0aXZlRG93bmxvYWRQYXRoICYmIGYuZmlsZW5hbWUgPT09IGZpbGUuZmlsZW5hbWUpID09IGluZGV4KTtcclxuXHJcblx0XHRhd2FpdCBVdGlscy5kb3dubG9hZEZpbGVzKGRvd25sb2Fkcywgcm9vdFBhdGgpO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBzdGF0aWMgYXN5bmMgZ2V0QWxsRmlsZXNJbkZvbGRlclJlY3Vyc2l2ZShmb2xkZXI6IFBhdGgpOiBQcm9taXNlPFBhdGhbXT5cclxuXHR7XHJcblx0XHRsZXQgZmlsZXM6IFBhdGhbXSA9IFtdO1xyXG5cclxuXHRcdGxldCBmb2xkZXJGaWxlcyA9IGF3YWl0IGZzLnJlYWRkaXIoZm9sZGVyLmFzU3RyaW5nKTtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZm9sZGVyRmlsZXMubGVuZ3RoOyBpKyspXHJcblx0XHR7XHJcblx0XHRcdGxldCBmaWxlID0gZm9sZGVyRmlsZXNbaV07XHJcblx0XHRcdGxldCBwYXRoID0gZm9sZGVyLmpvaW5TdHJpbmcoZmlsZSk7XHJcblxyXG5cdFx0XHRSZW5kZXJMb2cucHJvZ3Jlc3MoaSwgZm9sZGVyRmlsZXMubGVuZ3RoLCBcIkZpbmRpbmcgT2xkIEZpbGVzXCIsIFwiU2VhcmNoaW5nOiBcIiArIGZvbGRlci5hc1N0cmluZywgXCJ2YXIoLS1jb2xvci15ZWxsb3cpXCIpO1xyXG5cclxuXHRcdFx0aWYgKChhd2FpdCBmcy5zdGF0KHBhdGguYXNTdHJpbmcpKS5pc0RpcmVjdG9yeSgpKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0ZmlsZXMucHVzaCguLi5hd2FpdCB0aGlzLmdldEFsbEZpbGVzSW5Gb2xkZXJSZWN1cnNpdmUocGF0aCkpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2VcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGZpbGVzLnB1c2gocGF0aCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmlsZXM7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBhc3luYyBnZXRBbGxFbXB0eUZvbGRlcnNSZWN1cnNpdmUoZm9sZGVyOiBQYXRoKTogUHJvbWlzZTxQYXRoW10+XHJcblx0e1xyXG5cdFx0bGV0IGZvbGRlcnM6IFBhdGhbXSA9IFtdO1xyXG5cclxuXHRcdGxldCBmb2xkZXJGaWxlcyA9IGF3YWl0IGZzLnJlYWRkaXIoZm9sZGVyLmFzU3RyaW5nKTtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZm9sZGVyRmlsZXMubGVuZ3RoOyBpKyspXHJcblx0XHR7XHJcblx0XHRcdGxldCBmaWxlID0gZm9sZGVyRmlsZXNbaV07XHJcblx0XHRcdGxldCBwYXRoID0gZm9sZGVyLmpvaW5TdHJpbmcoZmlsZSk7XHJcblxyXG5cdFx0XHRSZW5kZXJMb2cucHJvZ3Jlc3MoaSwgZm9sZGVyRmlsZXMubGVuZ3RoLCBcIkZpbmRpbmcgT2xkIEZpbGVzXCIsIFwiU2VhcmNoaW5nOiBcIiArIGZvbGRlci5hc1N0cmluZywgXCJ2YXIoLS1jb2xvci15ZWxsb3cpXCIpO1xyXG5cclxuXHJcblx0XHRcdGlmICgoYXdhaXQgZnMuc3RhdChwYXRoLmFzU3RyaW5nKSkuaXNEaXJlY3RvcnkoKSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBzdWJGb2xkZXJzID0gYXdhaXQgdGhpcy5nZXRBbGxFbXB0eUZvbGRlcnNSZWN1cnNpdmUocGF0aCk7XHJcblx0XHRcdFx0aWYgKHN1YkZvbGRlcnMubGVuZ3RoID09IDApXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0bGV0IHN1YkZpbGVzID0gYXdhaXQgZnMucmVhZGRpcihwYXRoLmFzU3RyaW5nKTtcclxuXHRcdFx0XHRcdGlmIChzdWJGaWxlcy5sZW5ndGggPT0gMCkgZm9sZGVycy5wdXNoKHBhdGgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0Zm9sZGVycy5wdXNoKC4uLnN1YkZvbGRlcnMpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmb2xkZXJzO1xyXG5cdH1cclxuXHJcblx0cHVibGljIHN0YXRpYyBhc3luYyBkZWxldGVOb25FeHBvcnRzKHdlYnBhZ2VzOiBXZWJwYWdlW10sIHJvb3RQYXRoOiBQYXRoKVxyXG5cdHtcclxuXHRcdC8vIGRlbGV0ZSBhbGwgZmlsZXMgaW4gcm9vdCBwYXRoIHRoYXQgYXJlIG5vdCBpbiBleHBvcnRzXHJcblx0XHRsZXQgZmlsZXMgPSAoYXdhaXQgdGhpcy5nZXRBbGxGaWxlc0luRm9sZGVyUmVjdXJzaXZlKHJvb3RQYXRoKSkuZmlsdGVyKChmaWxlKSA9PiAhZmlsZS5tYWtlVW5peFN0eWxlKCkuYXNTdHJpbmcuY29udGFpbnMoQXNzZXRIYW5kbGVyLm1lZGlhRm9sZGVyTmFtZS5tYWtlVW5peFN0eWxlKCkuYXNTdHJpbmcpKTtcclxuXHJcblx0XHRSZW5kZXJMb2cubG9nKGZpbGVzLCBcIkRlbGV0aW9uIGNhbmRpZGF0ZXNcIik7XHJcblxyXG5cdFx0bGV0IHRvRGVsZXRlID0gW107XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKVxyXG5cdFx0e1xyXG5cdFx0XHRSZW5kZXJMb2cucHJvZ3Jlc3MoaSwgZmlsZXMubGVuZ3RoLCBcIkZpbmRpbmcgT2xkIEZpbGVzXCIsIFwiQ2hlY2tpbmc6IFwiICsgZmlsZXNbaV0uYXNTdHJpbmcsIFwidmFyKC0tY29sb3IteWVsbG93KVwiKTtcclxuXHJcblx0XHRcdGxldCBmaWxlID0gZmlsZXNbaV07XHJcblx0XHRcdGlmKCF3ZWJwYWdlcy5maW5kKChleHBvcnRlZEZpbGUpID0+IGV4cG9ydGVkRmlsZS5leHBvcnRQYXRoQWJzb2x1dGUubWFrZVVuaXhTdHlsZSgpLmFzU3RyaW5nID09IGZpbGUubWFrZVVuaXhTdHlsZSgpLmFzU3RyaW5nKSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGZvciAobGV0IHdlYnBhZ2Ugb2Ygd2VicGFnZXMpXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0aWYgKHdlYnBhZ2UuZG93bmxvYWRzLmZpbmQoKGRvd25sb2FkKSA9PiBkb3dubG9hZC5yZWxhdGl2ZURvd25sb2FkUGF0aC5tYWtlVW5peFN0eWxlKCkuYXNTdHJpbmcgPT0gZmlsZS5tYWtlVW5peFN0eWxlKCkuYXNTdHJpbmcpKVxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0b0RlbGV0ZS5wdXNoKGZpbGUpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRmb3JcdChsZXQgaSA9IDA7IGkgPCB0b0RlbGV0ZS5sZW5ndGg7IGkrKylcclxuXHRcdHtcclxuXHRcdFx0bGV0IGZpbGUgPSB0b0RlbGV0ZVtpXTtcclxuXHRcdFx0UmVuZGVyTG9nLnByb2dyZXNzKGksIHRvRGVsZXRlLmxlbmd0aCwgXCJEZWxldGluZyBPbGQgRmlsZXNcIiwgXCJEZWxldGluZzogXCIgKyBmaWxlLmFzU3RyaW5nLCBcInZhcigtLWNvbG9yLXJlZClcIik7XHJcblx0XHRcdGF3YWl0IGZzLnVubGluayhmaWxlLmFzU3RyaW5nKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBkZWxldGUgYWxsIGVtcHR5IGZvbGRlcnMgaW4gcm9vdCBwYXRoXHJcblx0XHRsZXQgZm9sZGVycyA9IChhd2FpdCB0aGlzLmdldEFsbEVtcHR5Rm9sZGVyc1JlY3Vyc2l2ZShyb290UGF0aCkpO1xyXG5cclxuXHRcdGZvclx0KGxldCBpID0gMDsgaSA8IGZvbGRlcnMubGVuZ3RoOyBpKyspXHJcblx0XHR7XHJcblx0XHRcdGxldCBmb2xkZXIgPSBmb2xkZXJzW2ldO1xyXG5cdFx0XHRSZW5kZXJMb2cucHJvZ3Jlc3MoaSwgZm9sZGVycy5sZW5ndGgsIFwiRGVsZXRpbmcgRW1wdHkgRm9sZGVyc1wiLCBcIkRlbGV0aW5nOiBcIiArIGZvbGRlci5hc1N0cmluZywgXCJ2YXIoLS1jb2xvci1wdXJwbGUpXCIpO1xyXG5cdFx0XHRhd2FpdCBmcy5ybWRpcihmb2xkZXIuZGlyZWN0b3J5LmFzU3RyaW5nKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuIl19