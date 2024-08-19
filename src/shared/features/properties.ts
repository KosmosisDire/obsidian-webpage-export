import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class PropertiesOptions extends InsertedFeatureOptions
{
	hideProperties: string[];
	info_hideProperties = new FeatureSettingInfo(
	{
		show: true,
		description: "A list of properties to hide from the properties view"
	});

	constructor()
	{
		super();
		this.featureId = "properties";
		this.displayTitle = "Properties";
		this.featurePlacement = new FeatureRelation(".header", RelationType.Start);
	}
}
