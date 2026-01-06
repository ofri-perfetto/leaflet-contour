import L from "leaflet";
import generateIsolines from "./isolines";
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

interface LabelPosition {
  x: number;
  y: number;
  angle: number;
  elevation: number;
}

/**
 * Leaflet GridLayer that renders elevation labels along contour lines.
 */
export class ContourLabelLayer extends L.GridLayer {
  private demSource: DemTileSource;
  private layerOptions: ContourLabelLayerOptions;

  constructor(options: ContourLabelLayerOptions) {
    super({
      tileSize: options.tileSize ?? 256,
      opacity: options.opacity ?? 1,
      ...options,
    });

    if (!options.demSource) {
      throw new Error("ContourLabelLayer requires a demSource option");
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
      interval = 100,
      font = "Arial, sans-serif",
      fontSize = 10,
      fontColor = "#333",
      haloColor = "white",
      haloWidth = 2,
      multiplier = 1,
      formatter = (e) => String(Math.round(e)),
      minLabelSpacing = 100,
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

      // Generate isolines at the label interval
      const isolines = generateIsolines(
        interval,
        heightTile,
        canvas.width,
        1, // buffer
      );

      // Find label positions along contour lines
      const labels = this.findLabelPositions(
        isolines,
        canvas.width,
        heightTile.width,
        interval,
        minLabelSpacing,
      );

      // Draw labels
      this.drawLabels(ctx, labels, font, fontSize, fontColor, haloColor, haloWidth, formatter);

      done(undefined, canvas);
    } catch (err) {
      if (!abortController.signal.aborted) {
        done(err as Error, canvas);
      }
    }
  }

  /**
   * Find suitable positions for labels along contour lines.
   * Prefers straight segments and avoids crowding.
   */
  private findLabelPositions(
    isolines: { [ele: string]: number[][] },
    canvasSize: number,
    tileWidth: number,
    interval: number,
    minSpacing: number,
  ): LabelPosition[] {
    const scale = canvasSize / tileWidth;
    const labels: LabelPosition[] = [];
    const occupiedAreas: { x: number; y: number }[] = [];

    // Only label contours at the specified interval
    for (const [eleStr, lines] of Object.entries(isolines)) {
      const elevation = Number(eleStr);

      // Skip if not at label interval
      if (elevation % interval !== 0) continue;

      for (const line of lines) {
        if (line.length < 6) continue; // Need at least 3 points

        // Find segments with low curvature for label placement
        const positions = this.findGoodPositionsOnLine(line, scale, canvasSize);

        for (const pos of positions) {
          // Check if too close to existing labels
          const tooClose = occupiedAreas.some(
            (occ) =>
              Math.sqrt(
                Math.pow(occ.x - pos.x, 2) + Math.pow(occ.y - pos.y, 2),
              ) < minSpacing,
          );

          if (!tooClose) {
            labels.push({
              x: pos.x,
              y: pos.y,
              angle: pos.angle,
              elevation,
            });
            occupiedAreas.push({ x: pos.x, y: pos.y });
          }
        }
      }
    }

    return labels;
  }

  /**
   * Find positions along a line segment where text can be placed nicely.
   */
  private findGoodPositionsOnLine(
    line: number[],
    scale: number,
    canvasSize: number,
  ): { x: number; y: number; angle: number }[] {
    const positions: { x: number; y: number; angle: number }[] = [];
    const margin = 20; // Pixels from tile edge

    // Sample points along the line
    for (let i = 2; i < line.length - 4; i += 6) {
      const x1 = line[i] * scale;
      const y1 = line[i + 1] * scale;
      const x2 = line[i + 2] * scale;
      const y2 = line[i + 3] * scale;

      // Skip if too close to edge
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      if (
        midX < margin ||
        midX > canvasSize - margin ||
        midY < margin ||
        midY > canvasSize - margin
      ) {
        continue;
      }

      // Calculate angle of the segment
      let angle = Math.atan2(y2 - y1, x2 - x1);

      // Keep text mostly upright (rotate 180 if upside down)
      if (angle > Math.PI / 2) {
        angle -= Math.PI;
      } else if (angle < -Math.PI / 2) {
        angle += Math.PI;
      }

      // Check segment length (need enough space for label)
      const segLen = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      if (segLen < 20) continue;

      positions.push({
        x: midX,
        y: midY,
        angle,
      });
    }

    return positions;
  }

  /**
   * Draw labels with halo effect for readability.
   */
  private drawLabels(
    ctx: CanvasRenderingContext2D,
    labels: LabelPosition[],
    font: string,
    fontSize: number,
    fontColor: string,
    haloColor: string,
    haloWidth: number,
    formatter: (elevation: number) => string,
  ): void {
    ctx.font = `${fontSize}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const label of labels) {
      const text = formatter(label.elevation);

      ctx.save();
      ctx.translate(label.x, label.y);
      ctx.rotate(label.angle);

      // Draw halo/outline
      if (haloWidth > 0) {
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = haloWidth * 2;
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(text, 0, 0);
      }

      // Draw text
      ctx.fillStyle = fontColor;
      ctx.fillText(text, 0, 0);

      ctx.restore();
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
 * Factory function for creating a ContourLabelLayer.
 */
export function contourLabelLayer(
  options: ContourLabelLayerOptions,
): ContourLabelLayer {
  return new ContourLabelLayer(options);
}
