import L from "leaflet";
import type { DemTileSource } from "./dem-tile-source";
export interface HillshadeLayerOptions extends L.GridLayerOptions {
    /** Shared DEM tile source */
    demSource: DemTileSource;
    /** Light source azimuth in degrees, clockwise from north (default 315) */
    azimuth?: number;
    /** Light source altitude in degrees above horizon (default 45) */
    altitude?: number;
    /** Vertical exaggeration factor (default 1) */
    exaggeration?: number;
    /** Shadow color (default "rgba(0,0,0,1)") */
    shadowColor?: string;
    /** Highlight color (default "rgba(255,255,255,1)") */
    highlightColor?: string;
}
/**
 * Leaflet GridLayer that renders hillshade/terrain shading from DEM tiles.
 * Uses Horn's method for calculating surface normals and shading.
 */
export declare class HillshadeLayer extends L.GridLayer {
    private demSource;
    private layerOptions;
    constructor(options: HillshadeLayerOptions);
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement;
    private renderTile;
    /**
     * Calculate hillshade using Horn's method.
     * This computes the illumination of a surface based on slope and aspect.
     */
    private calculateHillshade;
    onRemove(map: L.Map): this;
}
/**
 * Factory function for creating a HillshadeLayer.
 */
export declare function hillshadeLayer(options: HillshadeLayerOptions): HillshadeLayer;
