import { __awaiter } from "tslib";
import graphViewJS from "assets/graph_view.txt.js";
import graphWASMJS from "assets/graph_wasm.txt.js";
import renderWorkerJS from "assets/graph-render-worker.txt.js";
import graphWASM from "assets/graph_wasm.wasm";
import tinyColorJS from "assets/tinycolor.txt.js";
import webpageJS from "assets/webpage.txt.js";
import appStyles from "assets/obsidian-styles.txt.css";
import webpageStyles from "assets/plugin-styles.txt.css";
import { Path } from "scripts/utils/path.js";
import { Downloadable } from "scripts/utils/downloadable.js";
import { RenderLog } from "./render-log.js";
import { MainSettings } from "scripts/settings/main-settings.js";
import { Website } from "scripts/objects/website.js";
const { minify } = require('html-minifier-terser');
export class AssetHandler {
    static initialize(pluginID) {
        return __awaiter(this, void 0, void 0, function* () {
            this.vaultPluginsPath = Path.vaultPath.joinString(app.vault.configDir, "plugins/").makeAbsolute();
            yield this.loadAppStyles();
            this.webpageStyles = yield AssetHandler.minifyJSorCSS(webpageStyles, false);
            this.webpageJS = yield AssetHandler.minifyJSorCSS(webpageJS, true);
            this.graphViewJS = yield AssetHandler.minifyJSorCSS(graphViewJS, true);
            this.graphWASMJS = yield AssetHandler.minifyJSorCSS(graphWASMJS, true);
            this.renderWorkerJS = yield AssetHandler.minifyJSorCSS(renderWorkerJS, true);
            // @ts-ignore
            this.tinyColorJS = yield AssetHandler.minifyJSorCSS(tinyColorJS, true);
            this.graphWASM = Buffer.from(graphWASM);
            this.updateAssetCache();
        });
    }
    static minifyJSorCSS(content, isJSNotCSS) {
        return __awaiter(this, void 0, void 0, function* () {
            // for now this is disabled because I don't have time to make it clean
            // return content;
            let tempContent = content;
            try {
                // add script or style tags so that minifier can minify it as html
                if (isJSNotCSS) {
                    content = `
				<script>
				${content}
				</script>`;
                }
                else {
                    content = `
				<style>
				${content}
				</style>`;
                }
                content = yield minify(content, { collapseBooleanAttributes: true, collapseWhitespace: true, minifyCSS: true, minifyJS: true, removeComments: true, removeEmptyAttributes: true, removeRedundantAttributes: true, removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true });
                // remove the <script> or <style> tags
                content = content.replace("<script>", "").replace("</script>", "").replace("<style>", "").replace("</style>", "");
            }
            catch (e) {
                RenderLog.error(e.stack, "Error while minifying " + (isJSNotCSS ? "JS" : "CSS") + " file.");
                content = tempContent;
            }
            if (content == "")
                content = " ";
            return content;
        });
    }
    static getDownloads() {
        return __awaiter(this, void 0, void 0, function* () {
            let toDownload = [];
            if (!MainSettings.settings.inlineCSS) {
                let pluginCSS = this.webpageStyles;
                let thirdPartyPluginCSS = yield this.minifyJSorCSS(yield this.getPluginStyles(), false);
                pluginCSS += "\n" + thirdPartyPluginCSS + "\n";
                let appcssDownload = new Downloadable("obsidian-styles.css", this.appStyles, this.cssFolderName);
                let plugincssDownload = new Downloadable("plugin-styles.css", pluginCSS, this.cssFolderName);
                let themecssDownload = new Downloadable("theme.css", this.themeStyles, this.cssFolderName);
                let snippetsDownload = new Downloadable("snippets.css", this.snippetStyles, this.cssFolderName);
                toDownload.push(appcssDownload);
                toDownload.push(plugincssDownload);
                toDownload.push(themecssDownload);
                toDownload.push(snippetsDownload);
                toDownload.push(new Downloadable("generated-styles.css", this.generatedStyles, this.cssFolderName));
            }
            if (!MainSettings.settings.inlineJS) {
                let webpagejsDownload = new Downloadable("webpage.js", this.webpageJS, this.jsFolderName);
                toDownload.push(webpagejsDownload);
                if (this.generatedJS != "") {
                    let generatedjsDownload = new Downloadable("generated.js", this.generatedJS, this.jsFolderName);
                    toDownload.push(generatedjsDownload);
                }
            }
            if (MainSettings.settings.includeGraphView) {
                let graphWASMDownload = new Downloadable("graph_wasm.wasm", this.graphWASM, this.jsFolderName); // MIGHT NEED TO SPECIFY ENCODING
                let renderWorkerJSDownload = new Downloadable("graph-render-worker.js", this.renderWorkerJS, this.jsFolderName);
                let graphWASMJSDownload = new Downloadable("graph_wasm.js", this.graphWASMJS, this.jsFolderName);
                let graphViewJSDownload = new Downloadable("graph_view.js", this.graphViewJS, this.jsFolderName);
                let tinyColorJS = new Downloadable("tinycolor.js", this.tinyColorJS, this.jsFolderName);
                toDownload.push(renderWorkerJSDownload);
                toDownload.push(graphWASMDownload);
                toDownload.push(graphWASMJSDownload);
                toDownload.push(graphViewJSDownload);
                toDownload.push(tinyColorJS);
            }
            return toDownload;
        });
    }
    static updateAssetCache() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let snippetsNames = this.getEnabledSnippets();
            let themeName = this.getCurrentThemeName();
            let enabledPluginStyles = MainSettings.settings.includePluginCSS;
            if (snippetsNames != this.lastEnabledSnippets) {
                this.lastEnabledSnippets = snippetsNames;
                this.snippetStyles = yield this.minifyJSorCSS(yield this.getSnippetsCSS(snippetsNames), false);
            }
            if (themeName != this.lastEnabledTheme) {
                this.lastEnabledTheme = themeName;
                this.themeStyles = yield this.minifyJSorCSS(yield this.getThemeContent(themeName), false);
            }
            if (enabledPluginStyles != this.lastEnabledPluginStyles) {
                this.lastEnabledPluginStyles = enabledPluginStyles;
                this.pluginStyles = yield this.minifyJSorCSS(yield this.getPluginStyles(), false);
            }
            let bodyStyle = ((_a = document.body.getAttribute("style")) !== null && _a !== void 0 ? _a : "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
            let lineWidth = MainSettings.settings.customLineWidth || "50em";
            let contentWidth = MainSettings.settings.contentWidth || "500em";
            let sidebarWidth = MainSettings.settings.sidebarWidth || "25em";
            if (!isNaN(Number(lineWidth)))
                lineWidth += "px";
            if (!isNaN(Number(contentWidth)))
                contentWidth += "px";
            if (!isNaN(Number(sidebarWidth)))
                sidebarWidth += "px";
            let customHeadPath = new Path(MainSettings.settings.customHeadContentPath);
            this.customHeadContent = (_b = yield customHeadPath.readFileString()) !== null && _b !== void 0 ? _b : "";
            this.generatedStyles =
                `
body
{
	--line-width: ${lineWidth};
	--line-width-adaptive: ${lineWidth};
	--file-line-width: ${lineWidth};
	--content-width: ${contentWidth};
	--sidebar-width: calc(min(${sidebarWidth}, 80vw));
	--collapse-arrow-size: 0.35em;
	--tree-horizontal-spacing: 0.6em;
	--tree-vertical-spacing: 0.6em;
	--sidebar-margin: 24px;
}

body
{
	${bodyStyle}
}
`;
            this.generatedJS = "";
            if (MainSettings.settings.includeGraphView) {
                this.generatedJS +=
                    `
			let nodes=\n${JSON.stringify(Website.globalGraph)};
			let attractionForce = ${MainSettings.settings.graphAttractionForce};
			let linkLength = ${MainSettings.settings.graphLinkLength};
			let repulsionForce = ${MainSettings.settings.graphRepulsionForce};
			let centralForce = ${MainSettings.settings.graphCentralForce};
			let edgePruning = ${MainSettings.settings.graphEdgePruning};
			`;
            }
            this.generatedJS = yield this.minifyJSorCSS(this.generatedJS, true);
            this.generatedStyles = yield this.minifyJSorCSS(this.generatedStyles, false);
            this.lastMathjaxChanged = -1;
        });
    }
    static loadMathjaxStyles() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            if (this.mathjaxStylesheet == undefined)
                this.mathjaxStylesheet = Array.from(document.styleSheets).find((sheet) => sheet.ownerNode.id == ("MJX-CHTML-styles"));
            if (this.mathjaxStylesheet == undefined)
                return;
            // @ts-ignore
            let changed = (_a = this.mathjaxStylesheet) === null || _a === void 0 ? void 0 : _a.ownerNode.getAttribute("data-change");
            if (changed != this.lastMathjaxChanged) {
                AssetHandler.mathStyles = "";
                for (let i = 0; i < this.mathjaxStylesheet.cssRules.length; i++) {
                    AssetHandler.mathStyles += this.mathjaxStylesheet.cssRules[i].cssText + "\n";
                }
                AssetHandler.mathStyles = yield this.minifyJSorCSS(AssetHandler.mathStyles.replaceAll("app://obsidian.md/", "https://publish.obsidian.md/"), false);
            }
            else {
                return;
            }
            this.lastMathjaxChanged = changed;
        });
    }
    static filterBodyClasses(inputCSS) {
        // replace all selectors that change based on the body's class to always be applied
        let matchCount = 1;
        while (matchCount != 0) {
            let matches = Array.from(inputCSS.matchAll(/body\.(?!theme-dark|theme-light)[\w-]+/g));
            matchCount = 0;
            matches.forEach((match) => {
                let selector = match[0];
                let classes = selector.split(".")[1];
                if (selector && classes && document.body.classList.contains(classes)) {
                    inputCSS = inputCSS.replace(match[0].toString(), "body");
                    RenderLog.log(classes);
                    matchCount++;
                }
            });
        }
        return inputCSS;
    }
    static loadAppStyles() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let appSheet = document.styleSheets[1];
            let stylesheets = document.styleSheets;
            for (let i = 0; i < stylesheets.length; i++) {
                if (stylesheets[i].href && ((_a = stylesheets[i].href) === null || _a === void 0 ? void 0 : _a.includes("app.css"))) {
                    appSheet = stylesheets[i];
                    break;
                }
            }
            this.appStyles += appStyles;
            for (let i = 0; i < appSheet.cssRules.length; i++) {
                let rule = appSheet.cssRules[i];
                if (rule) {
                    let skip = false;
                    let selector = rule.cssText.split("{")[0];
                    for (let keep of this.obsidianStylesKeep) {
                        if (!selector.includes(keep)) {
                            for (let filter of this.obsidianStylesFilter) {
                                if (selector.includes(filter)) {
                                    skip = true;
                                    break;
                                }
                            }
                        }
                        else {
                            skip = false;
                            break;
                        }
                    }
                    if (skip)
                        continue;
                    let cssText = rule.cssText + "\n";
                    cssText = cssText.replaceAll("public/", "https://publish.obsidian.md/public/");
                    cssText = cssText.replaceAll("lib/", "https://publish.obsidian.md/lib/");
                    this.appStyles += cssText;
                }
            }
            for (let i = 1; i < stylesheets.length; i++) {
                // @ts-ignore
                let styleID = (_b = stylesheets[i].ownerNode) === null || _b === void 0 ? void 0 : _b.id;
                if ((styleID.startsWith("svelte") && MainSettings.settings.includeSvelteCSS) || styleID == "ADMONITIONS_CUSTOM_STYLE_SHEET") {
                    RenderLog.log("Including stylesheet: " + styleID);
                    let style = stylesheets[i].cssRules;
                    for (let item in style) {
                        if (style[item].cssText != undefined) {
                            this.appStyles += "\n" + style[item].cssText;
                        }
                    }
                }
            }
            this.appStyles = this.filterBodyClasses(this.appStyles);
            this.appStyles = yield this.minifyJSorCSS(this.appStyles, false);
        });
    }
    static getPluginStyles() {
        return __awaiter(this, void 0, void 0, function* () {
            // load 3rd party plugin css
            let pluginCSS = "";
            let thirdPartyPluginStyleNames = MainSettings.settings.includePluginCSS.split("\n");
            for (let i = 0; i < thirdPartyPluginStyleNames.length; i++) {
                if (!thirdPartyPluginStyleNames[i] || (thirdPartyPluginStyleNames[i] && !(/\S/.test(thirdPartyPluginStyleNames[i]))))
                    continue;
                let path = this.vaultPluginsPath.joinString(thirdPartyPluginStyleNames[i].replace("\n", ""), "styles.css");
                if (!path.exists)
                    continue;
                let style = yield path.readFileString();
                if (style) {
                    pluginCSS += style;
                }
            }
            pluginCSS = this.filterBodyClasses(pluginCSS);
            return pluginCSS;
        });
    }
    static getThemeContent(themeName) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (themeName == "Default")
                return "/* Using default theme. */";
            // MIGHT NEED TO FORCE A RELATIVE PATH HERE IDKK
            let themePath = new Path(`.obsidian/themes/${themeName}/theme.css`).absolute();
            if (!themePath.exists) {
                RenderLog.warning("Cannot find theme at path: \n\n" + themePath);
                return "";
            }
            let themeContent = (_a = yield themePath.readFileString()) !== null && _a !== void 0 ? _a : "";
            themeContent = this.filterBodyClasses(themeContent);
            return themeContent;
        });
    }
    static getCurrentThemeName() {
        var _a;
        /*@ts-ignore*/
        let themeName = (_a = app.vault.config) === null || _a === void 0 ? void 0 : _a.cssTheme;
        return (themeName !== null && themeName !== void 0 ? themeName : "") == "" ? "Default" : themeName;
    }
    static getSnippetsCSS(snippetNames) {
        return __awaiter(this, void 0, void 0, function* () {
            let snippetsList = yield this.getStyleSnippetsContent();
            let snippets = "\n";
            for (let i = 0; i < snippetsList.length; i++) {
                snippets += `/* --- ${snippetNames[i]}.css --- */  \n ${snippetsList[i]}  \n\n\n`;
            }
            return snippets;
        });
    }
    static getEnabledSnippets() {
        var _a, _b;
        /*@ts-ignore*/
        return (_b = (_a = app.vault.config) === null || _a === void 0 ? void 0 : _a.enabledCssSnippets) !== null && _b !== void 0 ? _b : [];
    }
    static getStyleSnippetsContent() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let snippetContents = [];
            let enabledSnippets = this.getEnabledSnippets();
            for (let i = 0; i < enabledSnippets.length; i++) {
                let path = new Path(`.obsidian/snippets/${enabledSnippets[i]}.css`).absolute();
                if (path.exists)
                    snippetContents.push((_a = yield path.readFileString()) !== null && _a !== void 0 ? _a : "\n");
            }
            return snippetContents;
        });
    }
}
AssetHandler.obsidianStylesFilter = ["workspace-", "cm-", "ghost", "leaf", "CodeMirror",
    "@media", "pdf", "xfa", "annotation", "@keyframes",
    "load", "@-webkit", "setting", "filter", "decorator",
    "dictionary", "status", "windows", "titlebar", "source",
    "menu", "message", "popover", "suggestion", "prompt",
    "tab", "HyperMD", "workspace", "publish",
    "backlink", "sync", "vault", "mobile", "tablet", "phone",
    "textLayer", "header", "linux", "macos", "rename", "edit",
    "progress", "native", "aria", "tooltip",
    "drop", "sidebar", "mod-windows", "is-frameless",
    "is-hidden-frameless", "obsidian-app", "show-view-header",
    "is-maximized"];
AssetHandler.obsidianStylesKeep = ["scrollbar", "input[type"];
// this path is used to generate the relative path to the images folder, likewise for the other paths
AssetHandler.mediaFolderName = new Path("lib/media");
AssetHandler.jsFolderName = new Path("lib/scripts");
AssetHandler.cssFolderName = new Path("lib/styles");
AssetHandler.appStyles = "";
AssetHandler.mathStyles = "";
AssetHandler.webpageStyles = "";
AssetHandler.themeStyles = "";
AssetHandler.snippetStyles = "";
AssetHandler.pluginStyles = "";
AssetHandler.generatedStyles = "";
AssetHandler.lastEnabledPluginStyles = "";
AssetHandler.lastEnabledSnippets = [];
AssetHandler.lastEnabledTheme = "";
AssetHandler.lastMathjaxChanged = -1;
AssetHandler.mathjaxStylesheet = undefined;
AssetHandler.webpageJS = "";
AssetHandler.graphViewJS = "";
AssetHandler.graphWASMJS = "";
AssetHandler.renderWorkerJS = "";
AssetHandler.tinyColorJS = "";
AssetHandler.generatedJS = "";
AssetHandler.customHeadContent = "";
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtaGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFzc2V0LWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU8sV0FBVyxNQUFNLDBCQUEwQixDQUFDO0FBQ25ELE9BQU8sV0FBVyxNQUFNLDBCQUEwQixDQUFDO0FBQ25ELE9BQU8sY0FBYyxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sU0FBUyxNQUFNLHdCQUF3QixDQUFDO0FBQy9DLE9BQU8sV0FBVyxNQUFNLHlCQUF5QixDQUFDO0FBQ2xELE9BQU8sU0FBUyxNQUFNLHVCQUF1QixDQUFDO0FBQzlDLE9BQU8sU0FBUyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3ZELE9BQU8sYUFBYSxNQUFNLDhCQUE4QixDQUFDO0FBRXpELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM3QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzVDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDckQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBR25ELE1BQU0sT0FBTyxZQUFZO0lBa0RqQixNQUFNLENBQU8sVUFBVSxDQUFDLFFBQWdCOztZQUU5QyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUMsWUFBWSxFQUFFLENBQUM7WUFFbEcsTUFBTSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLFlBQVksQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzVFLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuRSxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sWUFBWSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLFlBQVksQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxjQUFjLEdBQUcsTUFBTSxZQUFZLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM3RSxhQUFhO1lBQ2IsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLFlBQVksQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV4QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN6QixDQUFDO0tBQUE7SUFFRCxNQUFNLENBQU8sYUFBYSxDQUFDLE9BQWUsRUFBRSxVQUFtQjs7WUFFOUQsc0VBQXNFO1lBQ3RFLGtCQUFrQjtZQUVsQixJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUM7WUFFMUIsSUFDQTtnQkFDQyxrRUFBa0U7Z0JBQ2xFLElBQUksVUFBVSxFQUNkO29CQUNDLE9BQU8sR0FBRzs7TUFFUixPQUFPO2NBQ0MsQ0FBQztpQkFDWDtxQkFFRDtvQkFDQyxPQUFPLEdBQUc7O01BRVIsT0FBTzthQUNBLENBQUM7aUJBQ1Y7Z0JBRUQsT0FBTyxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLHlCQUF5QixFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxFQUFFLHlCQUF5QixFQUFFLElBQUksRUFBRSwwQkFBMEIsRUFBRSxJQUFJLEVBQUUsNkJBQTZCLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO2dCQUVqVCxzQ0FBc0M7Z0JBQ3RDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQzthQUNsSDtZQUNELE9BQU8sQ0FBQyxFQUNSO2dCQUNDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSx3QkFBd0IsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQztnQkFDNUYsT0FBTyxHQUFHLFdBQVcsQ0FBQzthQUN0QjtZQUVELElBQUksT0FBTyxJQUFJLEVBQUU7Z0JBQUUsT0FBTyxHQUFHLEdBQUcsQ0FBQztZQUVqQyxPQUFPLE9BQU8sQ0FBQztRQUNoQixDQUFDO0tBQUE7SUFFTSxNQUFNLENBQU8sWUFBWTs7WUFFL0IsSUFBSSxVQUFVLEdBQW1CLEVBQUUsQ0FBQztZQUNwQyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQ3BDO2dCQUNDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7Z0JBQ25DLElBQUksbUJBQW1CLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN4RixTQUFTLElBQUksSUFBSSxHQUFHLG1CQUFtQixHQUFHLElBQUksQ0FBQztnQkFDL0MsSUFBSSxjQUFjLEdBQUcsSUFBSSxZQUFZLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ2pHLElBQUksaUJBQWlCLEdBQUcsSUFBSSxZQUFZLENBQUMsbUJBQW1CLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDN0YsSUFBSSxnQkFBZ0IsR0FBRyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQzNGLElBQUksZ0JBQWdCLEdBQUcsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNoRyxVQUFVLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUNoQyxVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7Z0JBQ25DLFVBQVUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbEMsVUFBVSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUNsQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7YUFDcEc7WUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQ25DO2dCQUNDLElBQUksaUJBQWlCLEdBQUcsSUFBSSxZQUFZLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUMxRixVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7Z0JBQ25DLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxFQUFFLEVBQzFCO29CQUNDLElBQUksbUJBQW1CLEdBQUcsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO29CQUNoRyxVQUFVLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7aUJBQ3JDO2FBQ0Q7WUFDRCxJQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQ3pDO2dCQUNDLElBQUksaUJBQWlCLEdBQUcsSUFBSSxZQUFZLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxpQ0FBaUM7Z0JBQ2pJLElBQUksc0JBQXNCLEdBQUcsSUFBSSxZQUFZLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ2hILElBQUksbUJBQW1CLEdBQUcsSUFBSSxZQUFZLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUNqRyxJQUFJLG1CQUFtQixHQUFHLElBQUksWUFBWSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDakcsSUFBSSxXQUFXLEdBQUcsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUV4RixVQUFVLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7Z0JBQ3hDLFVBQVUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztnQkFDbkMsVUFBVSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUNyQyxVQUFVLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQ3JDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7YUFDN0I7WUFFRCxPQUFPLFVBQVUsQ0FBQztRQUNuQixDQUFDO0tBQUE7SUFFTSxNQUFNLENBQU8sZ0JBQWdCOzs7WUFFbkMsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDOUMsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDM0MsSUFBSSxtQkFBbUIsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO1lBQ2pFLElBQUksYUFBYSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFDN0M7Z0JBQ0MsSUFBSSxDQUFDLG1CQUFtQixHQUFHLGFBQWEsQ0FBQztnQkFDekMsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQy9GO1lBQ0QsSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUN0QztnQkFDQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDO2dCQUNsQyxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDMUY7WUFDRCxJQUFJLG1CQUFtQixJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFDdkQ7Z0JBQ0MsSUFBSSxDQUFDLHVCQUF1QixHQUFHLG1CQUFtQixDQUFDO2dCQUNuRCxJQUFJLENBQUMsWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNsRjtZQUVELElBQUksU0FBUyxHQUFHLENBQUMsTUFBQSxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsbUNBQUksRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDdkgsSUFBSSxTQUFTLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxlQUFlLElBQUksTUFBTSxDQUFDO1lBQ2hFLElBQUksWUFBWSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxJQUFJLE9BQU8sQ0FBQztZQUNqRSxJQUFJLFlBQVksR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUM7WUFDaEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQUUsU0FBUyxJQUFJLElBQUksQ0FBQztZQUNqRCxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFBRSxZQUFZLElBQUksSUFBSSxDQUFDO1lBQ3ZELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUFFLFlBQVksSUFBSSxJQUFJLENBQUM7WUFFdkQsSUFBSSxjQUFjLEdBQUcsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFBLE1BQU0sY0FBYyxDQUFDLGNBQWMsRUFBRSxtQ0FBSSxFQUFFLENBQUM7WUFFckUsSUFBSSxDQUFDLGVBQWU7Z0JBQ3RCOzs7aUJBR2lCLFNBQVM7MEJBQ0EsU0FBUztzQkFDYixTQUFTO29CQUNYLFlBQVk7NkJBQ0gsWUFBWTs7Ozs7Ozs7O0dBU3RDLFNBQVM7O0NBRVgsQ0FBQTtZQUVDLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1lBQ3RCLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFDMUM7Z0JBQ0MsSUFBSSxDQUFDLFdBQVc7b0JBQ2hCO2lCQUNjLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQzsyQkFDekIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0I7c0JBQy9DLFlBQVksQ0FBQyxRQUFRLENBQUMsZUFBZTswQkFDakMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUI7d0JBQzNDLFlBQVksQ0FBQyxRQUFRLENBQUMsaUJBQWlCO3VCQUN4QyxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQjtJQUN6RCxDQUFBO2FBQ0Q7WUFFRCxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3BFLElBQUksQ0FBQyxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFN0UsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxDQUFDOztLQUM3QjtJQUVNLE1BQU0sQ0FBTyxpQkFBaUI7OztZQUVwQyxhQUFhO1lBQ2IsSUFBSSxJQUFJLENBQUMsaUJBQWlCLElBQUksU0FBUztnQkFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztZQUMvSixJQUFJLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxTQUFTO2dCQUFFLE9BQU87WUFFaEQsYUFBYTtZQUNiLElBQUksT0FBTyxHQUFHLE1BQUEsSUFBSSxDQUFDLGlCQUFpQiwwQ0FBRSxTQUFTLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzVFLElBQUksT0FBTyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFDdEM7Z0JBQ0MsWUFBWSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Z0JBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFDL0Q7b0JBQ0MsWUFBWSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7aUJBQzdFO2dCQUdELFlBQVksQ0FBQyxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLG9CQUFvQixFQUFFLDhCQUE4QixDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDcEo7aUJBRUQ7Z0JBQ0MsT0FBTzthQUNQO1lBRUQsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQzs7S0FDbEM7SUFFTyxNQUFNLENBQUMsaUJBQWlCLENBQUMsUUFBZ0I7UUFFaEQsbUZBQW1GO1FBQ25GLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztRQUNuQixPQUFPLFVBQVUsSUFBSSxDQUFDLEVBQ3RCO1lBQ0MsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHlDQUF5QyxDQUFDLENBQUMsQ0FBQztZQUV2RixVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBQ2YsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUV6QixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLElBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLElBQUksUUFBUSxJQUFJLE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQ3BFO29CQUNDLFFBQVEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztvQkFDekQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdkIsVUFBVSxFQUFFLENBQUM7aUJBQ2I7WUFDRixDQUFDLENBQUMsQ0FBQztTQUNIO1FBRUQsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVPLE1BQU0sQ0FBTyxhQUFhOzs7WUFFakMsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QyxJQUFJLFdBQVcsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDO1lBQ3ZDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUMzQztnQkFDQyxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUksTUFBQSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSwwQ0FBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUEsRUFDbkU7b0JBQ0MsUUFBUSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDMUIsTUFBTTtpQkFDTjthQUNEO1lBRUQsSUFBSSxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUM7WUFFNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUNqRDtnQkFDQyxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoQyxJQUFJLElBQUksRUFDUjtvQkFDQyxJQUFJLElBQUksR0FBRyxLQUFLLENBQUM7b0JBQ2pCLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUUxQyxLQUFLLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFDeEM7d0JBQ0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQzVCOzRCQUNDLEtBQUssSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUM1QztnQ0FDQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQzdCO29DQUNDLElBQUksR0FBRyxJQUFJLENBQUM7b0NBQ1osTUFBTTtpQ0FDTjs2QkFDRDt5QkFDRDs2QkFFRDs0QkFDQyxJQUFJLEdBQUcsS0FBSyxDQUFDOzRCQUNiLE1BQU07eUJBQ047cUJBQ0Q7b0JBRUQsSUFBSSxJQUFJO3dCQUFFLFNBQVM7b0JBSW5CLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO29CQUNsQyxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUscUNBQXFDLENBQUMsQ0FBQztvQkFDL0UsT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLGtDQUFrQyxDQUFDLENBQUM7b0JBRXpFLElBQUksQ0FBQyxTQUFTLElBQUksT0FBTyxDQUFDO2lCQUMxQjthQUNEO1lBRUQsS0FBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQzFDO2dCQUNDLGFBQWE7Z0JBQ2IsSUFBSSxPQUFPLEdBQUcsTUFBQSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUywwQ0FBRSxFQUFFLENBQUM7Z0JBQzNDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxPQUFPLElBQUksZ0NBQWdDLEVBQzNIO29CQUNDLFNBQVMsQ0FBQyxHQUFHLENBQUMsd0JBQXdCLEdBQUcsT0FBTyxDQUFDLENBQUM7b0JBQ2xELElBQUksS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7b0JBRXBDLEtBQUksSUFBSSxJQUFJLElBQUksS0FBSyxFQUNyQjt3QkFDQyxJQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksU0FBUyxFQUNuQzs0QkFFQyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO3lCQUM3QztxQkFDRDtpQkFDRDthQUNEO1lBRUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRXhELElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7O0tBQ2pFO0lBRU8sTUFBTSxDQUFPLGVBQWU7O1lBRW5DLDRCQUE0QjtZQUM1QixJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7WUFDbkIsSUFBSSwwQkFBMEIsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwRixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsMEJBQTBCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUMxRDtnQkFDQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQUUsU0FBUztnQkFFL0gsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUMzRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU07b0JBQUUsU0FBUztnQkFFM0IsSUFBSSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3hDLElBQUksS0FBSyxFQUNUO29CQUNDLFNBQVMsSUFBSSxLQUFLLENBQUM7aUJBQ25CO2FBQ0Q7WUFFRCxTQUFTLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTlDLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7S0FBQTtJQUVPLE1BQU0sQ0FBTyxlQUFlLENBQUMsU0FBaUI7OztZQUVyRCxJQUFJLFNBQVMsSUFBSSxTQUFTO2dCQUFFLE9BQU8sNEJBQTRCLENBQUM7WUFDaEUsZ0RBQWdEO1lBQ2hELElBQUksU0FBUyxHQUFHLElBQUksSUFBSSxDQUFDLG9CQUFvQixTQUFTLFlBQVksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQy9FLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUNyQjtnQkFDQyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUFpQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO2dCQUNqRSxPQUFPLEVBQUUsQ0FBQzthQUNWO1lBQ0QsSUFBSSxZQUFZLEdBQUcsTUFBQSxNQUFNLFNBQVMsQ0FBQyxjQUFjLEVBQUUsbUNBQUksRUFBRSxDQUFDO1lBRTFELFlBQVksR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFcEQsT0FBTyxZQUFZLENBQUM7O0tBQ3BCO0lBRU8sTUFBTSxDQUFDLG1CQUFtQjs7UUFFakMsY0FBYztRQUNkLElBQUksU0FBUyxHQUFHLE1BQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLDBDQUFFLFFBQVEsQ0FBQztRQUMzQyxPQUFPLENBQUMsU0FBUyxhQUFULFNBQVMsY0FBVCxTQUFTLEdBQUksRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN4RCxDQUFDO0lBRU8sTUFBTSxDQUFPLGNBQWMsQ0FBQyxZQUFzQjs7WUFFekQsSUFBSSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUN4RCxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDcEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQzVDO2dCQUNDLFFBQVEsSUFBSSxVQUFVLFlBQVksQ0FBQyxDQUFDLENBQUMsbUJBQW1CLFlBQVksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO2FBQ2xGO1lBQ0QsT0FBTyxRQUFRLENBQUM7UUFDakIsQ0FBQztLQUFBO0lBRU8sTUFBTSxDQUFDLGtCQUFrQjs7UUFFaEMsY0FBYztRQUNkLE9BQU8sTUFBQSxNQUFBLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSwwQ0FBRSxrQkFBa0IsbUNBQUksRUFBRSxDQUFDO0lBQ25ELENBQUM7SUFFTyxNQUFNLENBQU8sdUJBQXVCOzs7WUFFM0MsSUFBSSxlQUFlLEdBQWMsRUFBRSxDQUFDO1lBQ3BDLElBQUksZUFBZSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUMvQztnQkFDQyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxzQkFBc0IsZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDL0UsSUFBSSxJQUFJLENBQUMsTUFBTTtvQkFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQUEsTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLG1DQUFJLElBQUksQ0FBQyxDQUFDO2FBQzNFO1lBQ0QsT0FBTyxlQUFlLENBQUM7O0tBQ3ZCOztBQTlhYyxpQ0FBb0IsR0FDbkMsQ0FBQyxZQUFZLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWTtJQUNuRCxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsWUFBWTtJQUNsRCxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsV0FBVztJQUNwRCxZQUFZLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsUUFBUTtJQUN2RCxNQUFNLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsUUFBUTtJQUNwRCxLQUFLLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxTQUFTO0lBQ3hDLFVBQVUsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTztJQUN4RCxXQUFXLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU07SUFDekQsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsU0FBUztJQUN2QyxNQUFNLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxjQUFjO0lBQ2hELHFCQUFxQixFQUFFLGNBQWMsRUFBRSxrQkFBa0I7SUFDekQsY0FBYyxDQUFDLENBQUM7QUFFRCwrQkFBa0IsR0FDakMsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFFNUIscUdBQXFHO0FBQzlFLDRCQUFlLEdBQVMsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDOUMseUJBQVksR0FBUyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUM3QywwQkFBYSxHQUFTLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXRELHNCQUFTLEdBQVcsRUFBRSxDQUFDO0FBQ3ZCLHVCQUFVLEdBQVcsRUFBRSxDQUFDO0FBQ3hCLDBCQUFhLEdBQVcsRUFBRSxDQUFDO0FBQzNCLHdCQUFXLEdBQVcsRUFBRSxDQUFDO0FBQ3pCLDBCQUFhLEdBQVcsRUFBRSxDQUFDO0FBQzNCLHlCQUFZLEdBQVcsRUFBRSxDQUFDO0FBQzFCLDRCQUFlLEdBQVcsRUFBRSxDQUFDO0FBRTVCLG9DQUF1QixHQUFXLEVBQUUsQ0FBQztBQUNyQyxnQ0FBbUIsR0FBYSxFQUFFLENBQUM7QUFDbkMsNkJBQWdCLEdBQVcsRUFBRSxDQUFDO0FBQzlCLCtCQUFrQixHQUFXLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLDhCQUFpQixHQUE4QixTQUFTLENBQUM7QUFFMUQsc0JBQVMsR0FBVyxFQUFFLENBQUM7QUFDdkIsd0JBQVcsR0FBVyxFQUFFLENBQUM7QUFDekIsd0JBQVcsR0FBVyxFQUFFLENBQUM7QUFFekIsMkJBQWMsR0FBVyxFQUFFLENBQUM7QUFDNUIsd0JBQVcsR0FBVyxFQUFFLENBQUM7QUFDekIsd0JBQVcsR0FBVyxFQUFFLENBQUM7QUFFekIsOEJBQWlCLEdBQVcsRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGdyYXBoVmlld0pTIGZyb20gXCJhc3NldHMvZ3JhcGhfdmlldy50eHQuanNcIjtcclxuaW1wb3J0IGdyYXBoV0FTTUpTIGZyb20gXCJhc3NldHMvZ3JhcGhfd2FzbS50eHQuanNcIjtcclxuaW1wb3J0IHJlbmRlcldvcmtlckpTIGZyb20gXCJhc3NldHMvZ3JhcGgtcmVuZGVyLXdvcmtlci50eHQuanNcIjtcclxuaW1wb3J0IGdyYXBoV0FTTSBmcm9tIFwiYXNzZXRzL2dyYXBoX3dhc20ud2FzbVwiO1xyXG5pbXBvcnQgdGlueUNvbG9ySlMgZnJvbSBcImFzc2V0cy90aW55Y29sb3IudHh0LmpzXCI7XHJcbmltcG9ydCB3ZWJwYWdlSlMgZnJvbSBcImFzc2V0cy93ZWJwYWdlLnR4dC5qc1wiO1xyXG5pbXBvcnQgYXBwU3R5bGVzIGZyb20gXCJhc3NldHMvb2JzaWRpYW4tc3R5bGVzLnR4dC5jc3NcIjtcclxuaW1wb3J0IHdlYnBhZ2VTdHlsZXMgZnJvbSBcImFzc2V0cy9wbHVnaW4tc3R5bGVzLnR4dC5jc3NcIjtcclxuXHJcbmltcG9ydCB7IFBhdGggfSBmcm9tIFwic2NyaXB0cy91dGlscy9wYXRoLmpzXCI7XHJcbmltcG9ydCB7IERvd25sb2FkYWJsZSB9IGZyb20gXCJzY3JpcHRzL3V0aWxzL2Rvd25sb2FkYWJsZS5qc1wiO1xyXG5pbXBvcnQgeyBSZW5kZXJMb2cgfSBmcm9tIFwiLi9yZW5kZXItbG9nLmpzXCI7XHJcbmltcG9ydCB7IE1haW5TZXR0aW5ncyB9IGZyb20gXCJzY3JpcHRzL3NldHRpbmdzL21haW4tc2V0dGluZ3MuanNcIjtcclxuaW1wb3J0IHsgV2Vic2l0ZSB9IGZyb20gXCJzY3JpcHRzL29iamVjdHMvd2Vic2l0ZS5qc1wiO1xyXG5jb25zdCB7IG1pbmlmeSB9ID0gcmVxdWlyZSgnaHRtbC1taW5pZmllci10ZXJzZXInKTtcclxuXHJcblxyXG5leHBvcnQgY2xhc3MgQXNzZXRIYW5kbGVyXHJcbntcclxuXHRwcml2YXRlIHN0YXRpYyB2YXVsdFBsdWdpbnNQYXRoOiBQYXRoO1xyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBvYnNpZGlhblN0eWxlc0ZpbHRlciA9IFxyXG5cdFtcIndvcmtzcGFjZS1cIiwgXCJjbS1cIiwgXCJnaG9zdFwiLCBcImxlYWZcIiwgXCJDb2RlTWlycm9yXCIsIFxyXG5cdFwiQG1lZGlhXCIsIFwicGRmXCIsIFwieGZhXCIsIFwiYW5ub3RhdGlvblwiLCBcIkBrZXlmcmFtZXNcIiwgXHJcblx0XCJsb2FkXCIsIFwiQC13ZWJraXRcIiwgXCJzZXR0aW5nXCIsIFwiZmlsdGVyXCIsIFwiZGVjb3JhdG9yXCIsIFxyXG5cdFwiZGljdGlvbmFyeVwiLCBcInN0YXR1c1wiLCBcIndpbmRvd3NcIiwgXCJ0aXRsZWJhclwiLCBcInNvdXJjZVwiLFxyXG5cdFwibWVudVwiLCBcIm1lc3NhZ2VcIiwgXCJwb3BvdmVyXCIsIFwic3VnZ2VzdGlvblwiLCBcInByb21wdFwiLCBcclxuXHRcInRhYlwiLCBcIkh5cGVyTURcIiwgXCJ3b3Jrc3BhY2VcIiwgXCJwdWJsaXNoXCIsIFxyXG5cdFwiYmFja2xpbmtcIiwgXCJzeW5jXCIsIFwidmF1bHRcIiwgXCJtb2JpbGVcIiwgXCJ0YWJsZXRcIiwgXCJwaG9uZVwiLCBcclxuXHRcInRleHRMYXllclwiLCBcImhlYWRlclwiLCBcImxpbnV4XCIsIFwibWFjb3NcIiwgXCJyZW5hbWVcIiwgXCJlZGl0XCIsXHJcblx0XCJwcm9ncmVzc1wiLCBcIm5hdGl2ZVwiLCBcImFyaWFcIiwgXCJ0b29sdGlwXCIsIFxyXG5cdFwiZHJvcFwiLCBcInNpZGViYXJcIiwgXCJtb2Qtd2luZG93c1wiLCBcImlzLWZyYW1lbGVzc1wiLCBcclxuXHRcImlzLWhpZGRlbi1mcmFtZWxlc3NcIiwgXCJvYnNpZGlhbi1hcHBcIiwgXCJzaG93LXZpZXctaGVhZGVyXCIsIFxyXG5cdFwiaXMtbWF4aW1pemVkXCJdO1xyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBvYnNpZGlhblN0eWxlc0tlZXAgPSBcclxuXHRbXCJzY3JvbGxiYXJcIiwgXCJpbnB1dFt0eXBlXCJdO1xyXG5cclxuXHQvLyB0aGlzIHBhdGggaXMgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcmVsYXRpdmUgcGF0aCB0byB0aGUgaW1hZ2VzIGZvbGRlciwgbGlrZXdpc2UgZm9yIHRoZSBvdGhlciBwYXRoc1xyXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgbWVkaWFGb2xkZXJOYW1lOiBQYXRoID0gbmV3IFBhdGgoXCJsaWIvbWVkaWFcIik7XHJcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBqc0ZvbGRlck5hbWU6IFBhdGggPSBuZXcgUGF0aChcImxpYi9zY3JpcHRzXCIpO1xyXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgY3NzRm9sZGVyTmFtZTogUGF0aCA9IG5ldyBQYXRoKFwibGliL3N0eWxlc1wiKTtcclxuXHJcblx0cHVibGljIHN0YXRpYyBhcHBTdHlsZXM6IHN0cmluZyA9IFwiXCI7XHJcblx0cHVibGljIHN0YXRpYyBtYXRoU3R5bGVzOiBzdHJpbmcgPSBcIlwiO1xyXG5cdHB1YmxpYyBzdGF0aWMgd2VicGFnZVN0eWxlczogc3RyaW5nID0gXCJcIjtcclxuXHRwdWJsaWMgc3RhdGljIHRoZW1lU3R5bGVzOiBzdHJpbmcgPSBcIlwiO1xyXG5cdHB1YmxpYyBzdGF0aWMgc25pcHBldFN0eWxlczogc3RyaW5nID0gXCJcIjtcclxuXHRwdWJsaWMgc3RhdGljIHBsdWdpblN0eWxlczogc3RyaW5nID0gXCJcIjtcclxuXHRwdWJsaWMgc3RhdGljIGdlbmVyYXRlZFN0eWxlczogc3RyaW5nID0gXCJcIjtcclxuXHJcblx0cHJpdmF0ZSBzdGF0aWMgbGFzdEVuYWJsZWRQbHVnaW5TdHlsZXM6IHN0cmluZyA9IFwiXCI7XHJcblx0cHJpdmF0ZSBzdGF0aWMgbGFzdEVuYWJsZWRTbmlwcGV0czogc3RyaW5nW10gPSBbXTtcclxuXHRwcml2YXRlIHN0YXRpYyBsYXN0RW5hYmxlZFRoZW1lOiBzdHJpbmcgPSBcIlwiO1xyXG5cdHByaXZhdGUgc3RhdGljIGxhc3RNYXRoamF4Q2hhbmdlZDogbnVtYmVyID0gLTE7XHJcblx0cHJpdmF0ZSBzdGF0aWMgbWF0aGpheFN0eWxlc2hlZXQ6IENTU1N0eWxlU2hlZXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgd2VicGFnZUpTOiBzdHJpbmcgPSBcIlwiO1xyXG5cdHB1YmxpYyBzdGF0aWMgZ3JhcGhWaWV3SlM6IHN0cmluZyA9IFwiXCI7XHJcblx0cHVibGljIHN0YXRpYyBncmFwaFdBU01KUzogc3RyaW5nID0gXCJcIjtcclxuXHRwdWJsaWMgc3RhdGljIGdyYXBoV0FTTTogQnVmZmVyO1xyXG5cdHB1YmxpYyBzdGF0aWMgcmVuZGVyV29ya2VySlM6IHN0cmluZyA9IFwiXCI7XHJcblx0cHVibGljIHN0YXRpYyB0aW55Q29sb3JKUzogc3RyaW5nID0gXCJcIjtcclxuXHRwdWJsaWMgc3RhdGljIGdlbmVyYXRlZEpTOiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuXHRwdWJsaWMgc3RhdGljIGN1c3RvbUhlYWRDb250ZW50OiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGluaXRpYWxpemUocGx1Z2luSUQ6IHN0cmluZylcclxuXHR7XHJcblx0XHR0aGlzLnZhdWx0UGx1Z2luc1BhdGggPSBQYXRoLnZhdWx0UGF0aC5qb2luU3RyaW5nKGFwcC52YXVsdC5jb25maWdEaXIsIFwicGx1Z2lucy9cIikubWFrZUFic29sdXRlKCk7XHJcblxyXG5cdFx0YXdhaXQgdGhpcy5sb2FkQXBwU3R5bGVzKCk7XHJcblx0XHR0aGlzLndlYnBhZ2VTdHlsZXMgPSBhd2FpdCBBc3NldEhhbmRsZXIubWluaWZ5SlNvckNTUyh3ZWJwYWdlU3R5bGVzLCBmYWxzZSk7XHJcblx0XHR0aGlzLndlYnBhZ2VKUyA9IGF3YWl0IEFzc2V0SGFuZGxlci5taW5pZnlKU29yQ1NTKHdlYnBhZ2VKUywgdHJ1ZSk7XHJcblx0XHR0aGlzLmdyYXBoVmlld0pTID0gYXdhaXQgQXNzZXRIYW5kbGVyLm1pbmlmeUpTb3JDU1MoZ3JhcGhWaWV3SlMsIHRydWUpO1xyXG5cdFx0dGhpcy5ncmFwaFdBU01KUyA9IGF3YWl0IEFzc2V0SGFuZGxlci5taW5pZnlKU29yQ1NTKGdyYXBoV0FTTUpTLCB0cnVlKTtcclxuXHRcdHRoaXMucmVuZGVyV29ya2VySlMgPSBhd2FpdCBBc3NldEhhbmRsZXIubWluaWZ5SlNvckNTUyhyZW5kZXJXb3JrZXJKUywgdHJ1ZSk7XHJcblx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHR0aGlzLnRpbnlDb2xvckpTID0gYXdhaXQgQXNzZXRIYW5kbGVyLm1pbmlmeUpTb3JDU1ModGlueUNvbG9ySlMsIHRydWUpO1xyXG5cdFx0dGhpcy5ncmFwaFdBU00gPSBCdWZmZXIuZnJvbShncmFwaFdBU00pO1xyXG5cclxuXHRcdHRoaXMudXBkYXRlQXNzZXRDYWNoZSgpO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGFzeW5jIG1pbmlmeUpTb3JDU1MoY29udGVudDogc3RyaW5nLCBpc0pTTm90Q1NTOiBib29sZWFuKSA6IFByb21pc2U8c3RyaW5nPlxyXG5cdHtcclxuXHRcdC8vIGZvciBub3cgdGhpcyBpcyBkaXNhYmxlZCBiZWNhdXNlIEkgZG9uJ3QgaGF2ZSB0aW1lIHRvIG1ha2UgaXQgY2xlYW5cclxuXHRcdC8vIHJldHVybiBjb250ZW50O1xyXG5cclxuXHRcdGxldCB0ZW1wQ29udGVudCA9IGNvbnRlbnQ7XHJcblxyXG5cdFx0dHJ5XHJcblx0XHR7XHJcblx0XHRcdC8vIGFkZCBzY3JpcHQgb3Igc3R5bGUgdGFncyBzbyB0aGF0IG1pbmlmaWVyIGNhbiBtaW5pZnkgaXQgYXMgaHRtbFxyXG5cdFx0XHRpZiAoaXNKU05vdENTUylcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGNvbnRlbnQgPSBgXHJcblx0XHRcdFx0PHNjcmlwdD5cclxuXHRcdFx0XHQke2NvbnRlbnR9XHJcblx0XHRcdFx0PC9zY3JpcHQ+YDtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdHtcclxuXHRcdFx0XHRjb250ZW50ID0gYFxyXG5cdFx0XHRcdDxzdHlsZT5cclxuXHRcdFx0XHQke2NvbnRlbnR9XHJcblx0XHRcdFx0PC9zdHlsZT5gO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb250ZW50ID0gYXdhaXQgbWluaWZ5KGNvbnRlbnQsIHsgY29sbGFwc2VCb29sZWFuQXR0cmlidXRlczogdHJ1ZSwgY29sbGFwc2VXaGl0ZXNwYWNlOiB0cnVlLCBtaW5pZnlDU1M6IHRydWUsIG1pbmlmeUpTOiB0cnVlLCByZW1vdmVDb21tZW50czogdHJ1ZSwgcmVtb3ZlRW1wdHlBdHRyaWJ1dGVzOiB0cnVlLCByZW1vdmVSZWR1bmRhbnRBdHRyaWJ1dGVzOiB0cnVlLCByZW1vdmVTY3JpcHRUeXBlQXR0cmlidXRlczogdHJ1ZSwgcmVtb3ZlU3R5bGVMaW5rVHlwZUF0dHJpYnV0ZXM6IHRydWUsIHVzZVNob3J0RG9jdHlwZTogdHJ1ZX0pO1xyXG5cclxuXHRcdFx0Ly8gcmVtb3ZlIHRoZSA8c2NyaXB0PiBvciA8c3R5bGU+IHRhZ3NcclxuXHRcdFx0Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZShcIjxzY3JpcHQ+XCIsIFwiXCIpLnJlcGxhY2UoXCI8L3NjcmlwdD5cIiwgXCJcIikucmVwbGFjZShcIjxzdHlsZT5cIiwgXCJcIikucmVwbGFjZShcIjwvc3R5bGU+XCIsIFwiXCIpO1xyXG5cdFx0fVxyXG5cdFx0Y2F0Y2ggKGUpXHJcblx0XHR7XHJcblx0XHRcdFJlbmRlckxvZy5lcnJvcihlLnN0YWNrLCBcIkVycm9yIHdoaWxlIG1pbmlmeWluZyBcIiArIChpc0pTTm90Q1NTID8gXCJKU1wiIDogXCJDU1NcIikgKyBcIiBmaWxlLlwiKTtcclxuXHRcdFx0Y29udGVudCA9IHRlbXBDb250ZW50O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChjb250ZW50ID09IFwiXCIpIGNvbnRlbnQgPSBcIiBcIjtcclxuXHJcblx0XHRyZXR1cm4gY29udGVudDtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0RG93bmxvYWRzKCkgOiBQcm9taXNlPERvd25sb2FkYWJsZVtdPlxyXG5cdHtcclxuXHRcdGxldCB0b0Rvd25sb2FkOiBEb3dubG9hZGFibGVbXSA9IFtdO1xyXG5cdFx0aWYgKCFNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lQ1NTKVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgcGx1Z2luQ1NTID0gdGhpcy53ZWJwYWdlU3R5bGVzO1xyXG5cdFx0XHRsZXQgdGhpcmRQYXJ0eVBsdWdpbkNTUyA9IGF3YWl0IHRoaXMubWluaWZ5SlNvckNTUyhhd2FpdCB0aGlzLmdldFBsdWdpblN0eWxlcygpLCBmYWxzZSk7XHJcblx0XHRcdHBsdWdpbkNTUyArPSBcIlxcblwiICsgdGhpcmRQYXJ0eVBsdWdpbkNTUyArIFwiXFxuXCI7XHJcblx0XHRcdGxldCBhcHBjc3NEb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoXCJvYnNpZGlhbi1zdHlsZXMuY3NzXCIsIHRoaXMuYXBwU3R5bGVzLCB0aGlzLmNzc0ZvbGRlck5hbWUpO1xyXG5cdFx0XHRsZXQgcGx1Z2luY3NzRG93bmxvYWQgPSBuZXcgRG93bmxvYWRhYmxlKFwicGx1Z2luLXN0eWxlcy5jc3NcIiwgcGx1Z2luQ1NTLCB0aGlzLmNzc0ZvbGRlck5hbWUpO1xyXG5cdFx0XHRsZXQgdGhlbWVjc3NEb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoXCJ0aGVtZS5jc3NcIiwgdGhpcy50aGVtZVN0eWxlcywgdGhpcy5jc3NGb2xkZXJOYW1lKTtcclxuXHRcdFx0bGV0IHNuaXBwZXRzRG93bmxvYWQgPSBuZXcgRG93bmxvYWRhYmxlKFwic25pcHBldHMuY3NzXCIsIHRoaXMuc25pcHBldFN0eWxlcywgdGhpcy5jc3NGb2xkZXJOYW1lKTtcclxuXHRcdFx0dG9Eb3dubG9hZC5wdXNoKGFwcGNzc0Rvd25sb2FkKTtcclxuXHRcdFx0dG9Eb3dubG9hZC5wdXNoKHBsdWdpbmNzc0Rvd25sb2FkKTtcclxuXHRcdFx0dG9Eb3dubG9hZC5wdXNoKHRoZW1lY3NzRG93bmxvYWQpO1xyXG5cdFx0XHR0b0Rvd25sb2FkLnB1c2goc25pcHBldHNEb3dubG9hZCk7XHJcblx0XHRcdHRvRG93bmxvYWQucHVzaChuZXcgRG93bmxvYWRhYmxlKFwiZ2VuZXJhdGVkLXN0eWxlcy5jc3NcIiwgdGhpcy5nZW5lcmF0ZWRTdHlsZXMsIHRoaXMuY3NzRm9sZGVyTmFtZSkpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCFNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5saW5lSlMpXHJcblx0XHR7XHJcblx0XHRcdGxldCB3ZWJwYWdlanNEb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoXCJ3ZWJwYWdlLmpzXCIsIHRoaXMud2VicGFnZUpTLCB0aGlzLmpzRm9sZGVyTmFtZSk7XHJcblx0XHRcdHRvRG93bmxvYWQucHVzaCh3ZWJwYWdlanNEb3dubG9hZCk7XHJcblx0XHRcdGlmICh0aGlzLmdlbmVyYXRlZEpTICE9IFwiXCIpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgZ2VuZXJhdGVkanNEb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoXCJnZW5lcmF0ZWQuanNcIiwgdGhpcy5nZW5lcmF0ZWRKUywgdGhpcy5qc0ZvbGRlck5hbWUpO1xyXG5cdFx0XHRcdHRvRG93bmxvYWQucHVzaChnZW5lcmF0ZWRqc0Rvd25sb2FkKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYoTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVHcmFwaFZpZXcpXHJcblx0XHR7XHJcblx0XHRcdGxldCBncmFwaFdBU01Eb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoXCJncmFwaF93YXNtLndhc21cIiwgdGhpcy5ncmFwaFdBU00sIHRoaXMuanNGb2xkZXJOYW1lKTsgLy8gTUlHSFQgTkVFRCBUTyBTUEVDSUZZIEVOQ09ESU5HXHJcblx0XHRcdGxldCByZW5kZXJXb3JrZXJKU0Rvd25sb2FkID0gbmV3IERvd25sb2FkYWJsZShcImdyYXBoLXJlbmRlci13b3JrZXIuanNcIiwgdGhpcy5yZW5kZXJXb3JrZXJKUywgdGhpcy5qc0ZvbGRlck5hbWUpO1xyXG5cdFx0XHRsZXQgZ3JhcGhXQVNNSlNEb3dubG9hZCA9IG5ldyBEb3dubG9hZGFibGUoXCJncmFwaF93YXNtLmpzXCIsIHRoaXMuZ3JhcGhXQVNNSlMsIHRoaXMuanNGb2xkZXJOYW1lKTtcclxuXHRcdFx0bGV0IGdyYXBoVmlld0pTRG93bmxvYWQgPSBuZXcgRG93bmxvYWRhYmxlKFwiZ3JhcGhfdmlldy5qc1wiLCB0aGlzLmdyYXBoVmlld0pTLCB0aGlzLmpzRm9sZGVyTmFtZSk7XHJcblx0XHRcdGxldCB0aW55Q29sb3JKUyA9IG5ldyBEb3dubG9hZGFibGUoXCJ0aW55Y29sb3IuanNcIiwgdGhpcy50aW55Q29sb3JKUywgdGhpcy5qc0ZvbGRlck5hbWUpO1xyXG5cdFx0XHRcclxuXHRcdFx0dG9Eb3dubG9hZC5wdXNoKHJlbmRlcldvcmtlckpTRG93bmxvYWQpO1xyXG5cdFx0XHR0b0Rvd25sb2FkLnB1c2goZ3JhcGhXQVNNRG93bmxvYWQpO1xyXG5cdFx0XHR0b0Rvd25sb2FkLnB1c2goZ3JhcGhXQVNNSlNEb3dubG9hZCk7XHJcblx0XHRcdHRvRG93bmxvYWQucHVzaChncmFwaFZpZXdKU0Rvd25sb2FkKTtcclxuXHRcdFx0dG9Eb3dubG9hZC5wdXNoKHRpbnlDb2xvckpTKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdG9Eb3dubG9hZDtcclxuXHR9XHJcblxyXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgdXBkYXRlQXNzZXRDYWNoZSgpXHJcblx0e1xyXG5cdFx0bGV0IHNuaXBwZXRzTmFtZXMgPSB0aGlzLmdldEVuYWJsZWRTbmlwcGV0cygpO1xyXG5cdFx0bGV0IHRoZW1lTmFtZSA9IHRoaXMuZ2V0Q3VycmVudFRoZW1lTmFtZSgpO1xyXG5cdFx0bGV0IGVuYWJsZWRQbHVnaW5TdHlsZXMgPSBNYWluU2V0dGluZ3Muc2V0dGluZ3MuaW5jbHVkZVBsdWdpbkNTUztcclxuXHRcdGlmIChzbmlwcGV0c05hbWVzICE9IHRoaXMubGFzdEVuYWJsZWRTbmlwcGV0cylcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5sYXN0RW5hYmxlZFNuaXBwZXRzID0gc25pcHBldHNOYW1lcztcclxuXHRcdFx0dGhpcy5zbmlwcGV0U3R5bGVzID0gYXdhaXQgdGhpcy5taW5pZnlKU29yQ1NTKGF3YWl0IHRoaXMuZ2V0U25pcHBldHNDU1Moc25pcHBldHNOYW1lcyksIGZhbHNlKTtcclxuXHRcdH1cclxuXHRcdGlmICh0aGVtZU5hbWUgIT0gdGhpcy5sYXN0RW5hYmxlZFRoZW1lKVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLmxhc3RFbmFibGVkVGhlbWUgPSB0aGVtZU5hbWU7XHJcblx0XHRcdHRoaXMudGhlbWVTdHlsZXMgPSBhd2FpdCB0aGlzLm1pbmlmeUpTb3JDU1MoYXdhaXQgdGhpcy5nZXRUaGVtZUNvbnRlbnQodGhlbWVOYW1lKSwgZmFsc2UpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGVuYWJsZWRQbHVnaW5TdHlsZXMgIT0gdGhpcy5sYXN0RW5hYmxlZFBsdWdpblN0eWxlcylcclxuXHRcdHtcclxuXHRcdFx0dGhpcy5sYXN0RW5hYmxlZFBsdWdpblN0eWxlcyA9IGVuYWJsZWRQbHVnaW5TdHlsZXM7XHJcblx0XHRcdHRoaXMucGx1Z2luU3R5bGVzID0gYXdhaXQgdGhpcy5taW5pZnlKU29yQ1NTKGF3YWl0IHRoaXMuZ2V0UGx1Z2luU3R5bGVzKCksIGZhbHNlKTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0bGV0IGJvZHlTdHlsZSA9IChkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZShcInN0eWxlXCIpID8/IFwiXCIpLnJlcGxhY2VBbGwoXCJcXFwiXCIsIFwiJ1wiKS5yZXBsYWNlQWxsKFwiOyBcIiwgXCIgIWltcG9ydGFudDtcXG5cXHRcIik7XHJcblx0XHRsZXQgbGluZVdpZHRoID0gTWFpblNldHRpbmdzLnNldHRpbmdzLmN1c3RvbUxpbmVXaWR0aCB8fCBcIjUwZW1cIjtcclxuXHRcdGxldCBjb250ZW50V2lkdGggPSBNYWluU2V0dGluZ3Muc2V0dGluZ3MuY29udGVudFdpZHRoIHx8IFwiNTAwZW1cIjtcclxuXHRcdGxldCBzaWRlYmFyV2lkdGggPSBNYWluU2V0dGluZ3Muc2V0dGluZ3Muc2lkZWJhcldpZHRoIHx8IFwiMjVlbVwiO1xyXG5cdFx0aWYgKCFpc05hTihOdW1iZXIobGluZVdpZHRoKSkpIGxpbmVXaWR0aCArPSBcInB4XCI7XHJcblx0XHRpZiAoIWlzTmFOKE51bWJlcihjb250ZW50V2lkdGgpKSkgY29udGVudFdpZHRoICs9IFwicHhcIjtcclxuXHRcdGlmICghaXNOYU4oTnVtYmVyKHNpZGViYXJXaWR0aCkpKSBzaWRlYmFyV2lkdGggKz0gXCJweFwiO1xyXG5cclxuXHRcdGxldCBjdXN0b21IZWFkUGF0aCA9IG5ldyBQYXRoKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5jdXN0b21IZWFkQ29udGVudFBhdGgpO1xyXG5cdFx0dGhpcy5jdXN0b21IZWFkQ29udGVudCA9IGF3YWl0IGN1c3RvbUhlYWRQYXRoLnJlYWRGaWxlU3RyaW5nKCkgPz8gXCJcIjtcclxuXHJcblx0XHR0aGlzLmdlbmVyYXRlZFN0eWxlcyA9IFxyXG5gXHJcbmJvZHlcclxue1xyXG5cdC0tbGluZS13aWR0aDogJHtsaW5lV2lkdGh9O1xyXG5cdC0tbGluZS13aWR0aC1hZGFwdGl2ZTogJHtsaW5lV2lkdGh9O1xyXG5cdC0tZmlsZS1saW5lLXdpZHRoOiAke2xpbmVXaWR0aH07XHJcblx0LS1jb250ZW50LXdpZHRoOiAke2NvbnRlbnRXaWR0aH07XHJcblx0LS1zaWRlYmFyLXdpZHRoOiBjYWxjKG1pbigke3NpZGViYXJXaWR0aH0sIDgwdncpKTtcclxuXHQtLWNvbGxhcHNlLWFycm93LXNpemU6IDAuMzVlbTtcclxuXHQtLXRyZWUtaG9yaXpvbnRhbC1zcGFjaW5nOiAwLjZlbTtcclxuXHQtLXRyZWUtdmVydGljYWwtc3BhY2luZzogMC42ZW07XHJcblx0LS1zaWRlYmFyLW1hcmdpbjogMjRweDtcclxufVxyXG5cclxuYm9keVxyXG57XHJcblx0JHtib2R5U3R5bGV9XHJcbn1cclxuYFxyXG5cclxuXHRcdHRoaXMuZ2VuZXJhdGVkSlMgPSBcIlwiO1xyXG5cdFx0aWYgKE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlR3JhcGhWaWV3KVxyXG5cdFx0e1xyXG5cdFx0XHR0aGlzLmdlbmVyYXRlZEpTICs9IFxyXG5cdFx0XHRgXHJcblx0XHRcdGxldCBub2Rlcz1cXG4ke0pTT04uc3RyaW5naWZ5KFdlYnNpdGUuZ2xvYmFsR3JhcGgpfTtcclxuXHRcdFx0bGV0IGF0dHJhY3Rpb25Gb3JjZSA9ICR7TWFpblNldHRpbmdzLnNldHRpbmdzLmdyYXBoQXR0cmFjdGlvbkZvcmNlfTtcclxuXHRcdFx0bGV0IGxpbmtMZW5ndGggPSAke01haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaExpbmtMZW5ndGh9O1xyXG5cdFx0XHRsZXQgcmVwdWxzaW9uRm9yY2UgPSAke01haW5TZXR0aW5ncy5zZXR0aW5ncy5ncmFwaFJlcHVsc2lvbkZvcmNlfTtcclxuXHRcdFx0bGV0IGNlbnRyYWxGb3JjZSA9ICR7TWFpblNldHRpbmdzLnNldHRpbmdzLmdyYXBoQ2VudHJhbEZvcmNlfTtcclxuXHRcdFx0bGV0IGVkZ2VQcnVuaW5nID0gJHtNYWluU2V0dGluZ3Muc2V0dGluZ3MuZ3JhcGhFZGdlUHJ1bmluZ307XHJcblx0XHRcdGBcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmdlbmVyYXRlZEpTID0gYXdhaXQgdGhpcy5taW5pZnlKU29yQ1NTKHRoaXMuZ2VuZXJhdGVkSlMsIHRydWUpO1xyXG5cdFx0dGhpcy5nZW5lcmF0ZWRTdHlsZXMgPSBhd2FpdCB0aGlzLm1pbmlmeUpTb3JDU1ModGhpcy5nZW5lcmF0ZWRTdHlsZXMsIGZhbHNlKTtcclxuXHJcblx0XHR0aGlzLmxhc3RNYXRoamF4Q2hhbmdlZCA9IC0xO1xyXG5cdH1cclxuXHJcblx0cHVibGljIHN0YXRpYyBhc3luYyBsb2FkTWF0aGpheFN0eWxlcygpXHJcblx0e1xyXG5cdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0aWYgKHRoaXMubWF0aGpheFN0eWxlc2hlZXQgPT0gdW5kZWZpbmVkKSB0aGlzLm1hdGhqYXhTdHlsZXNoZWV0ID0gQXJyYXkuZnJvbShkb2N1bWVudC5zdHlsZVNoZWV0cykuZmluZCgoc2hlZXQpID0+IHNoZWV0Lm93bmVyTm9kZS5pZCA9PSAoXCJNSlgtQ0hUTUwtc3R5bGVzXCIpKTtcclxuXHRcdGlmICh0aGlzLm1hdGhqYXhTdHlsZXNoZWV0ID09IHVuZGVmaW5lZCkgcmV0dXJuO1xyXG5cclxuXHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdGxldCBjaGFuZ2VkID0gdGhpcy5tYXRoamF4U3R5bGVzaGVldD8ub3duZXJOb2RlLmdldEF0dHJpYnV0ZShcImRhdGEtY2hhbmdlXCIpO1xyXG5cdFx0aWYgKGNoYW5nZWQgIT0gdGhpcy5sYXN0TWF0aGpheENoYW5nZWQpXHJcblx0XHR7XHJcblx0XHRcdEFzc2V0SGFuZGxlci5tYXRoU3R5bGVzID0gXCJcIjtcclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1hdGhqYXhTdHlsZXNoZWV0LmNzc1J1bGVzLmxlbmd0aDsgaSsrKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0QXNzZXRIYW5kbGVyLm1hdGhTdHlsZXMgKz0gdGhpcy5tYXRoamF4U3R5bGVzaGVldC5jc3NSdWxlc1tpXS5jc3NUZXh0ICsgXCJcXG5cIjtcclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdEFzc2V0SGFuZGxlci5tYXRoU3R5bGVzID0gYXdhaXQgdGhpcy5taW5pZnlKU29yQ1NTKEFzc2V0SGFuZGxlci5tYXRoU3R5bGVzLnJlcGxhY2VBbGwoXCJhcHA6Ly9vYnNpZGlhbi5tZC9cIiwgXCJodHRwczovL3B1Ymxpc2gub2JzaWRpYW4ubWQvXCIpLCBmYWxzZSk7XHJcblx0XHR9XHJcblx0XHRlbHNlXHJcblx0XHR7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmxhc3RNYXRoamF4Q2hhbmdlZCA9IGNoYW5nZWQ7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBmaWx0ZXJCb2R5Q2xhc3NlcyhpbnB1dENTUzogc3RyaW5nKTogc3RyaW5nXHJcblx0e1xyXG5cdFx0Ly8gcmVwbGFjZSBhbGwgc2VsZWN0b3JzIHRoYXQgY2hhbmdlIGJhc2VkIG9uIHRoZSBib2R5J3MgY2xhc3MgdG8gYWx3YXlzIGJlIGFwcGxpZWRcclxuXHRcdGxldCBtYXRjaENvdW50ID0gMTtcclxuXHRcdHdoaWxlIChtYXRjaENvdW50ICE9IDApXHJcblx0XHR7XHJcblx0XHRcdGxldCBtYXRjaGVzID0gQXJyYXkuZnJvbShpbnB1dENTUy5tYXRjaEFsbCgvYm9keVxcLig/IXRoZW1lLWRhcmt8dGhlbWUtbGlnaHQpW1xcdy1dKy9nKSk7XHJcblx0XHRcdFxyXG5cdFx0XHRtYXRjaENvdW50ID0gMDtcclxuXHRcdFx0bWF0Y2hlcy5mb3JFYWNoKChtYXRjaCkgPT5cclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBzZWxlY3RvciA9IG1hdGNoWzBdO1xyXG5cdFx0XHRcdGxldCBjbGFzc2VzID0gc2VsZWN0b3Iuc3BsaXQoXCIuXCIpWzFdO1xyXG5cdFx0XHRcdGlmIChzZWxlY3RvciAmJiBjbGFzc2VzICYmIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKGNsYXNzZXMpKVxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGlucHV0Q1NTID0gaW5wdXRDU1MucmVwbGFjZShtYXRjaFswXS50b1N0cmluZygpLCBcImJvZHlcIik7XHJcblx0XHRcdFx0XHRSZW5kZXJMb2cubG9nKGNsYXNzZXMpO1xyXG5cdFx0XHRcdFx0bWF0Y2hDb3VudCsrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGlucHV0Q1NTO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBzdGF0aWMgYXN5bmMgbG9hZEFwcFN0eWxlcygpXHJcblx0e1xyXG5cdFx0bGV0IGFwcFNoZWV0ID0gZG9jdW1lbnQuc3R5bGVTaGVldHNbMV07XHJcblx0XHRsZXQgc3R5bGVzaGVldHMgPSBkb2N1bWVudC5zdHlsZVNoZWV0cztcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3R5bGVzaGVldHMubGVuZ3RoOyBpKyspXHJcblx0XHR7XHJcblx0XHRcdGlmIChzdHlsZXNoZWV0c1tpXS5ocmVmICYmIHN0eWxlc2hlZXRzW2ldLmhyZWY/LmluY2x1ZGVzKFwiYXBwLmNzc1wiKSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGFwcFNoZWV0ID0gc3R5bGVzaGVldHNbaV07XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmFwcFN0eWxlcyArPSBhcHBTdHlsZXM7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcHBTaGVldC5jc3NSdWxlcy5sZW5ndGg7IGkrKylcclxuXHRcdHtcclxuXHRcdFx0bGV0IHJ1bGUgPSBhcHBTaGVldC5jc3NSdWxlc1tpXTtcclxuXHRcdFx0aWYgKHJ1bGUpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRsZXQgc2tpcCA9IGZhbHNlO1xyXG5cdFx0XHRcdGxldCBzZWxlY3RvciA9IHJ1bGUuY3NzVGV4dC5zcGxpdChcIntcIilbMF07XHJcblxyXG5cdFx0XHRcdGZvciAobGV0IGtlZXAgb2YgdGhpcy5vYnNpZGlhblN0eWxlc0tlZXApIFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGlmICghc2VsZWN0b3IuaW5jbHVkZXMoa2VlcCkpIFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBmaWx0ZXIgb2YgdGhpcy5vYnNpZGlhblN0eWxlc0ZpbHRlcikgXHJcblx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoc2VsZWN0b3IuaW5jbHVkZXMoZmlsdGVyKSkgXHJcblx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0c2tpcCA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0c2tpcCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChza2lwKSBjb250aW51ZTtcclxuXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0bGV0IGNzc1RleHQgPSBydWxlLmNzc1RleHQgKyBcIlxcblwiO1xyXG5cdFx0XHRcdGNzc1RleHQgPSBjc3NUZXh0LnJlcGxhY2VBbGwoXCJwdWJsaWMvXCIsIFwiaHR0cHM6Ly9wdWJsaXNoLm9ic2lkaWFuLm1kL3B1YmxpYy9cIik7XHJcblx0XHRcdFx0Y3NzVGV4dCA9IGNzc1RleHQucmVwbGFjZUFsbChcImxpYi9cIiwgXCJodHRwczovL3B1Ymxpc2gub2JzaWRpYW4ubWQvbGliL1wiKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0aGlzLmFwcFN0eWxlcyArPSBjc3NUZXh0O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yKGxldCBpID0gMTsgaSA8IHN0eWxlc2hlZXRzLmxlbmd0aDsgaSsrKSBcclxuXHRcdHtcclxuXHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRsZXQgc3R5bGVJRCA9IHN0eWxlc2hlZXRzW2ldLm93bmVyTm9kZT8uaWQ7XHJcblx0XHRcdGlmICgoc3R5bGVJRC5zdGFydHNXaXRoKFwic3ZlbHRlXCIpICYmIE1haW5TZXR0aW5ncy5zZXR0aW5ncy5pbmNsdWRlU3ZlbHRlQ1NTKSB8fCBzdHlsZUlEID09IFwiQURNT05JVElPTlNfQ1VTVE9NX1NUWUxFX1NIRUVUXCIpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRSZW5kZXJMb2cubG9nKFwiSW5jbHVkaW5nIHN0eWxlc2hlZXQ6IFwiICsgc3R5bGVJRCk7XHJcblx0XHRcdFx0bGV0IHN0eWxlID0gc3R5bGVzaGVldHNbaV0uY3NzUnVsZXM7XHJcblxyXG5cdFx0XHRcdGZvcihsZXQgaXRlbSBpbiBzdHlsZSkgXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0aWYoc3R5bGVbaXRlbV0uY3NzVGV4dCAhPSB1bmRlZmluZWQpXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHR0aGlzLmFwcFN0eWxlcyArPSBcIlxcblwiICsgc3R5bGVbaXRlbV0uY3NzVGV4dDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmFwcFN0eWxlcyA9IHRoaXMuZmlsdGVyQm9keUNsYXNzZXModGhpcy5hcHBTdHlsZXMpO1xyXG5cclxuXHRcdHRoaXMuYXBwU3R5bGVzID0gYXdhaXQgdGhpcy5taW5pZnlKU29yQ1NTKHRoaXMuYXBwU3R5bGVzLCBmYWxzZSk7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN0YXRpYyBhc3luYyBnZXRQbHVnaW5TdHlsZXMoKSA6IFByb21pc2U8c3RyaW5nPlxyXG5cdHtcclxuXHRcdC8vIGxvYWQgM3JkIHBhcnR5IHBsdWdpbiBjc3NcclxuXHRcdGxldCBwbHVnaW5DU1MgPSBcIlwiO1xyXG5cdFx0bGV0IHRoaXJkUGFydHlQbHVnaW5TdHlsZU5hbWVzID0gTWFpblNldHRpbmdzLnNldHRpbmdzLmluY2x1ZGVQbHVnaW5DU1Muc3BsaXQoXCJcXG5cIik7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXJkUGFydHlQbHVnaW5TdHlsZU5hbWVzLmxlbmd0aDsgaSsrKVxyXG5cdFx0e1xyXG5cdFx0XHRpZiAoIXRoaXJkUGFydHlQbHVnaW5TdHlsZU5hbWVzW2ldIHx8ICh0aGlyZFBhcnR5UGx1Z2luU3R5bGVOYW1lc1tpXSAmJiAhKC9cXFMvLnRlc3QodGhpcmRQYXJ0eVBsdWdpblN0eWxlTmFtZXNbaV0pKSkpIGNvbnRpbnVlO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IHBhdGggPSB0aGlzLnZhdWx0UGx1Z2luc1BhdGguam9pblN0cmluZyh0aGlyZFBhcnR5UGx1Z2luU3R5bGVOYW1lc1tpXS5yZXBsYWNlKFwiXFxuXCIsIFwiXCIpLCBcInN0eWxlcy5jc3NcIik7XHJcblx0XHRcdGlmICghcGF0aC5leGlzdHMpIGNvbnRpbnVlO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IHN0eWxlID0gYXdhaXQgcGF0aC5yZWFkRmlsZVN0cmluZygpO1xyXG5cdFx0XHRpZiAoc3R5bGUpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRwbHVnaW5DU1MgKz0gc3R5bGU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRwbHVnaW5DU1MgPSB0aGlzLmZpbHRlckJvZHlDbGFzc2VzKHBsdWdpbkNTUyk7XHJcblxyXG5cdFx0cmV0dXJuIHBsdWdpbkNTUztcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgc3RhdGljIGFzeW5jIGdldFRoZW1lQ29udGVudCh0aGVtZU5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPlxyXG5cdHtcclxuXHRcdGlmICh0aGVtZU5hbWUgPT0gXCJEZWZhdWx0XCIpIHJldHVybiBcIi8qIFVzaW5nIGRlZmF1bHQgdGhlbWUuICovXCI7XHJcblx0XHQvLyBNSUdIVCBORUVEIFRPIEZPUkNFIEEgUkVMQVRJVkUgUEFUSCBIRVJFIElES0tcclxuXHRcdGxldCB0aGVtZVBhdGggPSBuZXcgUGF0aChgLm9ic2lkaWFuL3RoZW1lcy8ke3RoZW1lTmFtZX0vdGhlbWUuY3NzYCkuYWJzb2x1dGUoKTtcclxuXHRcdGlmICghdGhlbWVQYXRoLmV4aXN0cylcclxuXHRcdHtcclxuXHRcdFx0UmVuZGVyTG9nLndhcm5pbmcoXCJDYW5ub3QgZmluZCB0aGVtZSBhdCBwYXRoOiBcXG5cXG5cIiArIHRoZW1lUGF0aCk7XHJcblx0XHRcdHJldHVybiBcIlwiO1xyXG5cdFx0fVxyXG5cdFx0bGV0IHRoZW1lQ29udGVudCA9IGF3YWl0IHRoZW1lUGF0aC5yZWFkRmlsZVN0cmluZygpID8/IFwiXCI7XHJcblxyXG5cdFx0dGhlbWVDb250ZW50ID0gdGhpcy5maWx0ZXJCb2R5Q2xhc3Nlcyh0aGVtZUNvbnRlbnQpO1xyXG5cclxuXHRcdHJldHVybiB0aGVtZUNvbnRlbnQ7XHJcblx0fVxyXG5cdFxyXG5cdHByaXZhdGUgc3RhdGljIGdldEN1cnJlbnRUaGVtZU5hbWUoKTogc3RyaW5nXHJcblx0e1xyXG5cdFx0LypAdHMtaWdub3JlKi9cclxuXHRcdGxldCB0aGVtZU5hbWUgPSBhcHAudmF1bHQuY29uZmlnPy5jc3NUaGVtZTtcclxuXHRcdHJldHVybiAodGhlbWVOYW1lID8/IFwiXCIpID09IFwiXCIgPyBcIkRlZmF1bHRcIiA6IHRoZW1lTmFtZTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgc3RhdGljIGFzeW5jIGdldFNuaXBwZXRzQ1NTKHNuaXBwZXROYW1lczogc3RyaW5nW10pIDogUHJvbWlzZTxzdHJpbmc+XHJcblx0e1xyXG5cdFx0bGV0IHNuaXBwZXRzTGlzdCA9IGF3YWl0IHRoaXMuZ2V0U3R5bGVTbmlwcGV0c0NvbnRlbnQoKTtcclxuXHRcdGxldCBzbmlwcGV0cyA9IFwiXFxuXCI7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNuaXBwZXRzTGlzdC5sZW5ndGg7IGkrKylcclxuXHRcdHtcclxuXHRcdFx0c25pcHBldHMgKz0gYC8qIC0tLSAke3NuaXBwZXROYW1lc1tpXX0uY3NzIC0tLSAqLyAgXFxuICR7c25pcHBldHNMaXN0W2ldfSAgXFxuXFxuXFxuYDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBzbmlwcGV0cztcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgc3RhdGljIGdldEVuYWJsZWRTbmlwcGV0cygpOiBzdHJpbmdbXVxyXG5cdHtcclxuXHRcdC8qQHRzLWlnbm9yZSovXHJcblx0XHRyZXR1cm4gYXBwLnZhdWx0LmNvbmZpZz8uZW5hYmxlZENzc1NuaXBwZXRzID8/IFtdO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBzdGF0aWMgYXN5bmMgZ2V0U3R5bGVTbmlwcGV0c0NvbnRlbnQoKTogUHJvbWlzZTxzdHJpbmdbXT5cclxuXHR7XHJcblx0XHRsZXQgc25pcHBldENvbnRlbnRzIDogc3RyaW5nW10gPSBbXTtcclxuXHRcdGxldCBlbmFibGVkU25pcHBldHMgPSB0aGlzLmdldEVuYWJsZWRTbmlwcGV0cygpO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlbmFibGVkU25pcHBldHMubGVuZ3RoOyBpKyspXHJcblx0XHR7XHJcblx0XHRcdGxldCBwYXRoID0gbmV3IFBhdGgoYC5vYnNpZGlhbi9zbmlwcGV0cy8ke2VuYWJsZWRTbmlwcGV0c1tpXX0uY3NzYCkuYWJzb2x1dGUoKTtcclxuXHRcdFx0aWYgKHBhdGguZXhpc3RzKSBzbmlwcGV0Q29udGVudHMucHVzaChhd2FpdCBwYXRoLnJlYWRGaWxlU3RyaW5nKCkgPz8gXCJcXG5cIik7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gc25pcHBldENvbnRlbnRzO1xyXG5cdH1cclxuXHJcbn1cclxuIl19