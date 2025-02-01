import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { WebpageDocument } from "./document";
import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";

type CounterDependencies = {
	count: number;
	label: string;
};

export class CounterFeature extends DynamicInsertedFeature<
	InsertedFeatureOptions,
	CounterDependencies
> {
	protected generateContent(container: HTMLElement) {
		const deps = this.getDependencies();
		const div = document.createElement("div");
		div.textContent = `${deps.label}: ${deps.count}`;
		container.appendChild(div);
	}
}
