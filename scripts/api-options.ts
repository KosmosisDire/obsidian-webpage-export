import { Setting } from "obsidian";
import { ExportPreset, Settings } from "./settings/settings";

export class MarkdownRendererAPIOptions
{
	container?: HTMLElement = undefined;
	keepViewContainer?: boolean = true;
	makeHeadersTrees?: boolean = true;
	postProcess?: boolean = true;
	displayProgress?: boolean = true;
}

export class MarkdownWebpageRendererAPIOptions extends MarkdownRendererAPIOptions
{
	addSidebars?: boolean = Settings.exportPreset != ExportPreset.RawDocuments;
	addThemeToggle?: boolean = Settings.includeThemeToggle;
	addFileNavigation?: boolean = Settings.includeFileTree;
	addOutline?: boolean = Settings.includeOutline;
	addSearch?: boolean = Settings.includeSearchBar;
	addGraphView?: boolean = Settings.includeGraphView;
	addBodyClasses?: boolean = true;
	addMathjaxStyles?: boolean = true;
	addHeadTag?: boolean = true;
	addTitle?: boolean = true;

	allowFoldingLists?: boolean = Settings.allowFoldingLists;
	allowFoldingHeadings?: boolean = Settings.allowFoldingHeadings;
	allowResizeSidebars?: boolean = Settings.allowResizingSidebars;
	openNavFileLocation?: boolean = true;
	startOutlineCollapsed?: boolean = Settings.startOutlineCollapsed;
	minOutlineCollapsibleLevel?: number = Settings.minOutlineCollapse;

	vaultName?: string = app.vault.getName();
	
	includeJS?: boolean = true;
	includeCSS?: boolean = true;
	inlineMedia?: boolean = Settings.inlineAssets;
	inlineCSS?: boolean = Settings.inlineAssets;
	inlineJS?: boolean = Settings.inlineAssets;
	inlineHTML?: boolean = Settings.inlineAssets;
	inlineFonts?: boolean = Settings.inlineAssets;
	offlineResources?: boolean = Settings.makeOfflineCompatible;
	webStylePaths?: boolean = Settings.makeNamesWebStyle;
	flattenExportPaths?: boolean = false;
	fixLinks?: boolean = true;
}
