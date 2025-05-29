import { i18n } from "./language";

export const language: i18n =
{
	cancel: "取消",
	browse: "浏览",
	pathInputPlaceholder: "输入或浏览路径...",
	pathValidations:
	{
		noEmpty: "路径不能为空",
		mustExist: "路径不存在",
		noTilde: "不允许使用带有波浪号 (~) 的主目录",
		noAbsolute: "路径不能是绝对路径",
		noRelative: "路径不能是相对路径",
		noFiles: "路径不能是文件",
		noFolders: "路径不能是文件夹",
		mustHaveExtension: "路径必须包含扩展名: {0}",
	},
	updateAvailable: "有更新可用",
	exportAsHTML: "导出为HTML",
	exportModal:
	{
		title: "导出为HTML",
		exportAsTitle: "将 {0} 导出为HTML",
		moreOptions: "更多选项请查看插件设置页面。",
		openAfterExport: "导出后打开",
		exportButton: "导出",
		filePicker:
		{
			title: "选择导出库中的所有文件",
			selectAll: "全选",
			save: "保存",
		},
		currentSite:
		{
			noSite: "此路径当前不包含已导出的网站。",
			oldSite: "此路径包含使用不同插件版本创建的导出内容。",
			pathContainsSite: "站点",
			fileCount: "文件数量",
			lastExported: "最后导出时间",
		},
		exportMode: {
			title: "导出模式",
			online: "如果您的文件将通过HTTP服务器在线访问，请使用此选项。",
			local: "这将导出一个包含所有内容的单个（较大）HTML文件。仅适用于离线共享。",
			rawDocuments: "导出普通的HTML文档，带有简单的样式和脚本，但无额外功能。",
		},
		purgeExport: {
			description: "清除站点缓存以重新导出所有文件。",
			clearCache: "清除缓存",
			confirmation: "您确定吗？",
			clearWarning: "此操作将删除站点的元数据（但不会删除所有导出的HTML文件）。\n\n这将强制站点重新导出所有文件。\n\n此外，如果您在再次导出之前更改了选定的导出文件，某些文件可能会保留在文件系统中未使用。\n\n此操作不可撤销。",
		},
	},
	settings:
	{
		title: "HTML导出设置",
		support: "支持该插件的持续开发。",
		debug: "将调试信息复制到剪贴板",
		unavailableSetting: "⚠️ 此功能在 {0} 模式下不可用。",
		pageFeatures: {
			title: "页面功能",
			description: "控制导出页面的各种功能。"
		},
		baseFeatures:
		{
			info_selector: "用于定位元素的CSS选择器。功能将相对于该元素放置。",
			info_type: "该功能将放置在该元素之前、之后，还是内部（开头或结尾）。",
			info_displayTitle: "功能上方显示的描述性标题",
			info_featurePlacement: "将此功能放置在页面上的位置（相对于选择器）。",
		},
		document: {
			title: "文档",
			description: "控制文档本身的设置",
			info_allowFoldingLists: "是否允许列表折叠",
			info_allowFoldingHeadings: "是否允许标题折叠",
			info_documentWidth: "文档的宽度"
		},
		sidebars: {
			title: "侧边栏",
			description: "包含文件导航、大纲、主题切换、图形视图等所有其他功能。",
			info_allowResizing: "是否允许用户调整侧边栏的大小",
			info_allowCollapsing: "是否允许用户折叠侧边栏",
			info_rightDefaultWidth: "右侧边栏的默认宽度",
			info_leftDefaultWidth: "左侧边栏的默认宽度"
		},
		fileNavigation: {
			title: "文件导航",
			description: "显示一个文件树，用于浏览导出的库。",
			info_showCustomIcons: "为树中的每个文件显示一个自定义图标",
			info_showDefaultFolderIcons: "为树中的每个文件夹显示一个默认图标",
			info_showDefaultFileIcons: "为树中的每个文件显示一个默认图标",
			info_defaultFolderIcon: "用于文件夹的图标。使用'lucide//'前缀使用Lucide图标",
			info_defaultFileIcon: "用于文件的图标。使用'lucide//'前缀使用Lucide图标",
			info_defaultMediaIcon: "用于媒体文件的图标。使用'lucide//'前缀使用Lucide图标",
			info_exposeStartingPath: "在页面首次加载时是否显示文件树中的当前文件"
		},
		outline: {
			title: "大纲",
			description: "显示当前文档的标题列表。",
			info_startCollapsed: "大纲是否开始折叠？",
			info_minCollapseDepth: "应折叠标题的最小深度"
		},
		graphView: {
			title: "图形视图",
			description: "显示您的库的可视化交互表示。（注意：此功能仅适用于托管在Web服务器上的导出）",
			info_showOrphanNodes: "显示未连接到任何其他节点的节点。",
			info_showAttachments: "将附件（如图像和PDF）显示为图中的节点。",
			info_allowGlobalGraph: "允许用户查看所有节点的全局图。",
			info_allowExpand: "允许用户将图形视图弹出至全屏显示。",
			info_attractionForce: "链接节点之间的吸引力有多大？吸引力越大，图形将显得越集中。",
			info_linkLength: "节点之间的链接应有多长？链接越短，节点将聚集得更紧密。",
			info_repulsionForce: "节点之间的排斥力有多大？排斥力越大，分离的节点将分散得越远。",
			info_centralForce: "节点被吸引到中心的程度有多大？吸引力越大，图形看起来越密集和呈圆形。",
			info_edgePruning: "超过此阈值长度的边将不会显示，但仍然参与图形计算。这有助于大型复杂图形显得更加有序。悬停在节点上时，仍会显示这些链接。",
			info_minNodeRadius: "最小节点的大小是多少？节点越小，吸引其他节点的力量越小。",
			info_maxNodeRadius: "最大节点的大小是多少？节点大小取决于它们的链接数量。节点越大，吸引其他节点的力量越大。这有助于围绕最重要的节点形成良好的分组。"
		},
		search: {
			title: "搜索栏",
			description: "允许您搜索库，列出匹配的文件和标题。（注意：此功能仅适用于托管在Web服务器上的导出）",
			placeholder: "搜索..."
		},
		linkPreview: {
			title: "链接预览",
			description: "当鼠标悬停在指向其他文档的内部链接上时显示预览。"
		},
		themeToggle: {
			title: "主题切换",
			description: "允许动态切换暗色和亮色主题。"
		},
		customHead: {
			title: "自定义HTML / JS",
			description: "插入一个指定的HTML文件到页面上，可包含自定义JS或CSS。",
			info_sourcePath: "包含的本地HTML文件路径。",
			validationError: "必须是一个指向HTML文件的路径。"
		},
		backlinks: {
			title: "反向链接",
			description: "显示链接到当前文档的所有文档。"
		},
		tags: {
			title: "标签",
			description: "显示当前打开文档的标签。",
			info_showInlineTags: "在页面顶部显示文档内定义的标签。",
			info_showFrontmatterTags: "在页面顶部显示文档前置区域定义的标签。"
		},
		aliases: {
			title: "别名",
			description: "显示当前文档的别名。"
		},
		properties: {
			title: "属性",
			description: "以表格形式显示当前文档的所有属性。",
			info_hideProperties: "要从属性视图中隐藏的属性列表"
		},
		rss: {
			title: "RSS",
			description: "为导出的站点生成RSS源",
			info_siteUrl: "此站点将托管的URL",
			info_siteUrlPlaceholder: "https://example.com/mysite",
			info_authorName: "站点作者的名称"
		},
		styleOptionsSection: {
			title: "样式选项",
			description: "配置导出中包含的样式"
		},
		makeOfflineCompatible: {
			title: "使页面离线兼容",
			description: "下载所有在线资源、图像、脚本，使页面可以离线查看，或者使网站不依赖CDN。"
		},
		includePluginCSS: {
			title: "包含插件的CSS",
			description: "在导出的HTML中包含以下插件的CSS。如果插件功能未正确呈现，请尝试将插件添加到此列表中。避免无必要添加插件，因为更多的CSS会增加页面的加载时间。"
		},
		includeStyleCssIds: {
			title: "包含特定ID的样式",
			description: "在导出的HTML中包含带有以下ID的样式标签的CSS。"
		},
		generalSettingsSection: {
			title: "通用设置",
			description: "控制网站图标和站点元数据等简单设置",
		},
		favicon: {
			title: "网站图标",
			description: "站点的网站图标的本地路径",
		},
		siteName: {
			title: "站点名称",
			description: "库/导出站点的名称",
		},
		iconEmojiStyle: {
			title: "图标表情符号样式",
			description: "用于自定义图标的表情符号样式",
		},
		themeName: {
			title: "主题",
			description: "导出使用的已安装主题",
		},
		exportSettingsSection: {
			title: "导出设置",
			description: "控制更多技术性导出设置，如控制链接的生成方式",
		},
		relativeHeaderLinks: {
			title: "使用相对标题链接",
			description: "为标题使用相对链接而不是绝对链接",
		},
		slugifyPaths: {
			title: "路径别名化",
			description: "使所有路径和文件名符合网络风格（小写，无空格）",
		},
		addPageIcon: {
			title: "添加页面图标",
			description: "在页面标题中添加文件的图标",
		},
		obsidianSettingsSection: {
			title: "Obsidian设置",
			description: "控制插件在Obsidian中的运行方式",
		},
		logLevel: {
			title: "日志级别",
			description: "设置在控制台中显示的日志级别",
		},
		titleProperty: {
			title: "标题属性",
			description: "用作文档标题的属性",
		},
	}
}
