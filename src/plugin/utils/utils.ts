import {  MarkdownView, TextFileView } from 'obsidian';
import { Path } from './path';
import { Attachment } from './downloadable';
import { ExportLog } from 'src/plugin/render-api/render-api';

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
		for (const substring of substrings)
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
		const testEl = document.createElement('div');
		testEl.style.setProperty('display', 'none');
		testEl.style.setProperty('color', 'var(' + variable + ')');
		testParentEl.appendChild(testEl);

		const col = getComputedStyle(testEl).color;
		const opacity = getComputedStyle(testEl).opacity;

		testEl.remove();

		function toColorObject(str: string)
		{
			const match = str.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
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

	export async function downloadAttachments(files: Attachment[])
	{
		ExportLog.addToProgressCap(files.length);
		ExportLog.progress(0, "Saving files to disk", "...", "var(--color-green)");

		let complete = 0;
		
		await Promise.all(files.map(async (file, i) => {
			try {
				complete++;
				ExportLog.progress(1, "Saving files to disk", "Saved: " + file.filename, "var(--color-green)");
				await file.download();
			} catch (e) {
				ExportLog.error(e, "Could not save file: " + file.filename);
			}
		}));
	}

	//export async function  that awaits until a condition is met
	export async function  waitUntil(condition: () => boolean, timeout: number = 1000, interval: number = 100): Promise<boolean>
	{
		if (condition()) return true;
		
		return new Promise((resolve, reject) => {
			let timer = 0;
			const intervalId = setInterval(() => {
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
		const view = app.workspace.getActiveViewOfType(TextFileView);
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

	export async function openPath(path: Path)
	{
		if (process.platform === "win32")
			path = path.backslashified()

		// @ts-ignore
		await window.electron.remote.shell.openPath(path.path);
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
