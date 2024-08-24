import { Shared } from "src/shared/shared";
import { FeatureRelation, FeatureSettingInfo, FetchedFeatureOptions, RelationType } from "./feature-options-base";

export class CustomHeadOptions extends FetchedFeatureOptions
{
	sourcePath: string = "";
	info_sourcePath = new FeatureSettingInfo(
	{
		show: true,
		description: "The local path to the source .html file which will be included.",
		fileInputOptions: {
			validation: (path: string) => {
				let isEmpty = (path || "").length === 0;
				let valid = path.endsWith(".html");
				return {valid: valid, isEmpty: isEmpty, error: !valid ? "Must be a path to a .html file" : ""};
			},
			browseButton: true
		}
	});

	constructor()
	{
		super();
		this.featureId = "custom-head";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation("head", RelationType.Start);
		this.includePath = `${Shared.libFolderName}/${Shared.htmlFolderName}/custom-head.html`;
	}
}
