import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";
import { LinkHandler } from "./links";

interface TagsDependencies {
	tags: string[];
}

export class Tags extends DynamicInsertedFeature<
	InsertedFeatureOptions,
	TagsDependencies
> {
	constructor(tags: string[]) {
		super(ObsidianSite.metadata.featureOptions.tags, { tags });
	}

	protected generateContent(container: HTMLElement) {
		const deps = this.getDependencies();

		for (const tagName of deps.tags) {
			const tagEl = document.createElement("a");
			tagEl.classList.add("tag");
			tagEl.setAttribute(
				"href",
				`?query=tag:${tagName.replace("#", "")}`
			);
			tagEl.innerText = tagName;
			container.appendChild(tagEl);
		}

		LinkHandler.initializeLinks(container);
	}
}
