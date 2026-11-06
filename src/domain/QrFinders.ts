/** Side of the big square in three corners of a QR code, in code squares. */
export const FINDER_SIDE = 7;

/** One layer of a finder pattern, in code squares: drawn in order, dark or light. */
export interface FinderLayer {
  readonly x: number;
  readonly y: number;
  readonly side: number;
  readonly radius: number;
  readonly dark: boolean;
}

function origins(codeSize: number): Array<[number, number]> {
  const far = codeSize - FINDER_SIDE;
  return [
    [0, 0],
    [far, 0],
    [0, far],
  ];
}

/** True for squares that belong to a corner pattern: those are drawn rounded instead. */
export function isFinderModule(x: number, y: number, codeSize: number): boolean {
  return origins(codeSize).some(
    ([ox, oy]) => x >= ox && x < ox + FINDER_SIDE && y >= oy && y < oy + FINDER_SIDE,
  );
}

/**
 * The three corner patterns as rounded shapes: a dark ring, then its light
 * inside, then the dark middle. Same proportions as the square originals, so
 * scanners still find them.
 */
export function finderLayers(codeSize: number): FinderLayer[] {
  return origins(codeSize).flatMap(([ox, oy]) => [
    { x: ox, y: oy, side: 7, radius: 2.4, dark: true },
    { x: ox + 1, y: oy + 1, side: 5, radius: 1.5, dark: false },
    { x: ox + 2, y: oy + 2, side: 3, radius: 1.5, dark: true },
  ]);
}

/** Whether a point (in code squares) is inside a layer's rounded square. */
export function insideLayer(layer: FinderLayer, px: number, py: number): boolean {
  const { x, y, side, radius } = layer;
  if (px < x || px > x + side || py < y || py > y + side) return false;
  const cx = Math.min(Math.max(px, x + radius), x + side - radius);
  const cy = Math.min(Math.max(py, y + radius), y + side - radius);
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}
