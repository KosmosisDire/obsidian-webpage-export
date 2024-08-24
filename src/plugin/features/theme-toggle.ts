import { ThemeToggleOptions } from "src/shared/features/theme-toggle";
import { FeatureGenerator } from "./feature-generator";



export class ThemeToggle implements FeatureGenerator
{
	public async generate(container?: HTMLElement, featureOptions?: ThemeToggleOptions): Promise<HTMLElement>
	{
		container = container ?? document.body;
		const label = container.createEl("label", { 
			attr: { for: "theme-toggle-input",  id: featureOptions?.featureId ?? "" }, 
			cls: "theme-toggle-container" });

		label.createEl("input", { attr: { type: "checkbox", id: "theme-toggle-input"}, cls: "theme-toggle-input"});
		label.createDiv({ cls: "toggle-background" });
		
		return label;
	}	
}
