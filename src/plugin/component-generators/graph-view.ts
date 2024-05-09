import { TFile } from "obsidian";
import { Path } from "plugin/utils/path";
import { Website } from "plugin/website/website";
import { MarkdownWebpageRendererAPIOptions } from "plugin/render-api/api-options";
import { ComponentGenerator } from "./component-generator";
import { DEFAULT_GRAPH_VIEW_OPTIONS, GraphViewOptions } from "shared/website-data";

export class GraphView implements ComponentGenerator
{
	public nodeCount: number;
	public linkCount: number;
	public radii: number[];
	public labels: string[];
	public paths: string[];
	public linkSources: number[];
	public linkTargets: number[];

	public graphOptions: GraphViewOptions = DEFAULT_GRAPH_VIEW_OPTIONS;
	private isInitialized: boolean = false;


	static InOutQuadBlend(start: number, end: number, t: number): number
	{
		t /= 2;
		let t2 = 2.0 * t * (1.0 - t) + 0.5;
		t2 -= 0.5;
		t2 *= 2.0;
		return start + (end - start) * t2;
	}

	public async init(files: TFile[], options: MarkdownWebpageRendererAPIOptions)
	{
		if (this.isInitialized) return;

		Object.assign(this.graphOptions, options.graphViewOptions);

		this.paths = files.map(f => f.path);
		this.nodeCount = this.paths.length;
		this.linkSources = [];
		this.linkTargets = [];
		this.labels = [];
		this.radii = [];

		const linkCounts: number[] = [];

		for (let i = 0; i < this.nodeCount; i++)
		{
			linkCounts.push(0);
		}

		const resolvedLinks = Object.entries(app.metadataCache.resolvedLinks);
		const values = Array.from(resolvedLinks.values());
		const sources = values.map(v => v[0]);
		const targets = values.map(v => v[1]);

		for (const source of this.paths)
		{
			const sourceIndex = sources.indexOf(source);
			const file = files.find(f => f.path == source);
			
			if (file)
			{
				const titleInfo = await Website.getTitleAndIcon(file, true);
				this.labels.push(titleInfo.title);
			}

			if (sourceIndex != -1)
			{
				const target = targets[sourceIndex];

				for (const link of Object.entries(target))
				{
					if (link[0] == source) continue;
					if (this.paths.includes(link[0]))
					{
						const path1 = source;
						const path2 = link[0];

						const index1 = this.paths.indexOf(path1);
						const index2 = this.paths.indexOf(path2);

						if (index1 == -1 || index2 == -1) continue;

						this.linkSources.push(index1);
						this.linkTargets.push(index2);

						linkCounts[index1] = (linkCounts[index1] ?? 0) + 1;
						linkCounts[index2] = (linkCounts[index2] ?? 0) + 1;
					}
				}
			}
		}

		const maxLinks = Math.max(...linkCounts);

		this.radii = linkCounts.map(l => GraphView.InOutQuadBlend(this.graphOptions.minNodeRadius, this.graphOptions.maxNodeRadius, Math.min(l / (maxLinks * 0.8), 1.0)));
		this.paths = this.paths.map(p => new Path(p).setExtension(".html").slugify(options.slugifyPaths).path);

		this.linkCount = this.linkSources.length;

		this.isInitialized = true;
	}

	public insert(container: HTMLElement): HTMLElement
	{
		const graphWrapper = container.createDiv();
		graphWrapper.classList.add("graph-view-wrapper");

		const graphHeader = graphWrapper.createDiv();
		graphHeader.addClass("sidebar-section-header");
		graphHeader.innerText = "Interactive Graph";

		const graphEl = graphWrapper.createDiv();
		graphEl.className = "graph-view-placeholder";
		graphEl.innerHTML = 
		`
		<div class="graph-view-container">
			<div class="graph-icon graph-expand" role="button" aria-label="Expand" data-tooltip-position="top"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
			<div class="graph-icon graph-global" role="button" aria-label="Global Graph" data-tooltip-position="top"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-git-fork"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg></div>
			<canvas id="graph-canvas" class="hide" width="512px" height="512px"></canvas>
		</div>
		`
		return graphWrapper;
	}

	public getExportData(): string
	{
		if (!this.isInitialized) throw new Error("Graph not initialized");
		return `let graphData=\n${JSON.stringify(this)};`;
	}
}
