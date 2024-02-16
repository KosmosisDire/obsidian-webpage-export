import {  MarkdownView, PluginManifest, TextFileView } from 'obsidian';
import { Path } from './path';
import { ExportLog } from '../html-generation/render-log';
import { Downloadable } from './downloadable';
import { Settings, SettingsPage } from 'scripts/settings/settings';

/* @ts-ignore */
const dialog: Electron.Dialog = require('electron').remote.dialog;

export class Utils
{
	static async delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}

	static padStringBeggining(str: string, length: number, char: string)
	{
		return char.repeat(length - str.length) + str;
	}

	static includesAny(str: string, substrings: string[]): boolean
	{
		for (let substring of substrings)
		{
			if (str.includes(substring)) return true;
		}

		return false;
	}

	static async urlAvailable(url: RequestInfo | URL) 
	{
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), 4000);
		
		const response = await fetch(url, {signal: controller.signal, mode: "no-cors"});
		clearTimeout(id);
	  
		return response;
	}

	static sampleCSSColorHex(variable: string, testParentEl: HTMLElement): { a: number, hex: string }
	{
		let testEl = document.createElement('div');
		testEl.style.setProperty('display', 'none');
		testEl.style.setProperty('color', 'var(' + variable + ')');
		testParentEl.appendChild(testEl);

		let col = getComputedStyle(testEl).color;
		let opacity = getComputedStyle(testEl).opacity;

		testEl.remove();

		function toColorObject(str: string)
		{
			var match = str.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
			return match ? {
				red: parseInt(match[1]),
				green: parseInt(match[2]),
				blue: parseInt(match[3]),
				alpha: 1
			} : null
		}

		var color = toColorObject(col), alpha = parseFloat(opacity);
		return isNaN(alpha) && (alpha = 1),
		color ? {
			a: alpha * color.alpha,
			hex: Utils.padStringBeggining(color.red.toString(16), 2, "0") + Utils.padStringBeggining(color.green.toString(16), 2, "0") + Utils.padStringBeggining(color.blue.toString(16), 2, "0")
		} : {
			a: alpha,
			hex: "ffffff"
		}
	};

	static async changeViewMode(view: MarkdownView, modeName: "preview" | "source")
	{
		/*@ts-ignore*/
		const mode = view.modes[modeName]; 
		/*@ts-ignore*/
		mode && await view.setMode(mode);
	};

	static async showSaveDialog(defaultPath: Path, defaultFileName: string, showAllFilesOption: boolean = true): Promise<Path | undefined>
	{
		// get paths
		let absoluteDefaultPath = defaultPath.directory.absolute().joinString(defaultFileName);
		
		// add filters
		let filters = [{
			name: Utils.trimStart(absoluteDefaultPath.extension, ".").toUpperCase() + " Files",
			extensions: [Utils.trimStart(absoluteDefaultPath.extension, ".")]
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
			defaultPath: absoluteDefaultPath.asString,
			filters: filters,
			properties: ["showOverwriteConfirmation"]
		})

		if (picker.canceled || !picker.filePath) return;
		
		let pickedPath = new Path(picker.filePath);
		Settings.exportPath = pickedPath.asString;
		SettingsPage.saveSettings();
		
		return pickedPath;
	}

	static async showSelectFolderDialog(defaultPath: Path): Promise<Path | undefined>
	{
		if(!defaultPath.exists) defaultPath = Path.vaultPath;

		// show picker
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath.directory.asString,
			properties: ["openDirectory"]
		});

		if (picker.canceled) return;

		let path = new Path(picker.filePaths[0]);
		Settings.exportPath = path.directory.asString;
		SettingsPage.saveSettings();

		return path;
	}

	static async showSelectFileDialog(defaultPath: Path): Promise<Path | undefined>
	{
		if(!defaultPath.exists) defaultPath = Path.vaultPath;

		// show picker
		let picker = await dialog.showOpenDialog({
			defaultPath: defaultPath.directory.asString,
			properties: ["openFile"]
		});

		if (picker.canceled) return;

		let path = new Path(picker.filePaths[0]);
		return path;
	}

	static idealDefaultPath() : Path
	{
		let lastPath = new Path(Settings.exportPath);

		if (lastPath.asString != "" && lastPath.exists)
		{
			return lastPath.directory;
		}

		return Path.vaultPath;
	}

	static async downloadFiles(files: Downloadable[], rootPath: Path)
	{
		if (!rootPath.isAbsolute) throw new Error("folderPath must be absolute: " + rootPath.asString);

		ExportLog.progress(0, files.length, "Saving HTML files to disk", "...", "var(--color-green)");
		
		for (let i = 0; i < files.length; i++)
		{
			let file = files[i];

			try
			{
				await file.download(rootPath.directory);
				ExportLog.progress(i+1, files.length, "Saving HTML files to disk", "Saving: " + file.filename, "var(--color-green)");
			}
			catch (e)
			{
				ExportLog.error(e.stack, "Could not save file: " + file.filename);
				continue;
			}
		}
	}

	//async function that awaits until a condition is met
	static async waitUntil(condition: () => boolean, timeout: number = 1000, interval: number = 100): Promise<boolean>
	{
		if (condition()) return true;
		
		return new Promise((resolve, reject) => {
			let timer = 0;
			let intervalId = setInterval(() => {
				if (condition()) {
					clearInterval(intervalId);
					resolve(true);
				} else {
					timer += interval;
					if (timer >= timeout) {
						clearInterval(intervalId);
						resolve(false);
					}
				}
			}, interval);
		});
	}

	static getPluginIDs(): string[]
	{
		/*@ts-ignore*/
		let pluginsArray: string[] = Array.from(app.plugins.enabledPlugins.values()) as string[];
		for (let i = 0; i < pluginsArray.length; i++)
		{
			/*@ts-ignore*/
			if (app.plugins.manifests[pluginsArray[i]] == undefined)
			{
				pluginsArray.splice(i, 1);
				i--;
			}
		}

		return pluginsArray;
	}

	static getPluginManifest(pluginID: string): PluginManifest | null
	{
		// @ts-ignore
		return app.plugins.manifests[pluginID] ?? null;
	}

	static getActiveTextView(): TextFileView | null
	{
		let view = app.workspace.getActiveViewOfType(TextFileView);
		if (!view)
		{
			return null;
		}

		return view;
	}

	static trimEnd(inputString: string, trimString: string): string
	{
		if (inputString.endsWith(trimString))
		{
			return inputString.substring(0, inputString.length - trimString.length);
		}

		return inputString;
	}

	static trimStart(inputString: string, trimString: string): string
	{
		if (inputString.startsWith(trimString))
		{
			return inputString.substring(trimString.length);
		}

		return inputString;
	}

	static async openPath(path: Path)
	{
		// @ts-ignore
		await window.electron.remote.shell.openPath(path.asString);
	}

	static levenshteinDistance(string1: string, string2: string): number
	{
		if (!string1.length) return string2.length;
		if (!string2.length) return string1.length;
		const arr = [];
		for (let i = 0; i <= string2.length; i++) {
		  arr[i] = [i];
		  for (let j = 1; j <= string1.length; j++) {
			arr[i][j] =
			  i === 0
				? j
				: Math.min(
					arr[i - 1][j] + 1,
					arr[i][j - 1] + 1,
					arr[i - 1][j - 1] + (string1[j - 1] === string2[i - 1] ? 0 : 1)
				  );
		  }
		}
		return arr[string2.length][string1.length];
	  };
}
