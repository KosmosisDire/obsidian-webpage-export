import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
	return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("sidebar options expose startCollapsed with default off", () => {
	const sidebarOptions = read("src/shared/features/sidebar.ts");

	assert.match(sidebarOptions, /startCollapsed:\s*boolean\s*=\s*false/);
	assert.match(sidebarOptions, /info_startCollapsed\s*=\s*new FeatureSettingInfo/);
	assert.match(sidebarOptions, /i18n\.settings\.sidebars\.info_startCollapsed/);
});

test("sidebar startCollapsed has translated setting descriptions", () => {
	const language = read("src/plugin/translations/language.ts");
	assert.match(language, /sidebars:\s*\{[^}]*info_startCollapsed:\s*string;/s);

	for (const path of [
		"src/plugin/translations/en.ts",
		"src/plugin/translations/zh-cn.ts",
		"src/plugin/translations/it.ts",
		"src/plugin/translations/uk.ts",
		"src/plugin/translations/pt.ts",
	]) {
		assert.match(read(path), /sidebars:\s*\{[^}]*info_startCollapsed:/s, path);
	}
});

test("exported sidebars can start collapsed from sidebar options", () => {
	const template = read("src/plugin/website/webpage-template.ts");
	const website = read("src/frontend/main/website.ts");

	assert.match(template, /this\.options\.sidebarOptions\.startCollapsed/);
	assert.doesNotMatch(template, /\|\|\s*window\.innerWidth\s*<\s*768/);
	assert.match(website, /metadata\.featureOptions\.sidebar\?\.startCollapsed/);
	assert.match(website, /isInitialResize\s*\?\s*startCollapsed\s*:\s*true/);
});
