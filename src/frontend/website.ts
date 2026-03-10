import { createFileTree, Tree } from "@shared/components/tree";
import { WebpageDocument } from "./document";
import { Sidebar } from "./sidebar";
import { Theme } from "./theme";
import { initializeLinks, getHashFromURL, getPathnameFromURL, currentPathname, setNavigate, setCurrentPathname } from "./links";
import { Notice } from "./notice";
import { layout, createLoadingEl, showLoading, onResize } from "./layout";
import { metadata, loadSiteData, getFileData, documentExists } from "./site-data";
import { Bounds } from "./utils";
import { Path } from "@shared/path";

// Import panels — they self-register on import
import "./panels/backlinks";
import "./panels/tags";
import "./panels/aliases";
import "./panels/outline";

export class ObsidianWebsite {
	public bodyEl: HTMLElement;
	public horizontalLayout: HTMLElement;

	public isLoaded: boolean = false;
	public isHttp: boolean = window.location.protocol !== "file:";
	public theme: Theme;
	public fileTree: Tree | undefined;
	public document: WebpageDocument;
	public entryPage: string;
	public vaultRoot: Path;

	// Facade for window.ObsidianSite consumers
	get metadata() { return metadata; }
	get leftSidebar() { return layout.leftSidebar; }
	get rightSidebar() { return layout.rightSidebar; }
	get centerContentEl() { return layout.centerContentEl!; }
	get deviceSize() { return layout.deviceSize; }
	get documentBounds() { return Bounds.fromElement(layout.centerContentEl!); }
	getFileData(url: string) { return getFileData(url); }
	documentExists(url: string) { return documentExists(url); }
	showLoading(loading: boolean, inside?: HTMLElement) { return showLoading(loading, inside); }

	private onloadCallbacks: ((document: WebpageDocument) => void)[] = [];

	onDocumentLoad(callback: (document: WebpageDocument) => void) {
		this.onloadCallbacks.push(callback);
	}

	async init() {
		// Wire up the navigate function so links.ts can trigger navigation
		setNavigate((url) => this.loadURL(url));

		window.addEventListener("load", () => this.onInit());

		if (this.isHttp) {
			const ok = await loadSiteData(true);
			if (!ok) {
				console.error("Failed to load website data.");
				return;
			}
		}
	}

	private async onInit() {
		this.bodyEl = document.body;

		// Kill all transitions during init so nothing animates into place
		const noTransitions = document.createElement("style");
		noTransitions.textContent = "* { transition-duration: 0s !important; }";
		document.head.appendChild(noTransitions);

		// Build layout immediately so the user sees the page structure
		if (!document.querySelector("#main-horizontal")) {
			this.buildLayout();
		}

		this.theme = new Theme();
		this.horizontalLayout = document.querySelector("#main-horizontal") as HTMLElement;
		layout.centerContentEl = document.querySelector("#center-content") as HTMLElement;
		layout.documentContainerEl = document.querySelector("#document-container") as HTMLElement;

		createLoadingEl();

		// Initialize sidebars
		const leftSidebarEl = document.querySelector(".sidebar#left-sidebar") as HTMLElement;
		const rightSidebarEl = document.querySelector(".sidebar#right-sidebar") as HTMLElement;
		if (leftSidebarEl) layout.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) layout.rightSidebar = new Sidebar(rightSidebarEl);

		// Apply responsive layout before anything else so sidebars
		// start collapsed on mobile before the page becomes visible.
		onResize();

		// Show loading while we wait for site data
		await showLoading(true);

		if (!this.isHttp) {
			const ok = await loadSiteData(false);
			if (!ok) {
				console.error("Failed to load website data.");
			}
		}

		// HTTP path: loadSiteData started in init() may not have resolved yet
		while (!metadata) await new Promise(r => setTimeout(r, 16));

		if (metadata.bodyClasses) {
			this.bodyEl.className += " " + metadata.bodyClasses;
		}

		// Build file tree from data
		const files = Object.keys(metadata.files).filter(f => {
			const data = metadata.files[f];
			return data && data.content?.html;
		});
		if (files.length > 0) {
			const fileTreeContainer = document.querySelector("#file-explorer") as HTMLElement
				?? document.querySelector("#left-sidebar-content") as HTMLElement;
			if (fileTreeContainer) {
				const fileMetadata: Record<string, { icon?: string; title?: string }> = {};
				for (const f of files) {
					const data = metadata.files[f];
					if (data && (data.icon || data.title)) {
						fileMetadata[f] = { icon: data.icon, title: data.title };
					}
				}

				const folderMetadata: Record<string, { icon?: string; title?: string }> = {};
				if (metadata.folders) {
					for (const [path, data] of Object.entries(metadata.folders)) {
						folderMetadata[path] = { icon: data.icon, title: data.title };
					}
				}

				this.fileTree = createFileTree(files, {
					id: "file-explorer",
					title: metadata.export.vault,
					startCollapsed: true,
					showCollapseAll: true,
					fileMetadata,
					folderMetadata,
				});
				this.fileTree.mount(fileTreeContainer);
				initializeLinks(this.fileTree.el);
			}
		}

		const pathToRoot = document.querySelector("meta[name='path-to-root']")?.getAttribute("content") ?? "./";
		// follow the path to root to get the vault base, then use that to determine the absolute file pathname
		const currentPage = new Path(window.location.pathname);
		this.vaultRoot = currentPage.directory.joinString(pathToRoot).normalized();
		let pathname = Path.getRelativePath(this.vaultRoot, currentPage).path;
		// If we're at the vault root, the relative path will be "." or empty
		if (pathname === "" || pathname === ".") pathname = "/index.html";

		this.entryPage = pathname;

		// Re-enable transitions now that layout is settled
		noTransitions.remove();

		this.document = new WebpageDocument(pathname);
		if (this.document.exists) {
			await this.document.load(null, layout.documentContainerEl!);
			setCurrentPathname(this.document.pathname);
		} else {
			await showLoading(false);
		}

		this.initEvents();

		// Set initial history state
		if (this.isHttp) {
			const fullUrl = this.resolveFullUrl(this.document.pathname);
			history.replaceState({ pathname: this.document.pathname }, this.document.title, fullUrl);
		}

		this.isLoaded = true;
		this.onloadCallbacks.forEach(cb => cb(this.document));
	}

	private initEvents() {
		window.addEventListener("popstate", async (e) => {
			if (!e.state) return;
			await this.loadURL(e.state.pathname, false);
		});

		window.addEventListener("resize", () => onResize());
		onResize();
	}

	updateMetaTag(name: string, content: string) {
		let meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
		if (!meta) {
			meta = document.createElement("meta");
			if (name.startsWith("og:")) meta.setAttribute("property", name);
			else meta.setAttribute("name", name);
			document.head.appendChild(meta);
		}
		meta.setAttribute("content", content);
	}

	/**
	 * Resolve a link URL to an absolute web path (always starts with /).
	 * Absolute links are passed through as-is.
	 * Relative links are resolved against the current document's directory.
	 */
	resolvePathname(url: string): string {
		const raw = getPathnameFromURL(url);
		if (!raw) return raw;

		// Already absolute — use directly
		if (raw.startsWith("/")) return raw;

		// Relative: resolve against current document's directory
		const currentDir = new Path(currentPathname).directory;
		const resolved = currentDir.joinString(raw).normalized();
		const result = resolved.path;
		return result.startsWith("/") ? result : "/" + result;
	}

	/**
	 * Compute the full browser URL for a vault-relative pathname.
	 */
	resolveFullUrl(pathname: string): string {
		if (!pathname || pathname === "/index.html") return this.vaultRoot.path;
		return this.vaultRoot.joinString(pathname).path;
	}

	async loadURL(url: string, pushState: boolean = true): Promise<WebpageDocument | undefined> {
		const header = getHashFromURL(url);
		const pathname = this.resolvePathname(url);

		// If this document is already loaded, just scroll to header
		if (this.document?.pathname === pathname) {
			if (header) this.document.scrollToHeader(header);
			else new Notice("This page is already loaded.");
			return this.document;
		}

		const data = getFileData(pathname);
		if (!data) {
			new Notice("This page does not exist yet.");
			console.warn("Page does not exist", pathname);
			return undefined;
		}

		const page = await new WebpageDocument(pathname).load(null, layout.documentContainerEl!);
		if (!page) {
			new Notice("Failed to load page. Unknown error.");
			return;
		}

		setCurrentPathname(page.pathname);

		// Update meta tags
		document.title = page.title;
		this.updateMetaTag("pathname", page.pathname);
		this.updateMetaTag("description", page.info?.description || "");
		this.updateMetaTag("author", page.info?.author || "");
		this.updateMetaTag("og:title", page.title);
		this.updateMetaTag("og:description", page.info?.description || "");
		this.updateMetaTag("og:url", window.location.href);

		// Update file tree active item
		this.fileTree?.findByPath(page.pathname)?.setActive();
		this.fileTree?.revealPath(page.pathname);
		this.document = page;

		if (this.document && this.isHttp && pushState) {
			const fullUrl = this.resolveFullUrl(page.pathname);
			history.pushState({ pathname: page.pathname }, this.document.title, fullUrl);
		}

		setTimeout(() => {
			this.onloadCallbacks.forEach(cb => cb(page));
			if (header) page.scrollToHeader(header);
		}, 100);

		return page;
	}

	private buildLayout() {
		const SIDEBAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon sidebar-toggle-button-icon"><rect x="1" y="2" width="22" height="20" rx="4"></rect><rect x="4" y="5" width="2" height="14" rx="2" fill="currentColor" class="sidebar-toggle-icon-inner"></rect></svg>`;

		const buildSidebar = (side: "left" | "right", topbarInner: string): HTMLElement => {
			const sidebarVar = side === "left" ? "--sidebar-width-left" : "--sidebar-width-right";
			const wrapper = document.createElement("div");
			wrapper.id = `${side}-content`;
			wrapper.className = "leaf";
			wrapper.style.setProperty("--sidebar-width", `var(${sidebarVar})`);
			wrapper.innerHTML = `
				<div id="${side}-sidebar" class="sidebar">
					<div class="clickable-icon sidebar-collapse-icon">${SIDEBAR_SVG}</div>
					<div class="sidebar-inner">
						<div class="sidebar-topbar">
							<div class="topbar-content">${topbarInner}</div>
						</div>
						<div class="sidebar-content-wrapper">
							<div id="${side}-sidebar-content" class="leaf-content"></div>
						</div>
					</div>
					<div class="sidebar-handle"></div>
				</div>`;
			return wrapper;
		};

		const searchHTML = `<div id="search-container"><div id="search-wrapper"><input enterkeyhint="search" type="search" spellcheck="false" placeholder="Search..."><div aria-label="Clear search" id="search-clear-button"></div></div></div>`;
		const themeHTML = `<label class="theme-toggle-container" for="theme-toggle-input"><input class="theme-toggle-input" type="checkbox" id="theme-toggle-input"><div class="toggle-background"></div></label>`;

		const left = buildSidebar("left", searchHTML);
		const center = document.createElement("div");
		center.id = "center-content";
		center.className = "leaf";
		const docContainer = document.createElement("div");
		docContainer.id = "document-container";
		center.appendChild(docContainer);
		const right = buildSidebar("right", themeHTML);

		const horizontal = document.createElement("div");
		horizontal.id = "main-horizontal";
		horizontal.appendChild(left);
		horizontal.appendChild(center);
		horizontal.appendChild(right);

		const main = document.createElement("div");
		main.id = "main";
		main.className = "mod-windows";
		main.appendChild(horizontal);

		document.body.appendChild(main);
	}
}
