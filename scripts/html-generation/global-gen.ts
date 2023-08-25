import { Path } from "scripts/utils/path";
import { TFile } from "obsidian";
import { LinkTree } from "./link-tree";
import { MainSettings } from "scripts/settings/main-settings";


export class GlobalDataGenerator
{

	static InOutQuadBlend(start: number, end: number, t: number): number
	{
		t /= 2;
		let t2 = 2.0 * t * (1.0 - t) + 0.5;
		t2 -= 0.5;
		t2 *= 2.0;
		return start + (end - start) * t2;
	}

	static graphCache: {nodeCount: number, linkCount: number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[]} | undefined;

	public static clearGraphCache()
	{
		GlobalDataGenerator.graphCache = undefined;
	}

	public static getGlobalGraph(minRadius: number, maxRadius: number): {nodeCount: number, linkCount: number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[]}
	{
		if (this.graphCache != undefined) return this.graphCache;

		let nodeCount = 0;
		let indexedRadii: {index: number, radius: number}[] = [];
		let labels: string[] = [];
		let linkSources: number[] = [];
		let linkTargets: number[] = [];
		let linkCounts: number[] = [];
		let paths: string[] = [];

		// generate all posible nodes from files
		for (let file of app.vault.getFiles())
		{
			if (file.extension != "md" && file.extension != "canvas") continue;

			indexedRadii.push({index: nodeCount, radius: minRadius});
			labels.push(file.basename);
			paths.push(file.path);
			linkCounts.push(0);
			nodeCount++;
		}

		// count the number of links for each node
		let maxLinks: number = 0;
		for (let link of Object.entries(app.metadataCache.resolvedLinks))
		{
			let sourceIndex = paths.indexOf(link[0]);
			let targetLinks = Object.entries(link[1]);


			for (let targetLink of targetLinks)
			{
				let targetIndex = paths.indexOf(targetLink[0]);

				if (sourceIndex == -1 || targetIndex == -1) 
				{
					continue;
				}
				

				linkCounts[sourceIndex]++;
				linkCounts[targetIndex]++;
				linkSources.push(sourceIndex);
				linkTargets.push(targetIndex);
			}

			if (linkCounts[sourceIndex] > maxLinks) maxLinks = linkCounts[sourceIndex];
		}


		// set the radius of each node based on the number of links
		for (let link of Object.entries(app.metadataCache.resolvedLinks))
		{
			let sourceIndex = paths.indexOf(link[0]);

			indexedRadii[sourceIndex].radius = GlobalDataGenerator.InOutQuadBlend(minRadius, maxRadius, Math.min(linkCounts[sourceIndex] / (maxLinks * 0.8), 1.0));
		}

		// sort radii and then sort others based on radii
		indexedRadii.sort((a, b) => b.radius - a.radius);

		let radii = indexedRadii.map(r => r.radius);
		labels = indexedRadii.map(r => labels[r.index]);
		linkSources = linkSources.map(s => indexedRadii.findIndex(r => r.index == s));
		linkTargets = linkTargets.map(t => indexedRadii.findIndex(r => r.index == t));
		linkCounts = indexedRadii.map(r => linkCounts[r.index]);
		paths = indexedRadii.map(r => MainSettings.settings.makeNamesWebStyle ? Path.toWebStyle(paths[r.index]) : paths[r.index]);
		paths = paths.map(p => 
			{
				return new Path(p).setExtension(".html").makeUnixStyle().asString;
			});

		this.graphCache = {nodeCount: nodeCount, linkCount: linkSources.length, radii: radii, labels: labels, paths: paths, linkSources: linkSources, linkTargets: linkTargets};

		return this.graphCache ?? {nodeCount: 0, linkCount: 0, radii: [], labels: [], paths: [], linkSources: [], linkTargets: []};
	}


	static fileTreeCache: LinkTree | undefined;

	public static clearFileTreeCache()
	{
		GlobalDataGenerator.fileTreeCache = undefined;
	}

	// return the file tree as a list of objects with size, title, and href
	// size is the depth of the file from the root
	// the list will be sorted first by size, then by title
	// the list will include folders and files
	public static getFileTree(exportedFiles: TFile[] | undefined = undefined): LinkTree
	{
		if (this.fileTreeCache != undefined) return this.fileTreeCache;
		if (exportedFiles == undefined) return new LinkTree(undefined, undefined, 0);
		
		let fileTree = LinkTree.fromFiles(exportedFiles);
		fileTree.sortAlphabetically();
		fileTree.sortByIsFolder(true);
		if(MainSettings.settings.makeNamesWebStyle) fileTree.makeLinksWebStyle();

		this.fileTreeCache = fileTree;

		return fileTree;
	}
}
