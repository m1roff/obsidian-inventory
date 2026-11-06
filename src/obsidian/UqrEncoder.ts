import { encode } from "uqr";
import { QrEncoder } from "../domain/QrCode";

/** Highest error correction: the emblem in the middle covers part of the code. */
export class UqrEncoder implements QrEncoder {
  encode(text: string): boolean[][] {
    return encode(text, { ecc: "H", border: 0 }).data;
  }
}
