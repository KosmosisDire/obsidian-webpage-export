import { randomInt } from "crypto";
import { file } from "jszip";
import { MarkdownView, Notice, TextFileView, View } from "obsidian";
import { Utils } from "./utils";
import Victor from "victor";


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

	public static getGlobalGraph(minRadius: number, maxRadius: number): {positions: Victor[], radii: number[], colors: number[], labels: string[], linkSources: number[], linkTargets: number[], linkCounts: number[]}
	{
		let positions: Victor[] = [];
		let indexedRadii: {index: number, radius: number}[] = [];
		let colors: number[] = [];
		let labels: string[] = [];
		let linkSources: number[] = [];
		let linkTargets: number[] = [];
		let linkCounts: number[] = [];

		let paths: string[] = [];

		// generate all posible nodes from files
		let index = 0;
		for (let file of app.vault.getFiles())
		{
			if (file.extension != "md" && file.extension != "canvas") continue;

			positions.push(new Victor(0,0));
			indexedRadii.push({index: index, radius: minRadius});
			colors.push(0x999999);
			labels.push(file.basename);
			paths.push(file.path);
			linkCounts.push(0);

			index++;
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

			indexedRadii[sourceIndex].radius = GraphGenerator.InOutQuadBlend(minRadius, maxRadius, linkCounts[sourceIndex] / maxLinks);
		}

		// sort radii and then sort others based on radii
		indexedRadii.sort((a, b) => b.radius - a.radius);

		let radii = indexedRadii.map(r => r.radius);
		colors = indexedRadii.map(r => colors[r.index]);
		labels = indexedRadii.map(r => labels[r.index]);
		linkSources = linkSources.map(s => indexedRadii.findIndex(r => r.index == s));
		linkTargets = linkTargets.map(t => indexedRadii.findIndex(r => r.index == t));
		linkCounts = indexedRadii.map(r => linkCounts[r.index]);

		let data = {positions: positions, radii: radii, colors: colors, labels: labels, linkSources: linkSources, linkTargets: linkTargets, linkCounts: linkCounts};

		console.log(data);

		return data;
	}
}
