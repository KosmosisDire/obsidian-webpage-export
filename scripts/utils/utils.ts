import {  MarkdownView, PluginManifest, TextFileView } from 'obsidian';
import { Path } from './path';
import { Attachment } from './downloadable';
import { ExportLog } from 'scripts/render-api/render-api';

export namespace Utils
{
	export async function  delay (ms: number)
	{
		return new Promise( resolve => setTimeout(resolve, ms) );
	}

	export function padStringBeggining(str: string, length: number, char: string)
	{
		return char.repeat(length - str.length) + str;
	}

	export function includesAny(str: string, substrings: string[]): boolean
	{
		for (let substring of substrings)
		{
			if (str.includes(substring)) return true;
		}

		return false;
	}

	export async function  urlAvailable(url: RequestInfo | URL) 
	{
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), 4000);
		
		const response = await fetch(url, {signal: controller.signal, mode: "no-cors"});
		clearTimeout(id);
	  
		return response;
	}

	export function sampleCSSColorHex(variable: string, testParentEl: HTMLElement): { a: number, hex: string }
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

		let color = toColorObject(col), alpha = parseFloat(opacity);
		return isNaN(alpha) && (alpha = 1),
		color ? {
			a: alpha * color.alpha,
			hex: this.padStringBeggining(color.red.toString(16), 2, "0") + this.padStringBeggining(color.green.toString(16), 2, "0") + this.padStringBeggining(color.blue.toString(16), 2, "0")
		} : {
			a: alpha,
			hex: "ffffff"
		}
	};

	export async function  changeViewMode(view: MarkdownView, modeName: "preview" | "source")
	{
		/*@ts-ignore*/
		const mode = view.modes[modeName]; 
		/*@ts-ignore*/
		mode && await view.setMode(mode);
	};

	export async function  downloadAttachments(files: Attachment[])
	{
		ExportLog.progress(0, "Saving HTML files to disk", "...", "var(--color-green)");
		
		for (let i = 0; i < files.length; i++)
		{
			let file = files[i];

			try
			{
				await file.download();
				ExportLog.progress((i+1) / files.length, "Saving HTML files to disk", "Saving: " + file.filename, "var(--color-green)");
			}
			catch (e)
			{
				ExportLog.error(e, "Could not save file: " + file.filename);
				continue;
			}
		}
	}

	//export async function  that awaits until a condition is met
	export async function  waitUntil(condition: () => boolean, timeout: number = 1000, interval: number = 100): Promise<boolean>
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

	export function getActiveTextView(): TextFileView | null
	{
		let view = app.workspace.getActiveViewOfType(TextFileView);
		if (!view)
		{
			return null;
		}

		return view;
	}

	export function trimEnd(inputString: string, trimString: string): string
	{
		if (inputString.endsWith(trimString))
		{
			return inputString.substring(0, inputString.length - trimString.length);
		}

		return inputString;
	}

	export function trimStart(inputString: string, trimString: string): string
	{
		if (inputString.startsWith(trimString))
		{
			return inputString.substring(trimString.length);
		}

		return inputString;
	}

	export async function  openPath(path: Path)
	{
		// @ts-ignore
		await window.electron.remote.shell.openPath(path.stringify);
	}

	export function levenshteinDistance(string1: string, string2: string): number
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
