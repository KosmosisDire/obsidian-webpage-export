import { promises as fs } from 'fs';
import {  MarkdownPreviewView, MarkdownView, Notice, PluginManifest, TextFileView, TFile } from 'obsidian';
import { ExportSettings } from './export-settings';
import { Downloadable, Path } from './UtilClasses';

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

	static generateProgressbar(title: string, progress: number, max: number, barLength: number, fullChar: string, emptyChar: string): string
	{
		return `${title}: ${Utils.padStringBeggining(progress + "/" + max, 13, " ")}\n\n${fullChar.repeat(Math.floor((progress / max) * barLength))}${emptyChar.repeat(barLength - Math.floor((progress / max) * barLength))}`;
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


	static async getText(path: Path): Promise<string | undefined>
	{
		try
		{
			return await fs.readFile(path.absolute().asString, { encoding: 'utf8' });
		}
		catch (err)
		{
			new Notice("Error: could not read text file at path: \n\n" + path + "\n\n" + err, 10000);
			console.error("Error: could not read text file at path: \n\n" + path + "\n\n" + err);
		}
	}

	static async getTextBase64(path: Path): Promise<string | undefined>
	{
		try
		{
			return await fs.readFile(path.absolute().asString, { encoding: 'base64' });
		}
		catch (err)
		{
			new Notice("Error: could not read text file at path: \n\n" + path + "\n\n" + err, 10000);
			console.error("Error: could not read text file at path: \n\n" + path + "\n\n" + err);
		}
	}

	static async getFileBuffer(path: Path): Promise<Buffer | undefined>
	{
		try
		{
			return await fs.readFile(path.absolute().asString);
		}
		catch (err)
		{
			new Notice("Error: could not read file at path: \n\n" + path + "\n\n" + err, 10000);
			console.error("Error: could not read file at path: \n\n" + path + "\n\n" + err);
		}
	}

	static async changeViewMode(view: MarkdownView, modeName: "preview" | "source")
	{
		/*@ts-ignore*/
		const mode = view.modes[modeName]; 
		/*@ts-ignore*/
		mode && await view.setMode(mode);
	};

	static createUnicodeArray(content: string) : Uint8Array
	{
		let charCode, byteArray = [];

		// BE BOM
		byteArray.push(254, 255);

		for (let i = 0; i < content.length; ++i) 
		{
			charCode = content.charCodeAt(i);

			// BE Bytes
			byteArray.push((charCode & 0xFF00) >>> 8);
			byteArray.push(charCode & 0xFF);
		}

		return new Uint8Array(byteArray);
	}

	static async showSaveDialog(defaultPath: Path, defaultFileName: string, showAllFilesOption: boolean = true): Promise<Path | undefined>
	{
		// get paths
		let absoluteDefaultPath = defaultPath.directory.absolute().joinString(defaultFileName);
		
		// add filters
		let filters = [{
			name: Utils.trimStart(absoluteDefaultPath.extenstion, ".").toUpperCase() + " Files",
			extensions: [Utils.trimStart(absoluteDefaultPath.extenstion, ".")]
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

		if (picker.canceled) return undefined;
		
		let pickedPath = new Path(picker.filePath);
		ExportSettings.settings.lastExportPath = pickedPath.asString;
		ExportSettings.saveSettings();
		
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

		if (picker.canceled) return undefined;

		let path = new Path(picker.filePaths[0]);
		ExportSettings.settings.lastExportPath = path.directory.asString;
		ExportSettings.saveSettings();

		return path;
	}

	static idealDefaultPath() : Path
	{
		let lastPath = new Path(ExportSettings.settings.lastExportPath);

		if (lastPath.asString != "" && lastPath.exists)
		{
			return lastPath.directory;
		}

		return Path.vaultPath;
	}

	static async downloadFiles(files: Downloadable[], folderPath: Path, progressCallback: ((progress: number, max: number, fileName: string) => void) | undefined = undefined, errorCallback: ((error: string) => void) | undefined = undefined)
	{
		if(progressCallback) progressCallback(0, files.length, "...");

		try
		{
			for (let i = 0; i < files.length; i++)
			{
				let file = files[i];
				let array: string | NodeJS.ArrayBufferView = file.content;
				if (!file.useUnicode && file.content instanceof String) array = Buffer.from(file.content, 'base64');
				if (file.useUnicode && file.content instanceof String) array = Utils.createUnicodeArray(file.content.toString());


				let parsedPath = folderPath.join(file.relativeDownloadPath).joinString(file.filename);

				await parsedPath.createDirectory();

				if (!parsedPath.directory.assertExists()) continue;

				try
				{
					await fs.writeFile(parsedPath.asString, array);
				}
				catch(err)
				{
					console.error("Error: could not write file at path: \n\n" + parsedPath.asString + "\n\n" + err);
					new Notice("Error: could not write file at path: \n\n" + parsedPath.asString + "\n\n" + err, 10000);
					continue;
				}

				if(progressCallback) progressCallback(i, files.length, file.filename);
			}
		}
		catch (e)
		{
			if(errorCallback) errorCallback(e);
			console.error("Error while saving HTML files: \n\n" + e);
			return;
		}
	}

	//async function that awaits until a condition is met
	static async waitUntil(condition: () => boolean, timeout: number = 1000, interval: number = 100): Promise<boolean>
	{
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

	static async getThemeContent(themeName: string): Promise<string>
	{
		if (themeName == "Default") return "/* Using default theme. */";

		// MIGHT NEED TO FORCE A RELATIVE PATH HERE IDKK
		let themePath = new Path(`.obsidian/themes/${themeName}/theme.css`).absolute();
		if (!themePath.exists)
		{
			console.warn("Warning: could not find theme at path: \n\n" + themePath);
			new Notice("Warning: could not find theme at path: \n\n" + themePath, 1000);
			return "";
		}

		let themeContent = await Utils.getText(themePath) ?? "";
		return themeContent;
	}

	static getCurrentThemeName(): string
	{
		/*@ts-ignore*/
		let themeName = app.vault.config?.cssTheme;
		return (themeName ?? "") == "" ? "Default" : themeName;
	}

	static getEnabledSnippets(): string[]
	{
		/*@ts-ignore*/
		return app.vault.config?.enabledCssSnippets ?? [];
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

	static async getStyleSnippetsContent(): Promise<string[]>
	{
		let snippetContents : string[] = [];
		let enabledSnippets = this.getEnabledSnippets();

		for (let i = 0; i < enabledSnippets.length; i++)
		{
			let path = new Path(`.obsidian/snippets/${enabledSnippets[i]}.css`).absolute();
			if (path.exists) snippetContents.push(await Utils.getText(path) ?? "\n");
		}

		return snippetContents;
	}

	static async rerenderView(view: MarkdownView | MarkdownPreviewView)
	{
		await Utils.delay(300);
		/*@ts-ignore*/
		await view.previewMode.renderer.rerender(true);
		await Utils.delay(300);
	}

	static async doFullRender(view: MarkdownView | MarkdownPreviewView)
	{
		/*@ts-ignore*/
		await view.previewMode.renderer.rerender(true);
		// if (view instanceof MarkdownView) Utils.changeViewMode(view, "preview");
		// await this.delay(200);

		// /*@ts-ignore*/
		// view.previewMode.renderer.showAll = true;
		// /*@ts-ignore*/
		// await view.previewMode.renderer.unfoldAllHeadings();
		
		// await this.rerenderView(view);
	}

	static async getRendererHeight(view: MarkdownView, rerender: boolean = false): Promise<number>
	{
		if(rerender) await Utils.doFullRender(view);

		/*@ts-ignore*/
		let height = view.previewMode.renderer.sizerEl.offsetHeight;

		return height;
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

	static findFileInVaultByName(name: string): TFile | undefined
	{
		return app.vault.getFiles().find(file =>
		{
			if(!name) return false;
			return file.basename == name;
		});
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
}
