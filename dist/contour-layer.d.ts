import L from "leaflet";
import type { DemTileSource } from "./dem-tile-source";
export interface ContourLayerOptions extends L.GridLayerOptions {
    /** Shared DEM tile source */
    demSource: DemTileSource;
    /** Minor contour interval in meters (default 10) */
    interval?: number;
    /** Major contour interval in meters (default interval * 5) */
    majorInterval?: number;
    /** Color for minor contour lines (default "#666") */
    minorColor?: string;
    /** Color for major contour lines (default "#333") */
    majorColor?: string;
    /** Line width for minor contours (default 0.5) */
    minorWidth?: number;
    /** Line width for major contours (default 1.5) */
    majorWidth?: number;
    /** Elevation multiplier for unit conversion (default 1) */
    multiplier?: number;
    /** Use lower zoom DEM tiles (default 0) */
    overzoom?: number;
    /** Subsample threshold for smooth contours (default 100) */
    subsampleBelow?: number;
}
/**
 * Leaflet GridLayer that renders contour lines from DEM tiles.
 */
export declare class ContourLayer extends L.GridLayer {
    private demSource;
    private layerOptions;
    constructor(options: ContourLayerOptions);
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement;
    private renderTile;
    private drawContours;
    onRemove(map: L.Map): this;
}
/**
 * Factory function for creating a ContourLayer.
 */
export declare function contourLayer(options: ContourLayerOptions): ContourLayer;
