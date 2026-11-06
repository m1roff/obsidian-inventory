import { finderLayers, isFinderModule } from "../domain/QrFinders";
import { holeRect, labelLines, logoModules, QrLabelOptions } from "../domain/QrLabel";
import { QrPalette } from "../domain/QrStyle";
import { QrLogo } from "./QrLogo";

const MODULE_PX = 12;
const QUIET_MODULES = 4;
const LINE_GAP_PX = 8;
/** Corner radius of the emblem's ground square, as a share of its side. */
const HOLE_CORNER = 0.22;

/** Draws the label: the code with the emblem, then the chosen text lines. */
export function renderQrLabel(
  grid: boolean[][],
  id: string,
  options: QrLabelOptions,
  logo: QrLogo,
  palette: QrPalette,
): HTMLCanvasElement {
  const size = grid.length;
  const codePx = size * MODULE_PX;
  const width = codePx + 2 * QUIET_MODULES * MODULE_PX;
  const lines = labelLines(id, options);
  const lineHeight = MODULE_PX * 3;
  const textHeight = lines.length > 0 ? lines.length * (lineHeight + LINE_GAP_PX) : 0;
  const origin = QUIET_MODULES * MODULE_PX;
  // The text starts a little below the code, so it does not crowd the code's quiet zone.
  const textTop = origin + codePx + 2 * MODULE_PX;
  const height = lines.length > 0 ? textTop + textHeight + 2 * MODULE_PX : width;

  const canvas = createEl("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.ink;
  grid.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark && !isFinderModule(x, y, size)) ctx.fillRect(origin + x * MODULE_PX, origin + y * MODULE_PX, MODULE_PX, MODULE_PX);
    }),
  );

  // The three corner patterns are drawn rounded rather than as plain squares.
  for (const layer of finderLayers(size)) {
    ctx.fillStyle = layer.dark ? palette.ink : palette.paper;
    roundedRect(
      ctx,
      origin + layer.x * MODULE_PX,
      origin + layer.y * MODULE_PX,
      layer.side * MODULE_PX,
      layer.side * MODULE_PX,
      layer.radius * MODULE_PX,
    );
    ctx.fill();
  }

  // Clear the middle (one square of margin), then draw the emblem in it.
  const hole = holeRect(size, logo.extraBelow);
  const holeX = origin + hole.x * MODULE_PX;
  const holeY = origin + hole.y * MODULE_PX;
  ctx.fillStyle = palette.paper;
  roundedRect(
    ctx,
    holeX,
    holeY,
    hole.width * MODULE_PX,
    hole.height * MODULE_PX,
    Math.min(hole.width, hole.height) * MODULE_PX * HOLE_CORNER,
  );
  ctx.fill();
  logo.draw(ctx, holeX + MODULE_PX, holeY + MODULE_PX, logoModules(size) * MODULE_PX, palette);

  ctx.fillStyle = palette.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.font = `${index === 0 && options.showId ? "bold " : ""}${lineHeight}px sans-serif`;
    ctx.fillText(line, width / 2, textTop + index * (lineHeight + LINE_GAP_PX), width - 2 * MODULE_PX);
  });
  return canvas;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const end = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(end, y, end, bottom, radius);
  ctx.arcTo(end, bottom, x, bottom, radius);
  ctx.arcTo(x, bottom, x, y, radius);
  ctx.arcTo(x, y, end, y, radius);
  ctx.closePath();
}
