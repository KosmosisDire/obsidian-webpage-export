// imports from obsidian API
import { Notice, Plugin, TFile, TFolder} from 'obsidian';

// modules that are part of the plugin
import { AssetHandler } from './html-generation/asset-handler';
import { MainSettings } from './settings/main-settings';
import { HTMLExporter } from './exporter';
import { Path } from './utils/path';
import { RenderLog } from './html-generation/render-log';

export default class HTMLExportPlugin extends Plugin
{
	static plugin: HTMLExportPlugin;
	static updateInfo: {updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string} = {updateAvailable: false, latestVersion: "0", currentVersion: "0", updateNote: ""};
	static pluginVersion: string = "0.0.0";

	async onload()
	{
		RenderLog.log("Loading webpage-html-export plugin");

		HTMLExportPlugin.plugin = this;
		this.checkForUpdates();
		HTMLExportPlugin.pluginVersion = this.manifest.version;
		this.addSettingTab(new MainSettings(this));
		await MainSettings.loadSettings();
		await AssetHandler.initialize();

		this.addRibbonIcon("folder-up", "Export Vault to HTML", () =>
		{
			HTMLExporter.export(false);
		});

		// register callback for file rename so we can update the saved files to export
		this.registerEvent(this.app.vault.on("rename", MainSettings.renameFile));

		this.addCommand({
			id: 'export-html-vault',
			name: 'Export using previous settings',
			callback: () =>
			{
				HTMLExporter.export(true);
			}
		});

		this.addCommand({
			id: 'export-html-current',
			name: 'Export only current file using previous settings',
			callback: () =>
			{
				let file = this.app.workspace.getActiveFile();

				if (!file) 
				{
					new Notice("No file is currently open!", 5000);
					return;
				}

				HTMLExporter.export(true, [file]);
			}
		});

		this.addCommand({
			id: 'export-html-setting',
			name: 'Set html export settings',
			callback: () =>
			{
				HTMLExporter.export(false);
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
						.onClick(() =>
						{
							if(file instanceof TFile)
							{
								HTMLExporter.export(false, [file]);
							}
							else if(file instanceof TFolder)
							{
								let filesInFolder = this.app.vault.getFiles().filter((f) => new Path(f.path).directory.asString.startsWith(file.path));
								HTMLExporter.export(false, filesInFolder);
							}
							else
							{
								RenderLog.error("File is not a TFile or TFolder! Invalid type: " + typeof file + "");
								new Notice("File is not a File or Folder! Invalid type: " + typeof file + "", 5000);
							}
						});
				});
			})
		);
	}

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
			
			if(updateAvailable) RenderLog.log("Update available: " + latestVersion + " (current: " + currentVersion + ")");
			
			return HTMLExportPlugin.updateInfo;
		}
		catch
		{
			RenderLog.log("Could not check for update");
			HTMLExportPlugin.updateInfo = {updateAvailable: false, latestVersion: currentVersion, currentVersion: currentVersion, updateNote: ""};
			return HTMLExportPlugin.updateInfo;
		}
	}

	onunload()
	{
		RenderLog.log('unloading webpage-html-export plugin');
	}
}
