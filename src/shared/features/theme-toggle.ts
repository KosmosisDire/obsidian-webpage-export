import {
	FeatureRelation,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class ThemeToggleOptions extends InsertedFeatureOptionsWithTitle {
	constructor() {
		super();
		this.featureId = "theme-toggle";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation(
			"#right-sidebar .topbar-content",
			RelationType.Start
		);
	}
}
