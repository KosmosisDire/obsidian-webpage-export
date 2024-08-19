import { FeatureRelation, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class ThemeToggleOptions extends InsertedFeatureOptions
{
	constructor()
	{
		super();
		this.featureId = "theme-toggle";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation("#right-sidebar .topbar-content", RelationType.Start);
	}
}
