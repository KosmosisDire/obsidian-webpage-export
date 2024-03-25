import { MarkdownPreviewView, TFile } from "obsidian";
import { DataviewApi, getAPI } from "obsidian-dataview";
import { ComponentGenerator } from "src/plugin/component-generators/component-generator";

export class DataviewGenerator implements ComponentGenerator
{
	public static readonly api: DataviewApi = getAPI();
	public static readonly jsKeyword = DataviewGenerator.api?.settings?.dataviewJsKeyword ?? "dataviewjs";

	public view: MarkdownPreviewView;
	public file: TFile;
	public query: string;
	public keyword: string;
	public container: HTMLElement;
	public rendered: boolean = false;

	constructor(view: MarkdownPreviewView, file: TFile, query: string, keyword: string)
	{
		this.view = view;
		this.file = file;
		this.query = query;
		this.keyword = keyword;
	}

	

	public async insert(container: HTMLElement)
	{
		this.container = container;
		if (this.keyword == "dataview") 
			await DataviewGenerator.api.execute(this.query, container, this.view, this.file.path);
		else
			await DataviewGenerator.api.executeJs(this.query, container, this.view, this.file.path);

		function delay(ms: number) {
			return new Promise( resolve => setTimeout(resolve, ms) );
		}

		await delay(100);
		
		this.rendered = true;
	}

	public static getDataviewFromHTML(sectionContainer: HTMLElement): { query: string, preEl: HTMLElement, keyword: string } | undefined
	{
		let dataviewEl = sectionContainer.querySelector(`pre:has(:is(.language-dataview, .block-language-dataview, .language-${DataviewGenerator.jsKeyword}, .block-language-${DataviewGenerator.jsKeyword}))`) as HTMLElement;
		if (!dataviewEl) return;

		let code = dataviewEl.querySelector("code") ?? dataviewEl;
		let query = code.innerText;
		let keyword = code.className.contains(DataviewGenerator.jsKeyword) ? DataviewGenerator.jsKeyword : "dataview";
		return { query, preEl: dataviewEl, keyword: keyword};
	}
}

