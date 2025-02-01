import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class RssOptions extends FeatureOptions
{
	siteUrl: string = '';
	authorName: string = '';

	info_siteUrl = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.rss.info_siteUrl,
		placeholder: i18n.settings.rss.info_siteUrlPlaceholder
	});

	info_authorName = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.rss.info_authorName
	});

	constructor()
	{
		super();
		this.featureId = "rss";
	}
}
