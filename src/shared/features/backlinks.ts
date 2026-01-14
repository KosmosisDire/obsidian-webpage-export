import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class BacklinksOptions extends InsertedFeatureOptionsWithTitle {
	placeInRightSidebar: boolean = false;

	public afterSettingsChange(): void {
		this.updatePlacement();
	}

	info_placeInRightSidebar = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.backlinks.info_placeInRightSidebar,
	});

	constructor() {
		super();
		this.featureId = "backlinks";
		this.displayTitle = i18n.settings.backlinks.title;
		this.updatePlacement();
	}

	private updatePlacement(): void {
		if (this.placeInRightSidebar) {
			this.featurePlacement = new FeatureRelation(
				"#right-sidebar-content",
				RelationType.End
			);
		} else {
			this.featurePlacement = new FeatureRelation(
				".footer",
				RelationType.Start
			);
		}
	}
}


