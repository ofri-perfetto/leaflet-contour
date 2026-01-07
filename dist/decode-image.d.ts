import type { DemTile, Encoding } from "./types";
/**
 * Decodes raw elevation data from a Uint8Array.
 * Supports multiple encoding formats:
 * - "terrarium": RGB encoded as r*256 + g + b/256 - 32768
 * - "mapbox": RGB encoded as -10000 + (r*256*256 + g*256 + b) * 0.1
 * - "raw16": Raw 16-bit little-endian elevation values (2 bytes per pixel)
 * - "raw32": Raw 32-bit little-endian float elevation values (4 bytes per pixel)
 */
export default function decodeImage(data: Uint8Array, encoding: Encoding, abortController: AbortController): Promise<DemTile>;
export declare function decodeParsedImage(width: number, height: number, encoding: Encoding, input: Uint8ClampedArray): DemTile;
