import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class SidebarOptions extends FeatureOptions
{
	allowResizing: boolean = true;
	allowCollapsing: boolean = true;
	rightDefaultWidth: string = "20em";
	leftDefaultWidth: string = "20em";

	info_allowResizing = new FeatureSettingInfo({
		show: true,
		description: "Whether or not to allow the sidebars to be resized"
	});
	info_allowCollapsing = new FeatureSettingInfo({
		show: true,
		description: "Whether or not to allow the sidebars to be collapsed"
	});
	info_rightDefaultWidth = new FeatureSettingInfo({
		show: true,
		description: "The default width of the right sidebar"
	});
	info_leftDefaultWidth = new FeatureSettingInfo({
		show: true,
		description: "The default width of the left sidebar"
	});

	constructor()
	{
		super();
		this.featureId = "sidebar";
	}
}
