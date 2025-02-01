import { InsertedFeatureOptions } from "./features/feature-options-base";
import { InsertedFeature } from "./inserted-feature";

export abstract class DynamicInsertedFeature<
	TOptions extends InsertedFeatureOptions,
	TDependencies extends object = {}
> extends InsertedFeature<TOptions> {
	private dependencies: TDependencies;

	constructor(
		options: TOptions,
		dependencies: TDependencies,
		existingElement?: HTMLElement
	) {
		super(options, existingElement);
		this.dependencies = dependencies;
		this.updateContent(); // Initial content generation
	}

	/**
	 * Manually regenerate the feature content.
	 * Call this method whenever the dependencies have changed and the feature needs to update.
	 */
	public regenerate(): void {
		this.updateContent();
	}

	/**
	 * Update the dependencies object and optionally regenerate the content
	 * @param newDependencies The new dependencies object
	 * @param autoRegenerate Whether to automatically regenerate the content (defaults to true)
	 */
	public updateDependencies(
		newDependencies: TDependencies,
		autoRegenerate: boolean = true
	): void {
		this.dependencies = newDependencies;
		if (autoRegenerate) {
			this.regenerate();
		}
	}

	/**
	 * Modify dependencies using a lambda function and optionally regenerate the content
	 * @param modifier Function that takes current dependencies and returns modified dependencies
	 * @param autoRegenerate Whether to automatically regenerate the content (defaults to true)
	 */
	public modifyDependencies(
		modifier: (deps: TDependencies) => void,
		autoRegenerate: boolean = true
	): void {
		modifier(this.dependencies);
		if (autoRegenerate) {
			this.regenerate();
		}
	}

	/**
	 * Get the current dependencies
	 */
	protected getDependencies(): TDependencies {
		return this.dependencies;
	}

	/**
	 * Update the feature's content
	 */
	protected updateContent(): void {
		const contentEl = this.getElement(InsertedFeature.CONTENT_KEY);
		if (!contentEl) return;

		// Clear existing content
		while (contentEl.firstChild) {
			contentEl.removeChild(contentEl.firstChild);
		}
		
		// check if feature exists in the document, and if not reinsert it
		const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);
		if (!featureEl?.isConnected && featureEl) {
			this.options.insertFeature(document.body, featureEl);
		}

		this.generateContent(contentEl);
	}

	/**
	 * Generate the feature content - must be implemented by subclasses
	 */
	protected abstract generateContent(container: HTMLElement): void;

	public hide(): void {
		const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);
		if (featureEl) {
			featureEl.style.display = "none";
		}
	}

	public show(): void {
		const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);
		if (featureEl) {
			featureEl.style.display = "";
		}
	}
}
