import { FeatureRelation, InsertedFeatureOptions } from "./features/feature-options-base";
import { InsertedFeature } from "./inserted-feature";

export class DynamicInsertedFeature<
	TOptions extends InsertedFeatureOptions,
	TDependencies extends object = {}
> extends InsertedFeature<TOptions> {
	private dependencies: TDependencies;
	private proxyHandler: ProxyHandler<TDependencies>;
	private dependencyProxy: TDependencies;
	private lastDependencyValues: Map<string, any> = new Map();
	private dependencyPaths: Set<string> = new Set();
	private isDestroyed: boolean = false;

	constructor(options: TOptions, dependencies: TDependencies) {
		super(options);
		this.dependencies = dependencies;

		// Setup proxy handler for dependency tracking
		this.proxyHandler = this.createProxyHandler();
		this.dependencyProxy = new Proxy(this.dependencies, this.proxyHandler);

		this.setupDependencyTracking();
	}

	private createProxyHandler(): ProxyHandler<TDependencies> {
		const handler: ProxyHandler<TDependencies> = {
			get: (target: any, prop: string | symbol) => {
				const value = target[prop];

				// Track accessed path
				this.dependencyPaths.add(String(prop));

				// If the value is an object, return a new proxy for it
				if (value && typeof value === "object") {
					return new Proxy(value, {
						get: (obj: any, nested: string | symbol) => {
							const nestedValue = obj[nested];
							this.dependencyPaths.add(
								`${String(prop)}.${String(nested)}`
							);
							return nestedValue;
						},
					});
				}

				return value;
			},
		};

		return handler;
	}

	private setupDependencyTracking() {
		// Initial value capture
		this.captureValues();

		const checkForChanges = () => {
			if (this.isDestroyed) return;

			if (this.hasValuesChanged()) {
				this.updateContent();
				this.captureValues();
			}
		};

		// Start periodic checks
		const intervalId = setInterval(checkForChanges, 100);

		// Clear interval on destroy
		const originalDestroy = this.destroy.bind(this);
		this.destroy = () => {
			this.isDestroyed = true;
			clearInterval(intervalId);
			originalDestroy();
		};
	}

	private captureValues() {
		this.lastDependencyValues.clear();
		this.dependencyPaths.forEach((path) => {
			const value = this.getValueByPath(this.dependencies, path);
			this.lastDependencyValues.set(path, this.cloneValue(value));
		});
	}

	private cloneValue(value: any): any {
		if (Array.isArray(value)) {
			return [...value];
		}
		if (typeof value === "object" && value !== null) {
			return { ...value };
		}
		return value;
	}

	private hasValuesChanged(): boolean {
		return Array.from(this.dependencyPaths).some((path) => {
			const currentValue = this.getValueByPath(this.dependencies, path);
			const lastValue = this.lastDependencyValues.get(path);
			return !this.areValuesEqual(currentValue, lastValue);
		});
	}

	private areValuesEqual(a: any, b: any): boolean {
		if (Array.isArray(a) && Array.isArray(b)) {
			return (
				a.length === b.length &&
				a.every((val, idx) => this.areValuesEqual(val, b[idx]))
			);
		}
		if (
			typeof a === "object" &&
			a !== null &&
			typeof b === "object" &&
			b !== null
		) {
			const keysA = Object.keys(a);
			const keysB = Object.keys(b);
			return (
				keysA.length === keysB.length &&
				keysA.every((key) => this.areValuesEqual(a[key], b[key]))
			);
		}
		return a === b;
	}

	private getValueByPath(obj: any, path: string): any {
		return path
			.split(".")
			.reduce(
				(curr, key) =>
					curr && typeof curr === "object" ? curr[key] : undefined,
				obj
			);
	}

	protected generateContent(): HTMLElement | string {
		// Access dependencies through proxy to track usage
		return this.generateFeatureContent();
	}

	protected generateFeatureContent(): HTMLElement | string {
		// Override this method in subclasses
		return document.createElement("div");
	}

	protected getDependencies(): TDependencies {
		return this.dependencyProxy;
	}
}
