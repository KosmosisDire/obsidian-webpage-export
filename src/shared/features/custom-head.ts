import { Shared } from "src/shared/shared";
import { FeatureRelation, FeatureSettingInfo, FetchedFeatureOptions, RelationType } from "./feature-options-base";
import { i18n } from "src/plugin/translations/language";

export class CustomHeadOptions extends FetchedFeatureOptions
{
	sourcePath: string = "";
	info_sourcePath = new FeatureSettingInfo(
	{
		show: true,
		description: i18n.settings.customHead.info_sourcePath,
		fileInputOptions: {
			makeRelativeToVault: true,
			validation: (path: string) => {
				let isEmpty = (path || "").length === 0;
				let valid = path.endsWith(".html") || isEmpty;
				return {valid: valid, isEmpty: isEmpty, error: !valid ? i18n.settings.customHead.validationError : ""};
			},
			browseButton: true
		}
	});

	constructor()
	{
		super();
		this.featureId = "custom-head";
		this.featurePlacement = new FeatureRelation("head", RelationType.End);
		this.includePath = `${Shared.libFolderName}/${Shared.htmlFolderName}/custom-head.html`;
	}
}
