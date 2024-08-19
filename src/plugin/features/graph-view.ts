import { FeatureGenerator } from "./feature-generator";



export class GraphView implements FeatureGenerator
{
	public async generate(container?: HTMLElement): Promise<HTMLElement>
	{
		container = container ?? document.body;
		const graphWrapper = container.createDiv();
		graphWrapper.classList.add("graph-view-wrapper");

		const graphHeader = graphWrapper.createDiv("feature-header");
		const graphTitle = graphHeader.createDiv("feature-title");
		graphTitle.innerText = "Interactive Graph";

		const graphEl = graphWrapper.createDiv("graph-view-placeholder");
		const expandSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`;
		const globalSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-git-fork"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>`;
		graphEl.innerHTML = 
		`
		<div class="graph-view-container">
			<div class="graph-icon graph-expand" role="button" aria-label="Expand" data-tooltip-position="top">${expandSVG}</div>
			<div class="graph-icon graph-global" role="button" aria-label="Global Graph" data-tooltip-position="top">${globalSVG}</div>
			<canvas id="graph-canvas" class="hide" width="512px" height="512px"></canvas>
		</div>
		`
		return graphWrapper;
	}
}
