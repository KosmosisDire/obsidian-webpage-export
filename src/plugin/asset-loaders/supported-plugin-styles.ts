import { Settings, SettingsPage } from "src/plugin/settings/settings";
import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { ExportLog } from "src/plugin/render-api/render-api.js";
import { OtherPluginStyles } from "./other-plugin-styles.js";
import pluginIds from "src/assets/plugin-style-ids.json";

export class SupportedPluginStyles extends AssetLoader {
	constructor() {
		super("supported-plugins.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 5);
	}

	override async load() {
		SettingsPage.nameStyles();
		const stylesheets = document.styleSheets;
		this.data = "";

		for (let i = 1; i < stylesheets.length; i++) {
			// @ts-ignore
			const styleID = stylesheets[i].ownerNode?.id;

			if
				(
				pluginIds.ids.contains(styleID) || Settings.exportOptions.includeStyleCssIds.contains(styleID)
			) {
				ExportLog.log("Including stylesheet: " + styleID);
				const style = stylesheets[i].cssRules;

				for (const item in style) {
					if (style[item].cssText != undefined) {

						this.data += "\n" + style[item].cssText;
					}
				}
			}

			this.data += "\n\n /* ---- */\n\n";
		}

		// iconize
		this.data += await OtherPluginStyles.getStyleForPlugin("obsidian-icon-folder");

		await super.load();
	}

	getStylesheetContent(stylesheet: CSSStyleSheet): string {
		let content = "";
		const style = stylesheet.cssRules;

		for (const item in style) {
			if (style[item].cssText != undefined) {
				content += "\n" + style[item].cssText;
			}
		}

		return content;
	}

	isSvelteStylesheet(stylesheet: CSSStyleSheet): boolean {
		if (stylesheet.ownerNode == undefined) return false;
		// @ts-ignore
		const styleID = stylesheet.ownerNode.id;

		if (styleID.contains("svelte")) return true;

		const sheetContent = this.getStylesheetContent(stylesheet);
		const first1000 = sheetContent.substring(0, 1000);
		if (first1000.contains(".svelte-")) {
			return true;
		}

		return false;
	}
}
