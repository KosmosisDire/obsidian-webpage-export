import {  MarkdownView, OpenViewState, PaneType, SplitDirection, TFile, View, WorkspaceLeaf } from "obsidian";


export class LeafHandler
{
	// https://github.com/darlal/obsidian-switcher-plus/blob/27d337039883008bcbf40ca13ea2f9287469dde4/src/Handlers/handler.ts#L388
	// Some functions here are from this source and have been modified to fit the needs of this plugin.

	public static async openFileInNewLeaf(file: TFile, navType: PaneType | boolean, splitDirection: SplitDirection = 'vertical'): Promise<WorkspaceLeaf> 
	{
		const { workspace } = app;

		const getLeaf = () =>
		{
			return navType === 'split'
				? workspace.getLeaf(navType, splitDirection)
				: workspace.getLeaf(navType);
		};

		let leaf = getLeaf();

		try
		{
			await leaf.openFile(file, undefined).catch((reason) =>
			{
				console.log(reason);
			});
		}
		catch (error)
		{
			console.log(error);
		}

		return leaf;
	}

	public static openBlankLeaf(navType: PaneType | boolean, splitDirection: SplitDirection = 'vertical'): WorkspaceLeaf
	{
		const { workspace } = app;
		
		const getLeaf = () =>
		{
			return navType === 'split'
				? workspace.getLeaf(navType, splitDirection)
				: workspace.getLeaf(navType);
		}

		let leaf = getLeaf();

		return leaf;
	}

}

