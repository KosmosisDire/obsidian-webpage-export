import type { Sidebar } from "./sidebar";

export type DeviceSize = "large-screen" | "small-screen" | "tablet" | "phone";

export const layout = {
	deviceSize: "large-screen" as DeviceSize,
	leftSidebar: undefined as Sidebar | undefined,
	rightSidebar: undefined as Sidebar | undefined,
	centerContentEl: undefined as HTMLElement | undefined,
	documentContainerEl: undefined as HTMLElement | undefined,
};

// ─── Loading spinner ─────────────────────────────────────────────────────────

let loadingEl: HTMLElement | undefined;

export function createLoadingEl() {
	loadingEl = document.createElement("div");
	loadingEl.classList.add("loading-icon");
	loadingEl.innerHTML = `<div></div><div></div><div></div><div></div>`;
}

export async function showLoading(loading: boolean, inside?: HTMLElement) {
	inside = inside ?? layout.documentContainerEl ?? layout.centerContentEl;
	if (!inside || !loadingEl) return;
	inside.style.transitionDuration = "";
	inside.classList.toggle("hide", loading);
	loadingEl.classList.toggle("show", loading);

	// Place spinner in the parent of the hidden element so it stays visible
	const spinnerParent = inside.parentElement ?? inside;
	if (loading && loadingEl.parentElement !== spinnerParent) {
		spinnerParent.appendChild(loadingEl);
	}

	await new Promise(resolve => setTimeout(resolve, 200));
}

// ─── Responsive resize ──────────────────────────────────────────────────────

interface Breakpoint {
	maxWidth: number;
	name: DeviceSize;
	floating: boolean;
	onEnter: () => void;
}

const BREAKPOINTS: Breakpoint[] = [
	{
		maxWidth: 480, name: "phone", floating: true,
		onEnter: () => {
			if (layout.leftSidebar) layout.leftSidebar.collapsed = true;
			if (layout.rightSidebar) layout.rightSidebar.collapsed = true;
		},
	},
	{
		maxWidth: 768, name: "tablet", floating: true,
		onEnter: () => {
			if (layout.leftSidebar && layout.rightSidebar && !layout.leftSidebar.collapsed) {
				layout.rightSidebar.collapsed = true;
			}
		},
	},
	{
		maxWidth: 1024, name: "small-screen", floating: false,
		onEnter: () => {
			if (layout.leftSidebar && layout.rightSidebar && !layout.leftSidebar.collapsed) {
				layout.rightSidebar.collapsed = true;
			}
		},
	},
	{
		maxWidth: Infinity, name: "large-screen", floating: false,
		onEnter: () => {
			if (layout.leftSidebar) layout.leftSidebar.collapsed = false;
			if (layout.rightSidebar) layout.rightSidebar.collapsed = false;
		},
	},
];

let lastScreenWidth: number | undefined;
let isResizing = false;
let checkStillResizingTimeout: ReturnType<typeof setTimeout> | undefined;

export function onResize() {
	if (!isResizing) {
		document.body.classList.toggle("resizing", true);
		isResizing = true;
	}

	const w = window.innerWidth;

	// Find current breakpoint
	const bp = BREAKPOINTS.find(b => w <= b.maxWidth)!;

	// Check if we've changed breakpoints
	const lastBp = lastScreenWidth !== undefined
		? BREAKPOINTS.find(b => lastScreenWidth! <= b.maxWidth)!
		: undefined;

	if (!lastBp || bp.name !== lastBp.name) {
		layout.deviceSize = bp.name;

		document.body.classList.toggle("floating-sidebars", bp.floating);
		for (const b of BREAKPOINTS) {
			document.body.classList.toggle(`is-${b.name}`, b.name === bp.name);
		}

		bp.onEnter();
	}

	lastScreenWidth = w;

	if (checkStillResizingTimeout) clearTimeout(checkStillResizingTimeout);
	const snapshot = w;
	checkStillResizingTimeout = setTimeout(() => {
		if (window.innerWidth === snapshot) {
			checkStillResizingTimeout = undefined;
			isResizing = false;
			document.body.classList.toggle("resizing", false);
		}
	}, 200);
}
