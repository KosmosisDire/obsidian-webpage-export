import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class SidebarOptions extends FeatureOptions
{
	allowResizing: boolean = true;
	allowCollapsing: boolean = true;
	rightDefaultWidth: string = "20em";
	leftDefaultWidth: string = "20em";

	info_allowResizing = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.sidebars.info_allowResizing
	});
	info_allowCollapsing = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.sidebars.info_allowCollapsing
	});
	info_rightDefaultWidth = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.sidebars.info_rightDefaultWidth
	});
	info_leftDefaultWidth = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.sidebars.info_leftDefaultWidth
	});

	constructor()
	{
		super();
		this.featureId = "sidebar";
	}
}
