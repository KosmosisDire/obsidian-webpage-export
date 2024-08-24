import { FeatureOptions } from "src/shared/features/feature-options-base";

export interface FeatureGenerator
{
	generate(container?: HTMLElement, featureOptions?: FeatureOptions): Promise<HTMLElement>;
}
