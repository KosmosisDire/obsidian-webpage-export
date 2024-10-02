import { WebpageDocument } from "./document"
import { LinkHandler } from "./links";
import { Bounds, inOutQuadBlend, Vector2, getPointerPosition, lerp, lerpv, inOutQuadBlendv, lerpc, clamp, mapRange, mapRangeClamped } from "./utils";

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

	public get size(): Vector2
	{
		return new Vector2(parseFloat(this.nodeEl.style.width.replace("px", "")), parseFloat(this.nodeEl.style.height.replace("px", "")));
	}

	public set size(newSize: Vector2)
	{
		this.nodeEl.style.width = newSize.x + "px";
		this.nodeEl.style.height = newSize.y + "px";
		this.nodeEl.style.setProperty("--canvas-node-width", newSize.x + "px");
		this.nodeEl.style.setProperty("--canvas-node-height", newSize.y + "px");
	}

	public get position(): Vector2
	{
		// ex. transform: translate(1600px, 10550px);
		const transform = this.nodeEl.style.transform;
		const match = transform.match(/translate\(([^,]+)px, ([^,]+)px\)/);

		const translate = this.nodeEl.style.translate;
		const match2 = translate.match(/([^,]+)px ([^,]+)px/);

		// add together the two translations
		let x = 0;
		let y = 0;
		if (match)
		{
			x += parseFloat(match[1]);
			y += parseFloat(match[2]);
		}

		if (match2)
		{
			x += parseFloat(match2[1]);
			y += parseFloat(match2[2]);
		}

		return new Vector2(x, y);
	}

	public set position(newPos: Vector2)
	{
		this.nodeEl.style.transform = `translate(${newPos.x}px, ${newPos.y}px)`;
	}

	public get bounds(): Bounds
	{
		let bounds = new Bounds(0, 0, 0, 0);
		let size = this.size.scale(this.canvas.scale);
		let position = this.position.scale(this.canvas.scale).add(this.canvas.position);

		bounds.position = position;
		bounds.size = size;
		return bounds;
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
		//@ts-ignore
		this.nodeEl.nodeObj = this;
		this.labelEl = nodeEl.querySelector(".canvas-node-label") as HTMLElement;
		this.containerEl = nodeEl.querySelector(".canvas-node-container") as HTMLElement;
		this.contentEl = nodeEl.querySelector(".canvas-node-content") as HTMLElement;

		if (!this.labelEl || !this.containerEl || !this.contentEl)
		{
			console.error("Failed to find all required elements for canvas node", this);
			return;
		}

		const contentClasses = this.contentEl.classList;
		if (contentClasses.contains("image-embed")) this.type = NodeType.Image;
		else if (contentClasses.contains("video-embed")) this.type = NodeType.Video;
		else if (contentClasses.contains("audio-embed")) this.type = NodeType.Audio;
		else if (contentClasses.contains("markdown-embed") && contentClasses.contains("external-markdown-embed")) this.type = NodeType.ExternalMarkdown;
		else if (contentClasses.contains("markdown-embed")) this.type = NodeType.Markdown;
		else if (contentClasses.contains("canvas-embed")) this.type = NodeType.Canvas;
		else if (this.contentEl.firstElementChild?.tagName === "IFRAME") this.type = NodeType.Website;
		else if (this.nodeEl.classList.contains("canvas-node-group")) this.type = NodeType.Group;
		else this.type = NodeType.None;

		if (this.type == NodeType.ExternalMarkdown)
		{
			const documentEl = this.contentEl.querySelector(".obsidian-document");
			console.log(documentEl);
			const documentObj = canvas.document.children.find((doc) => doc.documentEl == documentEl);
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
			node.fitToView(false);
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

	public fitToView(instant: boolean = false)
	{
		this.canvas.fitToBounds(this.bounds, 0.9, instant);
	}
}

export class Canvas
{
	public document: WebpageDocument;
	public nodes: CanvasNode[];
	public hiddenNodes: CanvasNode[] = [];
	public canvasEl: HTMLElement;
	public wrapperEl: HTMLElement;
	public backgroundEl: HTMLElement;
	public backgroundDotEl: SVGCircleElement;
	public focusedNode: CanvasNode | null = null;

	private _renderScale = 1;
	public get renderScale(): number { return this._renderScale; }
	public set renderScale(scale: number)
	{
		this._renderScale = scale;
		//@ts-ignore
		this.canvasEl.style.zoom = (scale * 100) + "%";
		this.scale = this._scale;
		this.position = this._position;
	}


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

	private readonly _minScale: number = 0.1;
	private readonly _maxScale: number = 5;
	public get minScale(): number { return this._minScale; }
	public get maxScale(): number { return this._maxScale; }

	private _targetScale: number = 1;
	public get targetScale(): number { return this._targetScale}
	private set targetScale(newScale: number) 
	{
		newScale = Math.min(Math.max(newScale, this.minScale), this.maxScale);
		this._targetScale = newScale;
	}
	
	private _scale: number = 1;
	public get scale(): number { return this._scale; }
	private set scale(newScale: number)
	{
		let ratio = newScale / this._scale;
		this._scale = newScale;
		let scaled = newScale / this.renderScale;
		const scaleStr = scaled.toString() ?? "1";
		this.canvasEl.style.scale = scaleStr;
		const zoomStr = (1/(Math.sqrt(newScale))).toString() ?? "1";
		this.wrapperEl.style.setProperty("--zoom-multiplier",  zoomStr);

		this.canvasEl.classList.toggle("small-scale", this.scale < 0.15);

		this.backgroundScale = this.backgroundScale * ratio;
	}

	// private nodespaceOffset: Vector2;
	private _targetPosition: Vector2 = new Vector2(0, 0);
	public get targetPosition(): Vector2 { return this._targetPosition; }
	public set targetPosition(screenPos: Vector2)
	{
		this._targetPosition = screenPos;
	}

	private _position: Vector2 = new Vector2(0, 0);
	public get position(): Vector2 { return this._position; }
	public set position(screenPos: Vector2)
	{
		this._position = screenPos;
		let scaled = screenPos.divide(this.renderScale);
		this.canvasEl.style.translate = `${scaled.x}px ${scaled.y}px`;
		this.backgroundPosition = this.position;
	}

	public set forcePosition(screenPos: Vector2)
	{
		this.targetPosition = screenPos;
		this.position = screenPos;
	}

	public get forcePosition(): Vector2
	{
		return this.position;
	}

	private _backgroundBaseScale: number = 20;
	private _invisibleBackgroundScale: number = 2;
	private _backgroundScale: number = this._backgroundBaseScale;
	public get backgroundScale(): number { return this._backgroundScale; }
	public set backgroundScale(newScale: number)
	{
		const scaleStr = (newScale).toString()  ?? "20";
		this.backgroundEl?.setAttribute("width", scaleStr);
		this.backgroundEl?.setAttribute("height", scaleStr);
		this._backgroundScale = newScale;

		// lerp opacity based on scale
		if (this.backgroundEl?.parentElement)
			this.backgroundEl.parentElement.style.opacity = (1 - mapRangeClamped(this._backgroundScale, this._backgroundBaseScale / 2, this._invisibleBackgroundScale, 0, 1)).toString();
	}

	private _backgroundDotSize: number = 1;
	public get backgroundDotSize(): number { return this._backgroundDotSize; }
	public set backgroundDotSize(newSize: number)
	{
		const sizeStr = newSize.toString() ?? "0.7";
		this.backgroundDotEl?.setAttribute("r", sizeStr);
		this.backgroundDotEl?.setAttribute("cx", sizeStr);
		this.backgroundDotEl?.setAttribute("cy", sizeStr);
		this._backgroundDotSize = newSize;
	}

	private _backgroundPosition: Vector2 = new Vector2(0, 0);
	public get backgroundPosition(): Vector2 { return this._backgroundPosition; }
	public set backgroundPosition(newPosition: Vector2)
	{
		if (!this.backgroundEl) return;
		this.backgroundEl?.setAttribute("x", newPosition.x.toString());
		this.backgroundEl?.setAttribute("y", newPosition.y.toString());
		this._backgroundPosition = newPosition;
	}


	constructor(document: WebpageDocument)
	{
		this.document = document;
		this.nodes = Array.from(document.documentEl.querySelectorAll(".canvas-node"))
					.map((nodeEl) => new CanvasNode(this, nodeEl as HTMLElement));

		// canvas nodes sometimes (not always) have both a translate and a transform: translate in their style
		// this snippets combines them into one just one translation
		

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
		this.backgroundDotEl = this.backgroundEl?.querySelector("circle") as SVGCircleElement;
		this.canvasEl.setAttribute("style", `translate: 0px 1px; scale: 1;`);
		this.backgroundScale = this._backgroundScale;
		this.backgroundDotSize = this._backgroundDotSize;
		this.renderScale = this._renderScale;

		const nodespaceOffset = Bounds.fromElement(this.canvasEl).min.sub(this.nodeBounds.min);
		Array.from(this.canvasEl.children).forEach((el) => 
		{
			//@ts-ignore
			el.style.translate = `${nodespaceOffset.x}px ${nodespaceOffset.y}px`;
		});

		this.forcePosition = this.nodeBounds.min.sub(this.wrapperBounds.min);

		requestAnimationFrame(this.updateScale.bind(this));
		
		this.initEvents();

		this.wrapperEl.style.transition = "opacity 0.0s";
		this.wrapperEl.classList.add("hide");
		this.wrapperEl.style.transition = "opacity 3s";
		this.wrapperEl.classList.remove("hide");

		this.fitToBounds(this.nodeBounds, 3, true);

		setTimeout(() =>
		{
			// zoom in animation
			this.fitToBounds(this.nodeBounds, 0.9, false);
		}, 100);
	}

	private lastTime: number = 0;
	private updateScale(time: number)
	{
		if (this.lastTime == 0) this.lastTime = time;
		const deltaTime = (time - this.lastTime) / 1000;
		this.lastTime = time;

		if (Math.abs(this.targetScale - this.scale) > 0.0001) 
			this.scale = inOutQuadBlend(this.scale, this.targetScale, 6 * deltaTime);

		if (this.targetPosition.sub(this.position).magnitude > 0.001)
			this.position = inOutQuadBlendv(this.position, this.targetPosition, 6 * deltaTime);
		
		let screenBounds = Bounds.screenBounds;

		// sort the hidden nodes by their distance from the center of the screen
		this.hiddenNodes.sort((a, b) => 
		{
			const aCenter = a.bounds.center;
			const bCenter = b.bounds.center;
			const aDist = aCenter.sub(screenBounds.center).magnitude;
			const bDist = bCenter.sub(screenBounds.center).magnitude;
			return aDist - bDist;
		});

		// loop through the first 50 hidden nodes and check if they are visible, if they are unset the display
		for (let i = 0; i < 50; i++)
		{
			if (i >= this.hiddenNodes.length) break;
			const node = this.hiddenNodes[i];
			if (!node)
			{
				this.hiddenNodes.splice(i, 1);
				continue;
			}
			const bounds = node.bounds.expand(100);
			const isVisible = bounds.overlaps(screenBounds);
			node.nodeEl.style.display = isVisible ? "" : "none";
			if (isVisible) this.hiddenNodes.splice(i, 1);
		}

		requestAnimationFrame(this.updateScale.bind(this));
	}

	private initEvents()
	{
		// hide nodes that are not in view
		const observer = new IntersectionObserver((entries) => 
		{
			entries.forEach(entry => 
			{
				(entry.target as HTMLElement).style.display = entry.isIntersecting ? '' : 'none';
				//@ts-ignore
				if (!entry.isIntersecting) this.hiddenNodes.push((entry.target as HTMLElement).nodeObj);
			});
		}, { root: null, rootMargin: '0px', threshold: 0 });
		this.nodes.forEach((node) => observer.observe(node.nodeEl));

		// make canvas draggable / panable with mouse
		const localThis = this;
        const isWindows = navigator.userAgent.includes("Windows");

		function getRelativePointerPosition(event: MouseEvent | Touch): Vector2 {
            const rect = localThis.wrapperEl.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            return new Vector2(x, y);
        }

        function dragStart(event: PointerEvent) {
            if (event.pointerType != "mouse" && event.pointerType != "pen") return;
            const startPointerPos = getRelativePointerPosition(event);
            const startCanvasPos = localThis.position;
            const startingNode = localThis.focusedNode;

            function drag(dragEvent: MouseEvent) {
                if (isWindows && 
                    startingNode?.isScrollable && 
                    dragEvent.buttons == 4) return;

                dragEvent.preventDefault();
                const pointer = getRelativePointerPosition(dragEvent);
                const delta = pointer.sub(startPointerPos);
                localThis.forcePosition = startCanvasPos.add(delta);
            }

            function dragEnd(e: MouseEvent) {
                document.removeEventListener("mousemove", drag);
                document.removeEventListener("mouseup", dragEnd);
            }

            document.addEventListener("mousemove", drag);
            document.addEventListener("mouseup", dragEnd);
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
		this.wrapperEl.addEventListener("wheel", function (event) {
            if (!shouldOverrideScroll(event.deltaY, event.deltaX, localThis.focusedNode)) return;
            let scale = 1;
            scale -= event.deltaY / 700 * scale;
            localThis.scaleAround(scale, getRelativePointerPosition(event));
        }, { passive: true });

        let touching = false;
        this.wrapperEl.addEventListener("touchstart", function (event) {
            if (touching) return;
            touching = true;
            const touches = event.touches;
            
            function getTouchData(touches: TouchList) {
                const touch1 = getRelativePointerPosition(touches[0]);
                const touch2 = touches.length == 2 ? getRelativePointerPosition(touches[1]) : null;
                const center = touch2 ? touch1.add(touch2).scale(0.5) : touch1;
                const distance = touch2 ? Vector2.distance(touch1, touch2) : 0;

                return { touch1, touch2, center, distance };
            }

            let lastTouchData = getTouchData(touches);
            let isTwoFingerDrag = touches.length == 2;
            const startingNode = localThis.focusedNode;
        
            function touchMove(event: TouchEvent) {
                const touches = event.touches;
                const touchData = getTouchData(touches);

                if (touches.length == 2) {
                    if (!isTwoFingerDrag) {
                        lastTouchData = getTouchData(touches);
                        isTwoFingerDrag = true;
                    }

                    const scaleDelta = (touchData.distance - lastTouchData.distance) / lastTouchData.distance;
                    localThis.scaleAround(1 + scaleDelta, touchData.center);
                }

                const delta = touchData.center.sub(lastTouchData.center);
                if (!isTwoFingerDrag && !shouldOverrideScroll(-delta.y, delta.x, startingNode)) {
                    lastTouchData = getTouchData(touches);
                    return;
                }

                event.preventDefault();
                localThis.targetPosition = localThis.targetPosition.add(delta);
                lastTouchData = getTouchData(touches);
            }

            function touchEnd(event: TouchEvent) {
                document.removeEventListener("touchmove", touchMove);
                document.removeEventListener("touchend", touchEnd);
                touching = false;
            }

            document.addEventListener("touchmove", touchMove);
            document.addEventListener("touchend", touchEnd);
        });
    }

	/**Sets the relative scale of the canvas around a point*/
	public scaleAround(scaleBy: number, point: Vector2, instantScale: boolean = false): Vector2
	{
		// clamp scale by the min and max scale when applied to the current scale
		const currentScale = this.targetScale;
		let newScale = currentScale * scaleBy;
		newScale = Math.min(Math.max(newScale, this.minScale), this.maxScale);
		scaleBy = newScale / currentScale;
		
		// calculate offset after scaling
		const centerToPoint = point.sub(this.targetPosition);
		const centerPin = centerToPoint.scale(scaleBy).add(this.targetPosition);
		const offset = point.sub(centerPin);

		if (instantScale)
		{
			this.scale *= scaleBy;
			this.targetScale =  this.scale;
			this.forcePosition = this.forcePosition.add(offset);
		}
		else
		{
			this.targetScale *= scaleBy;
			this.targetPosition = this.targetPosition.add(offset);
		}

		return offset;
	}

	public setScaleAround(scale: number, point: Vector2, instant: boolean = false)
	{
		this.scaleAround(scale / this.targetScale, point, instant);
	}

	public fitToBounds(bounds: Bounds = this.nodeBounds, scaleMultiplier: number = 0.9, instant: boolean = false)
	{
		this.hideNodesOutsideBounds(bounds.scale(2));
		const documentWidth = this.document.containerEl.clientWidth;
		const documentHeight = this.document.containerEl.clientHeight;
		const xRatio = documentWidth/bounds.width;
		const yRatio = documentHeight/bounds.height;
		const scale = scaleMultiplier * Math.min(xRatio, yRatio);
		this.scaleAround(scale, bounds.center, instant);
		this.centerView(bounds.center, instant);
	}

	private hideNodesOutsideBounds(bounds: Bounds)
	{
		for (const node of this.nodes)
		{
			if (!bounds.overlaps(node.bounds))
			{
				node.nodeEl.style.display = "none";
				this.hiddenNodes.push(node);
			}
		}
	}

	/**Sets the absolute center of the view*/
	private centerView(center: Vector2, instant: boolean = false)
	{
		const offset = this.wrapperBounds.center.sub(center);
		if (instant) this.forcePosition = this.forcePosition.add(offset);
		else this.targetPosition = this.targetPosition.add(offset);
	}
}
