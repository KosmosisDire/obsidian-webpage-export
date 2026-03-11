import { FileData, WebsiteData } from "@shared/types";
import { Notice } from "./notice";

export let metadata: WebsiteData;

export function getFileData(url: string): FileData | null {
	if (!metadata?.files) return null;
	return metadata.files[url] ?? null;
}

export function documentExists(url: string): boolean {
	return !!metadata?.files?.[url];
}

export async function loadSiteData(isHttp: boolean): Promise<boolean> {
	const data = await fetchSiteData(isHttp);
	if (data) {
		metadata = data;
		return true;
	}
	// Create minimal fallback so the app can still render
	metadata = {
		export: { version: "", timestamp: 0, vault: "", totalFiles: 0 },
		files: {},
		indices: { graph: { nodes: [], edges: [] }, tags: {} },
		filePathMapping: {},
	};
	return false;
}

async function fetchSiteData(isHttp: boolean): Promise<WebsiteData | undefined> {
	if (isHttp) {
		try {
			const pathToRoot = document.querySelector("meta[name='path-to-root']")?.getAttribute("content") ?? "./";
			const dataReq = await fetch(pathToRoot + "obsidian-cache.json");
			if (dataReq.ok) {
				return JSON.parse(await dataReq.text()) as WebsiteData;
			}
		} catch (e) {
			console.error("Failed to load website metadata.", e);
			new Notice("Failed to load website metadata.");
		}
	} else {
		const embedScript = document.getElementById("obsidian-data")
			?? document.getElementById("website-metadata");
		if (embedScript) {
			try {
				const textContent = embedScript.textContent;
				if (textContent) return JSON.parse(textContent);
				const value = embedScript.getAttribute("value");
				if (value) return JSON.parse(decodeURI(atob(value)));
			} catch (e) {
				console.error("Failed to parse embedded data", e);
			}
		}
	}
	return undefined;
}
