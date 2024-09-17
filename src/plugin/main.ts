// imports from obsidian API
import { Notice, Plugin, TFile, TFolder, requestUrl,moment} from 'obsidian';

// modules that are part of the plugin
import { AssetHandler } from 'src/plugin/asset-loaders/asset-handler';
import { Settings, SettingsPage } from 'src/plugin/settings/settings';
import { HTMLExporter } from 'src/plugin/exporter';
import { Path } from 'src/plugin/utils/path';
import { ExportModal } from 'src/plugin/settings/export-modal';
import { ExportLog, MarkdownRendererAPI } from 'src/plugin/render-api/render-api';
import { DataviewRenderer } from './render-api/dataview-renderer';
import { Website } from './website/website';
import * as en from "./translations/en.json";
import * as cn from "./translations/zh-cn.json";
export default class HTMLExportPlugin extends Plugin
{
	static updateInfo: {updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string} = {updateAvailable: false, latestVersion: "0", currentVersion: "0", updateNote: ""};
	static pluginVersion: string = "0.0.0";
	public api = MarkdownRendererAPI;
	public settings = Settings;
	public assetHandler = AssetHandler;
	public Path = Path;
	public dv = DataviewRenderer;
	public Website = Website;

	private i18n: { [key: string]: any } = {};

	public async exportDocker() {
		await HTMLExporter.export(true, undefined, new Path("/output"));
	}

	async onload()
	{
		console.log("Loading webpage-html-export plugin");
		this.checkForUpdates();
		await this.loadTranslations();
		HTMLExportPlugin.pluginVersion = this.manifest.version;

		// @ts-ignore
		window.WebpageHTMLExport = this;

		this.addSettingTab(new SettingsPage(this,this.getLanguage()));
		await SettingsPage.loadSettings();
		await AssetHandler.initialize();

		this.addRibbonIcon("folder-up", "Export Vault to HTML", () =>
		{
			HTMLExporter.export(false);
		});

		// register callback for file rename so we can update the saved files to export
		this.registerEvent(this.app.vault.on("rename", SettingsPage.renameFile));

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
				const file = this.app.workspace.getActiveFile();

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
					item
					.setTitle(this.getLanguage().Export_as_HTML.title)
					.setIcon("download")
					.setSection("export")
					.onClick(() =>
					{
						ExportModal.title = `Export ${file.name} as HTML`;
						if(file instanceof TFile)
						{
							HTMLExporter.export(false, [file]);
						}
						else if(file instanceof TFolder)
						{
							const filesInFolder = this.app.vault.getFiles().filter((f) => new Path(f.path).directory.path.startsWith(file.path));
							HTMLExporter.export(false, filesInFolder);
						}
						else
						{
							ExportLog.error("File is not a TFile or TFolder! Invalid type: " + typeof file + "");
							new Notice("File is not a File or Folder! Invalid type: " + typeof file + "", 5000);
						}
					});
				});
			})
		);
	}

	async checkForUpdates(): Promise<{updateAvailable: boolean, latestVersion: string, currentVersion: string, updateNote: string}>
	{	
		const currentVersion = this.manifest.version;

		try
		{
			let url = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/manifest.json?cache=" + Date.now() + "";
			if (this.manifest.version.endsWith("b")) url = "https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/manifest-beta.json?cache=" + Date.now() + "";
			const manifestResp = await requestUrl(url);
			if (manifestResp.status != 200) throw new Error("Could not fetch manifest");
			const manifest = manifestResp.json;
			const latestVersion = manifest.version ?? currentVersion;
			const updateAvailable = currentVersion < latestVersion;
			const updateNote = manifest.updateNote ?? "";
			
			HTMLExportPlugin.updateInfo = {updateAvailable: updateAvailable, latestVersion: latestVersion, currentVersion: currentVersion, updateNote: updateNote};
			
			if(updateAvailable) ExportLog.log("Update available: " + latestVersion + " (current: " + currentVersion + ")");
			
			return HTMLExportPlugin.updateInfo;
		}
		catch
		{
			ExportLog.log("Could not check for update");
			HTMLExportPlugin.updateInfo = {updateAvailable: false, latestVersion: currentVersion, currentVersion: currentVersion, updateNote: ""};
			return HTMLExportPlugin.updateInfo;
		}
	}

	onunload()
	{
		ExportLog.log('unloading webpage-html-export plugin');
	}
		/**
		 * init json
		 */
		private async loadTranslations() {
			this.i18n["zh-cn"] = cn;
			this.i18n["en"] = en;
		}
	
		/**
		 * getUserLanguage
		 * Example default en
		 * @returns
		 */
		private getUserLanguage(): string {
			const locale = moment.locale();
			const language = locale ? moment.locale() : "en";
			return language;
		}
		/**
		 * 
		 * @returns 
		 */
		public getLanguage() {
			const settingLanguages = this.getUserLanguage();
			const language = this.i18n[settingLanguages];
			if (!language) {
				return this.i18n["en"];
			}
			return language;
		}
}