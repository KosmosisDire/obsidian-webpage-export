import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { WebpageDocument } from "./document";
import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";

export class CounterDependencies
{
	document: WebpageDocument;
}

export class CounterFeature extends DynamicInsertedFeature<InsertedFeatureOptions, CounterDependencies>
{
	// state is stored here
	public count: number = 0;

	protected generateFeatureContent(): HTMLElement
	{
		const element = document.createElement("div");
		element.innerHTML = `
            <h2>Counter: ${this.getDependencies().document.headers.length}</h2>
        `;

		return element;
	}
}
