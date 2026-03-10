// ─── Async ───────────────────────────────────────────────────────────────────

export async function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitUntil(predicate: () => boolean, interval: number = 100) {
	while (!predicate()) await delay(interval);
}

// ─── DOM ─────────────────────────────────────────────────────────────────────

export function getTextNodes(element: Element): Node[] {
	const textNodes: Node[] = [];
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
	let node: Node | null;
	while (node = walker.nextNode()) textNodes.push(node);
	return textNodes;
}

export function getLengthInPixels(cssString: string, contextElement: Element): number {
	const temp = document.createElement("div");
	temp.style.position = "absolute";
	temp.style.visibility = "hidden";
	temp.style.width = cssString;
	contextElement.appendChild(temp);
	const px = temp.offsetWidth;
	contextElement.removeChild(temp);
	return px;
}

// ─── Bounds ──────────────────────────────────────────────────────────────────

export class Bounds {
	public left: number;
	public right: number;
	public top: number;
	public bottom: number;

	get width(): number { return this.right - this.left; }
	set width(v: number) { this.right = this.left + v; }
	get height(): number { return this.bottom - this.top; }
	set height(v: number) { this.bottom = this.top + v; }
	get center(): Vector2 { return new Vector2(this.left + this.width / 2, this.top + this.height / 2); }
	get min(): Vector2 { return new Vector2(this.left, this.top); }
	set min(v: Vector2) { this.left = v.x; this.top = v.y; }
	set position(v: Vector2) { this.min = v; }
	get max(): Vector2 { return new Vector2(this.right, this.bottom); }
	set max(v: Vector2) { this.right = v.x; this.bottom = v.y; }
	get size(): Vector2 { return new Vector2(this.width, this.height); }
	set size(v: Vector2) { this.width = v.x; this.height = v.y; }

	constructor(left: number, top: number, width: number, height: number) {
		this.left = left;
		this.top = top;
		this.right = left + width;
		this.bottom = top + height;
	}

	containsPoint(point: Vector2) {
		return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bottom;
	}

	containsBounds(bounds: Bounds) {
		return bounds.left >= this.left && bounds.right <= this.right && bounds.top >= this.top && bounds.bottom <= this.bottom;
	}

	encapsulate(bounds: Bounds) {
		this.left = Math.min(this.left, bounds.left);
		this.top = Math.min(this.top, bounds.top);
		this.right = Math.max(this.right, bounds.right);
		this.bottom = Math.max(this.bottom, bounds.bottom);
		return this;
	}

	encapsulatePoint(point: Vector2) {
		if (point.isUndefined) return;
		this.left = Math.min(this.left, point.x);
		this.top = Math.min(this.top, point.y);
		this.right = Math.max(this.right, point.x);
		this.bottom = Math.max(this.bottom, point.y);
		return this;
	}

	expand(by: number) {
		this.left -= by; this.right += by;
		this.top -= by; this.bottom += by;
		return this;
	}

	translate(by: Vector2) {
		this.left += by.x; this.right += by.x;
		this.top += by.y; this.bottom += by.y;
		return this;
	}

	scale(by: number) {
		const w = this.width, h = this.height;
		this.left += w * (1 - by) / 2;
		this.right -= w * (1 - by) / 2;
		this.top += h * (1 - by) / 2;
		this.bottom -= h * (1 - by) / 2;
		return this;
	}

	overlaps(bounds: Bounds) {
		return this.left < bounds.right && this.right > bounds.left && this.top < bounds.bottom && this.bottom > bounds.top;
	}

	static fromElement(el: HTMLElement) {
		const r = el.getBoundingClientRect();
		return new Bounds(r.x, r.y, r.width, r.height);
	}

	static get screenBounds() {
		return new Bounds(0, 0, window.innerWidth, window.innerHeight);
	}
}

// ─── Vector2 ─────────────────────────────────────────────────────────────────

export class Vector2 {
	x: number;
	y: number;

	constructor(x: number, y: number) { this.x = x; this.y = y; }

	add(p: Vector2) { return new Vector2(this.x + p.x, this.y + p.y); }
	sub(p: Vector2) { return new Vector2(this.x - p.x, this.y - p.y); }
	scale(s: number) { return new Vector2(this.x * s, this.y * s); }
	divide(s: number) { return new Vector2(this.x / s, this.y / s); }

	get isUndefined() { return isNaN(this.x) || isNaN(this.y); }
	get magnitude() { return Math.sqrt(this.sqrMagnitude); }
	get sqrMagnitude() { return this.x * this.x + this.y * this.y; }
	get normalized() { const m = this.magnitude; return new Vector2(this.x / m, this.y / m); }
	get inverse() { return new Vector2(-this.x, -this.y); }

	static distance(a: Vector2, b: Vector2) { return a.sub(b).magnitude; }
	static dot(a: Vector2, b: Vector2) { return a.x * b.x + a.y * b.y; }
	static readonly Undefined = new Vector2(NaN, NaN);
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

export class Ticker {
	private _lastTime: number;
	private _deltaTime: number;
	private _time: number;
	public targetFPS: number;
	private measuredFPS: number;
	private callbacks: ((dt: number) => void)[] = [];

	get deltaTime() { return this._deltaTime / 1000; }
	get time() { return this._time; }

	constructor(targetFPS: number) {
		this.targetFPS = targetFPS;
		this.measuredFPS = targetFPS;
		this._lastTime = performance.now();
		this._deltaTime = 1 / targetFPS;
		this._time = this._lastTime;
	}

	async start() {
		while (true) {
			this._time = performance.now();
			requestAnimationFrame(() => {
				for (const cb of this.callbacks) cb(this.deltaTime);
			});
			const dt = this._time - this._lastTime;
			let deltaDiff = dt - (1000 / this.targetFPS);
			this._lastTime = this._time + Math.max(deltaDiff, 0);
			await delay(Math.max(0, deltaDiff));
			this._deltaTime = Math.min(dt + Math.max(deltaDiff, 0), 1000 / this.targetFPS * 3);
			this.measuredFPS = (1 / this.deltaTime) * 0.1 + this.measuredFPS * 0.9;
		}
	}

	add(callback: (dt: number) => void) { this.callbacks.push(callback); }
}

// ─── Animation ───────────────────────────────────────────────────────────────

export function slideUp(target: HTMLElement, duration: number = 500) {
	if (target.style.display === "none") return;
	target.style.transitionProperty = "height, margin, padding";
	target.style.transitionTimingFunction = "ease-in-out";
	target.style.transitionDuration = duration + "ms";
	target.style.boxSizing = "border-box";
	target.style.height = target.offsetHeight + "px";
	target.offsetHeight; // force reflow
	target.style.overflow = "hidden";
	target.style.height = "0";
	target.style.paddingTop = "0";
	target.style.paddingBottom = "0";
	target.style.marginTop = "0";
	target.style.marginBottom = "0";
	setTimeout(() => {
		target.style.display = "none";
		target.style.removeProperty("height");
		target.style.removeProperty("padding-top");
		target.style.removeProperty("padding-bottom");
		target.style.removeProperty("margin-top");
		target.style.removeProperty("margin-bottom");
		target.style.removeProperty("overflow");
		target.style.removeProperty("transition-duration");
		target.style.removeProperty("transition-property");
	}, duration);
}

export function slideDown(target: HTMLElement, duration: number = 500) {
	if (window.getComputedStyle(target).display !== "none") return;
	target.style.removeProperty("display");
	let display = window.getComputedStyle(target).display;
	if (display === "none") display = "block";
	target.style.display = display;
	const height = target.offsetHeight;
	target.style.overflow = "hidden";
	target.style.height = "0";
	target.style.paddingTop = "0";
	target.style.paddingBottom = "0";
	target.style.marginTop = "0";
	target.style.marginBottom = "0";
	target.offsetHeight; // force reflow
	target.style.boxSizing = "border-box";
	target.style.transitionProperty = "height, margin, padding";
	target.style.transitionTimingFunction = "ease-in-out";
	target.style.transitionDuration = duration + "ms";
	target.style.height = height + "px";
	target.style.removeProperty("padding-top");
	target.style.removeProperty("padding-bottom");
	target.style.removeProperty("margin-top");
	target.style.removeProperty("margin-bottom");
	setTimeout(() => {
		target.style.removeProperty("height");
		target.style.removeProperty("overflow");
		target.style.removeProperty("transition-duration");
		target.style.removeProperty("transition-property");
	}, duration);
}

export function slideToggle(target: HTMLElement, duration: number = 500) {
	if (window.getComputedStyle(target).display === "none") slideDown(target, duration);
	else slideUp(target, duration);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function getTouchPosition(event: TouchEvent) {
	const touches = Array.from(event.touches);
	const x = touches.reduce((a, c) => a + c.clientX, 0) / touches.length;
	const y = touches.reduce((a, c) => a + c.clientY, 0) / touches.length;
	return new Vector2(x, y);
}

export function getPointerPosition(event: MouseEvent) {
	return new Vector2(event.clientX, event.clientY);
}

// ─── Math ────────────────────────────────────────────────────────────────────

export function inOutQuadBlend(start: number, end: number, t: number): number {
	t /= 2;
	let t2 = 2.0 * t * (1.0 - t) + 0.5;
	t2 -= 0.5;
	t2 *= 2.0;
	return start + (end - start) * t2;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

export function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

export function lerpv(start: Vector2, end: Vector2, t: number): Vector2 {
	return new Vector2(lerp(start.x, end.x, t), lerp(start.y, end.y, t));
}

export function mapRange(value: number, low1: number, high1: number, low2: number, high2: number) {
	return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

export function mapRangeClamped(value: number, low1: number, high1: number, low2: number, high2: number) {
	return clamp(mapRange(value, low1, high1, low2, high2), low2, high2);
}
