

export const descriptions: Record<string, string> =
{
	// generic
	displayTitle: "Descriptive title to show above the feature",
	parentSelector: "CSS selector for the element in which this feature's view will be placed",
	includePath: "The path on the server from which this feature can be loaded",
	enabled: "Whether or not to enable this feature",

	// file tree
	showDefaultFolderIcons: "Show a default icon of a folder for every folder in the tree",
	showDefaultFileIcons: "Show a default icon of a file for every file in the tree",
	defaultFolderIcon: "The icon to use for folders. Prefix with 'lucide//' to use a Lucide icon",
	defaultFileIcon: "The icon to use for files. Prefix with 'lucide//' to use a Lucide icon",
	defaultMediaIcon: "The icon to use for media files. Prefix with 'lucide//' to use a Lucide icon",
	exposeStartingPath: "Whether or not to show the current file in the file tree when the page is first loaded",

	// graph view
	attractionForce: "How much should linked nodes attract each other? This will make the graph appear more clustered.",
	linkLength: "How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together.",
	repulsionForce: "How much should nodes repel each other? This will make the graph appear more spread out.",
	centralForce: "How much should nodes be attracted to the center? This will make the graph appear more dense and circular.",
	maxNodeRadius: "How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes.",
	minNodeRadius: "How small should the smallest nodes be? The smaller a node is the less it will attract other nodes.",
	edgePruning: "Edges with a length above this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links.",

	// outline
	startCollapsed: "Whether or not to start with all headings collapsed.",
	minCollapseDepth: "0 will allow collapsing all headings, 1 will allow collapsing all headings except the top level, etc...",

	// sidebars
	allowResizing: "Whether or not to allow the sidebars to be resized",
	allowCollapsing: "Whether or not to allow the sidebars to be collapsed",
	rightDefaultWidth: "The default width of the right sidebar",
	leftDefaultWidth: "The default width of the left sidebar",

	// document
	allowFoldingHeadings: "Whether or not to allow headings to be folded",
	allowFoldingLists: "Whether or not to allow lists to be folded",
	documentWidth: "The width of the document",

	// properties
	hideProperties: "A list of properties to hide from the properties view",

}
