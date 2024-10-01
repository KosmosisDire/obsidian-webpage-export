import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class RssOptions extends FeatureOptions
{
	siteUrl: string = '';
	siteName: string = app.vault.getName();
	authorName: string = '';

	info_siteUrl = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.rss.info_siteUrl,
		placeholder: i18n.settings.rss.info_siteUrlPlaceholder
	});

	info_siteName = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.rss.info_siteName
	});

	info_authorName = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.rss.info_authorName
	});

	constructor()
	{
		super();
		this.featureId = "obsidian-document";
	}
}
