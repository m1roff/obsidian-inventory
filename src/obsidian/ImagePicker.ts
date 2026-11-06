import { CoverImage } from "../domain/CoverWriter";

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Opens the system photo picker (camera or library on a phone). Must be called
 * straight from a tap handler, before any `await`, or the browser blocks it.
 */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = createEl("input", { type: "file" });
    input.accept = "image/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Shrinks big camera photos to keep the vault and sync small; falls back to the original. */
export async function prepareImage(file: File): Promise<CoverImage> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = createEl("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (blob) return { bytes: await blob.arrayBuffer(), extension: "jpg" };
  } catch {
    // The browser could not decode it (e.g. HEIC): keep the original bytes.
  }
  return { bytes: await file.arrayBuffer(), extension: extensionOf(file) };
}

function extensionOf(file: File): string {
  const fromType = /^image\/([a-z0-9]+)/i.exec(file.type)?.[1];
  const fromName = /\.([a-z0-9]+)$/i.exec(file.name)?.[1];
  return (fromType ?? fromName ?? "jpg").replace("jpeg", "jpg");
}
