import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class GraphViewOptions extends InsertedFeatureOptions
{
	showOrphanNodes: boolean = true;
	showAttachments: boolean = false;
	allowGlobalGraph: boolean = true;
	allowExpand: boolean = true;

	attractionForce: number = 1;
	linkLength: number = 15;
	repulsionForce: number = 80;
	centralForce: number = 2;
	edgePruning: number = 100;
	minNodeRadius: number = 3;
	maxNodeRadius: number = 7;

	info_showOrphanNodes = new FeatureSettingInfo(
	{
		show: true,
		description: "Show nodes that are not connected to any other nodes."
	});
	info_showAttachments = new FeatureSettingInfo(
	{
		show: true,
		description: "Show attachments like images and PDFs as nodes in the graph."
	});
	info_allowGlobalGraph = new FeatureSettingInfo(
	{
		show: true,
		description: "Allow the user to view the global graph of all nodes."
	});
	info_allowExpand = new FeatureSettingInfo(
	{
		show: true,
		description: "Allow the user to pop-out the graph view to take up the whole screen"
	});
	info_attractionForce = new FeatureSettingInfo(
	{
		show: true,
		description: "How much should linked nodes attract each other? This will make the graph appear more clustered."
	});
	info_linkLength = new FeatureSettingInfo(
	{
		show: true,
		description: "How long should the links between nodes be? The shorter the links the closer connected nodes will cluster together."
	});
	info_repulsionForce = new FeatureSettingInfo(
	{
		show: true,
		description: "How much should nodes repel each other? This will make the graph appear more spread out."
	});
	info_centralForce = new FeatureSettingInfo(
	{
		show: true,
		description: "How much should nodes be attracted to the center? This will make the graph appear more dense and circular."
	});
	info_edgePruning = new FeatureSettingInfo(
	{
		show: true,
		description: "Edges with a length above this threshold will not be rendered, however they will still contribute to the simulation. This can help large tangled graphs look more organised. Hovering over a node will still display these links."
	});
	info_minNodeRadius = new FeatureSettingInfo(
	{
		show: true,
		description: "How small should the smallest nodes be? The smaller a node is the less it will attract other nodes."
	});
	info_maxNodeRadius = new FeatureSettingInfo(
	{
		show: true,
		description: "How large should the largest nodes be? Nodes are sized by how many links they have. The larger a node is the more it will attract other nodes. This can be used to create a good grouping around the most important nodes."
	});

	constructor()
	{
		super();
		this.featureId = "graph-view";
		this.displayTitle = "Graph View";
		this.featurePlacement = new FeatureRelation("#right-sidebar-content", RelationType.Start);
	}
}
