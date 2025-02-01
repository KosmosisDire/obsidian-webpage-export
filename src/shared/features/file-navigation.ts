import { Shared } from "src/shared/shared";
import { FeatureRelation, FeatureSettingInfo, FetchedFeatureOptions, RelationType } from "./feature-options-base";
import { i18n } from "src/plugin/translations/language";

export class FileNavigationOptions extends FetchedFeatureOptions
{
	showCustomIcons: boolean = false;
	showDefaultFolderIcons: boolean = false;
	showDefaultFileIcons: boolean = false;
	defaultFolderIcon: string = "lucide//folder";
	defaultFileIcon: string = "lucide//file";
	defaultMediaIcon: string = "lucide//file-image";
	exposeStartingPath: boolean = true;
	
	info_showCustomIcons: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_showCustomIcons
	});
	info_showDefaultFolderIcons: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_showDefaultFolderIcons
	});
	info_showDefaultFileIcons: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_showDefaultFileIcons
	});
	info_defaultFolderIcon: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_defaultFolderIcon
	});
	info_defaultFileIcon: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_defaultFileIcon
	});
	info_defaultMediaIcon: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_defaultMediaIcon
	});
	info_exposeStartingPath: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.fileNavigation.info_exposeStartingPath
	});

	constructor()
	{
		super();
		this.featureId = "file-navigation";
		this.featurePlacement = new FeatureRelation("#left-sidebar-content", RelationType.End);
		this.includePath = `${Shared.libFolderName}/${Shared.htmlFolderName}/file-tree.html`;
	}
}
