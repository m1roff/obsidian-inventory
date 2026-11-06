/** Turns text into the QR grid (true = dark square). */
export interface QrEncoder {
  encode(text: string): boolean[][];
}

/** Finds a QR code in picture pixels (RGBA) and returns its text. */
export interface QrDecoder {
  decode(pixels: Uint8ClampedArray, width: number, height: number): string | null;
}
