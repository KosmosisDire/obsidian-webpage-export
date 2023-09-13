// -------------------------- GRAPH VIEW --------------------------
var running = false;
let batchFraction = 1;
let minBatchFraction = 0.3;
repulsionForce /= batchFraction;
let dt = 1;
let targetFPS = 40;
let startingCameraRect = {minX: -1, minY: -1, maxX: 1, maxY: 1};

let mouseWorldPos = { x: undefined, y: undefined };
let scrollVelocity = 0;
let averageFPS = targetFPS;

const pixiApp = new PIXI.Application();
var renderWorker = undefined;

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
     * @param {{nodeCount: number, linkCount:number, radii: number[], labels: string[], paths: string[], linkSources: number[], linkTargets: number[], linkCounts: number[]}} nodes
    */
    static init(nodes)
    {
        GraphAssembly.nodeCount = nodes.nodeCount;
        GraphAssembly.linkCount = nodes.linkCount;

        // create arrays for the data
        let positions = new Float32Array(GraphAssembly.nodeCount * 2);
        GraphAssembly.radii = new Float32Array(nodes.radii);
        GraphAssembly.linkSources = new Int32Array(nodes.linkSources);
        GraphAssembly.linkTargets = new Int32Array(nodes.linkTargets);

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
            attractionForce, 
            linkLength, 
            repulsionForce, 
            centralForce
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
			
			let rightSidebar = document.querySelector(".sidebar-right");
			let leftSidebar = document.querySelector(".sidebar-left");

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
            labels: nodes.labels,
            linkLength: linkLength,
            edgePruning: edgePruning,
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

    resampleColors()
    {
        function sampleColor(variable) 
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

            var color = toColorObject(col), alpha = parseFloat(opacity);
            return isNaN(alpha) && (alpha = 1),
            color ? {
                a: alpha * color.alpha,
                rgb: color.red << 16 | color.green << 8 | color.blue
            } : {
                a: alpha,
                rgb: 8947848
            }
        };

        this.colors =
        {
            background: sampleColor('--background-secondary').rgb,
            link: sampleColor('--graph-line').rgb,
            node: sampleColor('--graph-node').rgb,
            outline: sampleColor('--graph-line').rgb,
            text: sampleColor('--graph-text').rgb,
            accent: sampleColor('--interactive-accent').rgb,
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
        this.resizeCanvas(this.canvas.offsetWidth, this.canvas.offsetHeight);
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

    console.log("Module Ready");
    GraphAssembly.init(nodes);

    renderWorker = new GraphRenderWorker();
    window.renderWorker = renderWorker;

    initializeGraphEvents();

    pixiApp.ticker.maxFPS = targetFPS;
    pixiApp.ticker.add(updateGraph);

    setActiveDocument(getURLPath());

    setInterval(() =>
    {
        function isHidden(el) {
            var style = window.getComputedStyle(el);
            return (style.display === 'none')
        }

        try
        {
            var hidden = (renderWorker.canvasSidebar.classList.contains("is-collapsed"));
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
            renderWorker.autoResizeCanvas();
            renderWorker.centerCamera();
        }

    }, 1000);
}

function updateGraph()
{
    if(!running) return;

	if (renderWorker.canvasSidebar.classList.contains("is-collapsed")) return;

    GraphAssembly.update(mouseWorldPos, renderWorker.grabbedNode, renderWorker.cameraScale);

    if (GraphAssembly.hoveredNode != renderWorker.hoveredNode)
    {
        renderWorker.hoveredNode = GraphAssembly.hoveredNode;
        renderWorker.canvas.style.cursor = GraphAssembly.hoveredNode == -1 ? "default" : "pointer";
    }

    renderWorker.draw(GraphAssembly.positions);

    averageFPS = averageFPS * 0.95 + pixiApp.ticker.FPS * 0.05;

    if (averageFPS < targetFPS * 0.9 && batchFraction > minBatchFraction)
    {
        batchFraction = Math.max(batchFraction - 0.5 * 1/targetFPS, minBatchFraction);
        GraphAssembly.batchFraction = batchFraction;
        GraphAssembly.repulsionForce = repulsionForce / batchFraction;
    }

    if (scrollVelocity != 0)
    {
        let cameraCenter = renderWorker.getCameraCenterWorldspace();

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
	let cameraCenter = renderWorker.getCameraCenterWorldspace();

	renderWorker.cameraScale = Math.max(Math.min(renderWorker.cameraScale + zoom * renderWorker.cameraScale, maxScale), minScale);
	if(renderWorker.cameraScale != minScale && renderWorker.cameraScale != maxScale && scrollVelocity > 0 && mouseWorldPos.x != undefined && mouseWorldPos.y != undefined)
	{
		let aroundDiff = {x: point.x - cameraCenter.x, y: point.y - cameraCenter.y};
		let movePos = {x: cameraCenter.x + aroundDiff.x * zoom, y: cameraCenter.y + aroundDiff.y * zoom};
		renderWorker.setCameraCenterWorldspace(movePos);
	}
	else renderWorker.setCameraCenterWorldspace(cameraCenter);
}

function scaleGraphViewAroundPoint(point, scale, minScale = 0.15, maxScale = 15.0)
{
	let cameraCenter = renderWorker.getCameraCenterWorldspace();

	let scaleBefore = renderWorker.cameraScale;
	renderWorker.cameraScale = Math.max(Math.min(scale * renderWorker.cameraScale, maxScale), minScale);
	let diff = (scaleBefore - renderWorker.cameraScale) / scaleBefore;
	if(renderWorker.cameraScale != minScale && renderWorker.cameraScale != maxScale && scale != 0)
	{
		let aroundDiff = {x: point.x - cameraCenter.x, y: point.y - cameraCenter.y};
		let movePos = {x: cameraCenter.x - aroundDiff.x * diff, y: cameraCenter.y - aroundDiff.y * diff};
		renderWorker.setCameraCenterWorldspace(movePos);
	}
	else renderWorker.setCameraCenterWorldspace(cameraCenter);
}

function initializeGraphEvents()
{
    window.addEventListener('beforeunload', () => 
    {
        running = false;
        GraphAssembly.free();
    });

	let graphExpanded = false;
    let lastCanvasWidth = renderWorker.canvas.width;
    window.addEventListener('resize', () =>
    {
        if(graphExpanded)
        {
            renderWorker.autoResizeCanvas();
            renderWorker.centerCamera();
        }
        else
        {
            if (renderWorker.canvas.width != lastCanvasWidth)
            {
                renderWorker.autoResizeCanvas();
                renderWorker.centerCamera();
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

            renderWorker.autoResizeCanvas();
            renderWorker.centerCamera();

            let finalWidth = container.clientWidth;
            let finalHeight = container.clientHeight;
            renderWorker.cameraScale *= ((finalWidth / initialWidth) + (finalHeight / initialHeight)) / 2;

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
		if (!graphExpanded) GraphAssembly.saveState(renderWorker);
		else toggleExpandedGraph();
		let url = nodes.paths[nodeIndex];
		if(window.location.pathname.endsWith(nodes.paths[nodeIndex])) return;
		await loadDocument(url);
	}

    // Get the mouse position relative to the canvas.
	function getPointerPosOnCanvas(event)
	{
		var rect = renderWorker.canvas.getBoundingClientRect();
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
			mouseWorldPos = renderWorker.vecToWorldspace(pointerPos);
			pointerDelta = { x: pointerPos.x - lastPointerPos.x, y: pointerPos.y - lastPointerPos.y };
			lastPointerPos = pointerPos;

			if (renderWorker.grabbedNode != -1) dragDisplacement = { x: pointerPos.x - startPointerPos.x, y: pointerPos.y - startPointerPos.y };

			if (pointerDown && renderWorker.hoveredNode != -1 && renderWorker.grabbedNode == -1 && renderWorker.hoveredNode != renderWorker.grabbedNode)
			{
				renderWorker.grabbedNode = renderWorker.hoveredNode;
			}

			if ((pointerDown && renderWorker.hoveredNode == -1 && renderWorker.grabbedNode == -1) || middleDown)
			{
				renderWorker.cameraOffset = { x: renderWorker.cameraOffset.x + pointerDelta.x, y: renderWorker.cameraOffset.y + pointerDelta.y };
			}
			else
			{
				if (renderWorker.hoveredNode != -1) renderWorker.canvas.style.cursor = "pointer";
				else renderWorker.canvas.style.cursor = "default";
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
					renderWorker.grabbedNode = -1;
					renderWorker.hoveredNode = -1;
				}

				let distanceDelta = distance - lastDistance;
				let scaleDelta = distanceDelta / lastDistance;

				scaleGraphViewAroundPoint(renderWorker.vecToWorldspace(pointerPos), 1 + scaleDelta, 0.15, 15.0);
				renderWorker.cameraOffset = { x: renderWorker.cameraOffset.x + pointerDelta.x, y: renderWorker.cameraOffset.y + pointerDelta.y };

				lastDistance = distance;
			}
		}

		function handlePointerUp(up)
		{
			document.removeEventListener("pointerup", handlePointerUp);

			let pointerUpTime = Date.now();

			setTimeout(() => 
			{
				if (pointerDown && renderWorker.hoveredNode != -1 && Math.abs(dragDisplacement.x) <= 4 && Math.abs(dragDisplacement.y) <= 4 && pointerUpTime - startDragTime < 300)
				{
					navigateToNode(renderWorker.hoveredNode);
				}

				if (pointerDown && renderWorker.grabbedNode != -1)
				{
					renderWorker.grabbedNode = -1;
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
			mouseWorldPos = renderWorker.vecToWorldspace(pointerPos);
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

			if (pointerDown && renderWorker.hoveredNode != -1)
			{
				renderWorker.grabbedNode = renderWorker.hoveredNode;
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
		mouseWorldPos = renderWorker.vecToWorldspace(pointerPos);
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

	document.querySelector(".theme-toggle-input")?.addEventListener("change", event =>
	{
		setTimeout(() => renderWorker.resampleColors(), 0);
	});
}

Module['onRuntimeInitialized'] = initializeGraphView;
setTimeout(() => Module['onRuntimeInitialized'](), 300);
