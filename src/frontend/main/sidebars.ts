export class Sidebar
{
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
	private _resizing;
	get resizing(): boolean { return this._resizing; }
	private _collapsed: boolean;
	get collapsed(): boolean { return this._collapsed; }
	set collapsed(collapse: boolean)
	{
		this._collapsed = collapse;	

		if (!collapse && document.body.classList.contains("floating-sidebars"))
		{
			document.body.addEventListener("click", this.clickOutsideCollapse);
		}
		if (collapse) document.body.removeEventListener("click", this.clickOutsideCollapse);

		this.containerEl.classList.toggle("is-collapsed", collapse);
	}

	constructor(container: HTMLElement)
	{
		if (!container.classList.contains("sidebar")) throw new Error("Invalid sidebar container");
		this.containerEl = container;
		this.contentEl = container.querySelector(".leaf-content") as HTMLElement;
		this.topbarEl = container.querySelector(".sidebar-topbar") as HTMLElement;
		this.collapseEl = container.querySelector(".sidebar-collapse-icon") as HTMLElement;
		this.topbarContentEl = container.querySelector(".topbar-content") as HTMLElement;
		this.resizeHandleEl = container.querySelector(".sidebar-handle");
		this._isLeft = container.classList.contains("sidebar-left");
		this._sidebarID = container.classList.contains("sidebar-left") ? "sidebar-left" : "sidebar-right";

		this.collapseEl.addEventListener("click", () =>
		{
			this.collapsed = !this.collapsed;
		});

		this.setupSidebarResize();
	}

	private setupSidebarResize()
	{
		if (!this.resizeHandleEl) return;

		let minWidthEm = 15;
		let minResizeWidth = parseFloat(getComputedStyle(this.resizeHandleEl.parentElement).fontSize) * minWidthEm;
		let collapseWidth = minResizeWidth / 4.0;

		let savedWidth = localStorage.getItem(`${this.sidebarID}-width`);
		if (savedWidth) this.containerEl.style.setProperty('--sidebar-width', savedWidth);

		let localThis = this;
		function resizeMove(e)
		{
			if (!localThis.resizing) return;
			var distance = localThis.isLeft ? e.clientX : window.innerWidth - e.clientX;
			var newWidth = `min(max(${distance}px, ${minWidthEm}em), 40vw)`;

			if (distance < collapseWidth)
			{
				localThis.collapsed = true;
				localThis.containerEl.style.removeProperty('transition-duration');
			} 
			else 
			{
				localThis.collapsed = false;
				localThis.containerEl.style.setProperty('--sidebar-width', newWidth);
				if (distance > minResizeWidth) localThis.containerEl.style.transitionDuration = "0s";
			}
		}

		function handleClick(e) 
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
		function resetSidebarEvent(e)
		{
			localThis.containerEl.style.removeProperty('transition-duration');
			localThis.containerEl.style.removeProperty('--sidebar-width');
			localStorage.removeItem(`${localThis.sidebarID}-width`);
		}

		this.resizeHandleEl.addEventListener('dblclick', resetSidebarEvent);
	}

	private clickOutsideCollapse(event)
	{
		// don't allow bubbling into sidebar
		if (event.target.closest(".sidebar")) return;
		this.collapsed = true;
	}
}
