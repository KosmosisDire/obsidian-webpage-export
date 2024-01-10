import Minisearch from 'minisearch';
import { Website } from "./website";
import { Asset } from "scripts/html-generation/assets/asset";

export class IndexM 
{
	private static currentId = 1;
	public static async indexHTMLFiles(website: Website): Promise<void> {
		const index = new Minisearch({
			fields: ['id', 'title', 'path', 'content', 'tags'],
			storeFields: ['title', 'path', 'tags'],
		});

		const htmlWebpages = website.webpages.filter(webpage => webpage.document);

		for (const webpage of htmlWebpages) 
		{
			const content = webpage.contentElement.innerText.trim().replace(/\s+/g, ' ');

			if (content) 
			{
				const id = this.currentId.toString();
				this.currentId++;
				index.add({
					id,
					title: Website.getTitle(webpage.source).title,
					path: webpage.exportPath.copy.makeUnixStyle().asString,
					content: content,
					tags: webpage.getTags()
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
}
