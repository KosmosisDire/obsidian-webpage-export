import { Plugin } from "obsidian";
import { MarkdownRendererAPI } from "./renderer/renderer";
import { HTMLExporter, createEmptyFileData } from "./exporter";
import { ExportSettings } from "./export-settings";
import { FilePickerModal } from "./components/FilePickerModal";
import { FileData } from "../shared/types";
import path from "path";

export default class HTMLExportPlugin extends Plugin {
	private exporter: HTMLExporter;

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

	// static readonly OUTPUT_PATH = path.join(
	// 	"C:",
	// 	"Main",
	// 	"Obsidian",
	// 	"Export Development",
	// 	".obsidian",
	// 	"plugins",
	// 	"webpage-html-export",
	// 	"obsidian-cache.json"
		// );

	async onload() {
		console.log("Loading webpage-html-export plugin");
		
		this.exporter = new HTMLExporter(this.app, this);
		
		this.addRibbonIcon("document", "Export to HTML", () => {
			const allFiles = this.app.vault.getFiles();
			const fileData: Record<string, FileData> = {};
			
			allFiles.forEach(file => {
				fileData[file.path] = createEmptyFileData(file);
			});

			const modal = new FilePickerModal(this.app, fileData, (selectedPaths: string[]) => {
				console.log("Selected files for export:", selectedPaths);
				const selectedFiles = allFiles.filter(file => selectedPaths.includes(file.path));
				this.exporter.exportToHTML(selectedFiles, {
					outputPath: HTMLExportPlugin.OUTPUT_PATH,
					forceFullExport: false,
				});
			});
			
			modal.open();
		});

		//@ts-ignore
		window.MarkdownRendererAPI = MarkdownRendererAPI;
	}


	onunload() {
		console.log("Unloading webpage-html-export plugin");
	}
}
