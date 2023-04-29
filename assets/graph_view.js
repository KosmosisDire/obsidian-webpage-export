// -------------------------- GRAPH VIEW --------------------------

var running = false;
let batchFraction = 1;
let minBatchFraction = 0.3;
repulsionForce /= batchFraction;
let dt = 1;
let targetFPS = 30;
let startingCameraScale = undefined;
let startingCameraOffset = undefined;

async function RunGraphView()
{
    if(running) return;

    running = true;
    console.log("Module Ready");

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
            localStorage.setItem("positions", JSON.stringify(new Float32Array(GraphAssembly.positions)));
            localStorage.setItem("cameraOffset", JSON.stringify(renderWorker.cameraOffset));
            localStorage.setItem("cameraScale", JSON.stringify(renderWorker.cameraScale));
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

            startingCameraOffset = JSON.parse(localStorage.getItem("cameraOffset"));
            startingCameraScale = JSON.parse(localStorage.getItem("cameraScale"));
            // console.log(startingCameraOffset, startingCameraScale);

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

    GraphAssembly.init(nodes);

    class GraphRenderWorker
    {
        #cameraOffset
        #cameraScale
        #hoveredNode
        #grabbedNode
        #colors
        #width
        #height


        constructor()
        {
            this.canvas = $("#graph-canvas")[0];
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

            if (startingCameraOffset && startingCameraScale)
            {
                this.cameraOffset = startingCameraOffset;
                this.cameraScale = startingCameraScale;
            }
            else
            {
                this.centerCamera();
            }
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

        resampleColors()
        {
            function sampleColor(variable) 
            {
                let testEl = document.createElement('div');
                testEl.style.setProperty('display', 'none');
                testEl.style.setProperty('color', 'var(' + variable + ')');
                document.body.appendChild(testEl);

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

    const renderWorker = new GraphRenderWorker();

    const app = new PIXI.Application();

    app.ticker.maxFPS = targetFPS;

    let mousePositionWorld = { x: undefined, y: undefined };
    let mousePositionScreen = { x: undefined, y: undefined };
    let scrollVelocity = 0;
    let lastMousePos = { x: 0, y: 0 };
    let averageFPS = targetFPS;

    let mouseInside = false;
    let graphExpanded = false;
    let leftButtonDown = false;
    let rightButtonDown = false;
    let middleButtonDown = false;
    let panning = false;

    app.ticker.add(() => 
    {
        if(!running) return;

        GraphAssembly.update(mousePositionWorld, renderWorker.grabbedNode, renderWorker.cameraScale);

        if (GraphAssembly.hoveredNode != renderWorker.hoveredNode)
        {
            renderWorker.hoveredNode = GraphAssembly.hoveredNode;
            renderWorker.canvas.style.cursor = GraphAssembly.hoveredNode == -1 ? "default" : "pointer";
        }

        renderWorker.draw(GraphAssembly.positions);

        averageFPS = averageFPS * 0.95 + app.ticker.FPS * 0.05;

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

            renderWorker.cameraScale = Math.max(Math.min(renderWorker.cameraScale + scrollVelocity * renderWorker.cameraScale, 10.0), 0.1);

            if(renderWorker.cameraScale != 0.1 && renderWorker.cameraScale != 10 && scrollVelocity > 0 && mousePositionWorld.x != undefined && mousePositionWorld.y != undefined)
            {
                // zoom towards cursor position
                let mouseDiff = {x: mousePositionWorld.x - cameraCenter.x, y: mousePositionWorld.y - cameraCenter.y};
                var movePos = {x: cameraCenter.x + mouseDiff.x * scrollVelocity, y: cameraCenter.y + mouseDiff.y * scrollVelocity};
                renderWorker.setCameraCenterWorldspace(movePos);
            }
            else renderWorker.setCameraCenterWorldspace(cameraCenter);

            scrollVelocity *= 0.8;
        }
    });

    //#region Event listeners

    window.addEventListener('beforeunload', () => 
    {
        running = false;
        GraphAssembly.free();
    });

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

    // Get the mouse position relative to the canvas.
    function getMousePos(canvas, event)
    {
        var rect = canvas.getBoundingClientRect();
        var clientX = event.clientX;
        var clientY = event.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function handleMouseMove(event)
    {
        mousePositionScreen = getMousePos(renderWorker.canvas, event);
        mousePositionWorld = renderWorker.vecToWorldspace(mousePositionScreen);

        if (lastMousePos.x == 0 && lastMousePos.y == 0)
        {
            lastMousePos = { x: event.clientX, y: event.clientY };
            return;
        }

        let delta = { x: lastMousePos.x - event.clientX, y: lastMousePos.y - event.clientY };

        if (leftButtonDown && renderWorker.hoveredNode != -1)
        {
            renderWorker.grabbedNode = renderWorker.hoveredNode;
        }

        if (middleButtonDown || (leftButtonDown && renderWorker.hoveredNode == -1))
        {
            let camOffset = renderWorker.cameraOffset;
            renderWorker.cameraOffset = { x: camOffset.x - delta.x, y: camOffset.y - delta.y };
            panning = true;
        }
        else
        {
            panning = false;
        }

        lastMousePos = { x: event.clientX, y: event.clientY };
    }

    $("*:not(#graph-canvas)").on("mousemove",function(event)
    {
        if(panning || renderWorker.grabbedNode != -1)
        {
            handleMouseMove(event);
        }

        mouseInside = false;
    });

    $("#graph-canvas").on("mousemove", function(event)
    {
        handleMouseMove(event);

        mouseInside = true;
    });

    $("#graph-canvas").on("mousedown", function(e) 
    {
        e.preventDefault();
        e.stopPropagation();
            
        if (e.button == 0) leftButtonDown = true;
        if (e.button == 1) middleButtonDown = true;
        if (e.button == 2) rightButtonDown = true;
    });

    async function navigateToNode(nodeIndex)
    {
        if (!graphExpanded) GraphAssembly.saveState(renderWorker);
        else toggleExpandedGraph();

        let url = rootPath + "/" + nodes.paths[nodeIndex];
        if(window.location.pathname.endsWith(nodes.paths[nodeIndex])) return;
        await loadDocument(url);
        
        console.log(url);
    }

    $("*").on("mouseup", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        if (e.button == 0) leftButtonDown = false;
        if (e.button == 1) middleButtonDown = false;
        if (e.button == 2) rightButtonDown = false;

        // we must have just clicked on a node without dragging it
        if (!panning && renderWorker.grabbedNode == -1 && renderWorker.hoveredNode != -1)
        {
            navigateToNode(renderWorker.hoveredNode);
        }

        renderWorker.grabbedNode = -1;
    });

    // also mouse up if mouse leaves canvas
    $("#graph-canvas").on("mouseleave", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        if (renderWorker.grabbedNode == -1 && !(middleButtonDown || leftButtonDown))
        {
            mousePositionScreen = { x: undefined, y: undefined };
            mousePositionWorld = { x: undefined, y: undefined };
        }

        mouseInside = false;
    });

    $("#graph-canvas").on("mouseenter", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        mouseInside = true;
    });


    $("#graph-canvas")[0].addEventListener("wheel", function(e) 
    {
        e.preventDefault();
        e.stopPropagation();

        let delta = e.deltaY;
        if (delta > 0)
        {
            if(scrollVelocity >= -0.04)
            {
                scrollVelocity = -0.04;
            }

            scrollVelocity *= 1.2;
        }
        else
        {
            if(scrollVelocity <= 0.04)
            {
                scrollVelocity = 0.04;
            }

            scrollVelocity *= 1.2;
        }
    });



    // touch controls
    document.getElementById("graph-canvas").addEventListener("touchstart", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        if (e.touches.length == 1)
        {
            lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

            leftButtonDown = true;
        }
        else if (e.touches.length == 2)
        {
            middleButtonDown = true;
        }
    });

    document.getElementById("graph-canvas").addEventListener("touchmove", function(e)
    {
        handleMouseMove(e.touches[0]);
    });

    document.addEventListener("touchend", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        if (e.touches.length == 0)
        {
            leftButtonDown = false;
            middleButtonDown = false;

            if (!panning && renderWorker.grabbedNode == -1 && renderWorker.hoveredNode != -1)
            {
                navigateToNode(renderWorker.hoveredNode);
            }

            renderWorker.grabbedNode = -1;
        }
        else if (e.touches.length == 1)
        {
            middleButtonDown = false;
        }
    });    



    $(".toggle__input").on("change",function(e)
    {
        renderWorker.resampleColors();
    });

    function toggleExpandedGraph()
    {
        let container = $(".graph-view-container");
        let initialWidth = container.width();
        let initialHeight = container.height();

        // scale and fade out animation:
        container.addClass("scale-down");
        container.animate({ opacity: 0 }, 200, "easeInQuad", function()
        {
            container.toggleClass("expanded");

            renderWorker.autoResizeCanvas();
            renderWorker.centerCamera();

            let finalWidth = container.width();
            let finalHeight = container.height();
            renderWorker.cameraScale *= ((finalWidth / initialWidth) + (finalHeight / initialHeight)) / 2;

            container.removeClass("scale-down");
            container.addClass("scale-up");
            container.animate({ opacity: 1 }, 1000, "easeOutQuad", function()
            {
                container.removeClass("scale-up");
            });
            
        });

        graphExpanded = !graphExpanded;
    }

    $(".graph-expand.graph-icon").on("click tap", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        toggleExpandedGraph();
    });

    //#endregion    
}

Module['onRuntimeInitialized'] = RunGraphView;

setTimeout(() => Module['onRuntimeInitialized'](), 300);