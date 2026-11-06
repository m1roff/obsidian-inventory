import { QrDecoder } from "../domain/QrCode";
import { pickImageFile } from "../obsidian/ImagePicker";

const MAX_SIDE = 1600;

/**
 * Asks for a photo (camera or library) and reads the QR code on it. The photo
 * is only looked at in memory: nothing is saved. Must be called straight from
 * a tap, before any `await`. Null: no photo chosen, or no code found on it.
 */
export async function scanQrFromPhoto(decoder: QrDecoder): Promise<string | null> {
  const file = await pickImageFile();
  if (!file) return null;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = createEl("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return decoder.decode(pixels.data, pixels.width, pixels.height);
  } catch {
    // The browser could not decode the picture (e.g. an unsupported format).
    return null;
  }
}
