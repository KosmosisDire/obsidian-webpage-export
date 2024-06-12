import { ComponentGenerator } from "./component-generator";



export class ThemeToggle implements ComponentGenerator
{
	public async generate(container?: HTMLElement): Promise<HTMLElement>
	{
		container = container ?? document.body;
		const label = container.createEl("label");
		const input = label.createEl("input");
		const div = label.createDiv();

		label.classList.add("theme-toggle-container");
		label.setAttribute("for", "theme_toggle");

		input.classList.add("theme-toggle-input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");

		div.classList.add("toggle-background");

		return label;
	}	
}
