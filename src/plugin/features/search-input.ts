import { FeatureGenerator } from "./feature-generator";


export class SearchInput implements FeatureGenerator
{
	public inputContainerEl: HTMLElement;
	public inputWrapperEl: HTMLElement;
	public inputEl: HTMLInputElement;
	public clearButtonEl: HTMLElement;

	async generate(container?: HTMLElement): Promise<HTMLElement> 
	{
		container = container ?? document.body;
		this.inputContainerEl = container.createDiv({ attr: {id: "search-container"} });
		this.inputWrapperEl = this.inputContainerEl.createDiv({ attr: {id: "search-wrapper"} });
		this.inputEl = this.inputWrapperEl.createEl("input");
		this.inputEl.setAttribute("enterkeyhint", "search");
		this.inputEl.setAttribute("type", "search");
		this.inputEl.setAttribute("spellcheck", "false");
		this.inputEl.setAttribute("placeholder", "Search...");
		this.clearButtonEl = this.inputWrapperEl.createDiv({ attr: { "aria-label": "Clear search", id: "search-clear-button" } });

		return this.inputContainerEl;
	}
	
}
