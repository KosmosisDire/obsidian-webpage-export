import { i18n } from "src/plugin/translations/language";
import { FeatureRelation, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class SearchOptions extends InsertedFeatureOptions
{
	constructor()
	{
		super();
		this.featureId = "search";
		this.displayTitle = i18n.settings.search.placeholder;
		this.featurePlacement = new FeatureRelation("#left-sidebar .topbar-content", RelationType.Start);
	}
}
