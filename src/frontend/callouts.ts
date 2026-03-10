import { slideDown, slideUp } from "./utils";

export enum CalloutType {
	StartOpen,
	StartClosed,
	Static,
}

export class Callout {
	public calloutEl: HTMLElement;
	public titleEl: HTMLElement;
	public contentEl: HTMLElement;
	public iconEl: HTMLElement;
	public foldIconEl: HTMLElement;
	public foldType: CalloutType;
	public type: string;
	public metadata: string;

	get title(): string { return this.titleEl?.textContent ?? ""; }
	set title(t: string) { this.titleEl.textContent = t; }

	private _collapsed: boolean = false;
	get collapsed(): boolean { return this._collapsed; }
	set collapsed(v: boolean) { this.toggle(v); }

	constructor(calloutEl: HTMLElement, initEvents: boolean = true) {
		this.calloutEl = calloutEl;
		this.titleEl = calloutEl.querySelector(".callout-title-inner") as HTMLElement;
		this.contentEl = calloutEl.querySelector(".callout-content") as HTMLElement;
		this.iconEl = calloutEl.querySelector(".callout-icon") as HTMLElement;
		this.foldIconEl = calloutEl.querySelector(".callout-fold") as HTMLElement;

		const fold = calloutEl.getAttribute("data-callout-fold");
		switch (fold) {
			case "+": this.foldType = CalloutType.StartOpen; this._collapsed = false; break;
			case "-": this.foldType = CalloutType.StartClosed; this._collapsed = true; break;
			default: this.foldType = CalloutType.Static; this._collapsed = false; break;
		}

		this.type = calloutEl.getAttribute("data-callout") ?? "";
		this.metadata = calloutEl.getAttribute("data-callout-metadata") ?? "";

		if (initEvents) this.init();
	}

	toggle(force?: boolean) {
		if (this.foldType === CalloutType.Static) return;
		if (force === undefined) force = !this._collapsed;
		this.calloutEl?.classList.toggle("is-collapsed", force);
		this.foldIconEl?.classList.toggle("is-collapsed", force);
		if (force) slideUp(this.contentEl, 150);
		else slideDown(this.contentEl, 150);
		this._collapsed = force;
	}

	collapse() { this.toggle(true); }
	expand() { this.toggle(false); }

	init() {
		if (this.foldIconEl) {
			this.foldIconEl.addEventListener("click", () => this.toggle());
		}
	}
}
