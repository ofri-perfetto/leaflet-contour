import L from "leaflet";
import { HeightTile } from "./height-tile";
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
export class HillshadeLayer extends L.GridLayer {
  private demSource: DemTileSource;
  private layerOptions: HillshadeLayerOptions;

  constructor(options: HillshadeLayerOptions) {
    super({
      tileSize: options.tileSize ?? 256,
      opacity: options.opacity ?? 0.5,
      ...options,
    });

    if (!options.demSource) {
      throw new Error("HillshadeLayer requires a demSource option");
    }

    this.demSource = options.demSource;
    this.layerOptions = options;
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement {
    const opts = this.options as L.GridLayerOptions;
    const tileSize =
      typeof opts.tileSize === "number"
        ? opts.tileSize
        : (opts.tileSize as L.Point)?.x ?? 256;

    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      done(new Error("Could not get canvas context"), canvas);
      return canvas;
    }

    const abortController = new AbortController();
    (canvas as any)._abortController = abortController;

    const { x, y, z } = coords;

    this.renderTile(x, y, z, ctx, canvas, abortController, done);

    return canvas;
  }

  private async renderTile(
    x: number,
    y: number,
    z: number,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    abortController: AbortController,
    done: L.DoneCallback,
  ): Promise<void> {
    const {
      azimuth = 315,
      altitude = 45,
      exaggeration = 1,
    } = this.layerOptions;

    try {
      // Fetch DEM tile
      const demTile = await this.demSource.getDemTile(
        z,
        x,
        y,
        abortController,
      );

      if (abortController.signal.aborted) {
        return;
      }

      // Convert to HeightTile for easy access
      const heightTile = HeightTile.fromRawDem(demTile);

      // Calculate hillshade and render
      const imageData = this.calculateHillshade(
        heightTile,
        canvas.width,
        canvas.height,
        z,
        azimuth,
        altitude,
        exaggeration,
      );

      ctx.putImageData(imageData, 0, 0);
      done(undefined, canvas);
    } catch (err) {
      if (!abortController.signal.aborted) {
        done(err as Error, canvas);
      }
    }
  }

  /**
   * Calculate hillshade using Horn's method.
   * This computes the illumination of a surface based on slope and aspect.
   */
  private calculateHillshade(
    tile: HeightTile,
    width: number,
    height: number,
    zoom: number,
    azimuthDeg: number,
    altitudeDeg: number,
    exaggeration: number,
  ): ImageData {
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    // Convert angles to radians
    // Azimuth: convert from clockwise-from-north to counter-clockwise-from-east
    const azimuth = ((360 - azimuthDeg + 90) * Math.PI) / 180;
    const altitude = (altitudeDeg * Math.PI) / 180;

    // Calculate cell size in meters based on zoom level
    // Web Mercator: at zoom z, tile is 256px covering 40075km / 2^z meters
    // For a 256px tile at equator:
    const earthCircumference = 40075016.686;
    const tileMeters = earthCircumference / Math.pow(2, zoom);
    const cellSize = tileMeters / tile.width;

    // Pre-compute light vector components
    const cosAz = Math.cos(azimuth);
    const sinAz = Math.sin(azimuth);
    const cosAlt = Math.cos(altitude);
    const sinAlt = Math.sin(altitude);

    // Scale factors for mapping tile coords to canvas
    const scaleX = tile.width / width;
    const scaleY = tile.height / height;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        // Map canvas pixel to tile coordinates
        const tx = Math.floor(px * scaleX);
        const ty = Math.floor(py * scaleY);

        // Get elevations for 3x3 neighborhood using Horn's method weights
        //   a b c
        //   d e f
        //   g h i
        const a = tile.get(tx - 1, ty - 1);
        const b = tile.get(tx, ty - 1);
        const c = tile.get(tx + 1, ty - 1);
        const d = tile.get(tx - 1, ty);
        const f = tile.get(tx + 1, ty);
        const g = tile.get(tx - 1, ty + 1);
        const h = tile.get(tx, ty + 1);
        const i = tile.get(tx + 1, ty + 1);

        // Calculate gradients using Horn's method
        // dz/dx = ((c + 2f + i) - (a + 2d + g)) / (8 * cellSize)
        // dz/dy = ((g + 2h + i) - (a + 2b + c)) / (8 * cellSize)
        const dzdx =
          (((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellSize)) * exaggeration;
        const dzdy =
          (((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cellSize)) * exaggeration;

        // Calculate slope and aspect
        const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);

        // Calculate hillshade value using the formula:
        // shade = cos(zenith) * cos(slope) + sin(zenith) * sin(slope) * cos(azimuth - aspect)
        // where zenith = 90 - altitude
        const shade =
          sinAlt * Math.cos(slope) +
          cosAlt * Math.sin(slope) * Math.cos(azimuth - aspect);

        // Normalize to 0-255 range
        const intensity = Math.max(0, Math.min(255, Math.round(shade * 255)));

        // Set RGBA values (grayscale)
        const idx = (py * width + px) * 4;
        data[idx] = intensity;
        data[idx + 1] = intensity;
        data[idx + 2] = intensity;
        data[idx + 3] = 255;
      }
    }

    return imageData;
  }

  onRemove(map: L.Map): this {
    // Cancel any pending tile requests
    const container = this.getContainer();
    if (container) {
      container.querySelectorAll("canvas").forEach((c) => {
        const ctrl = (c as any)._abortController as
          | AbortController
          | undefined;
        ctrl?.abort();
      });
    }
    return super.onRemove(map);
  }
}

/**
 * Factory function for creating a HillshadeLayer.
 */
export function hillshadeLayer(options: HillshadeLayerOptions): HillshadeLayer {
  return new HillshadeLayer(options);
}
