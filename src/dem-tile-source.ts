import { LocalDemManager } from "./local-dem-manager";
import RemoteDemManager from "./remote-dem-manager";
import { HeightTile } from "./height-tile";
import { Timer } from "./performance";
import type {
  DemManager,
  DemTile,
  Encoding,
  Timing,
  HeightTileOptions,
} from "./types";
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
export class DemTileSource {
  private manager: DemManager;
  private timingCallbacks: Array<(timing: Timing) => void> = [];
  readonly url: string;
  readonly encoding: Encoding;
  readonly maxzoom: number;

  constructor(options: DemTileSourceOptions) {
    const {
      url,
      encoding = "terrarium",
      maxzoom = 12,
      cacheSize = 100,
      timeoutMs = 10_000,
      worker = true,
      actor,
    } = options;

    this.url = url;
    this.encoding = encoding;
    this.maxzoom = maxzoom;

    const ManagerClass = worker ? RemoteDemManager : LocalDemManager;
    this.manager = new ManagerClass({
      demUrlPattern: url,
      cacheSize,
      encoding,
      maxzoom,
      timeoutMs,
      actor,
    });
  }

  /**
   * Wait for the manager to be ready (worker initialized).
   */
  get loaded(): Promise<void> {
    return this.manager.loaded;
  }

  /**
   * Register a callback to receive timing information for each tile request.
   */
  onTiming(callback: (timing: Timing) => void): void {
    this.timingCallbacks.push(callback);
  }

  /**
   * Fetch and parse a single DEM tile.
   */
  async getDemTile(
    z: number,
    x: number,
    y: number,
    abortController: AbortController,
  ): Promise<DemTile> {
    return this.manager.fetchAndParseTile(z, x, y, abortController);
  }

  /**
   * Fetch a DEM tile and convert it to a HeightTile.
   * Supports overzoom for using lower-resolution tiles at higher zoom levels.
   */
  async getHeightTile(
    z: number,
    x: number,
    y: number,
    options: HeightTileOptions,
    abortController: AbortController,
  ): Promise<HeightTile> {
    const zoom = Math.min(z - (options.overzoom || 0), this.maxzoom);
    const subZ = z - zoom;
    const div = 1 << subZ;
    const newX = Math.floor(x / div);
    const newY = Math.floor(y / div);

    const tile = await this.manager.fetchAndParseTile(
      zoom,
      newX,
      newY,
      abortController,
    );

    return HeightTile.fromRawDem(tile).split(subZ, x % div, y % div);
  }

  /**
   * Fetch a HeightTile with all 8 neighbors for seamless contour generation.
   * The returned HeightTile is a virtual tile that combines the center tile
   * with its neighbors to avoid edge artifacts.
   */
  async getHeightTileWithNeighbors(
    z: number,
    x: number,
    y: number,
    options: HeightTileOptions,
    abortController: AbortController,
    timer?: Timer,
  ): Promise<HeightTile | undefined> {
    const max = 1 << z;
    const neighborPromises: (Promise<HeightTile> | undefined)[] = [];

    // Fetch 3x3 grid of tiles (center + 8 neighbors)
    for (let iy = y - 1; iy <= y + 1; iy++) {
      for (let ix = x - 1; ix <= x + 1; ix++) {
        neighborPromises.push(
          iy < 0 || iy >= max
            ? undefined
            : this.getHeightTile(
                z,
                (ix + max) % max, // Wrap X coordinate
                iy,
                options,
                abortController,
              ),
        );
      }
    }

    const neighbors = await Promise.all(neighborPromises);
    let virtualTile = HeightTile.combineNeighbors(neighbors);

    if (!virtualTile) {
      return undefined;
    }

    // Subsample for smoother contours at high zoom levels
    const subsampleBelow = options.subsampleBelow ?? 100;
    if (virtualTile.width >= subsampleBelow) {
      virtualTile = virtualTile.materialize(2);
    } else {
      while (virtualTile.width < subsampleBelow) {
        virtualTile = virtualTile.subsamplePixelCenters(2).materialize(2);
      }
    }

    // Apply averaging and scaling
    virtualTile = virtualTile
      .averagePixelCentersToGrid()
      .scaleElevation(options.multiplier ?? 1)
      .materialize(1);

    return virtualTile;
  }
}

/**
 * Factory function to create a DemTileSource.
 */
export function demTileSource(options: DemTileSourceOptions): DemTileSource {
  return new DemTileSource(options);
}
