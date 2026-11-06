import { qrPalette } from "../domain/QrStyle";
import { QrLogo } from "./QrLogo";

/** Side of the emblem's square in pixels: sharp enough to print large, still a light file. */
export const ICON_EXPORT_SIDE = 1024;
/** Empty border kept around the emblem, as a share of its square. */
const MARGIN = 0.03;

/**
 * The emblem as a black shape on a transparent ground, cropped to its own edges.
 * It is drawn black on white first (the way labels are drawn), then the darkness of each
 * pixel becomes its opacity, so the soft edges stay smooth and holes stay see-through.
 */
export function renderIconCanvas(logo: QrLogo, side = ICON_EXPORT_SIDE): HTMLCanvasElement {
  const palette = qrPalette("light");
  const margin = Math.round(side * MARGIN);
  const width = side + margin * 2;
  const height = Math.ceil(side * (1 + logo.extraBelow)) + margin * 2;

  const canvas = createEl("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d canvas");
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, width, height);
  logo.draw(ctx, margin, margin, side, palette);

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const alpha = 255 - (data[at] ?? 255);
      data[at] = 0;
      data[at + 1] = 0;
      data[at + 2] = 0;
      data[at + 3] = alpha;
      if (alpha > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  if (right < 0) return canvas;

  const crop = createEl("canvas");
  crop.width = right - left + 1;
  crop.height = bottom - top + 1;
  crop.getContext("2d")?.drawImage(canvas, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
  });
}
