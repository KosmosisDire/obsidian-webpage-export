import { TFile, TFolder } from "obsidian";
import { Webpage } from "./objects/webpage";
import { GenHelper } from "./html-generation/html-generator";
import { Path } from "./utils/path";
import { MainSettings } from "./settings/main-settings";
import { RenderLog } from "./html-generation/render-log";
import { Downloadable } from "./utils/downloadable";
import HTMLExportPlugin from "./main";
import { Utils } from "./utils/utils";
import { AssetHandler } from "./html-generation/asset-handler";
import { MarkdownRenderer } from "./html-generation/markdown-renderer";
import { promises as fs } from 'fs';
import { Website } from "./objects/website";


export class HTMLExporter
{
	public static async exportFiles(files: TFile[], destination: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website>
	{
		var website = await new Website().createWithFiles(files, destination);

		MarkdownRenderer.checkCancelled();

		if (clearDirectory) await this.deleteNonExports(website.webpages, destination);
		if (saveFiles) await this.saveExports(website.webpages, destination);

		MarkdownRenderer.endBatch();

		return website;
	}

	public static async exportFolder(folder: TFolder, rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website>
	{
		let folderPath = new Path(folder.path);
		let allFiles = HTMLExportPlugin.plugin.app.vault.getFiles();
		let files = allFiles.filter((file) => new Path(file.path).directory.asString.startsWith(folderPath.asString));

		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

	public static async exportVault(rootExportPath: Path, saveFiles: boolean, clearDirectory: boolean) : Promise<Website>
	{
		let files = HTMLExportPlugin.plugin.app.vault.getFiles();
		return await this.exportFiles(files, rootExportPath, saveFiles, clearDirectory);
	}

	public static async saveExports(webpages: Webpage[], rootPath: Path)
	{
		let downloads: Downloadable[] = [];

		for (let i = 0; i < webpages.length; i++)
		{
			downloads.push(...webpages[i].downloads);
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

	private static async getAllFilesInFolderRecursive(folder: Path): Promise<Path[]>
	{
		let files: Path[] = [];

		let folderFiles = await fs.readdir(folder.asString);
		for (let i = 0; i < folderFiles.length; i++)
		{
			let file = folderFiles[i];
			let path = folder.joinString(file);

			RenderLog.progress(i, folderFiles.length, "Finding Old Files", "Searching: " + folder.asString, "var(--color-yellow)");

			if ((await fs.stat(path.asString)).isDirectory())
			{
				files.push(...await this.getAllFilesInFolderRecursive(path));
			}
			else
			{
				files.push(path);
			}
		}

		return files;
	}

	private static async getAllEmptyFoldersRecursive(folder: Path): Promise<Path[]>
	{
		let folders: Path[] = [];

		let folderFiles = await fs.readdir(folder.asString);
		for (let i = 0; i < folderFiles.length; i++)
		{
			let file = folderFiles[i];
			let path = folder.joinString(file);

			RenderLog.progress(i, folderFiles.length, "Finding Old Files", "Searching: " + folder.asString, "var(--color-yellow)");


			if ((await fs.stat(path.asString)).isDirectory())
			{
				let subFolders = await this.getAllEmptyFoldersRecursive(path);
				if (subFolders.length == 0)
				{
					let subFiles = await fs.readdir(path.asString);
					if (subFiles.length == 0) folders.push(path);
				}
				else
				{
					folders.push(...subFolders);
				}
			}
		}

		return folders;
	}

	public static async deleteNonExports(webpages: Webpage[], rootPath: Path)
	{
		// delete all files in root path that are not in exports
		let files = (await this.getAllFilesInFolderRecursive(rootPath)).filter((file) => !file.makeUnixStyle().asString.contains(AssetHandler.mediaFolderName.makeUnixStyle().asString));

		console.log(files);

		let toDelete = [];
		for (let i = 0; i < files.length; i++)
		{
			RenderLog.progress(i, files.length, "Finding Old Files", "Checking: " + files[i].asString, "var(--color-yellow)");

			let file = files[i];
			if(!webpages.find((exportedFile) => exportedFile.exportPathAbsolute.makeUnixStyle().asString == file.makeUnixStyle().asString))
			{
				for (let webpage of webpages)
				{
					if (webpage.downloads.find((download) => download.relativeDownloadPath.makeUnixStyle().asString == file.makeUnixStyle().asString))
					{
						toDelete.push(file);
						break;
					}
				}
			}
		}

		for	(let i = 0; i < toDelete.length; i++)
		{
			let file = toDelete[i];
			RenderLog.progress(i, toDelete.length, "Deleting Old Files", "Deleting: " + file.asString, "var(--color-red)");
			await fs.unlink(file.asString);
		}

		// delete all empty folders in root path
		let folders = (await this.getAllEmptyFoldersRecursive(rootPath));

		for	(let i = 0; i < folders.length; i++)
		{
			let folder = folders[i];
			RenderLog.progress(i, folders.length, "Deleting Empty Folders", "Deleting: " + folder.asString, "var(--color-purple)");
			await fs.rmdir(folder.directory.asString);
		}
	}
}
