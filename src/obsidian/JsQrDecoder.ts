import jsQR from "jsqr";
import { QrDecoder } from "../domain/QrCode";

export class JsQrDecoder implements QrDecoder {
  decode(pixels: Uint8ClampedArray, width: number, height: number): string | null {
    return jsQR(pixels, width, height)?.data ?? null;
  }
}
