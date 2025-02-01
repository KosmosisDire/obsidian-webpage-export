import { inOutQuadBlend, Ticker, Vector2, getPointerPosition, getTouchPositionVector, getTouchPosition } from "src/frontend/main/utils";
import { GraphWASMHelper } from "src/frontend/graph-view/graph-wasm-helper";
import { GraphRenderWorker } from "../graph-view/graph-worker-helper";
import { LinkHandler } from "./links";
import { GraphViewOptions } from "src/shared/features/graph-view";
import { InsertedFeature } from "src/shared/inserted-feature";

export class GraphView extends InsertedFeature<GraphViewOptions>
{
	public set options(value: GraphViewOptions)
	{
		this._options = value;
		if (!this.graphSim) return;
		this.graphSim.attractionForce = value.attractionForce;
		this.graphSim.centralForce = value.centralForce;
		this.graphSim.linkLength = value.linkLength;
		this.graphSim.repulsionForce = value.repulsionForce / this.batchFraction;
	}

	public get options(): GraphViewOptions
	{
		return this._options as GraphViewOptions;
	}

	public set attractionForce(value: number)
	{
		if (value == this.options.attractionForce) return;
		this.options.attractionForce = value;
		if (this.graphSim) 
		{
			this.graphSim.attractionForce = value;
			this.graphSim.settleness = 1;
		}
	}

	public get attractionForce(): number
	{
		return this.options.attractionForce;
	}

	public set centralForce(value: number)
	{
		if (value == this.options.centralForce) return;
		this.options.centralForce = value;
		if (this.graphSim) 
			{
			this.graphSim.centralForce = value;
			this.graphSim.settleness = 1;
		}
	}

	public get centralForce(): number
	{
		return this.options.centralForce;
	}

	public set linkLength(value: number)
	{
		if (value == this.options.linkLength) return;
		this.options.linkLength = value;
		if (this.graphSim)
		{
			this.graphSim.linkLength = value;
			this.graphSim.settleness = 1;
		}
	}

	public get linkLength(): number
	{
		return this.options.linkLength;
	}

	public set repulsionForce(value: number)
	{
		if (value == this.options.repulsionForce) return;
		this.options.repulsionForce = value;
		if (this.graphSim)
		{
			this.graphSim.repulsionForce = value / this.batchFraction;
			this.graphSim.settleness = 1;
		}
	}

	public get repulsionForce(): number
	{
		return this.options.repulsionForce;
	}



	// node data
	public nodeCount: number;
	public linkCount: number;
	public radii: number[];
	public labels: string[];
	public paths: string[];
	public colors: string[];
	public linkSources: number[];
	public linkTargets: number[];
	public linkCounts: number[];

	public batchFraction: number = 1; // how much of the graph to update per frame
	public graphExpanded: boolean = false;

	public ticker: Ticker;
	public graphRenderer: GraphRenderWorker;
	public graphSim: GraphWASMHelper;
	public graphContainer: HTMLElement;
	public globalGraphButton: HTMLElement;
	public expandGraphButton: HTMLElement;


	private _paused: boolean = false;
	public get paused(): boolean
	{
		return this._paused;
	}
	public set paused(value: boolean)
	{
		this._paused = value;
	}

	private _isGlobalGraph: boolean = false;
	public get isGlobalGraph(): boolean
	{
		return this._isGlobalGraph;
	}
	private set isGlobalGraph(value: boolean)
	{
		this._isGlobalGraph = value;
	}

	private eventsInitialized: boolean = false;
	private updateRunning: boolean = false;

	private mouseWorldPos = new Vector2(0, 0);
	private scrollVelocity = 0;

	constructor(featureEl: HTMLElement)
	{
		super(ObsidianSite.metadata.featureOptions.graphView, featureEl);
		this.graphSim = new GraphWASMHelper();
		this.graphContainer = document.querySelector(".graph-view-container") as HTMLElement;
		this.globalGraphButton = document.querySelector(".graph-global.graph-icon") as HTMLElement;
		this.expandGraphButton = document.querySelector(".graph-expand.graph-icon") as HTMLElement;
		
		this.ticker = new Ticker(60);
		this.ticker.add(this.update.bind(this));
		this.ticker.start();

		requestAnimationFrame(this.draw.bind(this));
	}

	private initEvents()
	{
		const localThis = this;

		function getMousePositionOnCanvas(event: MouseEvent)
		{
			const rect = localThis.graphRenderer.canvas.getBoundingClientRect();
			const pos = getPointerPosition(event);
			return new Vector2(pos.x - rect.left, pos.y - rect.top);
		}

		function getTouchPositionOnCanvas(event: TouchEvent)
		{
			const rect = localThis.graphRenderer.canvas.getBoundingClientRect();
			const pos = getTouchPosition(event);
			return new Vector2(pos.x - rect.left, pos.y - rect.top);
		}

		let pointerPos = new Vector2(0, 0);
		let lastPointerPos = new Vector2(0, 0);
		let pointerDelta = new Vector2(0, 0);
		let dragDisplacement = new Vector2(0, 0);
		let startDragTime = 0;
		let pointerDown = false;
		let middleDown = false;
		let startPointerPos = new Vector2(0, 0);
		let firstPointerDownId = -1;
		let pointerInside = false;
		const graphContainer = this.graphContainer;
		const graphRenderer = this.graphRenderer;
		
		function handlePointerEnter(enter: PointerEvent)
		{
			let lastDistance = 0;
			let startZoom = false;

			function handleMouseMove(move: MouseEvent)
			{
				pointerPos = getMousePositionOnCanvas(move);
				localThis.mouseWorldPos = graphRenderer.vecToWorldspace(pointerPos);
				pointerDelta = new Vector2(pointerPos.x - lastPointerPos.x, pointerPos.y - lastPointerPos.y);
				lastPointerPos = pointerPos;

				if (graphRenderer.grabbedNode != -1) dragDisplacement = new Vector2(pointerPos.x - startPointerPos.x, pointerPos.y - startPointerPos.y);

				if (pointerDown && graphRenderer.hoveredNode != -1 && graphRenderer.grabbedNode == -1 && graphRenderer.hoveredNode != graphRenderer.grabbedNode)
				{
					graphRenderer.grabbedNode = graphRenderer.hoveredNode;
				}

				if ((pointerDown && graphRenderer.hoveredNode == -1 && graphRenderer.grabbedNode == -1) || middleDown)
				{
					graphRenderer.cameraOffset = new Vector2(graphRenderer.cameraOffset.x + pointerDelta.x, graphRenderer.cameraOffset.y + pointerDelta.y);
				}
				else
				{
					if (graphRenderer.hoveredNode != -1) graphRenderer.canvas.style.cursor = "pointer";
					else graphRenderer.canvas.style.cursor = "default";
				}
			}

			function handleTouchMove(move: TouchEvent)
			{
				if (move.touches?.length == 1) 
				{
					if(startZoom)
					{
						lastPointerPos = getTouchPositionOnCanvas(move);
						startZoom = false;
					}

					handleMouseMove(move as unknown as MouseEvent);
					return;
				}

				// pinch zoom
				if (move.touches?.length == 2)
				{
					const touch1 = getTouchPositionVector(move.touches[0]);
					const touch2 = getTouchPositionVector(move.touches[1]);

					pointerPos = getTouchPositionOnCanvas(move);
					pointerDelta = new Vector2(pointerPos.x - lastPointerPos.x, pointerPos.y - lastPointerPos.y);
					lastPointerPos = pointerPos;

					const distance = Math.sqrt(Math.pow(touch1.x - touch2.x, 2) + Math.pow(touch1.y - touch2.y, 2));

					if (!startZoom)
					{
						startZoom = true;
						lastDistance = distance;
						pointerDelta = new Vector2(0, 0);
						localThis.mouseWorldPos = Vector2.Undefined;
						graphRenderer.grabbedNode = -1;
						graphRenderer.hoveredNode = -1;
					}

					const distanceDelta = distance - lastDistance;
					const scaleDelta = distanceDelta / lastDistance;

					localThis.scaleAround(graphRenderer.vecToWorldspace(pointerPos), 1 + scaleDelta, 0.15, 15.0);
					graphRenderer.cameraOffset = new Vector2(graphRenderer.cameraOffset.x + pointerDelta.x, graphRenderer.cameraOffset.y + pointerDelta.y);

					lastDistance = distance;
				}
			}

			function handlePointerUp(up: PointerEvent)
			{
				document.removeEventListener("pointerup", handlePointerUp);

				const pointerUpTime = Date.now();

				setTimeout(() => 
				{
					if (pointerDown && graphRenderer.hoveredNode != -1 && Math.abs(dragDisplacement.x) <= 4 && Math.abs(dragDisplacement.y) <= 4 && pointerUpTime - startDragTime < 300)
					{
						localThis.navigateToNode(graphRenderer.hoveredNode);
					}

					if (pointerDown && graphRenderer.grabbedNode != -1)
					{
						graphRenderer.grabbedNode = -1;
					}

					if (up.button == 0) pointerDown = false;
					if (up.pointerType == "touch" && firstPointerDownId == up.pointerId) 
					{
						firstPointerDownId = -1;
						pointerDown = false;
					}
					if (up.button == 1) middleDown = false;
					if (!pointerInside) 
					{
						document.removeEventListener("mousemove", handleMouseMove);
						document.removeEventListener("touchmove", handleTouchMove);
					}
				}, 0);
			}

			function handlePointerDown(down: PointerEvent)
			{
				document.addEventListener("pointerup", handlePointerUp);
				localThis.mouseWorldPos = graphRenderer.vecToWorldspace(pointerPos);
				dragDisplacement = new Vector2(0, 0);
				if (down.button == 0) pointerDown = true;
				if (down.pointerType == "touch" && firstPointerDownId == -1) 
				{
					firstPointerDownId = down.pointerId;
					pointerDown = true;
				}
				if (down.button == 1) middleDown = true;

				startPointerPos = pointerPos;
				startDragTime = Date.now();

				// if (pointerDown && graphRenderer.hoveredNode != -1)
				// {
				// 	graphRenderer.grabbedNode = graphRenderer.hoveredNode;
				// }
			}

			function handlePointerLeave(leave: PointerEvent)
			{
				setTimeout(() => 
				{
					pointerInside = false;
					if (!pointerDown) 
					{
						document.removeEventListener("mousemove", handleMouseMove);
						document.removeEventListener("touchmove", handleTouchMove);
						localThis.mouseWorldPos = Vector2.Undefined;
					}
					graphContainer.removeEventListener("pointerdown", handlePointerDown);
					graphContainer.removeEventListener("pointerleave", handlePointerLeave);
				}, 1);
			}

			pointerPos = getMousePositionOnCanvas(enter);
			localThis.mouseWorldPos = graphRenderer.vecToWorldspace(pointerPos);
			lastPointerPos = getMousePositionOnCanvas(enter);
			pointerInside = true;

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("touchmove", handleTouchMove);
			graphContainer.addEventListener("pointerdown", handlePointerDown);
			graphContainer.addEventListener("pointerleave", handlePointerLeave);
		}

		this.graphRenderer.canvas.addEventListener("pointerenter", handlePointerEnter);

		this.expandGraphButton?.addEventListener("click", event =>
		{
			event.stopPropagation();
			localThis.toggleExpandedGraph();
		});

		this.globalGraphButton?.addEventListener("click", event =>
		{
			event.stopPropagation();
			
			if (!localThis.isGlobalGraph)
			{
				localThis.showGraph();
			}
			else
			{
				localThis.showGraph([ObsidianSite.document.pathname]);
			}
		});
	
		graphContainer.addEventListener("wheel", function(e) 
		{
			const startingScrollVelocity = 0.065;
			const delta = e.deltaY;
			if (delta > 0)
			{
				if(localThis.scrollVelocity >= -startingScrollVelocity)
				{
					localThis.scrollVelocity = -startingScrollVelocity;
				}
				localThis.scrollVelocity *= 1.16;
			}
			else
			{
				if(localThis.scrollVelocity <= startingScrollVelocity)
				{
					localThis.scrollVelocity = startingScrollVelocity;
				}
				localThis.scrollVelocity *= 1.16;
			}
		});
	
		// recenter the graph on double click
		graphContainer.addEventListener("dblclick", function(e)
		{
			localThis.fitToNodes();
		});
	
		document.querySelector(".theme-toggle-input")?.addEventListener("change", event =>
		{
			setTimeout(() => graphRenderer.resampleColors(), 0);
		});
	}

	private async generate(paths: string[])
	{
		this.paths = paths;
		this.nodeCount = this.paths.length;
		this.linkSources = [];
		this.linkTargets = [];
		this.labels = [];
		this.radii = [];
		this.colors = [];

		const linkCounts: number[] = [];

		for (let i = 0; i < this.nodeCount; i++)
		{
			linkCounts.push(0);
		}

		let pathIndex = 0;
		for (const source of this.paths)
		{
			const fileInfo = ObsidianSite.getWebpageData(source);
			if (!fileInfo) continue;

			this.labels.push(fileInfo.title);
			
			const links = fileInfo.links.map(l => LinkHandler.getPathnameFromURL(l)).concat(fileInfo.attachments).concat(fileInfo.backlinks);
			let uniqueLinks = [...new Set(links)];
			uniqueLinks.push(source);
			for (const link of uniqueLinks)
			{
				const targetIndex = this.paths.indexOf(link);
				if (targetIndex != -1)
				{
					this.linkSources.push(targetIndex);
					this.linkTargets.push(pathIndex);
					linkCounts[pathIndex]++;
					linkCounts[targetIndex]++;
				}
			}
			
			pathIndex++;
		}

		const maxLinks = Math.max(...linkCounts);
		this.radii = linkCounts.map(l => inOutQuadBlend(this.options.minNodeRadius, this.options.maxNodeRadius, Math.min(l / (maxLinks * 0.8), 1.0)));
		this.linkCount = this.linkSources.length;
	}

	public async showGraph(paths?: string[])
	{
		this.paused = true;

		let linked: string[] = [];
		if (paths)
		{
			for (const element of paths)
			{
				const fileInfo = ObsidianSite.getWebpageData(element);
				if (fileInfo?.backlinks)
					linked.push(...fileInfo.backlinks);
				if (fileInfo?.links)
					linked.push(...fileInfo.links.map(l => LinkHandler.getPathnameFromURL(l)));
				if (fileInfo?.attachments)
					linked.push(...fileInfo.attachments);
			}

			linked.push(...paths);
		}
		else
		{
			linked = ObsidianSite.metadata.allFiles;
		}

		if (linked.length == ObsidianSite.metadata.allFiles.length)
			this.isGlobalGraph = true;
		else
			this.isGlobalGraph = false;

		linked = linked.filter((l) => 
		{
			let data = ObsidianSite.getWebpageData(l);
			if (!data?.backlinks || !data?.links || !data?.type) return false;
			
			if (data.backlinks.length == 0)
			{
				console.log("No backlinks for", l);
			}
				
			if (!this.options.showOrphanNodes && data.backlinks.length == 0 && data.links.length == 0)
				return false;

			if (!this.options.showAttachments && (data.type == "attachment" || data.type == "media" || data.type == "other"))
				return false;

			return true;
		});

		if (linked.length == 0)
		{
			console.log("No nodes to display.");
			return;
		}

		// remove duplicates
		const uniquePaths = [...new Set(linked)];
		const newPositions: number[] = new Array(uniquePaths.length * 2).fill(0);

		// get old positions for these new nodes
		if (this.paths?.length > 0)
		{
			const oldPositions = this.graphSim.positionsF;
			for (let i = 0; i < uniquePaths.length; i++)
			{
				const path = uniquePaths[i];
				const index = this.paths.indexOf(path);
				if (index == -1) continue;
				newPositions[i * 2] = oldPositions[index * 2];
				newPositions[i * 2 + 1] = oldPositions[index * 2 + 1];
			}
		}

		await this.generate(uniquePaths);
		this.graphSim.init(this, newPositions);
	    if (!this.graphRenderer) this.graphRenderer = new GraphRenderWorker(this);
		else this.graphRenderer.updateData(this);

		this.fitToNodes();

		if (!this.eventsInitialized)
		{
			this.initEvents();
			this.eventsInitialized = true;
		}

		this.paused = false;

		// set icons
		const localSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-circle-dot"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>`;
		const globalSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-git-fork"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>`;
		this.globalGraphButton.innerHTML = this.isGlobalGraph ? localSVG : globalSVG;
	
		// set current file as active node
		this.setActiveNodeByPath(ObsidianSite.document.pathname);
	}

	public fitToNodes()
	{
		this.graphRenderer.centerCamera();
		this.graphRenderer.cameraScale = (1/Math.sqrt(this.nodeCount)) * this.graphRenderer.canvas.width / 200;
		this.graphSim.settleness = 1;
	}

	private firstUpdate = true;
	private update(dt:number)
	{
		if (this.paused || !this.graphRenderer || !this.graphSim)
		{
			return;
		}

		if (this.firstUpdate)
		{
			setTimeout(() => this.graphRenderer?.canvas?.classList.remove("hide"), 500);
			this.firstUpdate = false;
		}

		this.graphSim.dt = dt;
		this.graphSim.update(this.mouseWorldPos, this.graphRenderer.grabbedNode, this.graphRenderer.cameraScale);

		if (this.graphSim.hoveredNode != this.graphRenderer.hoveredNode)
		{
			this.graphRenderer.hoveredNode = this.graphSim.hoveredNode;
			this.graphRenderer.canvas.style.cursor = this.graphSim.hoveredNode == -1 ? "default" : "pointer";
		}
	}

	private drawLastTime = 0;
	private async draw(time: number)
	{
		if (!this.graphRenderer || !this.graphSim || this.paths.length == 0) return;

		const dt = (time - this.drawLastTime) / 1000;
		this.drawLastTime = time;


		this.graphRenderer.draw(this.graphSim.positions);

		if (this.scrollVelocity != 0)
		{
			if (Math.abs(this.scrollVelocity) < 0.001)
			{
				this.scrollVelocity = 0;
			}

			this.zoomAround(this.mouseWorldPos, this.scrollVelocity);

			this.scrollVelocity *= (1 - dt * 15);
		}

		requestAnimationFrame(this.draw.bind(this));
	}

	private zoomAround(point: Vector2, zoom: number, minScale: number = 0.15, maxScale: number = 15.0)
	{
		const cameraCenter = this.graphRenderer.getCameraCenterWorldspace();

		this.graphRenderer.cameraScale = Math.max(Math.min(this.graphRenderer.cameraScale + zoom * this.graphRenderer.cameraScale, maxScale), minScale);
		if(this.graphRenderer.cameraScale != minScale && this.graphRenderer.cameraScale != maxScale && this.scrollVelocity > 0 && !this.mouseWorldPos.isUndefined)
		{
			const aroundDiff = new Vector2(point.x - cameraCenter.x, point.y - cameraCenter.y);
			const movePos = new Vector2(cameraCenter.x + aroundDiff.x * zoom,cameraCenter.y + aroundDiff.y * zoom);
			this.graphRenderer.setCameraCenterWorldspace(movePos);
		}
		else this.graphRenderer.setCameraCenterWorldspace(cameraCenter);
	}

	private scaleAround(point: Vector2, scale: number, minScale: number = 0.15, maxScale: number = 15.0)
	{
		const cameraCenter = this.graphRenderer.getCameraCenterWorldspace();

		const scaleBefore = this.graphRenderer.cameraScale;
		this.graphRenderer.cameraScale = Math.max(Math.min(scale * this.graphRenderer.cameraScale, maxScale), minScale);
		const diff = (scaleBefore - this.graphRenderer.cameraScale) / scaleBefore;
		if(this.graphRenderer.cameraScale != minScale && this.graphRenderer.cameraScale != maxScale && scale != 0)
		{
			const aroundDiff = new Vector2(point.x - cameraCenter.x, point.y - cameraCenter.y);
			const movePos = new Vector2(cameraCenter.x - aroundDiff.x * diff, cameraCenter.y - aroundDiff.y * diff);
			this.graphRenderer.setCameraCenterWorldspace(movePos);
		}
		else this.graphRenderer.setCameraCenterWorldspace(cameraCenter);
	}

	private async navigateToNode(nodeIndex: number)
	{
		if (nodeIndex < 0 || nodeIndex >= this.nodeCount) return;
		if (this.graphExpanded) this.toggleExpandedGraph();
		const url = this.paths[nodeIndex];
		await ObsidianSite.loadURL(url);
	}

	public toggleExpandedGraph()
    {
        const initialWidth = this.graphContainer.clientWidth;
        const initialHeight = this.graphContainer.clientHeight;

        // scale and fade out animation:
        this.graphContainer.classList.add("scale-down");
        const fadeOutAnimation = this.graphContainer.animate({ opacity: 0 }, {duration: 100, easing: "ease-in", fill: "forwards"});
		const localThis = this;
        fadeOutAnimation.addEventListener("finish", function()
        {
            localThis.graphContainer.classList.toggle("expanded");

            localThis.graphRenderer.autoResizeCanvas();
            localThis.graphRenderer.centerCamera();

            const finalWidth = localThis.graphContainer.clientWidth;
            const finalHeight = localThis.graphContainer.clientHeight;
            localThis.graphRenderer.cameraScale *= ((finalWidth / initialWidth) + (finalHeight / initialHeight)) / 2;

            localThis.graphContainer.classList.remove("scale-down");
            localThis.graphContainer.classList.add("scale-up");

            const fadeInAnimation = localThis.graphContainer.animate({ opacity: 1 }, {duration: 200, easing: "ease-out", fill: "forwards"});
            fadeInAnimation.addEventListener("finish", function()
            {
                localThis.graphContainer.classList.remove("scale-up");
            });
        });

        this.graphExpanded = !this.graphExpanded;

		if (this.graphExpanded) 
		{
			document.addEventListener("pointerdown", handleOutsideClick, {once: true});
		}
		else 
		{
			document.removeEventListener("pointerdown", handleOutsideClick);
		}

		function handleOutsideClick(event: PointerEvent)
		{
			if (!localThis.graphExpanded) return;
			
			if (event.composedPath().includes(localThis.graphContainer)) 
			{
				document.addEventListener("pointerdown", handleOutsideClick, {once: true});
				return;
			}

			localThis.toggleExpandedGraph();
		}

		this.graphRenderer.autoResizeCanvas();
    }

	public getNodeByPath(path: string)
	{
		return this.paths.indexOf(path);
	}

	public setActiveNode(nodeIndex: number)
	{
		if (nodeIndex < 0 || nodeIndex >= this.nodeCount) return;
		this.graphRenderer.activeNode = nodeIndex;
	}

	public setActiveNodeByPath(path: string)
	{
		this.setActiveNode(this.getNodeByPath(path));
	}

	
}
