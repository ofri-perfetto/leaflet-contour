import L from "leaflet";
import type { DemTileSource } from "./dem-tile-source";
export interface ContourLabelLayerOptions extends L.GridLayerOptions {
    /** Shared DEM tile source */
    demSource: DemTileSource;
    /** Label interval in meters - labels are placed at elevations divisible by this (default 100) */
    interval?: number;
    /** Font family (default "Arial, sans-serif") */
    font?: string;
    /** Font size in pixels (default 10) */
    fontSize?: number;
    /** Font color (default "#333") */
    fontColor?: string;
    /** Halo/outline color for readability (default "white") */
    haloColor?: string;
    /** Halo width in pixels (default 2) */
    haloWidth?: number;
    /** Elevation multiplier for unit conversion (default 1) */
    multiplier?: number;
    /** Custom formatter for elevation labels */
    formatter?: (elevation: number) => string;
    /** Minimum distance between labels in pixels (default 100) */
    minLabelSpacing?: number;
    /** Use lower zoom DEM tiles (default 0) */
    overzoom?: number;
    /** Subsample threshold for smooth contours (default 100) */
    subsampleBelow?: number;
}
/**
 * Leaflet GridLayer that renders elevation labels along contour lines.
 */
export declare class ContourLabelLayer extends L.GridLayer {
    private demSource;
    private layerOptions;
    constructor(options: ContourLabelLayerOptions);
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement;
    private renderTile;
    /**
     * Find suitable positions for labels along contour lines.
     * Prefers straight segments and avoids crowding.
     */
    private findLabelPositions;
    /**
     * Find positions along a line segment where text can be placed nicely.
     */
    private findGoodPositionsOnLine;
    /**
     * Draw labels with halo effect for readability.
     */
    private drawLabels;
    onRemove(map: L.Map): this;
}
/**
 * Factory function for creating a ContourLabelLayer.
 */
export declare function contourLabelLayer(options: ContourLabelLayerOptions): ContourLabelLayer;
