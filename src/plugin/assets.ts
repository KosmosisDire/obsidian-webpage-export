// filepath: c:\Main\Obsidian\Development\.obsidian\plugins\webpage-html-export\src\plugin\assets.ts

export enum AssetType {
	CSS = 'text/css',
	JAVASCRIPT = 'application/javascript',
	JSON = 'application/json',
	SVG = 'image/svg+xml',
	HTML = 'text/html'
}

export enum Selector {
	HEAD = 'head',
	BODY = 'body',
	STYLE = 'style',
	SCRIPT = 'script'
}

export interface AssetDefinition {
	id: string;
	name: string;
	fetcher: () => Promise<string> | string;
	inline: boolean;
	selector?: Selector;
	outputPath?: string;
	contentType?: AssetType;
	priority?: number;
}

export interface ProcessedAsset {
	id: string;
	name: string;
	content: string;
	inline: boolean;
	selector?: Selector;
	outputPath?: string;
	contentType?: AssetType;
	size: number;
}

export class AssetManager {
	private assets: Map<string, AssetDefinition> = new Map();
	private _processedAssets: ProcessedAsset[] | null = null;

	registerAsset(asset: AssetDefinition): void {
		if (asset.inline && !asset.selector) {
			throw new Error(`Inline asset '${asset.id}' must specify a selector`);
		}
		if (!asset.inline && !asset.outputPath) {
			throw new Error(`Non-inline asset '${asset.id}' must specify an output path`);
		}
		
		this.assets.set(asset.id, asset);
		this._processedAssets = null; // Invalidate cache
	}

	unregisterAsset(id: string): boolean {
		const result = this.assets.delete(id);
		if (result) this._processedAssets = null; // Invalidate cache
		return result;
	}

	get processedAssets(): Promise<ProcessedAsset[]> {
		if (this._processedAssets) return Promise.resolve(this._processedAssets);
		return this.processAssets();
	}

	private async processAssets(): Promise<ProcessedAsset[]> {
		const assets = Array.from(this.assets.values())
			.sort((a, b) => (a.priority || 0) - (b.priority || 0));
		
		const processed: ProcessedAsset[] = [];

		for (const asset of assets) {
			try {
				const content = await Promise.resolve(asset.fetcher());
				processed.push({
					id: asset.id,
					name: asset.name,
					content,
					inline: asset.inline,
					selector: asset.selector,
					outputPath: asset.outputPath,
					contentType: asset.contentType,
					size: new Blob([content]).size
				});
			} catch (error) {
				console.error(`Failed to process asset '${asset.id}':`, error);
			}
		}

		this._processedAssets = processed;
		return processed;
	}

	clear(): void {
		this.assets.clear();
		this._processedAssets = null;
	}
}
