import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { AliasesOptions } from "src/shared/features/aliases";

interface AliasesData {
	aliases: string[];
}

export class Aliases extends DynamicInsertedFeature<AliasesOptions, AliasesData> {
	constructor(aliases: string[]) {
		super(ObsidianSite.metadata.featureOptions.alias, {
			aliases,
		});
	}

	protected generateContent(container: HTMLDivElement) {
		const deps = this.getDependencies();

		for (const aliasName of deps.aliases) {
			const aliasEl = document.createElement("span");
			aliasEl.classList.add("alias");
			aliasEl.innerText = aliasName;
			container.appendChild(aliasEl);
		}

		return container;
	}
}
