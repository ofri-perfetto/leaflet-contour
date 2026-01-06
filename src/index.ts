// Core utilities (framework-agnostic)
export * from "./isolines";
export * from "./decode-image";
export * from "./local-dem-manager";
export * from "./height-tile";
import CONFIG from "./config";

// Main DEM source
export * from "./dem-tile-source";


// Leaflet layers
export * from "./contour-layer";
export * from "./hillshade-layer";
export * from "./contour-label-layer";

// Types - re-exported below
export type {
  DemTile,
  Encoding,
  Timing,
  HeightTileOptions,
} from "./types";


// // Default export for UMD/browser usage
// const exported = {
//   // Core
//   generateIsolines,
//   decodeParsedImage,
//   LocalDemManager,
//   HeightTile,

//   // DEM source
//   DemTileSource,
//   demTileSource,

//   // Layers
//   ContourLayer,
//   contourLayer,
//   HillshadeLayer,
//   hillshadeLayer,
//   ContourLabelLayer,
//   contourLabelLayer,

//   // Worker URL configuration
//   set workerUrl(url: string) {
//     CONFIG.workerUrl = url;
//   },
//   get workerUrl() {
//     return CONFIG.workerUrl;
//   },
// };

// export default exported;

// // Named exports for ES modules
// export {
//   // Core
//   generateIsolines,
//   decodeParsedImage,
//   LocalDemManager,
//   HeightTile,

//   // DEM source
//   DemTileSource,
//   demTileSource,

//   // Layers
//   ContourLayer,
//   contourLayer,
//   HillshadeLayer,
//   hillshadeLayer,
//   ContourLabelLayer,
//   contourLabelLayer,
// };

// Re-export layer option types explicitly for convenience
export type { DemTileSourceOptions } from "./dem-tile-source";
export type { ContourLayerOptions } from "./contour-layer";
export type { HillshadeLayerOptions } from "./hillshade-layer";
export type { ContourLabelLayerOptions } from "./contour-label-layer";

// Worker URL configuration helpers
export const setWorkerUrl = (url: string) => {
  CONFIG.workerUrl = url;
};
export const getWorkerUrl = () => CONFIG.workerUrl;
