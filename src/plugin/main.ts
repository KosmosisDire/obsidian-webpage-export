import { Plugin, PluginSettingTab, Setting } from "obsidian";
import { MarkdownRendererAPI } from "./renderer/renderer";
import { HTMLExporter, createEmptyFileData } from "./exporter";
import { ExportConfig, DEFAULT_CONFIG, FeatureId } from "./export-settings";
import { FilePickerModal } from "./components/file-picker-modal";
import { FileData } from "../shared/types";
import path from "path";

export default class HTMLExportPlugin extends Plugin {
	private exporter: HTMLExporter;
	config: ExportConfig;

	static readonly OUTPUT_PATH = path.join(
		"C:",
		"Main",
		"Obsidian",
		"Development",
		".obsidian",
		"plugins",
		"webpage-html-export",
		"src",
		"frontend",
		"dist",
		"obsidian-cache.json"
	);

	async onload() {
		console.log("Loading webpage-html-export plugin");

		await this.loadConfig();
		this.addSettingTab(new ExportSettingsTab(this));
		this.exporter = new HTMLExporter(this.app, this);

		this.addRibbonIcon("document", "Export to HTML", () => {
			const allFiles = this.app.vault.getFiles();
			const fileData: Record<string, FileData> = {};

			allFiles.forEach((file) => {
				fileData[file.path] = createEmptyFileData(file);
			});

			const modal = new FilePickerModal(
				this.app,
				fileData,
				(selectedPaths: string[]) => {
					console.log("Selected files for export:", selectedPaths);
					const selectedFiles = allFiles.filter((file) =>
						selectedPaths.includes(file.path)
					);
					this.exporter.exportToHTML(selectedFiles, {
						outputPath: HTMLExportPlugin.OUTPUT_PATH,
						forceFullExport: false,
					});
				}
			);

			modal.open();
		});

		//@ts-ignore
		window.MarkdownRendererAPI = MarkdownRendererAPI;
	}

	onunload() {
		console.log("Unloading webpage-html-export plugin");
	}

	async loadConfig() {
		const saved = await this.loadData();
		this.config = Object.assign({}, DEFAULT_CONFIG, saved);
		// Deep-merge features so new features get defaults
		if (saved?.features) {
			for (const key of Object.keys(DEFAULT_CONFIG.features) as FeatureId[]) {
				this.config.features[key] = Object.assign(
					{},
					DEFAULT_CONFIG.features[key],
					saved.features[key]
				);
			}
		}
	}

	async saveConfig() {
		await this.saveData(this.config);
	}
}

const FEATURE_LABELS: Record<FeatureId, string> = {
	fileNavigation: "File navigation",
	outline: "Outline",
	graphView: "Graph view",
	search: "Search",
	themeToggle: "Theme toggle",
	backlinks: "Backlinks",
	tags: "Tags",
};

class ExportSettingsTab extends PluginSettingTab {
	plugin: HTMLExportPlugin;

	constructor(plugin: HTMLExportPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		// -- General --
		new Setting(containerEl).setName("General").setHeading();

		new Setting(containerEl)
			.setName("Site name")
			.setDesc("Name shown in the exported website header")
			.addText((text) =>
				text
					.setPlaceholder(this.app.vault.getName())
					.setValue(this.plugin.config.siteName)
					.onChange(async (value) => {
						this.plugin.config.siteName = value;
						await this.plugin.saveConfig();
					})
			);

		new Setting(containerEl)
			.setName("Theme")
			.setDesc("Obsidian theme to use for the export")
			.addText((text) =>
				text
					.setPlaceholder("Default")
					.setValue(this.plugin.config.themeName)
					.onChange(async (value) => {
						this.plugin.config.themeName = value;
						await this.plugin.saveConfig();
					})
			);

		// -- Export --
		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("Only export modified files")
			.setDesc("Skip files that haven't changed since the last export")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.config.onlyExportModified)
					.onChange(async (value) => {
						this.plugin.config.onlyExportModified = value;
						await this.plugin.saveConfig();
					})
			);

		new Setting(containerEl)
			.setName("Slugify paths")
			.setDesc("Convert file paths to lowercase, URL-safe names")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.config.slugifyPaths)
					.onChange(async (value) => {
						this.plugin.config.slugifyPaths = value;
						await this.plugin.saveConfig();
					})
			);

		// -- Features --
		new Setting(containerEl).setName("Features").setHeading();

		for (const [id, label] of Object.entries(FEATURE_LABELS) as [FeatureId, string][]) {
			const feature = this.plugin.config.features[id];

			new Setting(containerEl)
				.setName(label)
				.addToggle((toggle) =>
					toggle
						.setValue(feature.enabled)
						.onChange(async (value) => {
							feature.enabled = value;
							await this.plugin.saveConfig();
						})
				);
		}
	}
}
