import {
	InsertedFeatureOptions,
	InsertedFeatureOptionsWithTitle,
} from "./features/feature-options-base";

interface ElementDefinition {
	type: string;
	className?: string | string[];
	id?: string;
	attributes?: Record<string, string>;
}

export class InsertedFeature<TOptions extends InsertedFeatureOptions> {
	protected _options: TOptions;
	protected elements: Map<string, HTMLElement> = new Map();

	// Standard element keys
	protected static readonly FEATURE_KEY = "feature";
	protected static readonly HEADER_KEY = "header";
	protected static readonly CONTENT_KEY = "content";
	protected static readonly TITLE_KEY = "title";

	constructor(options: TOptions, existingElement?: HTMLElement) {
		this._options = options;

		if (existingElement) {
			this.replaceFeature(existingElement);
		} else {
			this.setupFeatureContainer();
		}

		this.options.insertFeature(
			document.body,
			this.getElement(InsertedFeature.FEATURE_KEY)!
		);
		this.onAfterMount();
	}

	protected getElementDefinitions(): Record<string, ElementDefinition> {
		return {
			[InsertedFeature.FEATURE_KEY]: {
				type: "div",
				className: ["feature", "hide"],
				id: this.options.featureId,
			},
			[InsertedFeature.HEADER_KEY]: {
				type: "div",
				className: "feature-header",
			},
			[InsertedFeature.CONTENT_KEY]: {
				type: "div",
				className: `${this.options.featureId}-content`,
			},
			[InsertedFeature.TITLE_KEY]: {
				type: "div",
				className: "feature-title",
			},
		};
	}

	protected getElementHierarchy(): Record<string, string | null> {
		return {
			[InsertedFeature.FEATURE_KEY]: null, // root
			[InsertedFeature.HEADER_KEY]: InsertedFeature.FEATURE_KEY,
			[InsertedFeature.TITLE_KEY]: InsertedFeature.HEADER_KEY,
			[InsertedFeature.CONTENT_KEY]: InsertedFeature.FEATURE_KEY,
		};
	}

	protected createElement(definition: ElementDefinition): HTMLElement {
		const element = document.createElement(definition.type);

		if (definition.className) {
			const classes = Array.isArray(definition.className)
				? definition.className
				: [definition.className];
			element.classList.add(...classes);
		}

		if (definition.id) {
			element.id = definition.id;
		}

		if (definition.attributes) {
			Object.entries(definition.attributes).forEach(([key, value]) => {
				element.setAttribute(key, value);
			});
		}

		return element;
	}

	protected getElement(key: string): HTMLElement | undefined {
		return this.elements.get(key);
	}

	protected setupFeatureContainer(): void {
		const definitions = this.getElementDefinitions();
		const hierarchy = this.getElementHierarchy();

		// Create all elements first
		Object.entries(definitions).forEach(([key, def]) => {
			this.elements.set(key, this.createElement(def));
		});

		// Build hierarchy
		Object.entries(hierarchy).forEach(([key, parentKey]) => {
			if (parentKey === null) return; // Skip root

			const element = this.elements.get(key);
			const parent = this.elements.get(parentKey);

			if (element && parent) {
				parent.appendChild(element);
			}
		});

		// Handle title if needed
		if (
			this._options instanceof InsertedFeatureOptionsWithTitle &&
			this._options.displayTitle?.length > 0
		) {
			const titleEl = this.getElement(InsertedFeature.TITLE_KEY);
			if (titleEl) {
				titleEl.innerText = this._options.displayTitle;
			}
		}

		// Show after small delay
		setTimeout(() => {
			const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);
			featureEl?.classList.remove("hide");
		}, 0);
	}

	protected replaceFeature(existingElement: HTMLElement): void {
		this.destroy();

		const definitions = this.getElementDefinitions();
		const hierarchy = this.getElementHierarchy();

		// Store root element
		this.elements.set(InsertedFeature.FEATURE_KEY, existingElement);

		// Find or create other elements
		Object.entries(definitions).forEach(([key, def]) => {
			if (key === InsertedFeature.FEATURE_KEY) return; // Skip root

			let element = existingElement.querySelector(
				`.${
					Array.isArray(def.className)
						? def.className[0]
						: def.className
				}`
			);

			if (!element) {
				element = this.createElement(def);
				const parentKey = hierarchy[key];
				if (parentKey) {
					const parent = this.elements.get(parentKey);
					parent?.appendChild(element);
				}
			}

			this.elements.set(key, element as HTMLElement);
		});
	}

	protected onAfterMount(): void {}

	public get options(): TOptions {
		return this._options;
	}

	public destroy(): void {
		this.elements.forEach((element) => {
			if (element.parentNode) {
				element.parentNode.removeChild(element);
			}
		});
		this.elements.clear();
	}
}
