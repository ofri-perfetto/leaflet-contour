import { HeightTile } from "./height-tile";
import { Timer } from "./performance";
import type { DemTile, Encoding, Timing, HeightTileOptions } from "./types";
import type Actor from "./actor";
import type WorkerDispatch from "./worker-dispatch";
export interface DemTileSourceOptions {
    /** Remote DEM tile url using `{z}`, `{x}`, and `{y}` placeholders */
    url: string;
    /** Encoding scheme for the DEM tiles */
    encoding?: Encoding;
    /** Maximum zoom level of the DEM tiles */
    maxzoom?: number;
    /** Number of tiles to cache (default 100) */
    cacheSize?: number;
    /** Request timeout in milliseconds (default 10000) */
    timeoutMs?: number;
    /** Use web worker for processing (default true) */
    worker?: boolean;
    /** Custom actor for worker communication */
    actor?: Actor<WorkerDispatch>;
}
/**
 * Shared source for DEM tiles that can be used by multiple layers.
 * Handles fetching, caching, and parsing of elevation data.
 */
export declare class DemTileSource {
    private manager;
    private timingCallbacks;
    readonly url: string;
    readonly encoding: Encoding;
    readonly maxzoom: number;
    constructor(options: DemTileSourceOptions);
    /**
     * Wait for the manager to be ready (worker initialized).
     */
    get loaded(): Promise<void>;
    /**
     * Register a callback to receive timing information for each tile request.
     */
    onTiming(callback: (timing: Timing) => void): void;
    /**
     * Fetch and parse a single DEM tile.
     */
    getDemTile(z: number, x: number, y: number, abortController: AbortController): Promise<DemTile>;
    /**
     * Fetch a DEM tile and convert it to a HeightTile.
     * Supports overzoom for using lower-resolution tiles at higher zoom levels.
     */
    getHeightTile(z: number, x: number, y: number, options: HeightTileOptions, abortController: AbortController): Promise<HeightTile>;
    /**
     * Fetch a HeightTile with all 8 neighbors for seamless contour generation.
     * The returned HeightTile is a virtual tile that combines the center tile
     * with its neighbors to avoid edge artifacts.
     */
    getHeightTileWithNeighbors(z: number, x: number, y: number, options: HeightTileOptions, abortController: AbortController, timer?: Timer): Promise<HeightTile | undefined>;
}
/**
 * Factory function to create a DemTileSource.
 */
export declare function demTileSource(options: DemTileSourceOptions): DemTileSource;
