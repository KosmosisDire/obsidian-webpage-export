import { Bounds, Vector2 } from "src/frontend/main/utils";
import { GraphView } from "../main/graph-view";

declare let Module: any;

export class GraphWASMHelper
{
    nodeCount = 0;
    linkCount = 0;
    hoveredNode = -1;

    #positionsPtr = 0;
    #positionsByteLength = 0;
    #radiiPtr = 0;
    #linkSourcesPtr = 0;
    #linkTargetsPtr = 0;
	
	startPositions: Float32Array = new Float32Array(0);
    linkSources = new Int32Array(0);
    linkTargets = new Int32Array(0);
    radii = new Float32Array(0);
    maxRadius = 0;
    averageRadius = 0;
    minRadius = 0;

	graphView: GraphView;

    init(graph: GraphView, positions?: number[])
    {
		this.free();

		this.graphView = graph;
        this.nodeCount = graph.nodeCount;
        this.linkCount = graph.linkCount;

		if (positions?.length != this.nodeCount * 2)
		{
			throw new Error("Invalid positions array length");
		}

        // create arrays for the data
		this.radii = new Float32Array(graph.radii);
        this.linkSources = new Int32Array(graph.linkSources);
        this.linkTargets = new Int32Array(graph.linkTargets);

		this.maxRadius = this.radii.reduce((a, b) => Math.max(a, b));
        this.averageRadius = this.radii.reduce((a, b) => a + b) / this.radii.length;
        this.minRadius = this.radii.reduce((a, b) => Math.min(a, b));

        this.startPositions = new Float32Array(this.nodeCount * 2);
        this.startPositions = this.generatePositions(positions);

        // allocate memory on the heap
        this.#positionsPtr = Module._malloc(this.startPositions.byteLength);
        this.#positionsByteLength = this.startPositions.byteLength;
        this.#radiiPtr = Module._malloc(this.radii.byteLength);
        this.#linkSourcesPtr = Module._malloc(this.linkSources.byteLength);
        this.#linkTargetsPtr = Module._malloc(this.linkTargets.byteLength);

        // copy the data to the heap
        Module.HEAP32.set(new Int32Array(this.startPositions.buffer), this.#positionsPtr / this.startPositions.BYTES_PER_ELEMENT);
        Module.HEAP32.set(new Int32Array(this.radii.buffer), this.#radiiPtr / this.radii.BYTES_PER_ELEMENT);
        Module.HEAP32.set(new Int32Array(this.linkSources.buffer), this.#linkSourcesPtr / this.linkSources.BYTES_PER_ELEMENT);
        Module.HEAP32.set(new Int32Array(this.linkTargets.buffer), this.#linkTargetsPtr / this.linkTargets.BYTES_PER_ELEMENT);

        Module._Init(
            this.#positionsPtr, 
            this.#radiiPtr, 
            this.#linkSourcesPtr, 
            this.#linkTargetsPtr, 
            this.nodeCount, 
            this.linkCount, 
            graph.batchFraction, 
            graph.ticker.deltaTime, 
            graph.options.attractionForce, 
            graph.options.linkLength, 
            graph.options.repulsionForce,
            graph.options.centralForce,
        );
    }

    get positions(): Float32Array
    {
        return Module.HEAP32.buffer.slice(this.#positionsPtr, this.#positionsPtr + this.#positionsByteLength);
    }

	get positionsF(): Float32Array
	{
		return new Float32Array(this.positions);
	}

    generatePositions(defaultPositions?: number[]): Float32Array
    {
        let positions = new Float32Array(defaultPositions ?? new Array(this.nodeCount * 2).fill(0));
		const spawnRadius = (this.averageRadius * 2 * Math.sqrt(this.nodeCount)) * 2;
		for (let i = 0; i < this.nodeCount; i++) 
		{
			const value = positions[i * 2];
			if (value != 0 && !isNaN(value) && value != undefined)
			{
				continue;
			}

			const distance = (1 - this.radii[i] / this.maxRadius) * spawnRadius;
			positions[i * 2] = Math.cos(i/this.nodeCount * 7.41 * 2 * Math.PI) * distance;
			positions[i * 2 + 1] = Math.sin(i/this.nodeCount * 7.41 * 2 * Math.PI) * distance;
		}

        return positions;
    }

	public getBounds(): Bounds
	{
		let bounds = new Bounds(0, 0, 0, 0);
		const positions = new Float32Array(this.positions);
		// fit view to positions
		for (let i = 0; i < this.nodeCount-1; i+=2)
		{
			const pos = new Vector2(positions[i], positions[i + 1]);
			bounds.encapsulatePoint(pos.scale(2));
		}

        const centerDelta = bounds.center;
        const centerDist = centerDelta.magnitude;
        bounds = bounds.expand(50 + centerDist);
        bounds.translate(centerDelta.inverse);
		return bounds;
	}

    update(mousePosition: Vector2, grabbedNode: number, cameraScale: number)
    {
        this.hoveredNode = Module._Update(mousePosition.x, mousePosition.y, grabbedNode, cameraScale);
    }

    free()
    {
        Module._free(this.#positionsPtr);
        Module._free(this.#radiiPtr);
        Module._free(this.#linkSourcesPtr);
        Module._free(this.#linkTargetsPtr);
        Module._FreeMemory();
    }

    set batchFraction(value: number)
    {
        Module._SetBatchFractionSize(value);
    }
    
    set attractionForce(value: number)
    {
        Module._SetAttractionForce(value);
    }

    set repulsionForce(value: number)
    {
        Module._SetRepulsionForce(value);
    }

    set centralForce(value: number)
    {
        Module._SetCentralForce(value);
    }

    set linkLength(value: number)
    {
        Module._SetLinkLength(value);
    }

    set dt(value: number)
    {
        Module._SetDt(value);
    }

    set settleness(value: number)
    {
        Module._SetSettleness(value);
    }
}
