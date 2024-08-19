import { Shared } from "shared/shared";
import { FeatureRelation, FeatureSettingInfo, FetchedFeatureOptions, RelationType } from "./feature-options-base";

export class FileNavigationOptions extends FetchedFeatureOptions
{
	showDefaultFolderIcons: boolean = false;
	showDefaultFileIcons: boolean = false;
	defaultFolderIcon: string = "lucide//folder";
	defaultFileIcon: string = "lucide//file";
	defaultMediaIcon: string = "lucide//file-image";
	exposeStartingPath: boolean = true;
		
	info_showDefaultFolderIcons: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: "Show a default icon of a folder for every folder in the tree"
	});
	info_showDefaultFileIcons: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: "Show a default icon of a file for every file in the tree"
	});
	info_defaultFolderIcon: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: "The icon to use for folders. Prefix with 'lucide//' to use a Lucide icon"
	});
	info_defaultFileIcon: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: "The icon to use for files. Prefix with 'lucide//' to use a Lucide icon"
	});
	info_defaultMediaIcon: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: "The icon to use for media files. Prefix with 'lucide//' to use a Lucide icon"
	});
	info_exposeStartingPath: FeatureSettingInfo = new FeatureSettingInfo(
	{
		show: true, 
		description: "Whether or not to show the current file in the file tree when the page is first loaded"
	});

	constructor()
	{
		super();
		this.featureId = "file-navigation";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation("#left-sidebar-content", RelationType.End);
		this.includePath = `${Shared.libFolderName}/${Shared.htmlFolderName}/file-tree.html`;
	}
}
