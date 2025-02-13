import { WebpageDocument } from "./document";

export class FilePreviewPopover 
{
	private static baseZIndex: number = 100;
	private static maxZIndex: number = 1000;
	public static pinnedPreviews: FilePreviewPopover[] = [];
	public static savePinnedPreviews()
	{
		const previewDatas = FilePreviewPopover.pinnedPreviews.map(preview => {
			return {
				target: preview.target,
				top: preview.filePreviewPopover.style.top,
				left: preview.filePreviewPopover.style.left,
				width: preview.filePreviewPopover.style.width,
				height: preview.filePreviewPopover.style.height,
				zIndex: preview.filePreviewPopover.style.zIndex,
			};
		});

		localStorage.setItem("pinnedPreviews", JSON.stringify(previewDatas));
	}

	public static loadPinnedPreviews()
	{
		const previewDatas = JSON.parse(localStorage.getItem("pinnedPreviews") ?? "[]");
		previewDatas.forEach(async (previewData: any) => 
		{
			const preview = new FilePreviewPopover(null, previewData.target, () => {});
			preview.setPinned(true);
			preview.filePreviewPopover.style.top = previewData.top;
			preview.filePreviewPopover.style.left = previewData.left;
			preview.filePreviewPopover.style.width = previewData.width;
			preview.filePreviewPopover.style.height = previewData.height;
			preview.filePreviewPopover.style.zIndex = previewData.zIndex || FilePreviewPopover.baseZIndex.toString();
			preview.show();
		});
	}

	public static create(target: string, x: number, y: number, pinned: boolean = true)
	{
		const preview = new FilePreviewPopover(null, target, () => {});
		preview.setPinned(pinned);
		preview.filePreviewPopover.style.top = y + "px";
		preview.filePreviewPopover.style.left = x + "px";
		preview.show();
	}

	public filePreviewPopover: HTMLElement;
	public markdownEmbed: HTMLElement;
	public markdownEmbedContent: HTMLElement;
	public filePreviewDocument: WebpageDocument;
	public actionContainer: HTMLElement;
	public pinButton: HTMLElement;
	public goToButton: HTMLElement;
	public dragHandle: HTMLElement;

	public link: HTMLElement | null;
	public target: string;

	public isPinned: boolean = false;
	private resizeObserver: ResizeObserver | null = null;
	private hoverTimeout: number | null = null;
	private showTimeout: number | null = null;
	private onRemove: () => void;
	private outsideClickListener: (event: PointerEvent) => void; 

	public static initializeLink(link: HTMLElement, target: string) {
		let preview: FilePreviewPopover | null = null;
		
		link.addEventListener("pointerenter", function() {
			if (!preview) {
				preview = new FilePreviewPopover(link, target, () => {
					preview = null;  // Set preview to null when it's removed
				});
				preview.startShowTimeout();
			}
		});

		link.addEventListener("pointerleave", function() {
			if (preview) {
				if (!preview.isPinned) {
					preview.startRemoveTimeout();
				}
				preview.clearShowTimeout();
			}
		});

		link.addEventListener("click", function(event) {
			if (preview) {
				if (!preview.isPinned) {
					preview.startRemoveTimeout();
				}
				preview.clearShowTimeout();
			}
		});
	}

	constructor(link: HTMLElement | null, target: string, onRemove: () => void) {
		this.link = link;
		this.target = target;
		this.onRemove = onRemove;

		this.createPreviewElements();
		this.setupEventListeners();
		this.positionPreview();
		this.setupOutsideClickListener();
	}

	private createPreviewElements() {
		this.filePreviewPopover = document.createElement("div");
		this.filePreviewPopover.className = "file-preview popover hover-popover hide";
		document.body.appendChild(this.filePreviewPopover);

		this.markdownEmbed = document.createElement("div");
		this.markdownEmbed.className = "markdown-embed";
		this.filePreviewPopover.appendChild(this.markdownEmbed);

		this.markdownEmbedContent = document.createElement("div");
		this.markdownEmbedContent.className = "markdown-embed-content";
		this.markdownEmbed.appendChild(this.markdownEmbedContent);

		this.actionContainer = document.createElement("div");
		this.actionContainer.className = "preview-action-container";
		this.filePreviewPopover.appendChild(this.actionContainer);

		this.dragHandle = document.createElement("div");
		this.dragHandle.className = "drag-handle clickable-icon popover-action";
		this.actionContainer.appendChild(this.dragHandle);

		this.pinButton = document.createElement("button");
		this.pinButton.className = "pin-button clickable-icon popover-action";
		this.actionContainer.appendChild(this.pinButton);

		this.goToButton = document.createElement("button");
		this.goToButton.className = "go-to-button clickable-icon popover-action";
		this.actionContainer.appendChild(this.goToButton);

		this.filePreviewPopover.style.zIndex = FilePreviewPopover.baseZIndex.toString();
		this.bringToFront();
	}

	public setPinned(pinned: boolean)
	{
		this.isPinned = pinned;
		this.pinButton.classList.toggle("pinned", this.isPinned);
		this.filePreviewPopover.classList.toggle("pinned", this.isPinned);
		if (this.isPinned) {
			FilePreviewPopover.pinnedPreviews.push(this);
		}
		else {
			FilePreviewPopover.pinnedPreviews = FilePreviewPopover.pinnedPreviews.filter(preview => preview !== this);
		}
	}


	private setupEventListeners() {
		this.pinButton.addEventListener("click", () => {
			this.setPinned(!this.isPinned);
			FilePreviewPopover.savePinnedPreviews();
		});

		this.goToButton.addEventListener("click", () => {
			ObsidianSite.loadURL(this.target);
		});

		this.setupDragHandleListeners();

		this.filePreviewPopover.addEventListener("pointerenter", () => {
			this.clearRemoveTimeout();
		});

		this.filePreviewPopover.addEventListener("pointerleave", () => {
			if (!this.isPinned) {
				this.startRemoveTimeout();
			}
		});

		this.setupResizeObserver();
	}

	private updateMaxSize()
	{
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const rect = this.filePreviewPopover.getBoundingClientRect();
		const margin = 10; // Consistent margin

		// Calculate max width and height
		const maxWidth = viewportWidth - rect.left - margin;
		const maxHeight = viewportHeight - rect.top - margin;

		// Apply max width and height
		this.filePreviewPopover.style.maxWidth = `${maxWidth}px`;
		this.filePreviewPopover.style.maxHeight = `${maxHeight}px`;

		// Ensure the preview stays within the left and top edges of the viewport
		const newLeft = Math.max(margin, rect.left);
		const newTop = Math.max(margin, rect.top);

		// Apply position adjustments if necessary
		if (newLeft !== rect.left) {
			this.filePreviewPopover.style.left = `${newLeft}px`;
		}
		if (newTop !== rect.top) {
			this.filePreviewPopover.style.top = `${newTop}px`;
		}

		FilePreviewPopover.savePinnedPreviews();
	}

	private setupResizeObserver()
	{
		this.updateMaxSize();

		// Setup resize observer
		this.resizeObserver = new ResizeObserver(() => {
			this.updateMaxSize();
		});
		this.resizeObserver.observe(this.filePreviewPopover);

		// Also update max size when window is resized
		window.addEventListener('resize', this.updateMaxSize);
	}

	private dragPreviewCallback(event: PointerEvent)
	{
		event.stopPropagation();
		this.bringToFront();
		const offsetX = event.clientX - this.filePreviewPopover.getBoundingClientRect().left;
		const offsetY = event.clientY - this.filePreviewPopover.getBoundingClientRect().top;

		const onPointerMove = (event: PointerEvent) => {
			let newLeft = event.clientX - offsetX;
			let newTop = event.clientY - offsetY;

			// Constrain the preview within the viewport
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const previewRect = this.filePreviewPopover.getBoundingClientRect();

			newLeft = Math.max(0, Math.min(newLeft, viewportWidth - previewRect.width));
			newTop = Math.max(0, Math.min(newTop, viewportHeight - previewRect.height));

			this.filePreviewPopover.style.left = newLeft + "px";
			this.filePreviewPopover.style.top = newTop + "px";
			this.updateMaxSize();
		};

		const onPointerUp = () => 
		{
			if (this.isPinned)
			{
				FilePreviewPopover.savePinnedPreviews();    
			}
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
		};

		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
	}

	private setupDragHandleListeners() {
		this.dragHandle.addEventListener("pointerdown", this.dragPreviewCallback.bind(this));
		this.actionContainer.addEventListener("pointerdown", this.dragPreviewCallback.bind(this));
	}

	private positionPreview() 
	{
		if (!this.link) return;
		const linkRect = this.link.getBoundingClientRect();
		const previewRect = this.filePreviewPopover.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Reset any previously set positioning
		this.filePreviewPopover.style.top = '';
		this.filePreviewPopover.style.left = '';

		const margin = 10; // Margin between link and preview

		let top, left;

		// Determine vertical position
		if (viewportHeight - linkRect.bottom >= previewRect.height + margin) {
			// Position below
			top = linkRect.bottom + margin;
		} else {
			// Position above, but calculate top position
			top = Math.max(margin, linkRect.top - previewRect.height - margin);
		}

		// Determine horizontal position
		// Try to align with the left edge of the link
		left = linkRect.left;

		// Check if the preview would extend beyond the right edge of the viewport
		if (left + previewRect.width > viewportWidth - margin) {
			// If so, align with the right edge of the link instead
			left = Math.max(margin, linkRect.right - previewRect.width);
		}

		// Ensure the preview stays within the viewport
		top = Math.min(Math.max(margin, top), viewportHeight - previewRect.height - margin);
		left = Math.min(Math.max(margin, left), viewportWidth - previewRect.width - margin);

		this.filePreviewPopover.style.top = `${top}px`;
		this.filePreviewPopover.style.left = `${left}px`;
	}


	private setupOutsideClickListener() {
		this.outsideClickListener = (event: PointerEvent) => {
			if (!this.isPinned && 
				!this.filePreviewPopover.contains(event.target as Node) &&
				!this.link?.contains(event.target as Node)) {
				this.remove();
			}
		};
		document.addEventListener('pointerdown', this.outsideClickListener);
	}

	public startShowTimeout() {
		this.clearShowTimeout();
		this.showTimeout = window.setTimeout(() => this.show(), 350);
	}

	public clearShowTimeout() {
		if (this.showTimeout !== null) {
			clearTimeout(this.showTimeout);
			this.showTimeout = null;
		}
	}

	public async show() {
		this.filePreviewDocument = new WebpageDocument(this.target);
		await (await this.filePreviewDocument.load(null, this.markdownEmbedContent, true, true))?.show();
		this.positionPreview();
		this.filePreviewPopover.classList.remove('hide');
	}

	private bringToFront() {
		let maxZIndex = Math.max(
			FilePreviewPopover.baseZIndex,
			...FilePreviewPopover.pinnedPreviews.map(p => 
				parseInt(p.filePreviewPopover.style.zIndex) || FilePreviewPopover.baseZIndex
			)
		);

		if (maxZIndex >= FilePreviewPopover.maxZIndex) {
			// Reset all z-indexes if we're approaching the maximum
			FilePreviewPopover.pinnedPreviews.forEach((p, index) => {
				p.filePreviewPopover.style.zIndex = (FilePreviewPopover.baseZIndex + index).toString();
			});
			maxZIndex = FilePreviewPopover.baseZIndex + FilePreviewPopover.pinnedPreviews.length - 1;
		}

		this.filePreviewPopover.style.zIndex = (maxZIndex + 1).toString();
	}

	public startRemoveTimeout() {
		this.clearRemoveTimeout();
		this.hoverTimeout = window.setTimeout(() => this.remove(), 300);
	}

	public clearRemoveTimeout() {
		if (this.hoverTimeout !== null) {
			clearTimeout(this.hoverTimeout);
			this.hoverTimeout = null;
		}
	}

	public remove() {
		this.clearRemoveTimeout();
		this.clearShowTimeout();
		if (this.filePreviewPopover && this.filePreviewPopover.parentNode) {
			this.filePreviewPopover.parentNode.removeChild(this.filePreviewPopover);
		}
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
		window.removeEventListener('resize', this.updateMaxSize);
		document.removeEventListener('pointerdown', this.outsideClickListener);
		this.onRemove();  // Call the onRemove callback
	}
}
