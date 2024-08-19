import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class OutlineOptions extends InsertedFeatureOptions
{
	startCollapsed: boolean = false;
	minCollapseDepth: number = 0;

	info_startCollapsed = new FeatureSettingInfo(
	{
		show: true,
		description: "Should the outline start collapsed?"
	});
	info_minCollapseDepth = new FeatureSettingInfo(
	{
		show: true,
		description: "The minimum depth at which headings should be collapsed"
	});

	constructor()
	{
		super();
		this.featureId = "outline";
		this.displayTitle = "Outline";
		this.featurePlacement = new FeatureRelation("#right-sidebar-content", RelationType.End);
	}
}
