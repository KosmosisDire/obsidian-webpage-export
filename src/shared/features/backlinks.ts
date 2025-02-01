import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class BacklinksOptions extends InsertedFeatureOptionsWithTitle {
	constructor() {
		super();
		this.featureId = "backlinks";
		this.displayTitle = i18n.settings.backlinks.title;
		this.featurePlacement = new FeatureRelation(
			".footer",
			RelationType.Start
		);
	}
}


