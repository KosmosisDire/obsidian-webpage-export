import { Settings, SettingsPage } from "scripts/settings/settings";
import { Path } from "./path";
/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;

export namespace FileDialogs
{
	export async function  showSaveDialog(defaultPath: Path, defaultFileName: string, showAllFilesOption: boolean = true): Promise<Path | undefined>
	{
		// get paths
		let absoluteDefaultPath = defaultPath.directory.absoluted().joinString(defaultFileName);
		
		// add filters
		let filters = [{
			name: this.trimStart(absoluteDefaultPath.extension, ".").toUpperCase() + " Files",
			extensions: [this.trimStart(absoluteDefaultPath.extension, ".")]
		}];

		if (showAllFilesOption)
		{
			filters.push({
				name: "All Files",
				extensions: ["*"]
			});
		}

		// show picker
		let picker = await dialog.showSaveDialog({
			defaultPath: absoluteDefaultPath.path,
			filters: filters,
			properties: ["showOverwriteConfirmation"]
		})

		if (picker.canceled || !picker.filePath) return;
		
		let pickedPath = new Path(picker.filePath);
		Settings.exportPath = pickedPath.path;
		SettingsPage.saveSettings();
		
		return pickedPath;
	}

	export async function  showSelectFolderDialog(defaultPath: Path): Promise<Path | undefined>
	{
		if(!defaultPath.exists) defaultPath = Path.vaultPath;

		// show picker
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath.directory.path,
			properties: ["openDirectory"]
		});

		if (picker.canceled) return;

		let path = new Path(picker.filePaths[0]);
		Settings.exportPath = path.directory.path;
		SettingsPage.saveSettings();

		return path;
	}

	export async function  showSelectFileDialog(defaultPath: Path): Promise<Path | undefined>
	{
		if(!defaultPath.exists) defaultPath = Path.vaultPath;

		// show picker
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath.directory.path,
			properties: ["openFile"]
		});

		if (picker.canceled) return;

		let path = new Path(picker.filePaths[0]);
		return path;
	}

	export function idealDefaultPath() : Path
	{
		let lastPath = new Path(Settings.exportPath);

		if (lastPath.path != "" && lastPath.exists)
		{
			return lastPath.directory;
		}

		return Path.vaultPath;
	}
}
