import { layout } from "./layout";

export class Sidebar {
	readonly minWidthEm = 15;
	readonly minResizeWidth: number;
	readonly collapseWidth: number;

	public containerEl: HTMLElement;
	public innerEl: HTMLElement;
	public contentEl: HTMLElement;
	public topbarEl: HTMLElement;
	public collapseEl: HTMLElement;
	public topbarContentEl: HTMLElement;
	public resizeHandleEl: HTMLElement | undefined;

	private _sidebarID: string;
	get sidebarID(): string { return this._sidebarID; }
	private _isLeft: boolean;
	get isLeft(): boolean { return this._isLeft; }
	private _resizing: boolean = false;
	get resizing(): boolean { return this._resizing; }

	private _collapsed: boolean = false;
	get collapsed(): boolean { return this._collapsed; }
	set collapsed(collapse: boolean) {
		if (this._collapsed === collapse) return;
		this._collapsed = collapse;

		const isPhone = layout.deviceSize === "phone";
		const isTablet = layout.deviceSize === "tablet";

		if (!collapse) {
			// Close the other sidebar on phone
			if (isPhone) {
				const other = this.isLeft ? layout.rightSidebar : layout.leftSidebar;
				if (other && !other.collapsed) other.collapsed = true;
			}
			// Click-outside-to-close on phone/tablet
			if (isPhone || isTablet) {
				document.body.removeEventListener("click", this.clickOutsideCollapse);
				document.body.addEventListener("click", this.clickOutsideCollapse);
			}
		} else {
			document.body.removeEventListener("click", this.clickOutsideCollapse);
		}

		this.containerEl.classList.toggle("is-collapsed", collapse);
	}

	private _floating: boolean = false;
	get floating(): boolean { return this._floating; }
	set floating(v: boolean) {
		this._floating = v;
		this.containerEl.classList.toggle("floating", v);
	}

	get width(): number { return this.containerEl.offsetWidth; }
	set width(width: number) {
		const newWidth = `min(max(${width}px, ${this.minWidthEm}em), 40vw)`;
		if (width < this.collapseWidth) {
			this.collapsed = true;
			this.containerEl.style.removeProperty("transition-duration");
		} else {
			this.collapsed = false;
			this.containerEl.style.setProperty("--sidebar-width", newWidth);
			if (width > this.minResizeWidth) this.containerEl.style.transitionDuration = "0s";
		}
	}

	constructor(container: HTMLElement) {
		if (!container.classList.contains("sidebar")) throw new Error("Invalid sidebar container");
		this.containerEl = container;
		this.innerEl = container.querySelector(".sidebar-inner") as HTMLElement;
		this.contentEl = container.querySelector(".leaf-content") as HTMLElement;
		this.topbarEl = container.querySelector(".sidebar-topbar") as HTMLElement;
		this.collapseEl = container.querySelector(".sidebar-collapse-icon") as HTMLElement;
		this.topbarContentEl = container.querySelector(".topbar-content") as HTMLElement;
		this.resizeHandleEl = container.querySelector(".sidebar-handle") as HTMLElement ?? undefined;
		this._isLeft = container.id === "left-sidebar";
		this._sidebarID = container.id;

		this.collapseEl.addEventListener("click", () => { this.collapsed = !this.collapsed; });
		this.clickOutsideCollapse = this.clickOutsideCollapse.bind(this);

		this.minResizeWidth = parseFloat(
			getComputedStyle(this.resizeHandleEl?.parentElement ?? this.containerEl).fontSize
		) * this.minWidthEm;
		this.collapseWidth = this.minResizeWidth / 4.0;

		this.setupSidebarResize();
	}

	private setupSidebarResize() {
		if (!this.resizeHandleEl) return;

		const savedWidth = localStorage.getItem(`${this.sidebarID}-width`);
		if (savedWidth) this.containerEl.style.setProperty("--sidebar-width", savedWidth);

		const self = this;
		function resizeMove(e: PointerEvent) {
			if (!self._resizing) return;
			const distance = self.isLeft ? e.clientX : window.innerWidth - e.clientX;
			self.width = distance;
		}

		this.resizeHandleEl.addEventListener("pointerdown", () => {
			self._resizing = true;
			self.containerEl.classList.add("is-resizing");
			document.addEventListener("pointermove", resizeMove);
			document.addEventListener("pointerup", function onUp() {
				document.removeEventListener("pointermove", resizeMove);
				document.removeEventListener("pointerup", onUp);
				const finalWidth = getComputedStyle(self.containerEl).getPropertyValue("--sidebar-width");
				localStorage.setItem(`${self.sidebarID}-width`, finalWidth);
				self.containerEl.classList.remove("is-resizing");
				self.containerEl.style.removeProperty("transition-duration");
				self._resizing = false;
			});
		});

		this.resizeHandleEl.addEventListener("dblclick", () => self.resetWidth());
	}

	resetWidth() {
		this.containerEl.style.removeProperty("transition-duration");
		this.containerEl.style.removeProperty("--sidebar-width");
		localStorage.removeItem(`${this.sidebarID}-width`);
	}

	private clickOutsideCollapse(event: MouseEvent) {
		if ((event.target as HTMLElement)?.closest(`#${this.containerEl.id}`)) return;
		const isPhone = layout.deviceSize === "phone";
		const isTablet = layout.deviceSize === "tablet";
		if (isPhone || isTablet) this.collapsed = true;
	}
}
