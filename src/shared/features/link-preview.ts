import { i18n } from "src/plugin/translations/language";
import { FeatureOptions } from "./feature-options-base";

export class LinkPreviewOptions extends FeatureOptions {
	constructor() {
		super();
		this.featureId = "link-preview";
		this.hideSettingsButton = true;
	}
}
