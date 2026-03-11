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

	get floating(): boolean {
		return this.containerEl.classList.contains("floating")
			|| document.body.classList.contains("floating-sidebars");
	}
	set floating(v: boolean) {
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
		this.setupSwipeToDismiss();
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

	private setupSwipeToDismiss() {
		let startX = 0;
		let sidebarWidth = 0;
		let swiping = false;
		let rejected = false;
		let moveCount = 0;
		let startY = 0;
		let lastX = 0;
		let lastTime = 0;
		let maxVelocity = 0;
		let prevX = 0;
		let prevTime = 0;

		const velocityThreshold = 0.4; // px/ms — minimum peak velocity to count as a swipe
		const detectionWindow = 3; // number of move events to check for velocity

		this.containerEl.addEventListener("touchstart", (e) => {
			if (!this.floating || this._collapsed) return;
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
			lastX = startX;
			lastTime = e.timeStamp;
			sidebarWidth = this.containerEl.offsetWidth;
			swiping = false;
			rejected = false;
			moveCount = 0;
			maxVelocity = 0;
		}, { passive: true });

		this.containerEl.addEventListener("touchmove", (e) => {
			if (!this.floating || this._collapsed || sidebarWidth === 0 || rejected) return;

			const currentX = e.touches[0].clientX;
			const now = e.timeStamp;
			const dt = now - lastTime;

			// Track velocity during the detection window before allowing any movement
			if (moveCount < detectionWindow && !swiping) {
				moveCount++;
				if (dt > 0) {
					const instantVelocity = Math.abs(currentX - lastX) / dt;
					if (instantVelocity >= velocityThreshold) {
						// Accept early — velocity is high enough
						const totalDx = Math.abs(currentX - startX);
						const totalDy = Math.abs(e.touches[0].clientY - startY);
						if (totalDy > totalDx) {
							rejected = true;
							return;
						}
						// Fall through to apply movement
					} else if (moveCount === detectionWindow) {
						// End of window without hitting threshold
						rejected = true;
						return;
					} else {
						lastX = currentX;
						lastTime = now;
						return;
					}
				} else {
					lastX = currentX;
					lastTime = now;
					return;
				}
			}

			// Calculate from original touch point so detection window distance is included
			const dx = currentX - startX;
			// Left sidebar: swipe left (negative dx). Right sidebar: swipe right (positive dx).
			const dismiss = this._isLeft ? -dx : dx;
			if (dismiss <= 0) {
				// Wrong direction or no movement — reset to full width
				if (swiping) {
					this.containerEl.style.removeProperty("min-width");
					this.containerEl.style.removeProperty("max-width");
					this.containerEl.style.removeProperty("transition-duration");
					swiping = false;
				}
				return;
			}

			if (!swiping) {
				swiping = true;
				this.containerEl.style.transitionDuration = "0s";
			}

			// Track recent velocity for release detection
			prevX = lastX;
			prevTime = lastTime;
			lastX = currentX;
			lastTime = now;

			const clampedWidth = Math.max(0, sidebarWidth - dismiss) + "px";
			this.containerEl.style.minWidth = clampedWidth;
			this.containerEl.style.maxWidth = clampedWidth;
		}, { passive: true });

		const endSwipe = () => {
			if (!swiping) return;
			swiping = false;

			const currentWidth = this.containerEl.offsetWidth;
			const frameDt = lastTime - prevTime;
			const releaseVelocity = frameDt > 0 ? Math.abs(lastX - prevX) / frameDt : 0;

			// Project where the sidebar would end up given current velocity
			const projectedWidth = currentWidth - releaseVelocity * 60;

			this.containerEl.style.removeProperty("min-width");
			this.containerEl.style.removeProperty("max-width");
			this.containerEl.style.removeProperty("transition-duration");

			if (projectedWidth < sidebarWidth * 0.5) {
				this.collapsed = true;
			}
		};

		this.containerEl.addEventListener("touchend", endSwipe);
		this.containerEl.addEventListener("touchcancel", endSwipe);
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
