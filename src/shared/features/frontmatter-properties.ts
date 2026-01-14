import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class FrontmatterPropertiesOptions extends InsertedFeatureOptionsWithTitle {
	showFrontmatterProperties: boolean = true;
	
	info_showFrontmatterProperties = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.frontmatterProperties.info_showFrontmatterProperties,
	});

	constructor() {
		super();
		this.featureId = "frontmatter-properties";
		this.displayTitle = i18n.settings.frontmatterProperties.title;
		this.featurePlacement = new FeatureRelation(
			".header .data-bar",
			RelationType.Start
		);
	}
}