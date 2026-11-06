/** The two looks of a QR label by its ground: `light` is the usual black code on white, `dark` is a white code on a black ground. */
export type QrStyle = "dark" | "light";

export const QR_STYLES: readonly QrStyle[] = ["light", "dark"];

export const DEFAULT_QR_STYLE: QrStyle = "light";

/** The two colours a label is drawn with: the code and its text (`ink`) and the ground (`paper`). */
export interface QrPalette {
  readonly ink: string;
  readonly paper: string;
}

export function qrPalette(style: QrStyle): QrPalette {
  // Pure black and white on purpose: a label has to print on any printer.
  return style === "dark" ? { ink: "#fff", paper: "#000" } : { ink: "#000", paper: "#fff" };
}

/** Anything that is not a known style gives the default. */
export function parseQrStyle(raw: unknown): QrStyle {
  return QR_STYLES.find((style) => style === raw) ?? DEFAULT_QR_STYLE;
}
