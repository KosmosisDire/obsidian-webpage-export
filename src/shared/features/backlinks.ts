import { FeatureRelation, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class BacklinksOptions extends InsertedFeatureOptions
{
	constructor()
	{
		super();
		this.featureId = "backlinks";
		this.displayTitle = "Backlinks";
		this.featurePlacement = new FeatureRelation(".footer", RelationType.Start);
	}
}


