import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class TagsOptions extends InsertedFeatureOptionsWithTitle {
	showInlineTags: boolean = true;
	showFrontmatterTags: boolean = true;
	info_showInlineTags: FeatureSettingInfo = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.tags.info_showInlineTags,
	});
	info_showFrontmatterTags: FeatureSettingInfo = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.tags.info_showFrontmatterTags,
	});

	constructor() {
		super();
		this.featureId = "tags";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation(
			".header .data-bar",
			RelationType.End
		);
	}
}

