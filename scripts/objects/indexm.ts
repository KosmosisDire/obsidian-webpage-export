import Minisearch from 'minisearch';
import { Website } from "./website";
import { Asset } from "scripts/html-generation/assets/asset";

export class IndexM 
{
	private static currentId = 1;
	public static async indexHTMLFiles(website: Website): Promise<void> {
		const index = new Minisearch({
			fields: ['id', 'title', 'path', 'content', 'tags', 'headers'],
			storeFields: ['title', 'path', 'tags', 'headers'],
		});

		const htmlWebpages = website.webpages.filter(webpage => webpage.document);

		for (const webpage of htmlWebpages) 
		{
			const content = this.preprocessContent(webpage.contentElement);

			if (content) 
			{
				const id = this.currentId.toString();
				this.currentId++;
				index.add({
					id,
					title: Website.getTitle(webpage.source).title,
					path: webpage.exportPath.copy.makeUnixStyle().asString,
					content: content,
					tags: webpage.getTags(),
					headers: webpage.getHeaders(),
				});
			}
			else
			{
				console.warn(`No indexable content found for ${webpage.source.basename}`);
			}
		}

		// Save the index as a JSON file
		const jsonIndex = website.destination.join(Asset.libraryPath).joinString('searchIndex.json');
		const jsonString = JSON.stringify(index.toJSON(), null, 2);
		await jsonIndex.writeFile(jsonString);
	}

	private static getTextNodes(element: HTMLElement): Node[]
	{
		const textNodes = [];
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

		let node;
		while (node = walker.nextNode()) {
			textNodes.push(node);
		}

		return textNodes;
	}

	public static preprocessContent(contentElement: HTMLElement): string 
	{
		contentElement.querySelectorAll(".math, svg, img, .frontmatter, .metadata-container, .heading-after, style, script").forEach((el) => el.remove());

		const textNodes = this.getTextNodes(contentElement);

		let content = '';
		for (const node of textNodes) 
		{
			content += ' ' + node.textContent + ' ';
		}

		content = content.trim().replace(/\s+/g, ' ');

		return content;
	}
}
