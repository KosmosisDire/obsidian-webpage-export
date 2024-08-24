import { AssetHandler } from "src/plugin/asset-loaders/asset-handler";
import { ExportLog } from "src/plugin/render-api/render-api";
import { Utils } from "src/plugin/utils/utils";
import { AssetType } from "src/plugin/asset-loaders/asset-types";

export namespace HTMLGeneration
{
	let _validBodyClasses: string | undefined = undefined;
	export async function getValidBodyClasses(cleanCache: boolean): Promise<string>
	{
		if (cleanCache) _validBodyClasses = undefined;
		if (_validBodyClasses) return _validBodyClasses;

		const bodyClasses = Array.from(document.body.classList); 

		let validClasses = "";
		validClasses += " publish ";
		validClasses += " css-settings-manager ";
		
		// keep body classes that are referenced in the styles
		const styles = AssetHandler.getAssetsOfType(AssetType.Style);
		let i = 0;
		let classes: string[] = [];

		for (const style of styles)
		{
			ExportLog.progress(i / styles.length, "Compiling css classes", "Scanning: " + style.filename, "var(--color-yellow)");
			if (typeof(style.data) != "string") continue;
			
			// this matches every class name with the dot
			const matches = Array.from(style.data.matchAll(/\.([A-Za-z_-]+[\w-]+)/g));
			let styleClasses = matches.map(match => match[0].substring(1).trim());
			// remove duplicates
			styleClasses = styleClasses.filter((value, index, self) => self.indexOf(value) === index);
			classes = classes.concat(styleClasses);
			i++;
			await Utils.delay(0);
		}

		// remove duplicates
		ExportLog.progress(1, "Filtering classes", "...", "var(--color-yellow)");
		classes = classes.filter((value, index, self) => self.indexOf(value) === index);
		ExportLog.progress(1, "Sorting classes", "...", "var(--color-yellow)");
		classes = classes.sort();

		i = 0;
		for (const bodyClass of bodyClasses)
		{
			ExportLog.progress(i / bodyClasses.length, "Collecting valid classes", "Scanning: " + bodyClass, "var(--color-yellow)");

			if (classes.includes(bodyClass))
			{
				validClasses += bodyClass + " ";
			}

			i++;
		}

		ExportLog.progress(1, "Cleanup classes", "...", "var(--color-yellow)");
		_validBodyClasses = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		ExportLog.progress(1, "Filter duplicate classes", _validBodyClasses.length + " classes", "var(--color-yellow)");
		_validBodyClasses = _validBodyClasses.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();
		
		ExportLog.progress(1, "Classes done", "...", "var(--color-yellow)");

		return _validBodyClasses;
	}

}
