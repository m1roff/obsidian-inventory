export interface QrLabelOptions {
  readonly showId: boolean;
  readonly showCaption: boolean;
  /** Free text under the code; empty means none. */
  readonly caption: string;
}

/** Share of the code's width taken by the emblem in the middle. */
const LOGO_SHARE = 0.22;

/** Side of the emblem in code squares; the code is built to survive losing it. */
export function logoModules(codeSize: number): number {
  return Math.max(1, Math.round(codeSize * LOGO_SHARE));
}

/** Text lines under the code, top to bottom. */
export function labelLines(id: string, options: QrLabelOptions): string[] {
  const lines: string[] = [];
  if (options.showId && id.trim() !== "") lines.push(id.trim());
  if (options.showCaption && options.caption.trim() !== "") lines.push(options.caption.trim());
  return lines;
}

export interface HoleRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The area cleared in the code for the emblem, in code squares: the emblem
 * with one square of margin around it. The emblem's main part stays in the
 * middle of the code; `extraBelow` (a share of its side) makes room for
 * something under it, like the pin on a place label.
 */
export function holeRect(codeSize: number, extraBelow: number): HoleRect {
  const side = logoModules(codeSize);
  const width = side + 2;
  return {
    x: (codeSize - width) / 2,
    y: (codeSize - side) / 2 - 1,
    width,
    height: side + 2 + Math.round(extraBelow * side),
  };
}
