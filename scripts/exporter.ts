import { Notice, TFile, TFolder } from "obsidian";
import { Path } from "./utils/path";
import { Settings, SettingsPage } from "./settings/settings";
import HTMLExportPlugin from "./main";
import { Utils } from "./utils/utils";
import { Website } from "./objects/website";
import { MarkdownRendererAPI } from "./render-api";

export class HTMLExporter
{
	public static async export(usePreviousSettings: boolean = true, overrideFiles: TFile[] | undefined = undefined)
	{
		let info = await SettingsPage.updateSettings(usePreviousSettings, overrideFiles);
		if ((!info && !usePreviousSettings) || (info && info.canceled)) return;

		let files = info?.pickedFiles ?? overrideFiles ?? SettingsPage.getFilesToExport();
		let exportPath = info?.exportPath ?? new Path(Settings.exportPath);

		let website = await HTMLExporter.exportFiles(files, exportPath, true, Settings.deleteOldFiles);

		if (!website) return;
		if (Settings.openAfterExport) Utils.openPath(exportPath);
		new Notice("✅ Finished HTML Export:\n\n" + exportPath, 5000);
	}

	public static async exportFiles(files: TFile[], destination: Path, saveFiles: boolean, deleteOld: boolean) : Promise<Website | undefined>
	{
		var website = await new Website().createWithFiles(files, destination);

		if (!website)
		{
			new Notice("❌ Export Cancelled", 5000);
			return;
		}

		await website.index.updateBodyClasses();
		if (deleteOld) await website.index.deleteOldFiles();
		if (saveFiles) 
		{
			await Utils.downloadFiles(website.downloads, destination);
		}

		MarkdownRendererAPI.endBatch();

		return website;
	}

	public static async exportFolder(folder: TFolder, rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website | undefined>
	{
		let folderPath = new Path(folder.path);
		let allFiles = HTMLExportPlugin.plugin.app.vault.getFiles();
		let files = allFiles.filter((file) => new Path(file.path).directory.asString.startsWith(folderPath.asString));

		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

	public static async exportVault(rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website | undefined>
	{
		let files = HTMLExportPlugin.plugin.app.vault.getFiles();
		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

	
	// public static async deleteNonExports(webpages: Webpage[], rootPath: Path)
	// {
	// 	return;

	// 	// delete all files in root path that are not in exports
	// 	let files = (await this.getAllFilesInFolderRecursive(rootPath)).filter((file) => !file.makeUnixStyle().asString.contains(Asset.mediaPath.makeUnixStyle().asString));

	// 	RenderLog.log(files, "Deletion candidates");

	// 	let toDelete = [];
	// 	for (let i = 0; i < files.length; i++)
	// 	{
	// 		RenderLog.progress(i, files.length, "Finding Old Files", "Checking: " + files[i].asString, "var(--color-yellow)");

	// 		let file = files[i];
	// 		if(!webpages.find((exportedFile) => exportedFile.exportPathAbsolute.makeUnixStyle().asString == file.makeUnixStyle().asString))
	// 		{
	// 			for (let webpage of webpages)
	// 			{
	// 				if (webpage.downloads.find((download) => download.relativeDownloadDirectory.makeUnixStyle().asString == file.makeUnixStyle().asString))
	// 				{
	// 					toDelete.push(file);
	// 					break;
	// 				}
	// 			}
	// 		}
	// 	}

	// 	for	(let i = 0; i < toDelete.length; i++)
	// 	{
	// 		let file = toDelete[i];
	// 		RenderLog.progress(i, toDelete.length, "Deleting Old Files", "Deleting: " + file.asString, "var(--color-red)");
	// 		await fs.unlink(file.asString);
	// 	}

	// 	// delete all empty folders in root path
	// 	let folders = (await this.getAllEmptyFoldersRecursive(rootPath));

	// 	for	(let i = 0; i < folders.length; i++)
	// 	{
	// 		let folder = folders[i];
	// 		RenderLog.progress(i, folders.length, "Deleting Empty Folders", "Deleting: " + folder.asString, "var(--color-purple)");
	// 		await fs.rmdir(folder.directory.asString);
	// 	}
	// }
}
