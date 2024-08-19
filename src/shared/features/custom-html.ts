import { FeatureSettingInfo, InsertedFeatureOptions } from "./feature-options-base";




export class CustomHtmlOptions extends InsertedFeatureOptions
{
	public customHtml: string = "";
	info_customHtml = new FeatureSettingInfo
	({
		show: true,
		description: "Custom HTML to add to the page"
	})
}
