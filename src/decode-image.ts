import type Actor from "./actor";
import {
  isAborted,
  offscreenCanvasSupported,
  onAbort,
  shouldUseVideoFrame,
} from "./utils";
import type { MainThreadDispatch } from "./remote-dem-manager";
import type { DemTile, Encoding } from "./types";

let offscreenCanvas: OffscreenCanvas;
let offscreenContext: OffscreenCanvasRenderingContext2D | null;
let canvas: HTMLCanvasElement;
let canvasContext: CanvasRenderingContext2D | null;

/**
 * Decodes raw elevation data from a Uint8Array.
 * Supports multiple encoding formats:
 * - "terrarium": RGB encoded as r*256 + g + b/256 - 32768
 * - "mapbox": RGB encoded as -10000 + (r*256*256 + g*256 + b) * 0.1
 * - "raw16": Raw 16-bit little-endian elevation values (2 bytes per pixel)
 * - "raw32": Raw 32-bit little-endian float elevation values (4 bytes per pixel)
 */
export default async function decodeImage(
  data: Uint8Array,
  encoding: Encoding,
  abortController: AbortController,
): Promise<DemTile> {
  if (isAborted(abortController)) return null as any as DemTile;

  // Handle raw elevation data formats
  if (encoding === "raw16") {
    return decodeRaw16(data);
  }
  if (encoding === "raw32") {
    return decodeRaw32(data);
  }

  // For terrarium/mapbox, the data is PNG image bytes - decode as image
  // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const blob = new Blob([buffer], { type: "image/png" });
  return decodeImageFromBlob(blob, encoding, abortController);
}

/**
 * Decode raw 16-bit little-endian elevation data.
 * First 4 bytes are width (uint16) and height (uint16), rest is elevation data.
 */
function decodeRaw16(data: Uint8Array): DemTile {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read header: width and height as 16-bit unsigned integers
  const width = view.getUint16(0, true); // little-endian
  const height = view.getUint16(2, true);

  const elevations = new Float32Array(width * height);
  const headerSize = 4;

  for (let i = 0; i < width * height; i++) {
    // Read as signed 16-bit integer (elevation in meters or decimeters)
    elevations[i] = view.getInt16(headerSize + i * 2, true);
  }

  return { width, height, data: elevations };
}

/**
 * Decode raw 32-bit little-endian float elevation data.
 * First 4 bytes are width (uint16) and height (uint16), rest is elevation data.
 */
function decodeRaw32(data: Uint8Array): DemTile {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read header: width and height as 16-bit unsigned integers
  const width = view.getUint16(0, true);
  const height = view.getUint16(2, true);

  const elevations = new Float32Array(width * height);
  const headerSize = 4;

  for (let i = 0; i < width * height; i++) {
    elevations[i] = view.getFloat32(headerSize + i * 4, true);
  }

  return { width, height, data: elevations };
}

/**
 * Parses a `raster-dem` image blob into a DemTile.
 * Uses the best available method based on browser capabilities.
 */
async function decodeImageFromBlob(
  blob: Blob,
  encoding: Encoding,
  abortController: AbortController,
): Promise<DemTile> {
  if (shouldUseVideoFrame()) {
    return decodeImageVideoFrame(blob, encoding, abortController);
  } else if (offscreenCanvasSupported()) {
    return decodeImageModern(blob, encoding, abortController);
  } else if (isWorker()) {
    return decodeImageOnMainThread(blob, encoding, abortController);
  } else {
    return decodeImageOld(blob, encoding, abortController);
  }
}

/**
 * Parses a `raster-dem` image into a DemTile using Webcoded VideoFrame API.
 */
async function decodeImageModern(
  blob: Blob,
  encoding: Encoding,
  abortController: AbortController,
): Promise<DemTile> {
  const img = await createImageBitmap(blob);
  if (isAborted(abortController)) return null as any as DemTile;
  return decodeImageUsingOffscreenCanvas(img, encoding);
}

function decodeImageUsingOffscreenCanvas(
  img: ImageBitmap,
  encoding: Encoding,
): DemTile {
  if (!offscreenCanvas) {
    offscreenCanvas = new OffscreenCanvas(img.width, img.height);
    offscreenContext = offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
  }

  return getElevations(img, encoding, offscreenCanvas, offscreenContext);
}

/**
 * Parses a `raster-dem` image into a DemTile using webcodec VideoFrame API which works
 * even when browsers disable/degrade the canvas getImageData API as a privacy protection.
 */
async function decodeImageVideoFrame(
  blob: Blob,
  encoding: Encoding,
  abortController: AbortController,
): Promise<DemTile> {
  const img = await createImageBitmap(blob);
  if (isAborted(abortController)) return null as any as DemTile;

  const vf = new VideoFrame(img, { timestamp: 0 });
  try {
    // formats we can handle: BGRX, BGRA, RGBA, RGBX
    const valid =
      vf?.format?.startsWith("BGR") || vf?.format?.startsWith("RGB");
    if (!valid) {
      throw new Error(`Unrecognized format: ${vf?.format}`);
    }
    const swapBR = vf?.format?.startsWith("BGR");
    const size = vf.allocationSize();
    const data = new Uint8ClampedArray(size);
    await vf.copyTo(data);
    if (swapBR) {
      for (let i = 0; i < data.length; i += 4) {
        const tmp = data[i];
        data[i] = data[i + 2];
        data[i + 2] = tmp;
      }
    }
    return decodeParsedImage(img.width, img.height, encoding, data);
  } catch (_) {
    if (isAborted(abortController)) return null as any as DemTile;
    // fall back to offscreen canvas
    return decodeImageUsingOffscreenCanvas(img, encoding);
  } finally {
    vf.close();
  }
}

/**
 * Parses a `raster-dem` image into a DemTile using `<img>` element drawn to a `<canvas>`.
 * Only works on the main thread, but works across all browsers.
 */
async function decodeImageOld(
  blob: Blob,
  encoding: Encoding,
  abortController: AbortController,
): Promise<DemTile> {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvasContext = canvas.getContext("2d", {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D;
  }
  const img: HTMLImageElement = new Image();
  onAbort(abortController, () => (img.src = ""));
  const fetchedImage = await new Promise<HTMLImageElement>(
    (resolve, reject) => {
      img.onload = () => {
        if (!isAborted(abortController)) resolve(img);
        URL.revokeObjectURL(img.src);
        img.onload = null;
      };
      img.onerror = () => reject(new Error("Could not load image."));
      img.src = blob.size ? URL.createObjectURL(blob) : "";
    },
  );
  return getElevations(fetchedImage, encoding, canvas, canvasContext);
}

/**
 * Parses a `raster-dem` image in a worker that doesn't support OffscreenCanvas and createImageBitmap
 * by running decodeImageOld on the main thread and returning the result.
 */
function decodeImageOnMainThread(
  blob: Blob,
  encoding: Encoding,
  abortController: AbortController,
): Promise<DemTile> {
  // Convert blob back to Uint8Array for transfer
  return blob.arrayBuffer().then((buffer) => {
    const data = new Uint8Array(buffer);
    return ((self as any).actor as Actor<MainThreadDispatch>).send(
      "decodeImage",
      [],
      abortController,
      undefined,
      data,
      encoding,
    );
  });
}

function isWorker(): boolean {
  return (
    // @ts-expect-error WorkerGlobalScope defined
    typeof WorkerGlobalScope !== "undefined" &&
    typeof self !== "undefined" &&
    // @ts-expect-error WorkerGlobalScope defined
    self instanceof WorkerGlobalScope
  );
}

function getElevations(
  img: ImageBitmap | HTMLImageElement,
  encoding: Encoding,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  canvasContext:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null,
): DemTile {
  canvas.width = img.width;
  canvas.height = img.height;

  if (!canvasContext) throw new Error("failed to get context");

  canvasContext.drawImage(img, 0, 0, img.width, img.height);

  const rgba = canvasContext.getImageData(0, 0, img.width, img.height).data;
  return decodeParsedImage(img.width, img.height, encoding, rgba);
}

export function decodeParsedImage(
  width: number,
  height: number,
  encoding: Encoding,
  input: Uint8ClampedArray,
): DemTile {
  const decoder: (r: number, g: number, b: number) => number =
    encoding === "mapbox"
      ? (r, g, b) => -10000 + (r * 256 * 256 + g * 256 + b) * 0.1
      : (r, g, b) => r * 256 + g + b / 256 - 32768;
  const data = new Float32Array(width * height);
  for (let i = 0; i < input.length; i += 4) {
    data[i / 4] = decoder(input[i], input[i + 1], input[i + 2]);
  }
  return { width, height, data };
}
