import L from "leaflet";
import { HeightTile } from "./height-tile";
import generateIsolines from "./isolines";
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
export class ContourLayer extends L.GridLayer {
  private demSource: DemTileSource;
  private layerOptions: ContourLayerOptions;

  constructor(options: ContourLayerOptions) {
    super({
      tileSize: options.tileSize ?? 256,
      opacity: options.opacity ?? 1,
      ...options,
    });

    if (!options.demSource) {
      throw new Error("ContourLayer requires a demSource option");
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
      interval = 10,
      majorInterval = interval * 5,
      minorColor = "#666",
      majorColor = "#333",
      minorWidth = 0.5,
      majorWidth = 1.5,
      multiplier = 1,
      overzoom = 0,
      subsampleBelow = 100,
    } = this.layerOptions;

    try {
      // Get HeightTile with neighbors for seamless contours
      const heightTile = await this.demSource.getHeightTileWithNeighbors(
        z,
        x,
        y,
        { multiplier, overzoom, subsampleBelow },
        abortController,
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!heightTile) {
        done(undefined, canvas);
        return;
      }

      // Generate isolines at the minor interval
      const isolines = generateIsolines(
        interval,
        heightTile,
        canvas.width,
        1, // buffer
      );

      // Draw the contours
      this.drawContours(
        ctx,
        isolines,
        canvas.width,
        heightTile.width,
        interval,
        majorInterval,
        minorColor,
        majorColor,
        minorWidth,
        majorWidth,
      );

      done(undefined, canvas);
    } catch (err) {
      if (!abortController.signal.aborted) {
        done(err as Error, canvas);
      }
    }
  }

  private drawContours(
    ctx: CanvasRenderingContext2D,
    isolines: { [ele: string]: number[][] },
    canvasSize: number,
    tileWidth: number,
    interval: number,
    majorInterval: number,
    minorColor: string,
    majorColor: string,
    minorWidth: number,
    majorWidth: number,
  ): void {
    const scale = canvasSize / tileWidth;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Group contours by type (minor/major) for efficient rendering
    // Each line is a flat array of [x0, y0, x1, y1, ...]
    const minorLines: number[][] = [];
    const majorLines: number[][] = [];

    for (const [eleStr, lines] of Object.entries(isolines)) {
      const elevation = Number(eleStr);
      const isMajor = elevation % majorInterval === 0;

      for (const line of lines) {
        if (isMajor) {
          majorLines.push(line);
        } else {
          minorLines.push(line);
        }
      }
    }

    // Draw minor contours first (underneath)
    if (minorLines.length > 0) {
      ctx.strokeStyle = minorColor;
      ctx.lineWidth = minorWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      for (const line of minorLines) {
        for (let i = 0; i < line.length; i += 2) {
          const px = line[i] * scale;
          const py = line[i + 1] * scale;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
      }

      ctx.stroke();
    }

    // Draw major contours on top
    if (majorLines.length > 0) {
      ctx.strokeStyle = majorColor;
      ctx.lineWidth = majorWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      for (const line of majorLines) {
        for (let i = 0; i < line.length; i += 2) {
          const px = line[i] * scale;
          const py = line[i + 1] * scale;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
      }

      ctx.stroke();
    }
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
 * Factory function for creating a ContourLayer.
 */
export function contourLayer(options: ContourLayerOptions): ContourLayer {
  return new ContourLayer(options);
}
