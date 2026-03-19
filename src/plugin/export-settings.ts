export type FeaturePosition = "before" | "after" | "start" | "end";

export interface FeatureConfig {
	enabled: boolean;
	selector: string;
	position: FeaturePosition;
	settings: Record<string, any>;
}

export interface ExportConfig {
	onlyExportModified: boolean;
	slugifyPaths: boolean;
	themeName: string;
	siteName: string;

	features: {
		fileNavigation: FeatureConfig;
		outline: FeatureConfig;
		graphView: FeatureConfig;
		search: FeatureConfig;
		themeToggle: FeatureConfig;
		backlinks: FeatureConfig;
		tags: FeatureConfig;
	};
}

export type FeatureId = keyof ExportConfig["features"];

export const DEFAULT_CONFIG: ExportConfig = {
	onlyExportModified: true,
	slugifyPaths: true,
	themeName: "",
	siteName: "",

	features: {
		fileNavigation: {
			enabled: true,
			selector: "#left-sidebar-content",
			position: "end",
			settings: {},
		},
		outline: {
			enabled: true,
			selector: "#right-sidebar-content",
			position: "end",
			settings: { startCollapsed: false },
		},
		graphView: {
			enabled: true,
			selector: "#right-sidebar-content",
			position: "start",
			settings: { showAttachments: false },
		},
		search: {
			enabled: true,
			selector: "#left-sidebar .topbar-content",
			position: "start",
			settings: {},
		},
		themeToggle: {
			enabled: true,
			selector: "#right-sidebar .topbar-content",
			position: "start",
			settings: {},
		},
		backlinks: {
			enabled: true,
			selector: ".footer",
			position: "start",
			settings: {},
		},
		tags: {
			enabled: true,
			selector: ".header .data-bar",
			position: "end",
			settings: {},
		},
	},
};

/** Runtime export options — not persisted, passed per-export. */
export interface ExportOptions {
	outputPath: string;
	forceFullExport: boolean;
}
