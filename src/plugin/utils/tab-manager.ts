import {  PaneType, SplitDirection, TFile, WorkspaceLeaf } from "obsidian";


export namespace TabManager
{
	function getLeaf(navType: PaneType | boolean, splitDirection: SplitDirection = 'vertical'): WorkspaceLeaf
	{
		const leaf = navType === 'split' ? app.workspace.getLeaf(navType, splitDirection) : app.workspace.getLeaf(navType);
		return leaf;
	}

	export async function openFileInNewTab(file: TFile, navType: PaneType | boolean, splitDirection: SplitDirection = 'vertical'): Promise<WorkspaceLeaf> 
	{
		const leaf = getLeaf(navType, splitDirection);

		try
		{
			await leaf.openFile(file, undefined).catch((reason) =>
			{
				console.error("Failed to open file in new tab:", reason);
			});
		}
		catch (error)
		{
			console.error("Failed to open file in new tab:", error);
		}

		return leaf;
	}

	export function openNewTab(navType: PaneType | boolean, splitDirection: SplitDirection = 'vertical', makeActive: boolean = false): WorkspaceLeaf
	{
		let leaf = getLeaf(navType, splitDirection);
		if (makeActive) app.workspace.setActiveLeaf(leaf);
		return leaf;
	}
}
