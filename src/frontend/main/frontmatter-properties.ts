import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";

interface FrontmatterPropertiesDependencies {
	properties: {[key: string]: any};
}

export class FrontmatterProperties extends DynamicInsertedFeature<
	InsertedFeatureOptions,
	FrontmatterPropertiesDependencies
> {
	constructor(properties: {[key: string]: any}) {
		super(ObsidianSite.metadata.featureOptions.frontmatterProperties, { properties });
	}

	protected generateContent(container: HTMLElement) {
		const deps = this.getDependencies();
		
		// Create a container for properties with compact design similar to tags
		const propertiesContainer = document.createElement("div");
		propertiesContainer.classList.add("frontmatter-properties-container");
		container.appendChild(propertiesContainer);
		
		if (!deps.properties || Object.keys(deps.properties).length === 0) {
			const emptyMessage = document.createElement("div");
			emptyMessage.classList.add("frontmatter-properties-empty");
			emptyMessage.textContent = "No properties";
			propertiesContainer.appendChild(emptyMessage);
			return;
		}
		
		// Display properties as compact items, similar to tags design
		for (const [key, value] of Object.entries(deps.properties)) {
			const propertyItem = document.createElement("div");
			propertyItem.classList.add("frontmatter-property");
			
			const keyElement = document.createElement("span");
			keyElement.classList.add("frontmatter-property-key");
			keyElement.textContent = key + ":";
			propertyItem.appendChild(keyElement);
			
			const valueElement = document.createElement("div");
			valueElement.classList.add("frontmatter-property-value");
			
			// Handle different value types with link support
			if (value === null || value === undefined) {
				valueElement.classList.add("frontmatter-property-null");
				valueElement.textContent = "null";
			} else if (typeof value === 'object') {
				valueElement.classList.add("frontmatter-property-object");
				valueElement.textContent = JSON.stringify(value, null, 2);
			} else if (Array.isArray(value)) {
				valueElement.classList.add("frontmatter-property-array");
				valueElement.textContent = JSON.stringify(value, null, 2);
			} else if (typeof value === 'string' && value.startsWith('http')) {
				// Make URLs clickable links
				valueElement.classList.add("frontmatter-property-link");
				const linkEl = document.createElement("a");
				linkEl.href = value;
				linkEl.textContent = value;
				linkEl.target = "_blank";
				valueElement.appendChild(linkEl);
			} else {
				valueElement.classList.add("frontmatter-property-primitive");
				valueElement.textContent = String(value);
			}
			
			propertyItem.appendChild(valueElement);
			propertiesContainer.appendChild(propertyItem);
		}
	}

	protected onAfterMount(): void {
		// Add CSS styles for compact frontmatter properties, closer to tags design
		if (!document.getElementById('frontmatter-properties-styles')) {
			const style = document.createElement('style');
			style.id = 'frontmatter-properties-styles';
			style.textContent = `
				/* Compact Frontmatter Properties Container - similar to tags */
				.frontmatter-properties-container {
					padding: 0.25em 0;
					margin: 0.25em 0;
					border-radius: 4px;
				}
				
				/* Compact Property Items - horizontal layout like tags */
				.frontmatter-property {
					display: inline-flex;
					align-items: center;
					gap: 0.5em;
					padding: 0.2em 0.4em;
					margin: 0.1em 0.2em;
					background-color: var(--background-secondary);
					border-radius: 12px;
					border: 1px solid var(--background-modifier-border);
					font-size: 0.85em;
					line-height: 1.3;
					max-width: fit-content;
				}
				
				/* Property Key - compact like tag styling */
				.frontmatter-property-key {
					color: var(--text-normal);
					font-weight: 500;
					font-size: 0.8em;
					opacity: 0.9;
					background-color: var(--interactive-accent);
					padding: 0.2em 0.4em;
					border-radius: 8px;
					font-weight: 600;
					text-transform: lowercase;
				}
				
				/* Property Value - compact like tag styling */
				.frontmatter-property-value {
					color: var(--text-normal);
					font-size: 0.85em;
					line-height: 1.3;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					background-color: var(--background-primary);
					padding: 0.2em 0.4em;
					border-radius: 8px;
					border: 1px solid var(--background-modifier-border);
					min-width: 0;
					flex: 1;
				}
				
				/* Link values - clickable */
				.frontmatter-property-link {
					color: var(--link-color);
					text-decoration: none;
					transition: color 0.2s ease;
				}
				
				.frontmatter-property-link:hover {
					color: var(--link-color-hover);
					text-decoration: underline;
				}
				
				/* Special value types - compact styling */
				.frontmatter-property-null {
					font-style: italic;
					opacity: 0.6;
					color: var(--text-muted);
				}
				
				.frontmatter-property-object,
				.frontmatter-property-array {
					font-family: var(--font-monospace);
					font-size: 0.8em;
					background-color: var(--background-primary);
					border: 1px solid var(--text-muted);
					padding: 0.2em 0.4em;
					white-space: pre-wrap;
					word-break: break-all;
					border-radius: 8px;
				}
				
				/* Empty state */
				.frontmatter-properties-empty {
					text-align: center;
					padding: 0.5em;
					font-style: italic;
					color: var(--text-muted);
					opacity: 0.7;
					font-size: 0.8em;
				}
				
				/* Responsive adjustments */
				@media (max-width: 768px) {
					.frontmatter-properties-container {
						margin: 0.2em 0;
						padding: 0.2em 0;
					}
					
					.frontmatter-property {
						padding: 0.15em 0.3em;
						margin: 0.05em 0.15em;
						font-size: 0.8em;
						gap: 0.4em;
					}
					
					.frontmatter-property-key {
						font-size: 0.75em;
						padding: 0.15em 0.3em;
					}
					
					.frontmatter-property-value {
						font-size: 0.8em;
						padding: 0.15em 0.3em;
					}
				}
			`;
			document.head.appendChild(style);
		}
	}

	public destroy(): void {
		super.destroy();
		
		// Clean up dynamically added styles if no other frontmatter properties exist
		if (document.querySelectorAll('.frontmatter-properties-container').length === 0) {
			const styleEl = document.getElementById('frontmatter-properties-styles');
			if (styleEl) {
				styleEl.remove();
			}
		}
	}
}