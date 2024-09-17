import moment from "moment";
import { language as cn } from './zh-cn';
import { language as en } from './en';
import { info } from "console";

export interface i18n
{
	cancel: string;
	browse: string;
	pathInputPlaceholder: string;
	pathValidations:
	{
		noEmpty: string;
		mustExist: string;
		noTilde: string;
		noAbsolute: string;
		noRelative: string;
		noFiles: string;
		noFolders: string;
		mustHaveExtension: string;
	},
	updateAvailable: string;
	exportAsHTML: string;
	exportModal: 
	{
		title: string;
		exportAsTitle: string;
		moreOptions: string;
		openAfterExport: string;
		exportButton: string;
		filePicker: 
		{
			title: string;
			selectAll: string;
			save: string;
		}
		currentSite: 
		{
			noSite: string;
			oldSite: string;
			pathContainsSite: string;
			fileCount: string;
			lastExported: string;
		}
		exportMode: {
			title: string;
			online: string;
			local: string;
			rawDocuments: string;
		},
		purgeExport: {
			description: string;
			clearCache: string;
			purgeSite: string;
			confirmation: string;
			clearWarning: string;
			purgeWarning: string;
		},
	}
	settings:
	{
		title: string;
		support: string;
		debug: string;
		pageFeatures: {
			title: string;
			description: string;
		},
		baseFeatures:
		{
			info_selector: string;
			info_type: string;
			info_displayTitle: string;
			info_featurePlacement: string;
		},
		document: {
			title: string;
			description: string;
			info_allowFoldingLists: string;
			info_allowFoldingHeadings: string;
			info_documentWidth: string;
		},
		sidebars: {
			title: string;
			description: string;
			info_allowResizing: string;
			info_allowCollapsing: string;
			info_rightDefaultWidth: string;
			info_leftDefaultWidth: string;
		},
		fileNavigation: {
			title: string;
			description: string;
			info_showDefaultFolderIcons: string;
			info_showDefaultFileIcons: string;
			info_defaultFolderIcon: string;
			info_defaultFileIcon: string;
			info_defaultMediaIcon: string;
			info_exposeStartingPath: string;
		},
		outline: {
			title: string;
			description: string;
			info_startCollapsed: string;
			info_minCollapseDepth: string;
		},
		graphView: {
			title: string;
			description: string;
			info_showOrphanNodes: string;
			info_showAttachments: string;
			info_allowGlobalGraph: string;
			info_allowExpand: string;
			info_attractionForce: string;
			info_linkLength: string;
			info_repulsionForce: string;
			info_centralForce: string;
			info_edgePruning: string;
			info_minNodeRadius: string;
			info_maxNodeRadius: string;
		},
		search: {
			title: string;
			description: string;
			placeholder: string;
		},
		themeToggle: {
			title: string;
			description: string;
		},
		customHead: {
			title: string;
			description: string;
			info_sourcePath: string;
			validationError: string;
		},
		backlinks: {
			title: string;
			description: string;
		},
		tags: {
			title: string;
			description: string;
			info_showInlineTags: string;
			info_showFrontmatterTags: string;
		},
		aliases: {
			title: string;
			description: string;
		},
		properties: {
			title: string;
			description: string;
			info_hideProperties: string;
		},
		assetOptions: {
			title: string;
			description: string;
		},
		makeOfflineCompatible: {
			title: string;
			description: string;
		},
		includeSvelteCSS: {
			title: string;
			description: string;
		},
		includePluginCSS: {
			title: string;
			description: string;
		}
	}
}

function getUserLanguage(): string {
	const locale = moment.locale();
	const language = locale ? moment.locale() : "en";
	return language;
}

function getLanguage() 
{
	return translations["zh-cn"];
	const settingLanguages = getUserLanguage();
	const language = translations[settingLanguages];
	if (!language) {
		return translations["en"];
	}
	return language;
}

export let translations: { [key: string]: i18n } = 
{
	"en": en,
	"zh-cn": cn
};

export let i18n: i18n = getLanguage();
