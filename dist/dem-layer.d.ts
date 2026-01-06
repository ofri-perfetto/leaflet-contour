import L from "leaflet";
import type { DemManager, IndividualContourTileOptions, Timing } from "./types";
import type Actor from "./actor";
import type WorkerDispatch from "./worker-dispatch";
interface DemHeightLayerOptions {
    /** Remote DEM tile url using `{z}` `{x}` and `{y}` placeholders */
    /** Number of most-recently-used tiles to cache */
    cacheSize?: number;
    /** Prefix for the maplibre protocol */
    id?: string;
    encoding?: "terrarium" | "mapbox";
    /** Maximum zoom of tiles contained in the source */
    maxzoom: number;
    timeoutMs?: number;
    /** Handle requests in a shared web worker to reduce UI-thread jank */
    worker?: boolean;
    actor?: Actor<WorkerDispatch>;
    contourOptions?: IndividualContourTileOptions;
    tileSize?: number;
    color?: (elevation: number) => string;
    lineWidth?: number;
}
/**
 * Leaflet GridLayer that renders DEM float grids to canvas tiles.
 */
export declare class DemHeightLayer extends L.GridLayer {
    contourOptions?: IndividualContourTileOptions;
    tileSizePx: number;
    colorFn: (e: number) => string;
    lineWidth: number;
    sharedDemProtocolId: string;
    contourProtocolId: string;
    contourProtocolUrlBase: string;
    manager: DemManager;
    sharedDemProtocolUrl: string;
    timingCallbacks: Array<(timing: Timing) => void>;
    constructor(url: string, options: DemHeightLayerOptions);
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement;
    private drawContours;
    onRemove(map: L.Map): this;
}
export {};
