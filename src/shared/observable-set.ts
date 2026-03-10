

export class ObservableSet<T> {
	private set: Set<T>;
	private listeners = new Set<() => void>();

	constructor(initial?: Iterable<T>) {
		this.set = new Set(initial);
	}

	has(value: T): boolean {
		return this.set.has(value);
	}

	add(value: T) {
		if (this.set.has(value)) return;
		this.set.add(value);
		this.notify();
	}

	delete(value: T) {
		if (!this.set.has(value)) return;
		this.set.delete(value);
		this.notify();
	}

	toggle(value: T) {
		if (this.set.has(value)) this.set.delete(value);
		else this.set.add(value);
		this.notify();
	}

	clear() {
		if (this.set.size === 0) return;
		this.set.clear();
		this.notify();
	}

	replaceAll(values: Iterable<T>) {
		this.set = new Set(values);
		this.notify();
	}

	get size(): number {
		return this.set.size;
	}

	values(): IterableIterator<T> {
		return this.set.values();
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this.set[Symbol.iterator]();
	}

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notify() {
		for (const fn of this.listeners) fn();
	}
}
