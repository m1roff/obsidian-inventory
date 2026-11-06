import { QrPalette } from "../domain/QrStyle";
import { facetPath, ICON_BOUNDS, ICON_FACETS, ICON_OUTLINE_PATHS } from "./InventoryIcon";

/** The emblem drawn in the middle of a QR label. Swap the class to change it. */
export interface QrLogo {
  /**
   * Room the emblem needs under its square, as a share of the square's side
   * (0 for none). The square itself stays in the middle of the code.
   */
  readonly extraBelow: number;
  /** Draws in the square at (x, y) with the given side, and below it if `extraBelow` is set. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, palette: QrPalette): void;
}

/** The plugin emblem in two colours only, ink on paper (a label must print on any printer). */
export class InventoryLogo implements QrLogo {
  readonly extraBelow = 0;

  private readonly outline = ICON_OUTLINE_PATHS.map((d) => new Path2D(d));
  private readonly facets = ICON_FACETS.map((facet) => new Path2D(facetPath(facet.points)));

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, palette: QrPalette): void {
    const scale = side / ICON_BOUNDS.width;
    const offsetX = x - ICON_BOUNDS.x * scale;
    const offsetY = y + (side - ICON_BOUNDS.height * scale) / 2 - ICON_BOUNDS.y * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // The crystal is solid ink with thin paper seams between facets.
    ctx.fillStyle = palette.ink;
    ctx.strokeStyle = palette.paper;
    ctx.lineWidth = 14;
    for (const facet of this.facets) {
      ctx.fill(facet);
      ctx.stroke(facet);
    }

    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 48;
    for (const path of this.outline) ctx.stroke(path);
    ctx.restore();
  }
}

/** The emblem with a map pin under it: the mark of a place. */
export class PlaceLogo implements QrLogo {
  readonly extraBelow = 0.6;

  constructor(private readonly base: QrLogo) {}

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, palette: QrPalette): void {
    this.base.draw(ctx, x, y, side, palette);

    const width = side * 0.4;
    const height = side * 0.52;
    const radius = width / 2;
    const centerX = x + side / 2;
    const top = y + side + side * 0.05;
    const centerY = top + radius;
    // Where the straight sides of the drop leave the circle, seen from its tip.
    const spread = Math.acos(radius / (height - radius));

    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.moveTo(centerX, top + height);
    ctx.lineTo(
      centerX + radius * Math.sin(spread),
      centerY + radius * Math.cos(spread),
    );
    ctx.arc(centerX, centerY, radius, Math.PI / 2 - spread, Math.PI / 2 + spread, true);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
