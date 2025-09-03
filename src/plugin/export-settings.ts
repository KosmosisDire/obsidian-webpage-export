import { MarkdownRendererOptions } from "./renderer/renderer-options";

export class ExportSettings {
	outputPath: string;
	forceFullExport: boolean = false;
	rendererOptions?: MarkdownRendererOptions;

	constructor(options?: Partial<ExportSettings>) {
		if (options) {
			Object.assign(this, options);
		}
	}
}
