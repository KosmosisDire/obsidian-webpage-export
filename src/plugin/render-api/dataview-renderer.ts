import { MarkdownPreviewView, TFile } from "obsidian";
import { DataviewApi, getAPI } from "obsidian-dataview";

export class DataviewRenderer
{
	public static api: DataviewApi = getAPI();
	public static readonly jsKeyword = DataviewRenderer.api?.settings?.dataviewJsKeyword ?? "dataviewjs";

	public view: MarkdownPreviewView;
	public file: TFile;
	public query: string;
	public keyword: string;
	public container: HTMLElement;
	public rendered: boolean = false;

	public static isDataviewEnabled(): boolean
	{
		//@ts-ignore
		return app.plugins?.enabledPlugins?.has("dataview") ?? false;
	}

	constructor(view: MarkdownPreviewView, file: TFile, query: string, keyword: string)
	{
		if (!DataviewRenderer.isDataviewEnabled()) 
		{
			throw new Error("Dataview plugin is not enabled or not installed.");
		}

		this.view = view;
		this.file = file;
		this.query = query;
		this.keyword = keyword;
		DataviewRenderer.api = getAPI();
	}

	public async generate(container?: HTMLElement): Promise<HTMLElement>
	{
		this.container = container ?? document.body;
		if (this.keyword == "dataview") 
			await DataviewRenderer.api.execute(this.query, container, this.view, this.file.path);
		else
			await DataviewRenderer.api.executeJs(this.query, container, this.view, this.file.path);

		function delay(ms: number) {
			return new Promise( resolve => setTimeout(resolve, ms) );
		}

		await delay(100);
		
		this.rendered = true;
		return this.container;
	}

	public static getDataViewsFromHTML(sectionContainer: HTMLElement): { query: string, preEl: HTMLElement, keyword: string }[]
	{
		const dataviewEls = Array.from(sectionContainer.querySelectorAll(`pre:has(:is(.language-dataview, .block-language-dataview, .language-${DataviewRenderer.jsKeyword}, .block-language-${DataviewRenderer.jsKeyword}))`));
		const results = dataviewEls.map((el) => 
		{
			const code = el.querySelector("code") ?? el as HTMLElement;
			const query = code.innerText;
			const keyword = code.className.contains(DataviewRenderer.jsKeyword) ? DataviewRenderer.jsKeyword : "dataview";
			return { query, preEl: el as HTMLElement, keyword: keyword};
		});
		return results;
	}
}

