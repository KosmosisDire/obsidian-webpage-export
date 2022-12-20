import {  OpenViewState, PaneType, SplitDirection, TFile, WorkspaceLeaf } from "obsidian";


export class LeafHandler
{
	// https://github.com/darlal/obsidian-switcher-plus/blob/27d337039883008bcbf40ca13ea2f9287469dde4/src/Handlers/handler.ts#L388
	// Some functions here are from this source and have been modified to fit the needs of this plugin.

	isMainPanelLeaf(leaf: WorkspaceLeaf): boolean 
	{
		const { workspace } = app;
		const root = leaf?.getRoot();
		/*@ts-ignore*/
		return root === workspace.rootSplit || root === workspace.floatingSplit;
	}

	getOpenLeaves(excludeMainPanelViewTypes?: string[], includeSidePanelViewTypes?: string[]): WorkspaceLeaf[] 
	{
		const leaves: WorkspaceLeaf[] = [];

		const saveLeaf = (l: WorkspaceLeaf) =>
		{
			const viewType = l.view?.getViewType();

			if (this.isMainPanelLeaf(l))
			{
				if (!excludeMainPanelViewTypes?.includes(viewType))
				{
					leaves.push(l);
				}
			} else if (includeSidePanelViewTypes?.includes(viewType))
			{
				leaves.push(l);
			}
		};

		app.workspace.iterateAllLeaves(saveLeaf);
		return leaves;
	}

	openFileInNewLeaf(
		file: TFile,
		navType: PaneType | boolean,
		openState?: OpenViewState,
		errorContext?: string,
		splitDirection: SplitDirection = 'vertical',
	): WorkspaceLeaf 
	{
		const { workspace } = app;
		errorContext = errorContext ?? '';
		const message = `HTML Export: error opening file. ${errorContext}`;

		const getLeaf = () =>
		{
			return navType === 'split'
				? workspace.getLeaf(navType, splitDirection)
				: workspace.getLeaf(navType);
		};

		let leaf = getLeaf();

		try
		{
			leaf.openFile(file, openState).catch((reason) =>
			{
				console.log(message, reason);
			});

		}
		catch (error)
		{
			console.log(message, error);
		}

		return leaf;
	}
}

