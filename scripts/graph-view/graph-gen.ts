import { ExportSettings } from "scripts/export-settings";
import { Utils } from "scripts/utils";

export class GraphGenerator
{

	static InOutQuadBlend(start: number, end: number, t: number): number
	{
		t /= 2;
		let t2 = 2.0 * t * (1.0 - t) + 0.5;
		t2 -= 0.5;
		t2 *= 2.0;
		return start + (end - start) * t2;
	}

	public static getGlobalGraph(minRadius: number, maxRadius: number): {nodeCount: number, linkCount: number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[]}
	{
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

			indexedRadii[sourceIndex].radius = GraphGenerator.InOutQuadBlend(minRadius, maxRadius, Math.min(linkCounts[sourceIndex] / (maxLinks * 0.8), 1.0));
		}

		// sort radii and then sort others based on radii
		indexedRadii.sort((a, b) => b.radius - a.radius);

		let radii = indexedRadii.map(r => r.radius);
		labels = indexedRadii.map(r => labels[r.index]);
		linkSources = linkSources.map(s => indexedRadii.findIndex(r => r.index == s));
		linkTargets = linkTargets.map(t => indexedRadii.findIndex(r => r.index == t));
		linkCounts = indexedRadii.map(r => linkCounts[r.index]);
		paths = indexedRadii.map(r => ExportSettings.settings.makeNamesWebStyle ? Utils.makePathWebStyle(paths[r.index]) : paths[r.index]);
		paths = paths.map(p => 
			{
				let parsed = Utils.parsePath(p);
				return Utils.joinPaths(parsed.dir, parsed.name) + ".html";
			});

		let data = {nodeCount: nodeCount, linkCount: linkSources.length, radii: radii, labels: labels, paths: paths, linkSources: linkSources, linkTargets: linkTargets, linkCounts: linkCounts};

		return data;
	}

}
