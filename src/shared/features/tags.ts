import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class TagsOptions extends InsertedFeatureOptions
{
	showInlineTags: FeatureSettingInfo = new FeatureSettingInfo({
		show: true,
		description: "Show tags that are inline in the document"
	});
	showFrontmatterTags: FeatureSettingInfo = new FeatureSettingInfo({
		show: true,
		description: "Show tags that are in the frontmatter"
	});

	constructor()
	{
		super();
		this.featureId = "tags";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation(".header .data-bar", RelationType.End);
	}
}

