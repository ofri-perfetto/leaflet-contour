// import { DomEvent, TileLayer, type TileLayerOptions } from "leaflet"
// import { LocalDemManager } from "./local-dem-manager";
// import { decodeOptions, encodeOptions, getOptionsForZoom } from "./utils";
// import RemoteDemManager from "./remote-dem-manager";
// import type {
//   DemManager,
//   DemTile,
//   GlobalContourTileOptions,
//   Timing,
// } from "./types";
// import type WorkerDispatch from "./worker-dispatch";
// import Actor from "./actor";
// import { Timer } from "./performance";

// if (!Blob.prototype.arrayBuffer) {
//   Blob.prototype.arrayBuffer = function arrayBuffer() {
//     return new Promise<ArrayBuffer>((resolve, reject) => {
//       const fileReader = new FileReader();
//       fileReader.onload = (event) =>
//         resolve(event.target?.result as ArrayBuffer);
//       fileReader.onerror = reject;
//       fileReader.readAsArrayBuffer(this);
//     });
//   };
// }

// // for maplibre interop
// type RequestParameters = {
//   url: string;
//   headers?: any;
//   method?: "GET" | "POST" | "PUT";
//   body?: string;
//   type?: "string" | "json" | "arrayBuffer" | "image";
//   credentials?: "same-origin" | "include";
//   collectResourceTiming?: boolean;
// };
// type ExpiryData = {
//   cacheControl?: string | null;
//   expires?: Date | string | null;
// };
// type GetResourceResponse<T> = ExpiryData & {
//   data: T;
// };
// type AddProtocolAction = (
//   requestParameters: RequestParameters,
//   abortController: AbortController,
// ) => Promise<GetResourceResponse<ArrayBuffer>>;

// // for legacy maplibre-3 interop
// type ResponseCallbackV3 = (
//   error?: Error | undefined,
//   data?: any | undefined,
//   cacheControl?: string | undefined,
//   expires?: string | undefined,
// ) => void;
// type V3OrV4Protocol = <
//   T extends AbortController | ResponseCallbackV3,
//   R = T extends AbortController
//     ? Promise<GetResourceResponse<ArrayBuffer>>
//     : { cancel: () => void },
// >(
//   requestParameters: RequestParameters,
//   arg2: T,
// ) => R;

// const v3compat =
//   (v4: AddProtocolAction): V3OrV4Protocol =>
//   (requestParameters, arg2) => {
//     if (arg2 instanceof AbortController) {
//       return v4(requestParameters, arg2) as any;
//     } else {
//       const abortController = new AbortController();
//       v4(requestParameters, abortController)
//         .then(
//           (result) =>
//             arg2(
//               undefined,
//               result.data,
//               result.cacheControl as any,
//               result.expires as any,
//             ),
//           (err) => arg2(err),
//         )
//         .catch((err) => arg2(err));
//       return { cancel: () => abortController.abort() };
//     }
//   };

// const used = new Set<string>();

// interface DemTileLayerOptions extends TileLayerOptions {
//     /** Remote DEM tile url using `{z}` `{x}` and `{y}` placeholders */
//     url: string;
//     /** Number of most-recently-used tiles to cache */
//     cacheSize?: number;
//     /** Prefix for the maplibre protocol */
//     id?: string;
//     encoding?: "terrarium" | "mapbox";
//     /** Maximum zoom of tiles contained in the source */
//     maxzoom: number;
//     timeoutMs?: number;
//     /** Handle requests in a shared web worker to reduce UI-thread jank */
//     worker?: boolean;
//     actor?: Actor<WorkerDispatch>;

//     //my changed stuff
//     convertToImage : (value : DemTile) => string
//   }

// // {
// //     url,
// //     cacheSize = 100,
// //     id = "dem",
// //     encoding = "terrarium",
// //     maxzoom = 12,
// //     worker = true,
// //     timeoutMs = 10_000,
// //     actor,
// //   }

// /**
//  * A remote source of DEM tiles that can be connected to maplibre.
//  */
// export class DemTileLayer extends TileLayer {
//   sharedDemProtocolId: string;
//   contourProtocolId: string;
//   contourProtocolUrlBase: string;
//   manager: DemManager;
//   sharedDemProtocolUrl: string;
//   timingCallbacks: Array<(timing: Timing) => void> = [];

//   convertToImage: (value : DemTile) => string;

//   constructor(options: DemTileLayerOptions) {
//     super(options.url,options)
//     this.convertToImage = options.convertToImage
//     const id = options.id || "dem"
//     const worker = options.worker || true
//     let protocolPrefix = id;
//     let i = 1;
//     while (used.has(protocolPrefix)) {
//       protocolPrefix = id + i++;
//     }
//     used.add(protocolPrefix);
//     this.sharedDemProtocolId = `${protocolPrefix}-shared`;
//     this.contourProtocolId = `${protocolPrefix}-contour`;
//     this.sharedDemProtocolUrl = `${this.sharedDemProtocolId}://{z}/{x}/{y}`;
//     this.contourProtocolUrlBase = `${this.contourProtocolId}://{z}/{x}/{y}`;
//     const ManagerClass = worker ? RemoteDemManager : LocalDemManager;
//     this.manager = new ManagerClass({
//       demUrlPattern: options.url,
//       cacheSize : options.cacheSize || 100,
//       encoding : options.encoding || "terrarium",
//       maxzoom : options.maxZoom || 12,
//       timeoutMs : options.timeoutMs || 10_000,
//       actor : options.actor
//     });
//   }

//   /** Registers a callback to be invoked with a performance report after each tile is requested. */
//   onTiming = (callback: (timing: Timing) => void) => {
//     this.timingCallbacks.push(callback);
//   };

//   // getDemTile(
//   //   z: number,
//   //   x: number,
//   //   y: number,
//   //   abortController?: AbortController,
//   // ): Promise<DemTile> {
//   //   return 
//   // }

//   createTile(coords : L.Coords , done: any) {
// 		const tile = document.createElement('img');

//     DomEvent.on(tile, 'load', this._tileOnLoad.bind(this, done, tile));
//     DomEvent.on(tile, 'error', (event: Event) => this._tileOnError.call(this, done, tile, event as any));

//     if (this.options.crossOrigin || this.options.crossOrigin === '') {
//       tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
//     }

//     // for this new option we follow the documented behavior
//     // more closely by only setting the property when string
//     if (typeof this.options.referrerPolicy === 'string') {
//       tile.referrerPolicy = this.options.referrerPolicy;
//     }
    
//     // The alt attribute is set to the empty string,
//     // allowing screen readers to ignore the decorative image tiles.
//     // https://www.w3.org/WAI/tutorials/images/decorative/
//     // https://www.w3.org/TR/html-aria/#el-img-empty-alt
//     tile.alt = '';
//      this.manager.fetchAndParseTile(
//       coords.z,
//       coords.x,
//       coords.y,
//       new AbortController(),
//     ).then((value : DemTile) => {
//       tile.src = this.convertToImage(value)
//     })

    

//     return tile;
//   }

//   /**
//    * Adds contour and shared DEM protocol handlers to maplibre.
//    *
//    * @param maplibre maplibre global object
//    */
//   setupMaplibre = (maplibre: {
//     addProtocol: (id: string, protcol: V3OrV4Protocol) => void;
//   }) => {
//     maplibre.addProtocol(this.sharedDemProtocolId, this.sharedDemProtocol);
//     maplibre.addProtocol(this.contourProtocolId, this.contourProtocol);
//   };

//   parseUrl(url: string): [number, number, number] {
//     const [, z, x, y] = /\/\/(\d+)\/(\d+)\/(\d+)/.exec(url) || [];
//     return [Number(z), Number(x), Number(y)];
//   }

//   /**
//    * Callback to be used with maplibre addProtocol to re-use cached DEM tiles across sources.
//    */
//   sharedDemProtocolV4: AddProtocolAction = async (
//     request: RequestParameters,
//     abortController: AbortController,
//   ) => {
//     const [z, x, y] = this.parseUrl(request.url);
//     const timer = new Timer("main");
//     let timing: Timing;
//     try {
//       const data = await this.manager.fetchTile(
//         z,
//         x,
//         y,
//         abortController,
//         timer,
//       );
//       timing = timer.finish(request.url);
//       const arrayBuffer: ArrayBuffer = await data.data.arrayBuffer();
//       return {
//         data: arrayBuffer,
//         cacheControl: data.cacheControl,
//         expires: data.expires,
//       };
//     } catch (error) {
//       timing = timer.error(request.url);
//       throw error;
//     } finally {
//       this.timingCallbacks.forEach((cb) => cb(timing));
//     }
//   };

//   /**
//    * Callback to be used with maplibre addProtocol to generate contour vector tiles according
//    * to options encoded in the tile URL pattern generated by `contourProtocolUrl`.
//    */
//   contourProtocolV4: AddProtocolAction = async (
//     request: RequestParameters,
//     abortController: AbortController,
//   ) => {
//     const timer = new Timer("main");
//     let timing: Timing;
//     try {
//       const [z, x, y] = this.parseUrl(request.url);
//       const options = decodeOptions(request.url);
//       const data = await this.manager.fetchContourTile(
//         z,
//         x,
//         y,
//         getOptionsForZoom(options, z),
//         abortController,
//         timer,
//       );
//       timing = timer.finish(request.url);
//       return { data: data.arrayBuffer };
//     } catch (error) {
//       timing = timer.error(request.url);
//       throw error;
//     } finally {
//       this.timingCallbacks.forEach((cb) => cb(timing));
//     }
//   };

//   contourProtocol: V3OrV4Protocol = v3compat(this.contourProtocolV4);
//   sharedDemProtocol: V3OrV4Protocol = v3compat(this.sharedDemProtocolV4);

//   /**
//    * Returns a URL with the correct maplibre protocol prefix and all `option` encoded in request parameters.
//    */
//   contourProtocolUrl = (options: GlobalContourTileOptions) =>
//     `${this.contourProtocolUrlBase}?${encodeOptions(options)}`;
// }

// export function demTileLayer(options: DemTileLayerOptions) {
//   return new DemTileLayer(options)
// }

import L from "leaflet";
import { HeightTile } from "./height-tile";
import type { DemSource } from "./dem-source";
import type { DemManager, IndividualContourTileOptions, Timing } from "./types";
import generateIsolines from "./isolines";
import type Actor from "./actor";
import type WorkerDispatch from "./worker-dispatch";
import RemoteDemManager from "./remote-dem-manager";
import { LocalDemManager } from "./local-dem-manager";

interface DemHeightLayerOptions {
  //demSource: DemSource;
  /** Remote DEM tile url using `{z}` `{x}` and `{y}` placeholders */
  // url: string;
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

const used = new Set<string>();

/**
 * Leaflet GridLayer that renders DEM float grids to canvas tiles.
 */
export class DemHeightLayer extends L.GridLayer {
  // demSource: DemSource;
  contourOptions?: IndividualContourTileOptions;
  tileSizePx: number;
  colorFn: (e: number) => string;
  lineWidth: number;
  
  
  sharedDemProtocolId: string;
  
  contourProtocolId: string;
  
  contourProtocolUrlBase: string;
  
  manager: DemManager;
  
  sharedDemProtocolUrl: string;
  
  timingCallbacks: Array<(timing: Timing) => void> = [];
    /*url,
    cacheSize = 100,
    id = "dem",
    encoding = "terrarium",
    maxzoom = 12,
    worker = true,
    timeoutMs = 10_000,
    actor,*/
  constructor(url : string, options: DemHeightLayerOptions) {
    super({ tileSize: options.tileSize ?? 256 });

    this.contourOptions = options.contourOptions;
    this.tileSizePx = options.tileSize ?? 256;
    this.lineWidth = options.lineWidth ?? 1;

    this.colorFn =
      options.color ??
      ((e) => (e % 100 === 0 ? "#222" : "#666"));

    const id = options.id || "dem"
    let protocolPrefix = id;
    let i = 1;
    while (used.has(protocolPrefix)) {
      protocolPrefix = id + i++;
    }
    used.add(protocolPrefix);
    this.sharedDemProtocolId = `${protocolPrefix}-shared`;
    this.contourProtocolId = `${protocolPrefix}-contour`;
    this.sharedDemProtocolUrl = `${this.sharedDemProtocolId}://{z}/{x}/{y}`;
    this.contourProtocolUrlBase = `${this.contourProtocolId}://{z}/{x}/{y}`;
    const ManagerClass = options.worker ? RemoteDemManager : LocalDemManager;
    this.manager = new ManagerClass({
      demUrlPattern: url,
      cacheSize : options.cacheSize || 100,
      encoding: options.encoding || "terrarium",
      maxzoom: options.maxzoom,
      timeoutMs: options.maxzoom,
      actor : options.actor,
    });
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.tileSizePx;
    canvas.height = this.tileSizePx;

    const ctx = canvas.getContext("2d")!;
    const abort = new AbortController();
    (canvas as any)._abort = abort;

    const { x, y, z } = coords;

    (async () => {
      try {
        // Fetch DEM tile as HeightTile (float grid)
        console.log("CALLING FETCH")
        const demTile = await this.manager.fetchAndParseTile(
          z,
          x,
          y,
          abort,
        );
        console.log(demTile)
        const heightTile = HeightTile.fromRawDem(demTile)
        this.drawContours(ctx, heightTile);

        done(undefined, canvas);
      } catch (err) {
        if (!abort.signal.aborted) {
          done(err as Error, canvas);
        }
      }
    })();

    return canvas;
  }

  private drawContours(ctx: CanvasRenderingContext2D, tile: HeightTile) {
    const extent = tile.width;
    const scale = this.tileSizePx / extent;

    // Example: generate isolines every 10 meters
    // const levels = [];
    // for (let e = -1000; e <= 9000; e += 10) {
    //   levels.push(e);
    // }

    const isolines = generateIsolines(
      10,
      tile.materialize(1),
      extent,
      1,
    );

    ctx.clearRect(0, 0, this.tileSizePx, this.tileSizePx);

    for (const [elevationStr, lines] of Object.entries(isolines)) {
      const elevation = Number(elevationStr);

      ctx.strokeStyle = this.colorFn(elevation);
      ctx.lineWidth = this.lineWidth;
      ctx.beginPath();

      for (const line of lines) {
        for (let i = 0; i < line.length; i+=2) {
          const x = line[i];
          const y = line[i+1];
          const cx = x * scale;
          const cy = y * scale;
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
      }

      ctx.stroke();
    }
  }

  onRemove(map: L.Map) {
    const container = this.getContainer();
    if (container) {
      container.querySelectorAll("canvas").forEach((c) => {
        (c as any)._abort?.abort();
      });
    }
    return super.onRemove(map);
  }
}
