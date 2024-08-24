// imports from obsidian API
import { Notice, Plugin, TFile, TFolder, requestUrl} from 'obsidian';

// modules that are part of the plugin
import { AssetHandler } from 'src/plugin/asset-loaders/asset-handler';
import { Settings, SettingsPage } from 'src/plugin/settings/settings';
import { HTMLExporter } from 'src/plugin/exporter';
import { Path } from 'src/plugin/utils/path';
import { ExportModal } from 'src/plugin/settings/export-modal';
import { ExportLog, MarkdownRendererAPI } from 'src/plugin/render-api/render-api';
import { DataviewRenderer } from './render-api/dataview-renderer';
import { Website } from './website/website';
class SvgPathManager {
    private svgContainer: SVGSVGElement;
    private paths: Set<SVGPathElement>;
    private grid: Map<string, Set<SVGPathElement>>;
    private gridSize: number;
    private currentPath: SVGPathElement | null;

    constructor(svgContainer: SVGSVGElement, gridSize: number = 50) {
        this.svgContainer = svgContainer;
        this.paths = new Set<SVGPathElement>();
        this.grid = new Map<string, Set<SVGPathElement>>();
        this.gridSize = gridSize;
        this.currentPath = null;
    }

    private getGridKey(x: number, y: number): string {
        const col = Math.floor(x / this.gridSize);
        const row = Math.floor(y / this.gridSize);
        return `${col},${row}`;
    }

    private addToGrid(path: SVGPathElement): void {
        const bbox = path.getBBox();
        const minX = Math.floor(bbox.x / this.gridSize);
        const minY = Math.floor(bbox.y / this.gridSize);
        const maxX = Math.floor((bbox.x + bbox.width) / this.gridSize);
        const maxY = Math.floor((bbox.y + bbox.height) / this.gridSize);

        for (let col = minX; col <= maxX; col++) {
            for (let row = minY; row <= maxY; row++) {
                const key = `${col},${row}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, new Set<SVGPathElement>());
                }
                this.grid.get(key)!.add(path);
            }
        }
    }

    private removeFromGrid(path: SVGPathElement): void {
        const bbox = path.getBBox();
        const minX = Math.floor(bbox.x / this.gridSize);
        const minY = Math.floor(bbox.y / this.gridSize);
        const maxX = Math.floor((bbox.x + bbox.width) / this.gridSize);
        const maxY = Math.floor((bbox.y + bbox.height) / this.gridSize);

        for (let col = minX; col <= maxX; col++) {
            for (let row = minY; row <= maxY; row++) {
                const key = `${col},${row}`;
                const cell = this.grid.get(key);
                if (cell) {
                    cell.delete(path);
                    if (cell.size === 0) {
                        this.grid.delete(key);
                    }
                }
            }
        }
    }

    startNewPath(startPoint: { x: number, y: number }): SVGPathElement {
        const d = `M ${startPoint.x} ${startPoint.y}`;
        const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // Apply default styles
        newPath.style.stroke = "currentColor";
        newPath.style.fill = "none";
        newPath.style.strokeWidth = "3px";

        newPath.setAttribute("d", d);
        this.svgContainer.appendChild(newPath);
        this.paths.add(newPath);

        this.addToGrid(newPath);
        this.currentPath = newPath;
        return newPath;
    }

    addPointToCurrentPath(point: { x: number, y: number }): void {
        if (!this.currentPath) {
            throw new Error(`No current path. Use startNewPath() to begin a new path.`);
        }

        const oldBBox = this.currentPath.getBBox();
        const d = this.currentPath.getAttribute("d") || "";
        this.currentPath.setAttribute("d", `${d} L ${point.x} ${point.y}`);
        const newBBox = this.currentPath.getBBox();

        if (newBBox.x !== oldBBox.x || newBBox.y !== oldBBox.y || newBBox.width !== oldBBox.width || newBBox.height !== oldBBox.height) {
            this.removeFromGrid(this.currentPath);
            this.addToGrid(this.currentPath);
        }
    }

    private optimizePath(path: SVGPathElement, tolerance: number = 1): void {
        const d = path.getAttribute("d");
        if (!d) return;

        const points = d.split(/[ML]/).filter(segment => segment.trim() !== "").map(segment => {
            const [x, y] = segment.trim().split(" ").map(Number);
            return { x, y };
        });

        if (points.length <= 2) return;

        const optimizedPoints = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const prev = optimizedPoints[optimizedPoints.length - 1];
            const curr = points[i];
            const next = points[i + 1];

            const distPrevCurr = Math.hypot(curr.x - prev.x, curr.y - prev.y);
            const distCurrNext = Math.hypot(next.x - curr.x, next.y - curr.y);

            if (distPrevCurr < tolerance && distCurrNext < tolerance) continue;

            const angle = Math.abs(Math.atan2(next.y - curr.y, next.x - curr.x) - Math.atan2(curr.y - prev.y, curr.x - prev.x));
            if (angle < 0.01 || Math.abs(angle - Math.PI) < 0.01) {
                continue;
            }

            optimizedPoints.push(curr);
        }

        optimizedPoints.push(points[points.length - 1]);

        const optimizedD = optimizedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
        path.setAttribute("d", optimizedD);
    }

    finishCurrentPath(): void {
        if (this.currentPath) {
            this.optimizePath(this.currentPath);
            this.currentPath = null;
        }
    }

    hitTest(x: number, y: number): SVGPathElement | null {
        const key = this.getGridKey(x, y);
        const candidates = this.grid.get(key);

        if (candidates) {
            for (let path of candidates) {
                if (this.isPointOnStroke(path, x, y)) {
                    return path;
                }
            }
        }

        return null;
    }

    hitTestLine(x1: number, y1: number, x2: number, y2: number): SVGPathElement[] {
        const keys = new Set<string>();
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        for (let x = minX; x <= maxX; x += this.gridSize) {
            for (let y = minY; y <= maxY; y += this.gridSize) {
                keys.add(this.getGridKey(x, y));
            }
        }

        const candidates = Array.from(keys)
            .flatMap(key => Array.from(this.grid.get(key) || []))
            .filter((path, index, self) => self.indexOf(path) === index);

        return candidates.filter(path => 
            this.isLineIntersectingStroke(path, x1, y1, x2, y2)
        );
    }

    removePath(path: SVGPathElement): void {
        if (this.paths.has(path)) {
            this.removeFromGrid(path);
            this.svgContainer.removeChild(path);
            this.paths.delete(path);
        }
    }

    private isPointOnStroke(path: SVGPathElement, x: number, y: number): boolean {
        const point = this.svgContainer.createSVGPoint();
        point.x = x;
        point.y = y;
        const matrix = path.getScreenCTM()?.inverse();
        if (matrix) {
            point.matrixTransform(matrix);
        }
        return path.isPointInStroke(point);
    }

    private isLineIntersectingStroke(path: SVGPathElement, x1: number, y1: number, x2: number, y2: number): boolean {
        const d = path.getAttribute("d");
        if (!d) return false;

        const pathPoints = d.split(/[ML]/).filter(segment => segment.trim() !== "").map(segment => {
            const [x, y] = segment.trim().split(" ").map(Number);
            return { x, y };
        });

        if (pathPoints.length < 2) return false;

        for (let i = 0; i < pathPoints.length - 1; i++) {
            const p1 = pathPoints[i];
            const p2 = pathPoints[i + 1];

            if (this.doLinesIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
                return true;
            }
        }

        return false;
    }

    private doLinesIntersect(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean {
        const det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
        if (det === 0) return false; // Lines are parallel

        const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / det;
        const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / det;

        return (0 <= lambda && lambda <= 1) && (0 <= gamma && gamma <= 1);
    }
}

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

	async onload()
	{
		console.log("Loading webpage-html-export plugin");
		this.checkForUpdates();
		HTMLExportPlugin.pluginVersion = this.manifest.version;

		// @ts-ignore
		window.WebpageHTMLExport = this;

		this.addSettingTab(new SettingsPage(this));
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
					.setTitle("Export as HTML")
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
}
