import { i18n } from "src/plugin/translations/language";
import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class OutlineOptions extends InsertedFeatureOptions
{
	startCollapsed: boolean = false;
	minCollapseDepth: number = 0;

	info_startCollapsed = new FeatureSettingInfo(
	{
		show: true,
		description: i18n.settings.outline.info_startCollapsed
	});
	info_minCollapseDepth = new FeatureSettingInfo(
	{
		show: true,
		description: i18n.settings.outline.info_minCollapseDepth
	});

	constructor()
	{
		super();
		this.featureId = "outline";
		this.displayTitle = i18n.settings.outline.title;
		this.featurePlacement = new FeatureRelation("#right-sidebar-content", RelationType.End);
	}
}
