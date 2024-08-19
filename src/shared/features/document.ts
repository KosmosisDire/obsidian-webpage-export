import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class DocumentOptions extends FeatureOptions
{
	allowFoldingLists: boolean = true;
	allowFoldingHeadings: boolean = true;
	documentWidth: string = "40em";

	info_allowFoldingLists = new FeatureSettingInfo({
		show: true,
		description: "Whether or not to allow lists to be folded"
	});
	info_allowFoldingHeadings = new FeatureSettingInfo({
		show: true,
		description: "Whether or not to allow headings to be folded"
	});
	info_documentWidth = new FeatureSettingInfo({
		show: true,
		description: "The width of the document"
	});

	constructor()
	{
		super();
		this.featureId = "obsidian-document";
	}
}
