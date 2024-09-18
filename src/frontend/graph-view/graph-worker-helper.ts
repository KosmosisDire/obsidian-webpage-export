import { Vector2 } from "src/frontend/main/utils";
import { GraphView } from "../main/graph-view";
import { Shared } from "src/shared/shared";
import { LinkHandler } from "../main/links";

// colors in hex
export interface GraphViewColors
{
	background: number;
	link: number;
	node: number;
	outline: number;
	text: number;
	accent: number;
}

export class GraphRenderWorker
{
    private _cameraOffset: Vector2;
	get cameraOffset() { return this._cameraOffset; }
	set cameraOffset(offset)
    {
        this._cameraOffset = offset;
        this.#pixiSetCamera(offset, this.cameraScale);
    }

    private _cameraScale: number;
	get cameraScale(){ return this._cameraScale; }
	set cameraScale(scale)
    {
        this._cameraScale = scale;
        this.#pixiSetCamera(this.cameraOffset, scale);
    }

    private _hoveredNode: number;
	get hoveredNode(){ return this._hoveredNode; }
	set hoveredNode(node: number)
    {
        this._hoveredNode = node;
        this.#pixiSetInteraction(node, this._grabbedNode);
    }

    private _grabbedNode: number;
	get grabbedNode(){ return this._grabbedNode; }
	set grabbedNode(node: number)
    {
        this._grabbedNode = node;
        this.#pixiSetInteraction(this._hoveredNode, node);
    }
    private _colors: GraphViewColors;
	get colors(){return this._colors;}
	set colors(colors: GraphViewColors)
    {
        this._colors = colors;
        this.#pixiSetColors(colors);
    }
    
    private _width: number;
	get width(){ return this._width; }
	set width(width)
	{
		this._width = width;
		this.resizeCanvas(width, this._height);
	}

    private _height: number;
	get height() { return this._height; }
    set height(height)
    {
        this._height = height;
        this.resizeCanvas(this._width, height);
    }

	public canvas: HTMLCanvasElement;
	public canvasSidebar: HTMLElement | null;
	// @ts-ignore
	public view: OffscreenCanvas;
	public worker: Worker;
	public graph: GraphView;
    
    set activeNode(node: number)
    {
        this.worker.postMessage(
        {
            type: 'set_active',
            active: node,
        });
    }

    constructor(graph: GraphView)
    {
		this.graph = graph;
        this.canvas = document.querySelector("#graph-canvas") as HTMLCanvasElement;
		this.canvasSidebar = this.canvas.closest(".sidebar");

		console.log("Creating graph worker");

		try
		{
			// @ts-ignore
        	this.view = this.canvas.transferControlToOffscreen();
		}
		catch(e)
		{
			console.log("Failed to transfer control to offscreen canvas");
		}

		var workerPath = `${ObsidianSite.document.info.pathToRoot}/${Shared.libFolderName}/${Shared.scriptsFolderName}/graph-render-worker.js`;

		if (window.location.protocol === 'file:')
		{
			var fileInfo = ObsidianSite.getLocalDataFromId(LinkHandler.getFileDataIdFromURL(workerPath));
			const data = Uint8Array.from(Array.from(fileInfo.data).map((s: string) => s.charCodeAt(0)));
			this.worker = new Worker(URL.createObjectURL(new Blob([data], {type: 'application/javascript'})));
		}
		else
		{
			this.worker = new Worker(new URL(workerPath, window.location.href).pathname);
		}


        this._cameraOffset = new Vector2(0, 0);
        this._cameraScale = 1;
        this._hoveredNode = -1;
        this._grabbedNode = -1;
        this._colors = 
        {
            background: 0x000000,
            link: 0x000000,
            node: 0x000000,
            outline: 0x000000,
            text: 0x000000,
            accent: 0x000000,
        }
        this._width = 0;
        this._height = 0;

        this.cameraOffset = new Vector2(this.canvas.width, this.canvas.height).scale(0.5);
        this.cameraScale = 1;
        this.hoveredNode = -1;
        this.grabbedNode = -1;
        this.resampleColors();

        this.#pixiInit(true);

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.autoResizeCanvas();

    }

	public updateData(graph: GraphView)
	{
		this.graph = graph;
		this.#pixiInit();
	}

    #pixiInit(initial: boolean = false)
    {
		// @ts-ignore
        const { width, height } = this.view;

		let options: any = { width: width, height: height, view: this.view };
		// @ts-ignore
		let objects: Transferable[] = [this.view];

		if (!initial)
		{
			options = { width: width, height: height };
			objects = [];
		}
		
		// @ts-ignore
        this.worker.postMessage(
        {
            type: 'init',
            linkCount: this.graph.graphSim.linkCount,
            linkSources: this.graph.graphSim.linkSources,
            linkTargets: this.graph.graphSim.linkTargets,
            nodeCount: this.graph.graphSim.nodeCount,
            radii: this.graph.graphSim.radii,
            labels: this.graph.labels,
            linkLength: this.graph.options.linkLength,
            edgePruning: this.graph.options.edgePruning,
            options: options,
        }, objects);
    }

	sampleColor(variable: string) 
	{
		const testEl = document.createElement('div');
		document.body.appendChild(testEl);
		testEl.style.setProperty('display', 'none');
		testEl.style.setProperty('color', 'var(' + variable + ')');

		const col = getComputedStyle(testEl).color;
		const opacity = getComputedStyle(testEl).opacity;

		testEl.remove();

		function toColorObject(str: string)
		{
			const match = str.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
			return match ? {
				red: parseInt(match[1]),
				green: parseInt(match[2]),
				blue: parseInt(match[3]),
				alpha: 1
			} : null
		}

		const color = toColorObject(col);
		const alpha = parseFloat(opacity);
		const result = 
		{
			a: (alpha * (color?.alpha ?? 1)) ?? 1,
			rgb: (color?.red ?? 0x880000) << 16 | (color?.green ?? 0x008800)  << 8 | (color?.blue ?? 0x000088)
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

    draw(_positions: Float32Array)
    {
        this.worker.postMessage(
        {
            type: 'draw',
            positions: _positions,
        }, [_positions]);
    }

    resizeCanvas(width: number, height: number)
    {
        this.worker.postMessage(
        {
            type: "resize",
            width: width,
            height: height,
        });

        this._width = width;
        this._height = height;
    }

    autoResizeCanvas()
    {
		let canvasWidth = this.canvas.offsetWidth;
		let canvasHeight = this.canvas.offsetHeight;
		if (this.width != canvasWidth || this.height != canvasHeight)
		{
			this.centerCamera();
        	this.resizeCanvas(canvasWidth, canvasHeight);
		}
    }

    centerCamera()
    {
        this.cameraOffset = new Vector2(this.width, this.height).scale(0.5);
    }

    #pixiSetInteraction(hoveredNodeIndex: number, grabbedNodeIndex: number)
    {   
        const obj = 
        {
            type: "update_interaction",
            hoveredNode: hoveredNodeIndex,
            grabbedNode: grabbedNodeIndex,
        }

        this.worker.postMessage(obj);
    }

    #pixiSetCamera(cameraOffset: Vector2, cameraScale: number)
    {
        this.worker.postMessage(
        {
            type: "update_camera",
            cameraOffset: cameraOffset,
            cameraScale: cameraScale,
        });
    }

    #pixiSetColors(colors: GraphViewColors)
    {
        this.worker.postMessage(
        {
            type: "update_colors",
            colors: colors,
        });
    }

    toScreenSpace(x: number, y: number, floor: boolean = true)
    {
		let xScreen = (x * this.cameraScale) + this.cameraOffset.x;
		let yScreen = (y * this.cameraScale) + this.cameraOffset.y;

		if (floor)
		{
			xScreen = Math.floor(xScreen);
			yScreen = Math.floor(yScreen);
		}

		return new Vector2(xScreen, yScreen);
    }

    vecToScreenSpace(vector: Vector2, floor = true)
    {
        return this.toScreenSpace(vector.x, vector.y, floor);
    }

    toWorldspace(x: number, y: number)
    {
		const xWorld = (x - this.cameraOffset.x) / this.cameraScale;
		const yWorld = (y - this.cameraOffset.y) / this.cameraScale;
		return new Vector2(xWorld, yWorld);
    }

    vecToWorldspace(vector: Vector2)
    {
        return this.toWorldspace(vector.x, vector.y);
    }

    setCameraCenterWorldspace(position: Vector2)
    {
		this.cameraOffset = new Vector2((this.width / 2) - (position.x * this.cameraScale), (this.height / 2) - (position.y * this.cameraScale));
    }

    getCameraCenterWorldspace()
    {
        return this.toWorldspace(this.width / 2, this.height / 2);
    }
}

