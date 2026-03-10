import { layout } from "./layout";
import { documentExists } from "./site-data";

/** Navigate to a URL. Set by website.ts at init time. */
export let navigate: (url: string) => void = () => {};

/** The current document's pathname. Set by website.ts on navigation. */
export let currentPathname: string = "";

export function setNavigate(fn: (url: string) => void) { navigate = fn; }
export function setCurrentPathname(path: string) { currentPathname = path; }

export function initializeLinks(onElement: HTMLElement) {
	onElement?.querySelectorAll(".internal-link, a.tag, a.tree-item-self, a.footnote-link").forEach((link: Element) => {
		const target = link.getAttribute("href") ?? "null";
		if (target === "null") return;

		link.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			navigate(target);

			// Close sidebar on phone
			if (layout.deviceSize === "phone") {
				const leftSidebar = (link as HTMLElement).closest("#left-sidebar");
				const rightSidebar = (link as HTMLElement).closest("#right-sidebar");
				if (leftSidebar && layout.leftSidebar?.collapsed === false) {
					layout.leftSidebar.collapsed = true;
				} else if (rightSidebar && layout.rightSidebar?.collapsed === false) {
					layout.rightSidebar.collapsed = true;
				}
			}
		});

		// Mark unresolved links
		const pathname = getPathnameFromURL(target);
		if (target && !target.startsWith("http") && !documentExists(pathname)) {
			link.classList.add("is-unresolved");
		}
	});
}

export function getPathnameFromURL(url: string): string {
	if (url?.startsWith("#") || url?.startsWith("?")) {
		return (currentPathname?.split("#")[0]?.split("?")[0] ?? "") + (url ?? "");
	}
	const pathname = url?.split("?")[0]?.split("#")[0]?.trim() ?? "";
	if (pathname === "" || pathname === "/" || pathname === "\\") return "/index.html";
	return pathname;
}

export function getHashFromURL(url: string): string {
	return (url.split("#")[1] ?? "").split("?")[0]?.trim() ?? "";
}

export function getQueryFromURL(url: string): string {
	return url.split("?")[1]?.trim() ?? "";
}
