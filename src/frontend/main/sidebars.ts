export class Sidebar
{
	readonly minWidthEm = 15;
	readonly minResizeWidth;
	readonly collapseWidth;

	public containerEl: HTMLElement;
	public contentEl: HTMLElement;
	public topbarEl: HTMLElement;
	public collapseEl: HTMLElement;
	public topbarContentEl: HTMLElement;
	public resizeHandleEl: HTMLElement | undefined;
	
	private _sidebarID: string;
	get sidebarID(): string { return this._sidebarID; }
	private _isLeft: boolean;
	get isLeft(): boolean { return this._isLeft; }
	private _resizing: boolean;
	get resizing(): boolean { return this._resizing; }
	private _collapsed: boolean;
	get collapsed(): boolean { return this._collapsed; }
	set collapsed(collapse: boolean)
	{
		this._collapsed = collapse;	

		if (!collapse && this.floating)
		{
			document.body.addEventListener("click", this.clickOutsideCollapse);
		}
		if (collapse) document.body.removeEventListener("click", this.clickOutsideCollapse);

		this.containerEl.classList.toggle("is-collapsed", collapse);
	}
	private _floating: boolean;
	get floating(): boolean { return this._floating; }
	set floating(floating: boolean)
	{
		this._floating = floating;
		this.containerEl.classList.toggle("floating", floating);
	}

	get width(): number
	{
		return this.containerEl.offsetWidth;
	}
	set width(width: number)
	{
		const newWidth = `min(max(${width}px, ${this.minWidthEm}em), 40vw)`;

		if (width < this.collapseWidth)
		{
			this.collapsed = true;
			this.containerEl.style.removeProperty('transition-duration');
		} 
		else 
		{
			this.collapsed = false;
			this.containerEl.style.setProperty('--sidebar-width', newWidth);
			if (width > this.minResizeWidth) this.containerEl.style.transitionDuration = "0s";
		}

		if(ObsidianSite.graphView) ObsidianSite.graphView.graphRenderer.autoResizeCanvas();
	}

	constructor(container: HTMLElement)
	{
		if (!container.classList.contains("sidebar")) throw new Error("Invalid sidebar container");
		this.containerEl = container;
		this.contentEl = container.querySelector(".leaf-content") as HTMLElement;
		this.topbarEl = container.querySelector(".sidebar-topbar") as HTMLElement;
		this.collapseEl = container.querySelector(".sidebar-collapse-icon") as HTMLElement;
		this.topbarContentEl = container.querySelector(".topbar-content") as HTMLElement;
		this.resizeHandleEl = container.querySelector(".sidebar-handle") as HTMLElement ?? undefined;
		this._isLeft = container.id == "left-sidebar";
		this._sidebarID = container.id;

		this.collapseEl.addEventListener("click", () =>
		{
			this.collapsed = !this.collapsed;
		});

		this.minResizeWidth = parseFloat(getComputedStyle(this.resizeHandleEl.parentElement ?? this.resizeHandleEl).fontSize) * this.minWidthEm;
		this.collapseWidth = this.minResizeWidth / 4.0;

		this.setupSidebarResize();
	}

	private setupSidebarResize()
	{
		if (!this.resizeHandleEl) return;

		const savedWidth = localStorage.getItem(`${this.sidebarID}-width`);
		if (savedWidth) this.containerEl.style.setProperty('--sidebar-width', savedWidth);

		const localThis = this;
		function resizeMove(e: PointerEvent)
		{
			if (!localThis.resizing) return;
			const distance = localThis.isLeft ? e.clientX : window.innerWidth - e.clientX;
			localThis.width = distance;
		}

		function handleClick(e: PointerEvent) 
		{
			localThis._resizing = true;
			localThis.containerEl.classList.add('is-resizing');
			document.addEventListener('pointermove', resizeMove);
			document.addEventListener('pointerup', function () 
			{
				document.removeEventListener('pointermove', resizeMove);
				const finalWidth = getComputedStyle(localThis.containerEl).getPropertyValue('--sidebar-width');
				localStorage.setItem(`${localThis.sidebarID}-width`, finalWidth);
				localThis.containerEl.classList.remove('is-resizing');
				localThis.containerEl.style.removeProperty('transition-duration');
			});
		}

		this.resizeHandleEl.addEventListener('pointerdown', handleClick);

		// reset sidebar width on double click
		function resetSidebarEvent(e: MouseEvent)
		{
			localThis.resetWidth();
		}

		this.resizeHandleEl.addEventListener('dblclick', resetSidebarEvent);
	}

	public resetWidth()
	{
		this.containerEl.style.removeProperty('transition-duration');
		this.containerEl.style.removeProperty('--sidebar-width');
		localStorage.removeItem(`${this.sidebarID}-width`);

		setTimeout(() =>
		{
			console.log("Resizing canvas");
			if(ObsidianSite.graphView) 
			{
				ObsidianSite.graphView.graphRenderer.autoResizeCanvas();
				ObsidianSite.graphView.graphRenderer.centerCamera();
			}
		}, 500);
	}

	private clickOutsideCollapse(event: MouseEvent)
	{
		// don't allow bubbling into sidebar
		if ((event.target as HTMLElement)?.closest(".sidebar")) return;
		this.collapsed = true;
	}
}
