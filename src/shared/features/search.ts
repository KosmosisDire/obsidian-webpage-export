import { FeatureRelation, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class SearchOptions extends InsertedFeatureOptions
{
	constructor()
	{
		super();
		this.featureId = "search";
		this.displayTitle = "Search...";
		this.featurePlacement = new FeatureRelation("#left-sidebar .topbar-content", RelationType.Start);
	}
}
