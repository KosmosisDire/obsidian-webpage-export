import { Component, MarkdownRenderer, Plugin, Notice, TFile } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import MiniSearch from "minisearch";
import { ExportLog, MarkdownRendererAPI } from "./renderer/renderer";
import {FileData, ExportData} from "./data";

export default class HTMLExportPlugin extends Plugin {
	static readonly VERSION = "1.0.0";
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
		"files.json"
	);

	async onload() {
		console.log("Loading webpage-html-export plugin");
		this.addRibbonIcon("document", "Export to HTML", () =>
			this.exportToHTML()
		);

		//@ts-ignore
		window.MarkdownRendererAPI = MarkdownRendererAPI;
	}

	async exportToHTML() {
		const notice = new Notice("Starting export...", 0);

		try {
			// Get all markdown files
			let files = this.app.vault.getFiles().filter(file => file.path.startsWith("Tests"));
			notice.setMessage(`Processing ${files.length} files...`);

			// Process files in parallel
			const processedFiles = await this.processFiles(files, notice);

			if (processedFiles.length === 0) {
				return;
			}

			// Build export structure
			const exportData = this.buildExportStructure(processedFiles);

			// Save to file
			notice.setMessage("Saving export...");
			await this.saveExport(exportData);

			notice.hide();
			new Notice(`Successfully exported ${processedFiles.length} files!`);
		} catch (error) {
			notice.hide();
			console.error("Export failed:", error);
			new Notice("Export failed. Check console for details.");
		}
	}

	private async processFiles(
		files: TFile[],
		notice: Notice
	): Promise<FileData[]> {
		const existing = await this.loadExistingExport();
		const filesToProcess = this.determineFilesToProcess(files, existing);

		if (filesToProcess.length === 0) {
			notice.hide();
			new Notice("No files need updating!");
			return [];
		}

		notice.setMessage(
			`Processing ${filesToProcess.length} changed files...`
		);

		const results: FileData[] = [];
		let completed = 0;

		await MarkdownRendererAPI.beginBatch();

		let cancelled = false;
		for (const file of filesToProcess) {
			try {
				const fileData = await this.processFile(file);
				results.push(fileData);
			} catch (error) {
				console.error(`Failed to process ${file.path}:`, error);
			}

			if (MarkdownRendererAPI.checkCancelled())
			{
				cancelled = true;
				break;
			}

			completed++;
			const progress = Math.round(
				(completed / filesToProcess.length) * 100
			);
			notice.setMessage(
				`Processing... ${progress}% (${completed}/${filesToProcess.length})`
			);
			ExportLog.setProgress(completed / filesToProcess.length, file.basename, "Completed: " + completed + "/" + filesToProcess.length, "0x2eb947");
		}

		MarkdownRendererAPI.endBatch();

		if (cancelled)
		{
			return [];	
		}

		// Merge with existing unchanged files
		if (existing?.files) {
			for (const [path, data] of Object.entries(existing.files)) {
				if (!results.find((f) => f.path === path)) {
					results.push(data);
				}
			}
		}

		return results;
	}

	private async processFile(file: TFile): Promise<FileData> {
		const [content, html] = await Promise.all([
			this.app.vault.read(file),
			this.renderHTML(file),
		]);

		const cache = this.app.metadataCache.getFileCache(file);
		const links = this.extractLinks(file);

		return {
			path: file.path,
			modified: file.stat.mtime,
			exported: Date.now(),
			frontmatter: cache?.frontmatter || {},
			content: {
				markdown: content,
				html: html,
			},
			links: links,
			elements: {
				headers:
					cache?.headings?.map((h) => ({
						text: h.heading,
						level: h.level,
					})) || [],
				tags: cache?.tags?.map((t) => t.tag) || [],
				blocks: cache?.blocks ? Object.keys(cache.blocks) : [],
				lists: cache?.listItems?.length || 0,
			},
		};
	}

	private async renderHTML(file: TFile): Promise<string> {
		const component = new Component();
		component.load();

		try {
			const result = await MarkdownRendererAPI.renderFileToString(file);
			return result ?? "";
		} finally {
			component.unload();
		}
	}

	private extractLinks(file: TFile) {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks;
		const cache = this.app.metadataCache.getFileCache(file);

		// Find backlinks
		const incoming = Object.keys(resolvedLinks).filter(
			(sourcePath) => resolvedLinks[sourcePath]?.[file.path]
		);

		return {
			outgoing: resolvedLinks[file.path] || {},
			incoming: incoming,
			unresolved: unresolvedLinks[file.path] || {},
			embeds: cache?.embeds?.map((e) => e.link) || [],
		};
	}

	private buildExportStructure(files: FileData[]): ExportData {
		// Convert array to path-keyed object
		const filesMap: Record<string, FileData> = {};
		files.forEach((file) => {
			filesMap[file.path] = file;
		});

		return {
			export: {
				version: HTMLExportPlugin.VERSION,
				timestamp: Date.now(),
				vault: this.app.vault.getName(),
				totalFiles: files.length,
			},
			files: filesMap,
			indices: {
				search: this.buildSearchIndex(files),
				graph: this.buildGraph(files),
				tags: this.buildTagIndex(files),
			},
		};
	}

	private buildSearchIndex(files: FileData[]): any {
		const miniSearch = new MiniSearch({
			fields: [
				"content.markdown",
				"elements.tags",
				"elements.headers.text",
			],
			storeFields: ["path", "modified"],
			idField: "path",
			searchOptions: {
				boost: { "elements.tags": 2 },
				fuzzy: 0.2,
			},
		});

		// Prepare documents for indexing - frontmatter is stored but not indexed
		const documents = files.map((file) => ({
			path: file.path,
			content: file.content,
			elements: {
				headers: file.elements.headers,
				tags: file.elements.tags,
			},
		}));

		miniSearch.addAll(documents);
		return miniSearch.toJSON();
	}

	private buildGraph(files: FileData[]) {
		const nodes: Array<{ id: string; group: string }> = [];
		const edges: Array<{ source: string; target: string; type: string }> =
			[];
		const seenNodes = new Set<string>();

		files.forEach((file) => {
			// Add file node
			const group = this.getNodeGroup(file);
			nodes.push({ id: file.path, group });
			seenNodes.add(file.path);

			// Add edges for outgoing links
			Object.keys(file.links.outgoing).forEach((target) => {
				edges.push({
					source: file.path,
					target: target,
					type: "link",
				});

				// Add target node if not seen
				if (!seenNodes.has(target)) {
					nodes.push({ id: target, group: "linked" });
					seenNodes.add(target);
				}
			});

			// Add edges for embeds
			file.links.embeds.forEach((embed) => {
				edges.push({
					source: file.path,
					target: embed,
					type: "embed",
				});

				if (!seenNodes.has(embed)) {
					nodes.push({ id: embed, group: "embedded" });
					seenNodes.add(embed);
				}
			});
		});

		return { nodes, edges };
	}

	private getNodeGroup(file: FileData): string {
		// Use parsed tags from elements, not frontmatter directly
		if (file.elements.tags.length > 0) {
			// Use first tag as group
			return file.elements.tags[0].replace("#", "");
		}

		// Otherwise group by folder
		const folder = path.dirname(file.path);
		return folder === "." ? "root" : folder.split("/")[0];
	}

	private buildTagIndex(files: FileData[]): Record<string, string[]> {
		const tagIndex: Record<string, string[]> = {};

		files.forEach((file) => {
			const allTags = new Set<string>();

			// Only use tags from elements (which came from Obsidian's cache)
			// This already includes both frontmatter tags AND inline tags parsed by Obsidian
			file.elements.tags.forEach((tag) => {
				allTags.add(tag.replace("#", ""));
			});

			// Add to index
			allTags.forEach((tag) => {
				if (!tagIndex[tag]) {
					tagIndex[tag] = [];
				}
				tagIndex[tag].push(file.path);
			});
		});

		return tagIndex;
	}

	private determineFilesToProcess(
		files: TFile[],
		existing: ExportData | null
	): TFile[] {
		if (!existing?.files) {
			return files; // Process all if no existing export
		}

		return files.filter((file) => {
			const existingFile = existing.files[file.path];

			// New file
			if (!existingFile) return true;

			// Modified since export
			if (file.stat.mtime > existingFile.exported) return true;

			// Check if any backlinks were modified
			const backlinks = this.extractLinks(file).incoming;
			for (const backlinkPath of backlinks) {
				const backlinkFile = this.app.vault.getFileByPath(backlinkPath);
				if (
					backlinkFile &&
					backlinkFile.stat.mtime > existingFile.exported
				) {
					return true;
				}
			}

			return false;
		});
	}

	private async loadExistingExport(): Promise<ExportData | null> {
		if (!fs.existsSync(HTMLExportPlugin.OUTPUT_PATH)) {
			return null;
		}

		try {
			const content = fs.readFileSync(
				HTMLExportPlugin.OUTPUT_PATH,
				"utf8"
			);
			return JSON.parse(content);
		} catch (error) {
			console.warn("Could not load existing export:", error);
			return null;
		}
	}

	private async saveExport(data: ExportData): Promise<void> {
		const json = JSON.stringify(data, null, 2);
		fs.writeFileSync(HTMLExportPlugin.OUTPUT_PATH, json, "utf8");

		console.log(`Export complete:
			- Total files: ${data.export.totalFiles}
			- Graph nodes: ${data.indices.graph.nodes.length}
			- Graph edges: ${data.indices.graph.edges.length}
			- Tags indexed: ${Object.keys(data.indices.tags).length}
		`);
	}

	onunload() {
		console.log("Unloading webpage-html-export plugin");
	}
}
