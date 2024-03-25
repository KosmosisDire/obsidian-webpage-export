import { Notice, TFile, TFolder } from "obsidian";
import { Path } from "src/plugin/utils/path";
import { Settings, SettingsPage } from "src/plugin/settings/settings";
import { Utils } from "src/plugin/utils/utils";
import { Website } from "src/plugin/website/website";
import { ExportLog, MarkdownRendererAPI } from "src/plugin/render-api/render-api";
import { ExportInfo, ExportModal } from "src/plugin/settings/export-modal";

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
		MarkdownRendererAPI.beginBatch();
		let website = undefined;
		try
		{
			website = await (await new Website(destination).load(files)).build();

			if (!website)
			{
				new Notice("❌ Export Cancelled", 5000);
				return;
			}

			if (deleteOld)
			{
				let i = 0;
				for (let dFile of website.index.deletedFiles)
				{
					let path = new Path(dFile, destination.path);
					await path.delete();
					ExportLog.progress(i / website.index.deletedFiles.length, "Deleting Old Files", "Deleting: " + path.path, "var(--color-red)");
					i++;
				};

				await Path.removeEmptyDirectories(destination.path);
			}
			
			if (saveFiles) 
			{
				await Utils.downloadAttachments(website.index.newFiles);
				await Utils.downloadAttachments(website.index.updatedFiles);
			}
		}
		catch (e)
		{
			new Notice("❌ Export Failed: " + e, 5000);
			ExportLog.error(e, "Export Failed", true);
		}

		MarkdownRendererAPI.endBatch();

		return website;
	}

	public static async exportFolder(folder: TFolder, rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website | undefined>
	{
		let folderPath = new Path(folder.path);
		let allFiles = app.vault.getFiles();
		let files = allFiles.filter((file) => new Path(file.path).directory.path.startsWith(folderPath.path));

		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

	public static async exportVault(rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website | undefined>
	{
		let files = app.vault.getFiles();
		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

}
