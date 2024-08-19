// -------------------------- GRAPH VIEW --------------------------
var running = false;
let batchFraction = 1; // how much of the graph to update per frame
let minBatchFraction = 0.3; // batch fraction is updated dynamically, but never goes below this value
let dt = 1;
let targetFPS = 40;
let startingCameraRect = {minX: -1, minY: -1, maxX: 1, maxY: 1};

let mouseWorldPos = { x: undefined, y: undefined };
let scrollVelocity = 0;
let averageFPS = targetFPS * 2;

let pixiApp = undefined;
let graphRenderer = undefined;

class GraphAssembly
{
    static nodeCount = 0;
    static linkCount = 0;
    static hoveredNode = -1;

    static #positionsPtr = 0;
    static #positionsByteLength = 0;
    static #radiiPtr = 0;
    static #linkSourcesPtr = 0;
    static #linkTargetsPtr = 0;

    static linkSources = new Int32Array(0);
    static linkTargets = new Int32Array(0);
    static radii = new Float32Array(0);
    static maxRadius = 0;
    static averageRadius = 0;
    static minRadius = 0;

    /**  
     * @param {{graphOptions: {attractionForce: number, linkLength: number, repulsionForce: number, centralForce: number, edgePruning: number, minNodeRadius: number, maxNodeRadius: number}, nodeCount: number, linkCount:number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[], linkCounts: number[]}} graphData
    */
    static init(graphData)
    {
        GraphAssembly.nodeCount = graphData.nodeCount;
        GraphAssembly.linkCount = graphData.linkCount;

        // create arrays for the data
        let positions = new Float32Array(GraphAssembly.nodeCount * 2);
        GraphAssembly.radii = new Float32Array(graphData.radii);
        GraphAssembly.linkSources = new Int32Array(graphData.linkSources);
        GraphAssembly.linkTargets = new Int32Array(graphData.linkTargets);

        // allocate memory on the heap
        GraphAssembly.#positionsPtr = Module._malloc(positions.byteLength);
        GraphAssembly.#positionsByteLength = positions.byteLength;
        GraphAssembly.#radiiPtr = Module._malloc(GraphAssembly.radii.byteLength);
        GraphAssembly.#linkSourcesPtr = Module._malloc(GraphAssembly.linkSources.byteLength);
        GraphAssembly.#linkTargetsPtr = Module._malloc(GraphAssembly.linkTargets.byteLength);

        GraphAssembly.maxRadius = GraphAssembly.radii.reduce((a, b) => Math.max(a, b));
        GraphAssembly.averageRadius = GraphAssembly.radii.reduce((a, b) => a + b) / GraphAssembly.radii.length;
        GraphAssembly.minRadius = GraphAssembly.radii.reduce((a, b) => Math.min(a, b));

        positions = this.loadState();

        // copy the data to the heap
        Module.HEAP32.set(new Int32Array(positions.buffer), GraphAssembly.#positionsPtr / positions.BYTES_PER_ELEMENT);
        Module.HEAP32.set(new Int32Array(GraphAssembly.radii.buffer), GraphAssembly.#radiiPtr / GraphAssembly.radii.BYTES_PER_ELEMENT);
        Module.HEAP32.set(new Int32Array(GraphAssembly.linkSources.buffer), GraphAssembly.#linkSourcesPtr / GraphAssembly.linkSources.BYTES_PER_ELEMENT);
        Module.HEAP32.set(new Int32Array(GraphAssembly.linkTargets.buffer), GraphAssembly.#linkTargetsPtr / GraphAssembly.linkTargets.BYTES_PER_ELEMENT);

        Module._Init(
            GraphAssembly.#positionsPtr, 
            GraphAssembly.#radiiPtr, 
            GraphAssembly.#linkSourcesPtr, 
            GraphAssembly.#linkTargetsPtr, 
            GraphAssembly.nodeCount, 
            GraphAssembly.linkCount, 
            batchFraction, 
            dt, 
            graphData.graphOptions.attractionForce, 
            graphData.graphOptions.linkLength, 
            graphData.graphOptions.repulsionForce,
            graphData.graphOptions.centralForce,
        );
    }

    /**
     * @returns {Float32Array}
     */
    static get positions()
    {
        return Module.HEAP32.buffer.slice(GraphAssembly.#positionsPtr, GraphAssembly.#positionsPtr + GraphAssembly.#positionsByteLength);
    }

    /**
     * @param {GraphRenderWorker} renderWorker
     * */ 
    static saveState(renderWorker)
    {
		// save all rounded to int
        localStorage.setItem("positions", JSON.stringify(new Float32Array(GraphAssembly.positions).map(x => Math.round(x))));
    }

    /**
     * @returns {Float32Array}
     * */
    static loadState()
    {
        let positionsLoad = localStorage.getItem("positions");
        let positions = null;
        if(positionsLoad) positions = new Float32Array(Object.values(JSON.parse(positionsLoad)));
        if (!positions || !positionsLoad || positions.length != GraphAssembly.nodeCount * 2)
        {
            positions = new Float32Array(GraphAssembly.nodeCount * 2);
            let spawnRadius = (GraphAssembly.averageRadius * Math.sqrt(GraphAssembly.nodeCount)) * 2;
            for (let i = 0; i < GraphAssembly.nodeCount; i++) 
            {
                let distance = (1 - GraphAssembly.radii[i] / GraphAssembly.maxRadius) * spawnRadius;
                positions[i * 2] = Math.cos(i/GraphAssembly.nodeCount * 7.41 * 2 * Math.PI) * distance;
                positions[i * 2 + 1] = Math.sin(i/GraphAssembly.nodeCount * 7.41 * 2 * Math.PI) * distance;
            }
        }

		// fit view to positions
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < GraphAssembly.nodeCount-1; i+=2)
		{
			let pos = { x: positions[i], y: positions[i + 1] };
			minX = Math.min(minX, pos.x);
			maxX = Math.max(maxX, pos.x);
			minY = Math.min(minY, pos.y);
			maxY = Math.max(maxY, pos.y);
		}

		let margin = 50;

		startingCameraRect = { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };

        return positions;
    }

    /**
     * @param {{x: number, y: number}} mousePosition
     * @param {number} grabbedNode
     */
    static update(mousePosition, grabbedNode, cameraScale)
    {
        GraphAssembly.hoveredNode = Module._Update(mousePosition.x, mousePosition.y, grabbedNode, cameraScale);
    }

    static free()
    {
        Module._free(GraphAssembly.#positionsPtr);
        Module._free(GraphAssembly.#radiiPtr);
        Module._free(GraphAssembly.#linkSourcesPtr);
        Module._free(GraphAssembly.#linkTargetsPtr);
        Module._FreeMemory();
    }

    /**
     * @param {number} value
     */
    static set batchFraction(value)
    {
        Module._SetBatchFractionSize(value);
    }
    
    /**
     * @param {number} value
     */
    static set attractionForce(value)
    {
        Module._SetAttractionForce(value);
    }

    /**
     * @param {number} value
     */
    static set repulsionForce(value)
    {
        Module._SetRepulsionForce(value);
    }

    /**
     * @param {number} value
     */
    static set centralForce(value)
    {
        Module._SetCentralForce(value);
    }

    /**
     * @param {number} value
     */
    static set linkLength(value)
    {
        Module._SetLinkLength(value);
    }

    /**
     * @param {number} value
     */
    static set dt(value)
    {
        Module._SetDt(value);
    }
}

class GraphRenderWorker
{
    #cameraOffset;
    #cameraScale;
    #hoveredNode;
    #grabbedNode;
    #colors;
    #width;
    #height;


    constructor()
    {
        this.canvas = document.querySelector("#graph-canvas");
		this.canvasSidebar = undefined;

		try
		{
			this.canvasSidebar = document.querySelector(".sidebar:has(#graph-canvas)");
		}
		catch(e)
		{
			console.log("Error: " + e + "\n\n Using fallback.");
			
			let rightSidebar = document.querySelector("#right-sidebar");
			let leftSidebar = document.querySelector("#left-sidebar");

			this.canvasSidebar = rightSidebar.querySelector("#graph-canvas") ? rightSidebar : leftSidebar;
		}

        this.view = this.canvas.transferControlToOffscreen();

        this.worker = new Worker(new URL("./graph-render-worker.js", import.meta.url));

        this.#cameraOffset = {x: 0, y: 0};
        this.#cameraScale = 1;
        this.#hoveredNode = -1;
        this.#grabbedNode = -1;
        this.#colors = 
        {
            background: 0x000000,
            link: 0x000000,
            node: 0x000000,
            outline: 0x000000,
            text: 0x000000,
            accent: 0x000000,
        }
        this.#width = 0;
        this.#height = 0;

        this.cameraOffset = {x: this.canvas.width / 2, y: this.canvas.height / 2};
        this.cameraScale = 1;
        this.hoveredNode = -1;
        this.grabbedNode = -1;
        this.resampleColors();

        this.#pixiInit();

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.autoResizeCanvas();

        this.fitToRect(startingCameraRect);
    }

    #pixiInit()
    {
        let { width, height } = this.view;

        this.worker.postMessage(
        {
            type: 'init',
            linkCount: GraphAssembly.linkCount,
            linkSources: GraphAssembly.linkSources,
            linkTargets: GraphAssembly.linkTargets,
            nodeCount: GraphAssembly.nodeCount,
            radii: GraphAssembly.radii,
            labels: graphData.labels,
            linkLength: graphData.graphOptions.linkLength,
            edgePruning: graphData.graphOptions.edgePruning,
            options: { width: width, height: height, view: this.view },
        }, [this.view]);
    }

	fitToRect(rect) // {minX, minY, maxX, maxY}
	{
		let min = {x: rect.minX, y: rect.minY};
		let max = {x: rect.maxX, y: rect.maxY};

		let width = max.x - min.x;
		let height = max.y - min.y;

		let scale = 1/Math.min(width/this.width, height / this.height);

		this.cameraScale = scale;
		this.cameraOffset = { x: (this.width / 2) - ((rect.minX + width / 2) * scale), y: (this.height / 2) - ((rect.minY + height / 2) * scale) };
	}

	fitToNodes()
	{
		this.fitToRect(startingCameraRect);
	}

	sampleColor(variable) 
	{
		let testEl = document.createElement('div');
		document.body.appendChild(testEl);
		testEl.style.setProperty('display', 'none');
		testEl.style.setProperty('color', 'var(' + variable + ')');

		let col = getComputedStyle(testEl).color;
		let opacity = getComputedStyle(testEl).opacity;

		testEl.remove();

		function toColorObject(str)
		{
			var match = str.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
			return match ? {
				red: parseInt(match[1]),
				green: parseInt(match[2]),
				blue: parseInt(match[3]),
				alpha: 1
			} : null
		}

		let color = toColorObject(col);
		let alpha = parseFloat(opacity);
		let result = 
		{
			a: (alpha * color?.alpha ?? 1) ?? 1,
			rgb: (color?.red << 16 | color?.green << 8 | color?.blue) ?? 0x888888
		};

		return result;
	};

    resampleColors()
    {
        this.colors =
        {
            background: this.sampleColor('--background-secondary').rgb,
            link: this.sampleColor('--graph-line').rgb,
            node: this.sampleColor('--graph-node').rgb,
            outline: this.sampleColor('--graph-line').rgb,
            text: this.sampleColor('--graph-text').rgb,
            accent: this.sampleColor('--interactive-accent').rgb,
        };
    }

    draw(_positions)
    {
        this.worker.postMessage(
        {
            type: 'draw',
            positions: _positions,
        }, [_positions]);
    }

    resizeCanvas(width, height)
    {
        this.worker.postMessage(
        {
            type: "resize",
            width: width,
            height: height,
        });

        this.#width = width;
        this.#height = height;
    }

    autoResizeCanvas()
    {
		let canvasWidth = this.canvas.offsetWidth;
		if (this.width != canvasWidth || this.height != canvasWidth)
		{
			this.centerCamera();
        	this.resizeCanvas(canvasWidth, canvasWidth);
		}
    }

    centerCamera()
    {
        this.cameraOffset = { x: this.width / 2, y: this.height / 2 };
    }

    #pixiSetInteraction(hoveredNodeIndex, grabbedNodeIndex)
    {   
        let obj = 
        {
            type: "update_interaction",
            hoveredNode: hoveredNodeIndex,
            grabbedNode: grabbedNodeIndex,
        }

        this.worker.postMessage(obj);
    }

    #pixiSetCamera(cameraOffset, cameraScale)
    {
        this.worker.postMessage(
        {
            type: "update_camera",
            cameraOffset: cameraOffset,
            cameraScale: cameraScale,
        });
    }

    #pixiSetColors(colors)
    {
        this.worker.postMessage(
        {
            type: "update_colors",
            colors: colors,
        });

    }

    set cameraOffset(offset)
    {
        this.#cameraOffset = offset;
        this.#pixiSetCamera(offset, this.cameraScale);
    }

    set cameraScale(scale)
    {
        this.#cameraScale = scale;
        this.#pixiSetCamera(this.cameraOffset, scale);
    }

    get cameraOffset()
    {
        return this.#cameraOffset;
    }

    get cameraScale()
    {
        return this.#cameraScale;
    }

    /**
     * @param {number} node
     */
    set hoveredNode(node)
    {
        this.#hoveredNode = node;
        this.#pixiSetInteraction(node, this.#grabbedNode);
    }

    /**
     * @param {number} node
     */
    set grabbedNode(node)
    {
        this.#grabbedNode = node;
        this.#pixiSetInteraction(this.#hoveredNode, node);
    }

    /**
     * @param {number} node
     */
    set activeNode(node)
    {
        this.worker.postMessage(
        {
            type: 'set_active',
            active: node,
        });
    }

    get hoveredNode()
    {
        return this.#hoveredNode;
    }

    get grabbedNode()
    {
        return this.#grabbedNode;
    }

    /**
     * @param {{ background: number; link: number; node: number; outline: number; text: number; accent: number; }} colors
     */
    set colors(colors)
    {
        this.#colors = colors;
        this.#pixiSetColors(colors);
    }

    get colors()
    {
        return this.#colors;
    }

    set width(width)
    {
        this.#width = width;
        this.resizeCanvas(width, this.#height);
    }

    set height(height)
    {
        this.#height = height;
        this.resizeCanvas(this.#width, height);
    }

    get height()
    {
        return this.#height;
    }

    get width()
    {
        return this.#width;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {boolean} floor
     * @returns {{x: number; y: number;}}
     */
    toScreenSpace(x, y, floor = true)
    {
        if (floor)
        {
            return {x: Math.floor((x * this.cameraScale) + this.cameraOffset.x), y: Math.floor((y * this.cameraScale) + this.cameraOffset.y)};
        }
        else
        {
            return {x: (x * this.cameraScale) + this.cameraOffset.x, y: (y * this.cameraScale) + this.cameraOffset.y};
        }
    }

    /**
     * @param {{x: number; y: number;}} vector
     * @param {boolean} floor
     * @returns {{x: number; y: number;}}
    */
    vecToScreenSpace(vector, floor = true)
    {
        return this.toScreenSpace(vector.x, vector.y, floor);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {{x: number; y: number;}}
     */
    toWorldspace(x, y)
    {
        return {x: (x - this.cameraOffset.x) / this.cameraScale, y: (y - this.cameraOffset.y) / this.cameraScale};
    }

    /**
     * @param {{x: number; y: number;}} vector
     * @returns {{x: number; y: number;}}
     */
    vecToWorldspace(vector)
    {
        return this.toWorldspace(vector.x, vector.y);
    }

    setCameraCenterWorldspace({x, y})
    {
        this.cameraOffset = {x: (this.width / 2) - (x * this.cameraScale), y: (this.height / 2) - (y * this.cameraScale)};
    }

    getCameraCenterWorldspace()
    {
        return this.toWorldspace(this.width / 2, this.height / 2);
    }
}

async function initializeGraphView()
{
    if(running) return;
	running = true;

	graphData.graphOptions.repulsionForce /= batchFraction; // compensate for batch fraction
	pixiApp = new PIXI.Application();

    console.log("Module Ready");
    GraphAssembly.init(graphData); // graphData is a global variable set in another script

    graphRenderer = new GraphRenderWorker();
    window.graphRenderer = graphRenderer;

    initializeGraphEvents();

    pixiApp.ticker.maxFPS = targetFPS;
    pixiApp.ticker.add(updateGraph);

    setActiveDocument(new URL(window.location.href), false, false);

    setInterval(() =>
    {
        function isHidden(el) {
            var style = window.getComputedStyle(el);
            return (style.display === 'none')
        }

        try
        {
            var hidden = (graphRenderer.canvasSidebar.classList.contains("is-collapsed"));
        }
        catch(e)
        {
            return;
        }

        if(running && hidden)
        {
            running = false;
        }
        else if (!running && !hidden)
        {
            running = true;
            graphRenderer.autoResizeCanvas();
            graphRenderer.centerCamera();
        }

    }, 1000);
}

let firstUpdate = true;
function updateGraph()
{
    if(!running) return;

	if (graphRenderer.canvasSidebar.classList.contains("is-collapsed")) return;

	if (firstUpdate)
	{
		setTimeout(() => graphRenderer?.canvas?.classList.remove("hide"), 500);
		firstUpdate = false;
	}

    GraphAssembly.update(mouseWorldPos, graphRenderer.grabbedNode, graphRenderer.cameraScale);

    if (GraphAssembly.hoveredNode != graphRenderer.hoveredNode)
    {
        graphRenderer.hoveredNode = GraphAssembly.hoveredNode;
        graphRenderer.canvas.style.cursor = GraphAssembly.hoveredNode == -1 ? "default" : "pointer";
    }

	// graphRenderer.autoResizeCanvas();
    graphRenderer.draw(GraphAssembly.positions);

    averageFPS = averageFPS * 0.95 + pixiApp.ticker.FPS * 0.05;

    if (averageFPS < targetFPS * 0.8 && batchFraction > minBatchFraction)
    {
        batchFraction = Math.max(batchFraction - 0.5 * 1/targetFPS, minBatchFraction);
        GraphAssembly.batchFraction = batchFraction;
        GraphAssembly.repulsionForce = graphData.graphOptions.repulsionForce / batchFraction;
    }

	if (averageFPS > targetFPS * 1.2 && batchFraction < 1)
	{
		batchFraction = Math.min(batchFraction + 0.5 * 1/targetFPS, 1);
		GraphAssembly.batchFraction = batchFraction;
		GraphAssembly.repulsionForce = graphData.graphOptions.repulsionForce / batchFraction;
	}

    if (scrollVelocity != 0)
    {
        let cameraCenter = graphRenderer.getCameraCenterWorldspace();

        if (Math.abs(scrollVelocity) < 0.001)
        {
            scrollVelocity = 0;
        }

        zoomGraphViewAroundPoint(mouseWorldPos, scrollVelocity);

        scrollVelocity *= 0.65;
    }
}

function zoomGraphViewAroundPoint(point, zoom, minScale = 0.15, maxScale = 15.0)
{
	let cameraCenter = graphRenderer.getCameraCenterWorldspace();

	graphRenderer.cameraScale = Math.max(Math.min(graphRenderer.cameraScale + zoom * graphRenderer.cameraScale, maxScale), minScale);
	if(graphRenderer.cameraScale != minScale && graphRenderer.cameraScale != maxScale && scrollVelocity > 0 && mouseWorldPos.x != undefined && mouseWorldPos.y != undefined)
	{
		let aroundDiff = {x: point.x - cameraCenter.x, y: point.y - cameraCenter.y};
		let movePos = {x: cameraCenter.x + aroundDiff.x * zoom, y: cameraCenter.y + aroundDiff.y * zoom};
		graphRenderer.setCameraCenterWorldspace(movePos);
	}
	else graphRenderer.setCameraCenterWorldspace(cameraCenter);
}

function scaleGraphViewAroundPoint(point, scale, minScale = 0.15, maxScale = 15.0)
{
	let cameraCenter = graphRenderer.getCameraCenterWorldspace();

	let scaleBefore = graphRenderer.cameraScale;
	graphRenderer.cameraScale = Math.max(Math.min(scale * graphRenderer.cameraScale, maxScale), minScale);
	let diff = (scaleBefore - graphRenderer.cameraScale) / scaleBefore;
	if(graphRenderer.cameraScale != minScale && graphRenderer.cameraScale != maxScale && scale != 0)
	{
		let aroundDiff = {x: point.x - cameraCenter.x, y: point.y - cameraCenter.y};
		let movePos = {x: cameraCenter.x - aroundDiff.x * diff, y: cameraCenter.y - aroundDiff.y * diff};
		graphRenderer.setCameraCenterWorldspace(movePos);
	}
	else graphRenderer.setCameraCenterWorldspace(cameraCenter);
}

function initializeGraphEvents()
{
    window.addEventListener('beforeunload', () => 
    {
        running = false;
        GraphAssembly.free();
    });

	let graphExpanded = false;
    let lastCanvasWidth = graphRenderer.canvas.width;
    window.addEventListener('resize', () =>
    {
        if(graphExpanded)
        {
            graphRenderer.autoResizeCanvas();
            graphRenderer.centerCamera();
        }
        else
        {
            if (graphRenderer.canvas.width != lastCanvasWidth)
            {
                graphRenderer.autoResizeCanvas();
                graphRenderer.centerCamera();
            }
        }
    });

    let container = document.querySelector(".graph-view-container");

	function handleOutsideClick(event)
	{
		if (event.composedPath().includes(container)) 
		{
			return;
		}
		toggleExpandedGraph();
	}

	function toggleExpandedGraph()
    {
        let initialWidth = container.clientWidth;
        let initialHeight = container.clientHeight;

        // scale and fade out animation:
        container.classList.add("scale-down");
        let fadeOutAnimation = container.animate({ opacity: 0 }, {duration: 100, easing: "ease-in", fill: "forwards"});
        fadeOutAnimation.addEventListener("finish", function()
        {
            container.classList.toggle("expanded");

            graphRenderer.autoResizeCanvas();
            graphRenderer.centerCamera();

            let finalWidth = container.clientWidth;
            let finalHeight = container.clientHeight;
            graphRenderer.cameraScale *= ((finalWidth / initialWidth) + (finalHeight / initialHeight)) / 2;

            container.classList.remove("scale-down");
            container.classList.add("scale-up");

            updateGraph();

            let fadeInAnimation = container.animate({ opacity: 1 }, {duration: 200, easing: "ease-out", fill: "forwards"});
            fadeInAnimation.addEventListener("finish", function()
            {
                container.classList.remove("scale-up");
            });
        });

        graphExpanded = !graphExpanded;
		
		if (graphExpanded) document.addEventListener("pointerdown", handleOutsideClick);
		else document.removeEventListener("pointerdown", handleOutsideClick);
    }

	async function navigateToNode(nodeIndex)
	{
		if (!graphExpanded) GraphAssembly.saveState(graphRenderer);
		else toggleExpandedGraph();
		let url = graphData.paths[nodeIndex];
		if(window.location.pathname.endsWith(graphData.paths[nodeIndex])) return;
		await loadDocument(url, true, true);
	}

    // Get the mouse position relative to the canvas.
	function getPointerPosOnCanvas(event)
	{
		var rect = graphRenderer.canvas.getBoundingClientRect();
		let pos = getPointerPosition(event);

		return {
			x: pos.x - rect.left,
			y: pos.y - rect.top
		};
	}

	let startPointerPos = { x: 0, y: 0 };
	let pointerPos = { x: 0, y: 0 };
	let lastPointerPos = { x: 0, y: 0 };
	let pointerDelta = { x: 0, y: 0 };
	let dragDisplacement = { x: 0, y: 0 };
	let startDragTime = 0;
	let pointerDown = false;
	let middleDown = false;
	let pointerInside = false;
	let graphContainer = document.querySelector(".graph-view-container");
	let firstPointerDownId = -1;

	function handlePointerEnter(enter)
	{
		let lastDistance = 0;
		let startZoom = false;

		function handleMouseMove(move)
		{
			pointerPos = getPointerPosOnCanvas(move);
			mouseWorldPos = graphRenderer.vecToWorldspace(pointerPos);
			pointerDelta = { x: pointerPos.x - lastPointerPos.x, y: pointerPos.y - lastPointerPos.y };
			lastPointerPos = pointerPos;

			if (graphRenderer.grabbedNode != -1) dragDisplacement = { x: pointerPos.x - startPointerPos.x, y: pointerPos.y - startPointerPos.y };

			if (pointerDown && graphRenderer.hoveredNode != -1 && graphRenderer.grabbedNode == -1 && graphRenderer.hoveredNode != graphRenderer.grabbedNode)
			{
				graphRenderer.grabbedNode = graphRenderer.hoveredNode;
			}

			if ((pointerDown && graphRenderer.hoveredNode == -1 && graphRenderer.grabbedNode == -1) || middleDown)
			{
				graphRenderer.cameraOffset = { x: graphRenderer.cameraOffset.x + pointerDelta.x, y: graphRenderer.cameraOffset.y + pointerDelta.y };
			}
			else
			{
				if (graphRenderer.hoveredNode != -1) graphRenderer.canvas.style.cursor = "pointer";
				else graphRenderer.canvas.style.cursor = "default";
			}
		}

		function handleTouchMove(move)
		{
			if (move.touches?.length == 1) 
			{
				if(startZoom)
				{
					lastPointerPos = getPointerPosOnCanvas(move);
					startZoom = false;
				}

				handleMouseMove(move);
				return;
			}

			// pinch zoom
			if (move.touches?.length == 2)
			{
				let touch1 = getTouchPosition(move.touches[0]);
				let touch2 = getTouchPosition(move.touches[1]);

				pointerPos = getPointerPosOnCanvas(move);
				pointerDelta = { x: pointerPos.x - lastPointerPos.x, y: pointerPos.y - lastPointerPos.y };
				lastPointerPos = pointerPos;

				let distance = Math.sqrt(Math.pow(touch1.x - touch2.x, 2) + Math.pow(touch1.y - touch2.y, 2));

				if (!startZoom)
				{
					startZoom = true;
					lastDistance = distance;
					pointerDelta = { x: 0, y: 0 };
					mouseWorldPos = { x: undefined, y: undefined};
					graphRenderer.grabbedNode = -1;
					graphRenderer.hoveredNode = -1;
				}

				let distanceDelta = distance - lastDistance;
				let scaleDelta = distanceDelta / lastDistance;

				scaleGraphViewAroundPoint(graphRenderer.vecToWorldspace(pointerPos), 1 + scaleDelta, 0.15, 15.0);
				graphRenderer.cameraOffset = { x: graphRenderer.cameraOffset.x + pointerDelta.x, y: graphRenderer.cameraOffset.y + pointerDelta.y };

				lastDistance = distance;
			}
		}

		function handlePointerUp(up)
		{
			document.removeEventListener("pointerup", handlePointerUp);

			let pointerUpTime = Date.now();

			setTimeout(() => 
			{
				if (pointerDown && graphRenderer.hoveredNode != -1 && Math.abs(dragDisplacement.x) <= 4 && Math.abs(dragDisplacement.y) <= 4 && pointerUpTime - startDragTime < 300)
				{
					navigateToNode(graphRenderer.hoveredNode);
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

		function handlePointerDown(down)
		{
			document.addEventListener("pointerup", handlePointerUp);
			mouseWorldPos = graphRenderer.vecToWorldspace(pointerPos);
			dragDisplacement = { x: 0, y: 0 };
			if (down.button == 0) pointerDown = true;
			if (down.pointerType == "touch" && firstPointerDownId == -1) 
			{
				firstPointerDownId = down.pointerId;
				pointerDown = true;
			}
			if (down.button == 1) middleDown = true;

			startPointerPos = pointerPos;
			startDragTime = Date.now();

			if (pointerDown && graphRenderer.hoveredNode != -1)
			{
				graphRenderer.grabbedNode = graphRenderer.hoveredNode;
			}
		}

		function handlePointerLeave(leave)
		{
			setTimeout(() => 
			{
				pointerInside = false;
				if (!pointerDown) 
				{
					document.removeEventListener("mousemove", handleMouseMove);
					document.removeEventListener("touchmove", handleTouchMove);
					mouseWorldPos = { x: undefined, y: undefined };
				}
				graphContainer.removeEventListener("pointerdown", handlePointerDown);
				graphContainer.removeEventListener("pointerleave", handlePointerLeave);
			}, 1);
		}

		pointerPos = getPointerPosOnCanvas(enter);
		mouseWorldPos = graphRenderer.vecToWorldspace(pointerPos);
		lastPointerPos = getPointerPosOnCanvas(enter);
		pointerInside = true;

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("touchmove", handleTouchMove);
		graphContainer.addEventListener("pointerdown", handlePointerDown);
		graphContainer.addEventListener("pointerleave", handlePointerLeave);
	}

	graphContainer.addEventListener("pointerenter", handlePointerEnter);

	document.querySelector(".graph-expand.graph-icon")?.addEventListener("click", event =>
    {
        event.stopPropagation();

        toggleExpandedGraph();
    });

	graphContainer.addEventListener("wheel", function(e) 
	{
		let startingScrollVelocity = 0.09;
		let delta = e.deltaY;
		if (delta > 0)
		{
			if(scrollVelocity >= -startingScrollVelocity)
			{
				scrollVelocity = -startingScrollVelocity;
			}
			scrollVelocity *= 1.4;
		}
		else
		{
			if(scrollVelocity <= startingScrollVelocity)
			{
				scrollVelocity = startingScrollVelocity;
			}
			scrollVelocity *= 1.4;
		}
	});

	// recenter the graph on double click
	graphContainer.addEventListener("dblclick", function(e)
	{
		graphRenderer.fitToNodes();
	});

	document.querySelector(".theme-toggle-input")?.addEventListener("change", event =>
	{
		setTimeout(() => graphRenderer.resampleColors(), 0);
	});
}

window.addEventListener("load", () => 
{
	waitLoadScripts(["pixi", "graph-data", "graph-render-worker", "graph-wasm"],  () =>
	{
		Module['onRuntimeInitialized'] = initializeGraphView;
		setTimeout(() => Module['onRuntimeInitialized'](), 300);
	});
});
