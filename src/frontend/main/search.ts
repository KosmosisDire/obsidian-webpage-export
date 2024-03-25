import { LinkHandler } from "./links";
import { getTextNodes } from "./utils";
import { Website } from "./website";

export enum SearchType
{
	Title,
	Aliases,
	Headers,
	Tags,
	Path,
	Content,
}

let allSearch = SearchType.Title | SearchType.Aliases | SearchType.Headers | SearchType.Tags | SearchType.Path | SearchType.Content;

export class Search
{
	private index: any; // MiniSearch
	private input: HTMLInputElement;
	private container: HTMLElement;

	// only used when the file tree is not present
	private dedicatedSearchResultsList: HTMLElement;
	

	public search(query: string, type: SearchType = allSearch)
	{
		if (query.length == 0)
		{
			this.clear();
			return;
		}

		this.input.value = query;

		if (type != allSearch)
		{
			this.input.style.color = "var(--text-accent)";
		}
		else
		{
			this.input.style.color = "";
		}

		let searchFields = [];
		if (type & SearchType.Title) searchFields.push('title');
		if (type & SearchType.Aliases) searchFields.push('aliases');
		if (type & SearchType.Headers) searchFields.push('headers');
		if (type & SearchType.Tags) searchFields.push('tags');
		if (type & SearchType.Path) searchFields.push('path');
		if (type & SearchType.Content) searchFields.push('content');
	
		
		const results = this.index.search(query, 
		{ 
			prefix: true, 
			fuzzy: 0.3, 
			boost: { title: 2, aliases: 1.8, headers: 1.5, tags: 1.3, path: 1.1 }, 
			fields: searchFields 
		});
		
		// filter results for the best matches and generate extra metadata
		let showPaths = [];
		let headerLinks = [];
		for (let result of results)
		{
			// only show the most relevant results
			if ((result.score < results[0].score * 0.30 && showPaths.length > 4) || result.score < results[0].score * 0.1) 
				break;

			showPaths.push(result.path);

			// generate matching header links to display under the search result
			let headers = [];
			let breakEarly = false;
			for (let match in result.match)
			{
				if (result.match[match].includes("headers"))
				{
					for (let header of result.headers)
					{
						if (header.toLowerCase().includes(match.toLowerCase()))
						{
							if (!headers.includes(header)) headers.push(header);
							if (query.toLowerCase() != match.toLowerCase()) 
							{
								breakEarly = true;
								break;
							}
						}
					}
				}

				if (breakEarly) break;
			}

			headerLinks.push(headers);
		}

		Website.fileTree?.filter(showPaths);
		Website.fileTree?.sort((a, b) =>
		{
			if (!a || !b) return 0;
			return showPaths.findIndex((path) => a.path == path) - showPaths.findIndex((path) => b.path == path);
		});

		if (!Website.fileTree)
		{
			const list = document.createElement('div');
			results.filter(result => result.path.endsWith(".html"))
					.slice(0, 20).forEach(result => 
					{

						const item = document.createElement('div');
						item.classList.add('search-result');

						const link = document.createElement('a');
						link.classList.add('tree-item-self');

						const searchURL = result.path + '?mark=' + encodeURIComponent(query);
						link.setAttribute('href', searchURL);
						link.appendChild(document.createTextNode(result.title));
						item.appendChild(link);
						list.append(item);
					});

			this.dedicatedSearchResultsList.replaceChildren(list);
			this.container.after(this.dedicatedSearchResultsList);
			LinkHandler.initializeLinks(this.dedicatedSearchResultsList);
		}
	
	}

	public clear()
	{
		this.container?.classList.remove("has-content");
		this.input.value = "";
		this.clearCurrentDocumentSearch();
		Website.fileTree?.unfilter();
	}

	public async init(): Promise<Search | undefined>
	{
		this.input = document.querySelector('input[type="search"]');
		this.container = this.input?.closest("#search-container");
		if (!this.input || !this.container) return;

		const indexResp = await fetch('lib/search-index.json');
		if (!indexResp.ok)
		{
			console.error("Failed to fetch search index");
			return;
		}
		const indexJSON = await indexResp.text();
		try
		{
			// @ts-ignore
			this.index = MiniSearch.loadJSON(indexJSON, { fields: ['title', 'path', 'tags', 'headers'] });
		}
		catch (e)
		{
			console.error("Failed to load search index: ", e);
			return;
		}

		const inputClear = document.querySelector('#search-clear-button');
		inputClear.addEventListener('click', (event) => 
		{
			this.clear();
		});

		this.input.addEventListener('input', (event) => 
		{
			const query = (event.target as HTMLInputElement)?.value ?? "";
			if (query.length == 0)
			{
				this.clear();
				return;
			}
			
			this.search(query);
		});

		if (!Website.fileTree)
		{
			this.dedicatedSearchResultsList = document.createElement('div');
			this.dedicatedSearchResultsList.setAttribute('id', 'search-results');
		}

		return this;
	}

	private async searchCurrentDocument(query: string)
	{
		this.clearCurrentDocumentSearch();
		const textNodes = getTextNodes(Website.document.sizerEl);

		textNodes.forEach(async node =>
		{
			const content = node.nodeValue;
			const newContent = content.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`);

			if (newContent !== content) 
			{
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = newContent;
		
				const newNodes = Array.from(tempDiv.childNodes);
		
				newNodes.forEach(newNode => 
				{
					if (newNode.nodeType != Node.TEXT_NODE)
					{
						(newNode as Element)?.setAttribute('class', 'search-mark');
					}
					node.parentNode.insertBefore(newNode, node);
				});
		
				node.parentNode.removeChild(node);
			}
		});

		let firstMark = document.querySelector(".search-mark");

		// wait for page to fade in
		setTimeout(() => 
		{
			if(firstMark) Website.scrollTo(firstMark);
		}, 500);
	}

	private clearCurrentDocumentSearch()
	{
		document.querySelectorAll(".search-mark").forEach(node => 
		{
			node.outerHTML = node.innerHTML;
		});
	}
}
