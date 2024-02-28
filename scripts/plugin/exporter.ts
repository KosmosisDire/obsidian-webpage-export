import { Notice, TFile, TFolder } from "obsidian";
import { Path } from "../utils/path";
import { Settings, SettingsPage } from "../settings/settings";
import { Utils } from "../utils/utils";
import { Website } from "../website/website";
import { MarkdownRendererAPI } from "scripts/render-api/render-api";
import { ExportInfo, ExportModal } from "scripts/settings/export-modal";

export class HTMLExporter
{
	static async updateSettings(usePreviousSettings: boolean = false, overrideFiles: TFile[] | undefined = undefined): Promise<ExportInfo | undefined>
	{
		if (!usePreviousSettings) 
		{
			let modal = new ExportModal();
			if(overrideFiles) modal.overridePickedFiles(overrideFiles);
			return await modal.open();
		}
		
		let files = Settings.filesToExport[0];
		let path = new Path(Settings.exportPath);
		if ((files.length == 0 && overrideFiles == undefined) || !path.exists || !path.isAbsolute || !path.isDirectory)
		{
			new Notice("Please set the export path and files to export in the settings first.", 5000);
			let modal = new ExportModal();
			if(overrideFiles) modal.overridePickedFiles(overrideFiles);
			return await modal.open();
		}

		return undefined;
	}

	public static async export(usePreviousSettings: boolean = true, overrideFiles: TFile[] | undefined = undefined)
	{
		let info = await this.updateSettings(usePreviousSettings, overrideFiles);
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
		var website = await (await new Website(destination).load(files)).build();

		if (!website)
		{
			new Notice("❌ Export Cancelled", 5000);
			return;
		}

		// await website.index.updateBodyClasses();
		if (deleteOld)
		{
			for (let dFile of website.index.deletedFiles)
			{
				let path = new Path(dFile, destination.stringify);
				await path.delete();
				console.log("Deleted: " + path.stringify);
			};

			await Path.removeEmptyDirectories(destination.stringify);
		}
		
		if (saveFiles) 
		{
			await Utils.downloadAttachments(website.index.allFiles);
		}

		MarkdownRendererAPI.endBatch();

		return website;
	}

	public static async exportFolder(folder: TFolder, rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website | undefined>
	{
		let folderPath = new Path(folder.path);
		let allFiles = app.vault.getFiles();
		let files = allFiles.filter((file) => new Path(file.path).directory.stringify.startsWith(folderPath.stringify));

		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

	public static async exportVault(rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website | undefined>
	{
		let files = app.vault.getFiles();
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
