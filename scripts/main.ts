// imports from obsidian API
import { Notice, Plugin, TFile, TFolder} from 'obsidian';

// modules that are part of the plugin
import { ExportModal } from './settings/export-modal';
import { Utils } from './utils/utils';
import { AssetHandler } from './html-generation/asset-handler';
import { MainSettings } from './settings/main-settings';
import { HTMLExporter } from './exporter';
import { Path } from './utils/path';

export default class HTMLExportPlugin extends Plugin
{
	static plugin: HTMLExportPlugin;
	
	async onload()
	{
		console.log('loading webpage-html-export plugin');

		HTMLExportPlugin.plugin = this;
		this.checkForUpdates();
		AssetHandler.initialize("webpage-html-export");
		this.addSettingTab(new MainSettings(this));
		MainSettings.loadSettings();

		this.addRibbonIcon("folder-up", "Export Vault to HTML", async () =>
		{
			let modal = new ExportModal();
			let info = await modal.open();
			if (info.canceled) return;

			await HTMLExporter.exportFiles(info.pickedFiles, info.exportPath, true, MainSettings.settings.deleteOldExportedFiles);
			new Notice("✅ Finished HTML Export:\n\n" + info.exportPath, 5000);
			if (MainSettings.settings.openAfterExport) await Utils.openPath(info.exportPath);
		});

		// register callback for file rename so we can update the saved files to export
		this.registerEvent(this.app.vault.on("rename", MainSettings.renameFile));

		this.addCommand({
			id: 'export-html-vault',
			name: 'Export website using previously selected files and settings',
			callback: async () =>
			{
				let path = new Path(MainSettings.settings.exportPath);
				await HTMLExporter.exportFiles(MainSettings.getFilesToExport(), path, true, MainSettings.settings.deleteOldExportedFiles);
				new Notice("✅ Finished HTML Export:\n\n" + path.asString, 5000);
				if (MainSettings.settings.openAfterExport) await Utils.openPath(path);
			}
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) =>
			{
				menu.addItem((item) =>
				{
					item.setTitle("Export as HTML")
						.setIcon("download")
						.setSection("export")
						.onClick(async () =>
						{
							if(file instanceof TFile)
							{
								let modal = new ExportModal();
								modal.overridePickedFiles([file]);
								let info = await modal.open();
								if (info.canceled) return;

								await HTMLExporter.exportFiles(info.pickedFiles, info.exportPath, true, MainSettings.settings.deleteOldExportedFiles);
								new Notice("✅ Finished HTML Export:\n\n" + info.exportPath, 5000);
								if (MainSettings.settings.openAfterExport) await Utils.openPath(info.exportPath);
							}
							else if(file instanceof TFolder)
							{
								let modal = new ExportModal();
								let filesInFolder = this.app.vault.getFiles().filter((f) => new Path(f.path).directory.asString.startsWith(file.path));
								modal.overridePickedFiles(filesInFolder);
								let info = await modal.open();
								if (info.canceled) return;

								await HTMLExporter.exportFiles(info.pickedFiles, info.exportPath, true, MainSettings.settings.deleteOldExportedFiles);
								new Notice("✅ Finished HTML Export:\n\n" + info.exportPath, 5000);
								if (MainSettings.settings.openAfterExport) await Utils.openPath(info.exportPath);
							}
							else
							{
								console.error("File is not a TFile or TFolder! Invalid type: " + typeof file + "");
								new Notice("File is not a File or Folder! Invalid type: " + typeof file + "", 5000);
							}
						});
				});
			})
		);
	}

	static updateInfo: {updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string} = {updateAvailable: false, latestVersion: "0", currentVersion: "0", updateNote: ""};
	async checkForUpdates(): Promise<{updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string}>
	{	
		let currentVersion = this.manifest.version;
		try
		{
			let url = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/manifest.json?cache=" + Date.now() + "";
			let manifest = await fetch(url, {cache: "no-store"}).then((response) => response.json());
			let latestVersion = manifest.version ?? currentVersion;
			let updateAvailable = currentVersion < latestVersion;
			let updateNote = manifest.updateNote ?? "";
			
			HTMLExportPlugin.updateInfo = {updateAvailable: updateAvailable, latestVersion: latestVersion, currentVersion: currentVersion, updateNote: updateNote};
			
			if(updateAvailable) console.log("Update available: " + latestVersion + " (current: " + currentVersion + ")");
			
			return HTMLExportPlugin.updateInfo;
		}
		catch
		{
			console.log("Could not check for update");
			HTMLExportPlugin.updateInfo = {updateAvailable: false, latestVersion: currentVersion, currentVersion: currentVersion, updateNote: ""};
			return HTMLExportPlugin.updateInfo;
		}
	}

	onunload()
	{
		console.log('unloading webpage-html-export plugin');
	}
}
