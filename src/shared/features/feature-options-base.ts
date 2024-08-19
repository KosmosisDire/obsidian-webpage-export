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
		description: "CSS selector for an element. The feature will be placed relative to this element."
	});

	info_type = new FeatureSettingInfo(
	{
		show: true, 
		description: "Will this feature be placed before, after, or inside (at the beggining or end).",
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
				validation?: (path: string) => {valid: boolean, isEmpty: boolean, error: string}, 
				browseButton?: boolean, 
				onChanged?: (path: string)=>void
			}
			dropdownTypes?: Record<string, string>
		})
	{
		if (options)
		{
			this.show = options.show;
			this.name = options.name;
			this.description = options.description;
			this.placeholder = options.placeholder;
			this.fileInputOptions = options.fileInputOptions;
			this.dropdownOptions = options.dropdownTypes;
		}
	}
}

export class FeatureOptions
{
	featureId: string = "feature";
	enabled: boolean = true;
}

export class InsertedFeatureOptions extends FeatureOptions
{
	displayTitle: string = "Feature";
	featurePlacement: FeatureRelation = new FeatureRelation();

	info_displayTitle = new FeatureSettingInfo(
	{
		show: true, 
		description: "Descriptive title to show above the feature"
	});
	info_featurePlacement = new FeatureSettingInfo(
	{
		show: true, 
		description: "Where to place this feature on the page. Multiple values will be tried in order until one succeeds. Multiple values will not insert this feature multiple times."
	});

	constructor(options?: InsertedFeatureOptions)
	{
		super();
		// object assign
		Object.assign(this, options);
	}

	public insertFeature(container: HTMLElement, feature: HTMLElement): boolean
	{
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

export class FetchedFeatureOptions extends InsertedFeatureOptions
{
	includePath: string;
	info_includePath = new FeatureSettingInfo({
		show: false,
		description: "The path on the server from which this feature can be loaded"
	});
}
