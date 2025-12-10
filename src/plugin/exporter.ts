import {
	Component,
	MarkdownRenderer,
	Plugin,
	Notice,
	TFile,
	App,
} from "obsidian";
import * as fs from "fs";
import MiniSearch from "minisearch";
import { ExportLog, MarkdownRendererAPI } from "./renderer/renderer";
import { FileData, ExportData } from "./data";
import { ExportSettings } from "./export-settings";
import { Path } from "@shared/path";

export function createEmptyFileData(file: TFile): FileData {
	return {
		path: file.path,
		modified: file.stat.mtime,
		exported: 0,
		frontmatter: {},
		content: {
			markdown: "",
			html: "",
		},
		links: {
			outgoing: {},
			incoming: [],
			unresolved: {},
			embeds: [],
		},
		elements: {
			headers: [],
			tags: [],
			blocks: [],
			lists: 0,
		},
	};
}

export class HTMLExporter {
	private app: App;
	private plugin: Plugin;

	static readonly VERSION = "1.0.0";

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	async exportToHTML(
		files: TFile[],
		settings: ExportSettings
	): Promise<void> {
		const notice = new Notice("Starting export...", 0);

		try {
			notice.setMessage(`Processing ${files.length} files...`);

			settings = settings || new ExportSettings();

			// Process files in parallel
			const processedFiles = await this.processFiles(
				files,
				notice,
				settings
			);

			if (processedFiles.length === 0) {
				return;
			}

			// Build export structure
			const exportData = this.buildExportStructure(processedFiles);

			// Save to file
			notice.setMessage("Saving export...");
			await this.saveExport(exportData, settings);

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
		notice: Notice,
		settings: ExportSettings
	): Promise<FileData[]> {
		const existing = settings.forceFullExport
			? null
			: await this.loadExistingExport(settings);
		const filesToProcess = this.determineFilesToProcess(files, existing);

		// Create a set of selected file paths for quick lookup
		const selectedPaths = new Set(files.map((f) => f.path));
		const results: FileData[] = [];

		if (filesToProcess.length === 0) {
			notice.setMessage("No files need updating, cleaning up export...");

			// Still need to filter existing files to only include selected ones
			if (existing?.files) {
				for (const [webPath, data] of Object.entries(existing.files)) {
					// data.path contains the Obsidian path
					if (selectedPaths.has(data.path)) {
						results.push(data);
					}
				}
			}

			return results; // Return filtered existing data instead of empty array
		}

		notice.setMessage(
			`Processing ${filesToProcess.length} changed files...`
		);

		let completed = 0;

		await MarkdownRendererAPI.beginBatch(settings.rendererOptions);

		let cancelled = false;
		for (const file of filesToProcess) {
			try {
				const fileData = await this.processFile(file);
				results.push(fileData);
			} catch (error) {
				console.error(`Failed to process ${file.path}:`, error);
			}

			if (MarkdownRendererAPI.checkCancelled()) {
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
			ExportLog.setProgress(
				completed / filesToProcess.length,
				file.basename,
				"Completed: " + completed + "/" + filesToProcess.length,
				"0x2eb947"
			);
		}

		MarkdownRendererAPI.endBatch();

		if (cancelled) {
			return [];
		}

		// Merge with existing unchanged files, but only if they were selected for export
		if (existing?.files) {
			for (const [webPath, data] of Object.entries(existing.files)) {
				if (
					selectedPaths.has(data.path) &&
					!results.find((f) => f.path === data.path)
				) {
					results.push(data);
				}
			}
		}

		return results;
	}

	private resolveLinks(html: string, sourcePath: string, pathMap: Record<string, string>): string
	{
		// Replace all href attributes with transformed links
		return html.replace(/href=["']([^"']+)["']/g, (_match, href) =>
		{
			var splitHref = href.split('#');
			href = splitHref[0];
			let hash = splitHref.length > 1 ? '#' + splitHref[1] : '';
			const transformed = this.transformHref(href, sourcePath, pathMap);
			return `href="${transformed}${hash}"`;
		});
	}

	private transformHref(href: string, sourcePath: string, pathMap: Record<string, string>): string
	{
		let transformed = app.metadataCache.getFirstLinkpathDest(href, sourcePath)?.path || href;
		transformed = pathMap[transformed] || transformed;
		return transformed;
	}

	private async processFile(file: TFile): Promise<FileData> {
		let [content, html] = await Promise.all([
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
		const filePathMapping = this.buildFilePathMapping(files);

		const filesMap: Record<string, FileData> = {};
		files.forEach(async (file) => {

			// resolve links in HTML and convert them to web paths
			file.content.html = this.resolveLinks(file.content.html, file.path, filePathMapping);

			// Convert files array to path-keyed object using web file names as keys
			const webFileName = filePathMapping[file.path];
			filesMap[webFileName] = file;

		});

		return {
			export: {
				version: HTMLExporter.VERSION,
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
			filePathMapping: filePathMapping,
		};
	}

	private buildFilePathMapping(files: FileData[]): Record<string, string> {
		const mapping: Record<string, string> = {};

		files.forEach((file) => {
			const obsidianPath = new Path(file.path);
			const webPath = obsidianPath.copy.slugify(true);

			// Convert extension to .html if the file is convertable
			if (MarkdownRendererAPI.isConvertable(obsidianPath.extension)) {
				webPath.setExtension(".html");
			}

			mapping[file.path] = webPath.path;
		});

		return mapping;
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
		const filePath = new Path(file.path);
		const folder = filePath.directory.path;
		return folder === "" ? "root" : filePath.directory.split()[0];
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
		if (!existing?.files || !existing?.filePathMapping) {
			return files; // Process all if no existing export
		}

		return files.filter((file) => {
			// Look up by web path using the mapping
			const webPath = existing.filePathMapping[file.path];
			const existingFile = webPath ? existing.files[webPath] : undefined;

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

	private async loadExistingExport(
		settings: ExportSettings
	): Promise<ExportData | null> {
		const outputPath = settings.outputPath;
		if (!fs.existsSync(outputPath)) {
			return null;
		}

		try {
			const content = fs.readFileSync(outputPath, "utf8");
			return JSON.parse(content);
		} catch (error) {
			console.warn("Could not load existing export:", error);
			return null;
		}
	}

	private async saveExport(
		data: ExportData,
		settings: ExportSettings
	): Promise<void> {
		const json = JSON.stringify(data, null, 2);
		const outputPath = settings.outputPath;
		fs.writeFileSync(outputPath, json, "utf8");

		console.log(`Export complete:
			- Total files: ${data.export.totalFiles}
			- Graph nodes: ${data.indices.graph.nodes.length}
			- Graph edges: ${data.indices.graph.edges.length}
			- Tags indexed: ${Object.keys(data.indices.tags).length}
		`);
	}
}
