import { MarkdownRenderer, Notice, TFile, TFolder } from "obsidian";
import { ExportFile } from "./html-generation/export-file";
import { HTMLGenerator } from "./html-generation/html-generator";
import { Path } from "./utils/path";
import { MainSettings } from "./settings/main-settings";
import { RenderLog } from "./html-generation/render-log";
import { Downloadable } from "./utils/downloadable";
import HTMLExportPlugin from "./main";
import { Utils } from "./utils/utils";
import { AssetHandler } from "./html-generation/asset-handler";


export class HTMLExporter
{

	public static async exportFile(file: TFile, exportFromPath: Path, exportToPath: Path, saveFile: boolean) : Promise<ExportFile | undefined>
	{
		let loneFile = !HTMLGenerator.isBatchStarted();
		if(loneFile) await HTMLGenerator.beginBatch([file]);

		let filePath = new Path(file.path);

		var exportedFile = new ExportFile
		(
			file, 
			exportToPath.directory.absolute(), 
			exportFromPath.directory, 
			!loneFile,
			exportToPath.fullName,
			loneFile
		);
		
		// Skip the file if it's unchanged since last export
		if (MainSettings.settings.incrementalExport && exportedFile.isFileModified === false)
		{
			RenderLog.log("Skipping file", `${file.path}. File unchanged since last export.`);
			return;
		}

		if(HTMLGenerator.convertableExtensions.contains(file.extension)) 
		{
			await HTMLGenerator.generateWebpage(exportedFile);
		}
		else 
		{
			exportedFile.downloads.push(await exportedFile.getSelfDownloadable());
		}

		if(saveFile) await this.saveExports([exportedFile], exportToPath.directory.absolute());
		
		if(loneFile) await HTMLGenerator.endBatch();
	
		return exportedFile;
	}

	public static async exportFiles(files: TFile[], rootExportPath: Path, saveFiles: boolean) : Promise<ExportFile[] | undefined>
	{
		await HTMLGenerator.beginBatch(files);

		RenderLog.progress(0, files.length, "Generating HTML", "...", "var(--color-accent)");
		
		let exports: ExportFile[] = [];
				
		for (let i = 0; i < files.length; i++)
		{
			let file = files[i];
			try
			{
				RenderLog.progress(i, files.length, "Generating HTML", "Exporting: " + file.path, "var(--color-accent)");
				let exportPath = rootExportPath.joinString(file.name);
				if (HTMLGenerator.convertableExtensions.contains(file.extension)) exportPath.setExtension("html");
				let exportedFile = await this.exportFile(file, new Path(file.path), exportPath, false);
				if(exportedFile) exports.push(exportedFile);
			}
			catch (e)
			{
				let message = "Could not export file: " + file.name;
				RenderLog.error(message, e.stack);
				return;
			}
		}

		if(saveFiles) await this.saveExports(exports, rootExportPath);

		await HTMLGenerator.endBatch();

		return exports;
	}

	public static async exportFolder(folder: TFolder, rootExportPath: Path, saveFiles: boolean) : Promise<ExportFile[] | undefined>
	{
		let folderPath = new Path(folder.path);
		let allFiles = HTMLExportPlugin.plugin.app.vault.getFiles();
		let files = allFiles.filter((file) => new Path(file.path).directory.asString.startsWith(folderPath.asString));

		return await this.exportFiles(files, rootExportPath, saveFiles);
	}

	public static async exportVault(rootExportPath: Path, saveFiles: boolean) : Promise<ExportFile[] | undefined>
	{
		let files = HTMLExportPlugin.plugin.app.vault.getFiles();
		return await this.exportFiles(files, rootExportPath, saveFiles);
	}

	public static async saveExports(exports: ExportFile[], rootPath: Path)
	{
		let downloads: Downloadable[] = [];

		for (let i = 0; i < exports.length; i++)
		{
			downloads.push(...exports[i].downloads);
		}

		downloads.forEach((file) =>
		{
			if(MainSettings.settings.makeNamesWebStyle) 
			{
				file.filename = Path.toWebStyle(file.filename);
				file.relativeDownloadPath.makeWebStyle();
			}
		});

		downloads.push(...await AssetHandler.getDownloads());

		downloads = downloads.filter((file, index) => downloads.findIndex((f) => f.relativeDownloadPath == file.relativeDownloadPath && f.filename === file.filename) == index);



		await Utils.downloadFiles(downloads, rootPath);
	}
}
