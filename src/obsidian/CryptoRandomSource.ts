import { RandomSource } from "../domain/IdGenerator";

export class CryptoRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % maxExclusive;
  }
}
