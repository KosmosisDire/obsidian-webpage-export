import { WebpageDocument } from "./document"
import { Bounds, Vector2, getPointerPosition } from "./utils";

export enum NodeType
{
	Markdown = "markdown",
	ExternalMarkdown = "external-markdown",
	Canvas = "canvas",
	Image = "image",
	Video = "video",
	Audio = "audio",
	Website = "website",
	Group = "group",
	None = "none"
}

export class CanvasNode
{
	public canvas: Canvas;
	public nodeEl: HTMLElement;
	public labelEl: HTMLElement;
	public containerEl: HTMLElement;
	public contentEl: HTMLElement;
	public type: NodeType;
	public document: WebpageDocument;
	public isFocused: boolean = false;

	public get bounds(): Bounds
	{
		return Bounds.fromElement(this.nodeEl);
	}

	public get label(): string
	{
		return this.labelEl.textContent ?? "";
	}

	public set label(newLabel: string)
	{
		this.labelEl.textContent = newLabel;
	}

	public get isScrollable(): boolean
	{
		if (!this.document) return false;
		return this.document?.documentEl.scrollHeight > this.document?.documentEl.clientHeight;
	}

	public get scrollContainer(): HTMLElement | null
	{
		return this.document?.documentEl;
	}

	constructor(canvas: Canvas, nodeEl: HTMLElement)
	{
		this.canvas = canvas;
		this.nodeEl = nodeEl;
		this.labelEl = nodeEl.querySelector(".canvas-node-label") as HTMLElement;
		this.containerEl = nodeEl.querySelector(".canvas-node-container") as HTMLElement;
		this.contentEl = nodeEl.querySelector(".canvas-node-content") as HTMLElement;

		const contentClasses = this.contentEl.classList;
		if (contentClasses.contains("image-embed")) this.type = NodeType.Image;
		else if (contentClasses.contains("video-embed")) this.type = NodeType.Video;
		else if (contentClasses.contains("audio-embed")) this.type = NodeType.Audio;
		else if (contentClasses.contains("markdown-embed") && contentClasses.contains("is-loaded")) this.type = NodeType.ExternalMarkdown;
		else if (contentClasses.contains("markdown-embed")) this.type = NodeType.Markdown;
		else if (contentClasses.contains("canvas-embed")) this.type = NodeType.Canvas;
		else if (this.contentEl.firstElementChild?.tagName === "IFRAME") this.type = NodeType.Website;
		else if (this.nodeEl.classList.contains("canvas-node-group")) this.type = NodeType.Group;
		else this.type = NodeType.None;

		if (this.type == NodeType.ExternalMarkdown)
		{
			const markdownEmbedContent = this.contentEl.querySelector(".markdown-embed-content");
			const documentObj = canvas.document.children.find((doc) => doc.containerEl == markdownEmbedContent);
			if (documentObj) this.document = documentObj;
			else console.error("Failed to find document object for external markdown node", this);
		}

		// if (this.type == NodeType.Group)
		// {
		// 	this.nodeEl.style.pointerEvents = "auto";
		// }

		this.initEvents();
	}

	public focus(force: boolean = true)
	{
		if (this.isFocused && force) return;
		if (this.canvas.focusedNode != this) this.canvas.focusedNode?.focus(false);
		this.nodeEl.classList.toggle("is-focused", force);
		this.canvas.focusedNode = force ? this : null;
		this.isFocused = force;
	}

	private initEvents()
	{
		const node = this;

		this.nodeEl.addEventListener("dblclick", (e) => 
		{
			node.fitToView(0.3);
		});

		function onEnter(event: PointerEvent)
		{
			node.focus(true);
			node.nodeEl.addEventListener("mouseleave", onLeave);
			node.nodeEl.addEventListener("touchend", onLeave);
			event.stopPropagation();
		}

		function onLeave()
		{
			console.log("leave");
			node.focus(false);
			node.nodeEl.removeEventListener("mouseleave", onLeave);
			node.nodeEl.removeEventListener("touchend", onLeave);
		}

		this.nodeEl.addEventListener("pointerenter", onEnter);
	}

	public fitToView(transitionTime: number = 0)
	{
		this.canvas.fitToBounds(this.bounds, 0.9, transitionTime);
	}
}

export class Canvas
{
	public document: WebpageDocument;
	public nodes: CanvasNode[];
	public canvasEl: HTMLElement;
	public wrapperEl: HTMLElement;
	public backgroundEl: HTMLElement;
	public focusedNode: CanvasNode | null = null;


	public get nodeBounds(): Bounds
	{
		if (this.nodes.length == 0) return new Bounds(0, 0, 0, 0);
		const bounds = this.nodes[0].bounds;

		for (const node of this.nodes)
		{
			bounds.encapsulate(node.bounds);
		};

		return bounds;
	}

	public get wrapperBounds(): Bounds
	{
		return Bounds.fromElement(this.wrapperEl);
	}

	private readonly minScale: number = 0.1;
	private readonly maxScale: number = 1.5;
	private _scale: number = 1;
	public get scale(): number { return this._scale; }
	private set scale(newScale: number) 
	{
		newScale = Math.min(Math.max(newScale, this.minScale), this.maxScale);
		const scaleStr = newScale.toString() ?? "1";
		this.canvasEl.style.scale = scaleStr;
		const zoomStr = (1/(Math.sqrt(newScale))).toString() ?? "1";
		this.wrapperEl.style.setProperty("--zoom-multiplier",  zoomStr);
		this._scale = newScale;
	}

	// private nodespaceOffset: Vector2;
	private _position: Vector2;
	public get position(): Vector2 { return this._position; }
	public set position(screenPos: Vector2)
	{
		this._position = screenPos;
		this.canvasEl.style.translate = `${screenPos.x}px ${screenPos.y}px`;
	}

	private _backgroundScale: number = 20;
	public get backgroundScale(): number { return this._backgroundScale; }
	public set backgroundScale(newScale: number)
	{
		const scaleStr = newScale.toString() ?? "20";
		this.backgroundEl.setAttribute("width", scaleStr);
		this.backgroundEl.setAttribute("height", scaleStr);
		this._backgroundScale = newScale;
	}

	private _backgroundPosition: Vector2 = new Vector2(0, 0);
	public get backgroundPosition(): Vector2 { return this._backgroundPosition; }
	public set backgroundPosition(newPosition: Vector2)
	{
		this.backgroundEl.setAttribute("x", newPosition.x.toString());
		this.backgroundEl.setAttribute("y", newPosition.y.toString());
		this._backgroundPosition = newPosition;
	}


	constructor(document: WebpageDocument)
	{
		this.document = document;
		this.nodes = Array.from(document.documentEl.querySelectorAll(".canvas-node"))
					.map((nodeEl) => new CanvasNode(this, nodeEl as HTMLElement));

		// make local space equal to screen space
		this.document.documentEl.style.position = "absolute";
		this.document.documentEl.style.width = "100%";
		this.document.documentEl.style.height = "100%";
		this.document.documentEl.style.overflow = "hidden";
		this.document.documentEl.style.top = "0";
		this.document.documentEl.style.left = "0";

		this.canvasEl = document.documentEl.querySelector(".canvas") as HTMLElement;
		this.wrapperEl = document.documentEl.querySelector(".canvas-wrapper") as HTMLElement;
		this.backgroundEl = document.documentEl.querySelector(".canvas-background pattern") as HTMLElement;
		this.canvasEl.setAttribute("style", `translate: 0px 1px; scale: 1;`);
		this.backgroundScale = 20;

		const nodespaceOffset = Bounds.fromElement(this.canvasEl).min.sub(this.nodeBounds.min);
		Array.from(this.canvasEl.children).forEach((el) => 
		{
			//@ts-ignore
			el.style.translate = `${nodespaceOffset.x}px ${nodespaceOffset.y}px`;
		});

		this.position = this.nodeBounds.min.sub(this.wrapperBounds.min);

		this.initEvents();

		// zoom in animation
		this.fitToBounds(this.nodeBounds, 3);
		this.fitToBounds(this.nodeBounds, 0.9, 0.3);
	}

	private initEvents()
	{
		// make canvas draggable / panable with mouse
		const canvas = this;
		const isWindows = navigator.userAgent.includes("Windows"); // used for smart scrolling
 
		this.backgroundEl.parentElement?.addEventListener("dblclick", () => 
		{
			console.log("fitting to bounds");
			canvas.fitToBounds(this.nodeBounds, 0.9, 0.3);
		});

		function dragStart(event: PointerEvent)
		{
			if (event.pointerType != "mouse" && event.pointerType != "pen") return;
			const startPointerPos = getPointerPosition(event);
			const startCanvasPos = canvas.position;
			const startingNode = canvas.focusedNode;
			//@ts-ignore
			// canvas.wrapperEl.setPointerCapture(event.pointerId);

			function drag(dragEvent: MouseEvent)
			{
				// skip drag if the focused node can be scrolled on windows
				if (isWindows && 
					startingNode?.isScrollable && 
					dragEvent.buttons == 4) return;

				dragEvent.preventDefault();
				const pointer = getPointerPosition(dragEvent);
				const delta = pointer.sub(startPointerPos);
				canvas.position = startCanvasPos.add(delta);
			}

			function dragEnd(e: MouseEvent)
			{
				document.body.removeEventListener("mousemove", drag);
				document.body.removeEventListener("mouseup", dragEnd);
				// canvas.wrapperEl.releasePointerCapture(event.pointerId);
			}

			document.body.addEventListener("mousemove", drag);
			document.body.addEventListener("mouseup", dragEnd);
		}

		this.wrapperEl.addEventListener("pointerdown", dragStart);

		function shouldOverrideScroll(deltaY: number, deltaX: number, node: CanvasNode | null | undefined): boolean
		{
			const scrollContainer = node?.scrollContainer;
			if (scrollContainer)
			{
				// if the container can be scrolled up and the user is scrolling up, don't zoom
				if (scrollContainer.scrollTop != 0 && deltaY < 0 && Math.abs(deltaY / (deltaX+0.01)) > 2)
					return false;
			
				// if the container can be scrolled down and the user is scrolling down, don't zoom
				if ((scrollContainer.scrollHeight - scrollContainer.scrollTop) > (scrollContainer.clientHeight + 1) &&
					deltaY > 0 && Math.abs(deltaY / (deltaX+0.01)) > 2)
					return false;

				// if the container can be scrolled left and the user is scrolling left, don't zoom
				if (scrollContainer.scrollLeft != 0 && deltaX < 0 && Math.abs(deltaX / (deltaY+0.01)) > 2)
					return false;

				// if the container can be scrolled right and the user is scrolling right, don't zoom
				if ((scrollContainer.scrollWidth - scrollContainer.scrollLeft) > (scrollContainer.clientWidth + 1) &&
					deltaX > 0 && Math.abs(deltaX / (deltaY+0.01)) > 2)
					return false;
			}

			return true;
		}

		// make canvas mouse zoomable
		this.wrapperEl.addEventListener("wheel", function (event)
		{
			if (!shouldOverrideScroll(event.deltaY, event.deltaX, canvas.focusedNode)) return;
			let scale = 1;
			scale -= event.deltaY / 700 * scale;
			canvas.scaleAround(scale, getPointerPosition(event));
		}, { passive: true });

		// make canvas pinch to zoom and drag to pan on touch devices
		let touching = false;
		this.wrapperEl.addEventListener("touchstart", function (event)
		{
			if (touching) return;
			touching = true;
			const touches = event.touches;
			
			function getTouchData(touches: TouchList)
			{
				const touch1 = new Vector2(touches[0].clientX, touches[0].clientY);
				const touch2 = touches.length == 2 ? new Vector2(touches[1].clientX, touches[1].clientY) : null;
				const center = touch2 ? touch1.add(touch2).scale(0.5) : touch1;
				const distance = touch2 ? Vector2.distance(touch1, touch2) : 0;

				return { touch1, touch2, center, distance };
			}

			let lastTouchData = getTouchData(touches);
			let isTwoFingerDrag = touches.length == 2;
			const startingNode = canvas.focusedNode;
		
			function touchMove(event: TouchEvent)
			{
				const touches = event.touches;
				const touchData = getTouchData(touches);

				if (touches.length == 2)
				{
					if (!isTwoFingerDrag)
					{
						lastTouchData = getTouchData(touches);
						isTwoFingerDrag = true;
					}

					const scaleDelta = (touchData.distance - lastTouchData.distance) / lastTouchData.distance;
					canvas.scaleAround(1 + scaleDelta, touchData.center);
				}

				const delta = touchData.center.sub(lastTouchData.center);
				if (!isTwoFingerDrag && !shouldOverrideScroll(-delta.y, delta.x, startingNode))
				{
					lastTouchData = getTouchData(touches);
					return;
				}

				event.preventDefault();
				canvas.position = canvas.position.add(delta);
				lastTouchData = getTouchData(touches);
			}

			function touchEnd(event: TouchEvent)
			{
				document.body.removeEventListener("touchmove", touchMove);
				document.body.removeEventListener("touchend", touchEnd);
				touching = false;
			}

			document.body.addEventListener("touchmove", touchMove);
			document.body.addEventListener("touchend", touchEnd);
		});
	}

	/**Sets the relative scale of the canvas around a point*/
	public scaleAround(scaleBy: number, point: Vector2)
	{
		// clamp scale by the min and max scale when applied to the current scale
		const currentScale = this.scale;
		let newScale = currentScale * scaleBy;
		newScale = Math.min(Math.max(newScale, this.minScale), this.maxScale);
		scaleBy = newScale / currentScale;
		
		// calculate offset after scaling
		const centerToPoint = point.sub(this.position);
		const centerPin = centerToPoint.scale(scaleBy).add(this.position);
		const offset = point.sub(centerPin);

		this.scale *= scaleBy;
		this.position = this.position.add(offset);

		return offset;
	}

	public setScaleAround(scale: number, point: Vector2)
	{
		this.scaleAround(scale / this.scale, point);
	}

	public fitToBounds(bounds: Bounds = this.nodeBounds, scaleMultiplier: number = 0.9, transitionTime: number = 0)
	{
		if (transitionTime > 0)
		{
			const canvasEl = this.canvasEl;
			canvasEl.style.transition = `scale ${transitionTime}s cubic-bezier(0.5, -0.1, 0.5, 1.1), translate ${transitionTime}s cubic-bezier(0.5, -0.1, 0.5, 1.1)`;
			
			setTimeout(function()
			{
				canvasEl.style.transition = "";
			}, transitionTime * 1000 + 50);
		}

		const documentWidth = this.document.containerEl.clientWidth;
		const documentHeight = this.document.containerEl.clientHeight;
		const xRatio = documentWidth/bounds.width;
		const yRatio = documentHeight/bounds.height;
		const scale = scaleMultiplier * Math.min(xRatio, yRatio);
		this.scaleAround(scale, bounds.center);
		this.centerView(bounds.center);
	}

	/**Sets the absolute center of the view*/
	private centerView(center: Vector2)
	{
		const offset = this.wrapperBounds.center.sub(center);
		this.position = this.position.add(offset);
	}
}
