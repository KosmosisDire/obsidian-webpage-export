import { i18n } from "src/plugin/translations/language";

export enum RelationType
{
	Before = "before",
	After = "after",
	Start = "start",
	End = "end",
}

export class FeatureRelation
{
	selector: string = "#right-sidebar-content";
	type: RelationType = RelationType.Start;

	info_selector = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.baseFeatures.info_selector
	});

	info_type = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.baseFeatures.info_type,
		dropdownTypes: RelationType
	});

	constructor(selector: string = "#right-sidebar-content", type: RelationType = RelationType.Start)
	{
		this.selector = selector;
		this.type = type;
	}
}

export class FeatureSettingInfo
{
	show?: boolean = true;
	name?: string = "";
	description?: string = "";
	placeholder?: string = "";

	fileInputOptions?:
	{
		defaultPath?: string, 
		pickFolder?: boolean, 
		makeRelativeToVault?: boolean,
		validation?: (path: string) => {valid: boolean, isEmpty: boolean, error: string}, 
		browseButton?: boolean, 
		onChanged?: (path: string)=>void
	} = undefined;

	dropdownOptions?: Record<string, string> = undefined;

	constructor(options?: 
		{
			show?: boolean,
			name?: string, 
			description?: string, 
			placeholder?: string, 
			fileInputOptions?:
			{
				defaultPath?: string, 
				pickFolder?: boolean, 
				makeRelativeToVault?: boolean,
				validation?: (path: string) => {valid: boolean, isEmpty: boolean, error: string}, 
				browseButton?: boolean, 
				onChanged?: (path: string)=>void
			}
			dropdownTypes?: Record<string, any>
		})
	{
		if (options)
		{
			this.show = options.show ?? this.show;
			this.name = options.name ?? this.name;
			this.description = options.description ?? this.description;
			this.placeholder = options.placeholder ?? this.placeholder;
			this.fileInputOptions = options.fileInputOptions ?? this.fileInputOptions;
			this.dropdownOptions = options.dropdownTypes ?? this.dropdownOptions;
		}
	}
}

export class FeatureOptions
{
	featureId: string = "feature";
	enabled: boolean = true;
	unavailable: boolean = false;
	alwaysEnabled: boolean = false;
	hideSettingsButton: boolean = false;

	public setAvailable(value: boolean)
	{
		this.unavailable = !value;
		this.enabled = value;
	}
}

export class InsertedFeatureOptions extends FeatureOptions
{
	featurePlacement: FeatureRelation = new FeatureRelation();
	info_featurePlacement = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.baseFeatures.info_featurePlacement,
	});

	constructor(featureId?: string, featurePlacement?: FeatureRelation)
	{
		super();
		this.featureId = featureId ?? "inserted-feature";
		this.featurePlacement = featurePlacement ?? new FeatureRelation();
	}

	public insertFeature(container: HTMLElement, feature: HTMLElement): boolean
	{
		if (!container) return false;
		let relation = container.querySelector(this.featurePlacement.selector) as HTMLElement;
		if (relation)
		{
			switch (this.featurePlacement.type)
			{
				case RelationType.Before:
					relation.before(feature);
					return true;
				case RelationType.After:
					relation.after(feature);
					return true;
				case RelationType.Start:
					relation.prepend(feature);
					return true;
				case RelationType.End:
					relation.append(feature);
					return true;
				default:
					return false;
			}
		}

		return false;
	}
}

export class InsertedFeatureOptionsWithTitle extends InsertedFeatureOptions
{
	displayTitle: string = "Feature";

	info_displayTitle = new FeatureSettingInfo(
	{
		show: true, 
		description: i18n.settings.baseFeatures.info_displayTitle
	});
}

export class FetchedFeatureOptions extends InsertedFeatureOptions
{
	includePath: string;
	info_includePath = new FeatureSettingInfo({
		show: false,
	});
}
