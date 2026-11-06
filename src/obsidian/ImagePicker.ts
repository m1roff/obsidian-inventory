import { CoverImage } from "../domain/CoverWriter";
import { describeError, DebugLog, NO_DEBUG_LOG } from "../domain/DebugLog";

/** `WeakRef` is newer than the library level this project compiles against, but every Obsidian has it. */
interface WeakReference<T extends object> {
  deref(): T | undefined;
}
const WeakRefCtor = (globalThis as unknown as { WeakRef: new <T extends object>(target: T) => WeakReference<T> })
  .WeakRef;

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Opens the system photo picker (camera or library on a phone). Must be called
 * straight from a tap handler, before any `await`, or the browser blocks it.
 * With `multiple` the library lets the owner tick several photos at once; the result is empty
 * when the picker was closed without a choice.
 */
export function pickImageFiles(multiple: boolean, log: DebugLog = NO_DEBUG_LOG): Promise<File[]> {
  return new Promise((resolve) => {
    const input = createEl("input", { type: "file" });
    input.accept = "image/*";
    input.multiple = multiple;
    let settled = false;
    const stopWatching: Array<() => void> = [];
    const finish = (files: File[], how: string): void => {
      if (settled) return;
      settled = true;
      for (const stop of stopWatching) stop();
      log.write("picker", how, {
        files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
      });
      resolve(files);
    };
    input.addEventListener("change", () => finish(Array.from(input.files ?? []), "change fired"));
    input.addEventListener("cancel", () => finish([], "cancel fired"));

    if (log.enabled) {
      // Only a weak reference: a strong one would keep the input alive and hide the very thing
      // we want to see (the input being thrown away while the system picker is open).
      const ref = new WeakRefCtor(input);
      const onFocus = (): void => {
        log.write("picker", "window got focus back", { settled });
        const timer = window.setTimeout(() => {
          const alive = ref.deref();
          log.write("picker", "1.5 s after the focus came back", {
            settled,
            inputStillAlive: alive !== undefined,
            files: alive?.files?.length ?? null,
          });
        }, 1500);
        stopWatching.push(() => window.clearTimeout(timer));
      };
      const onVisibility = (): void => log.write("picker", "visibility changed", { state: document.visibilityState });
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibility);
      stopWatching.push(() => {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibility);
      });
      log.write("picker", "opening the system picker", { inputInPage: input.isConnected });
    }
    input.click();
  });
}

/** One photo: the same picker without multiple choice. `null` when it was closed without one. */
export async function pickImageFile(log: DebugLog = NO_DEBUG_LOG): Promise<File | null> {
  return (await pickImageFiles(false, log))[0] ?? null;
}

/** Shrinks big camera photos to keep the vault and sync small; falls back to the original. */
export async function prepareImage(file: File, log: DebugLog = NO_DEBUG_LOG): Promise<CoverImage> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    log.write("image", "decoded", { width: bitmap.width, height: bitmap.height, scale });
    const canvas = createEl("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (blob) {
      log.write("image", "re-encoded as jpg", { bytes: blob.size });
      return { bytes: await blob.arrayBuffer(), extension: "jpg" };
    }
    log.write("image", "canvas gave no blob, keeping the original");
  } catch (error) {
    // The browser could not decode it (e.g. HEIC): keep the original bytes.
    log.write("image", "could not decode, keeping the original", { error: describeError(error) });
  }
  const extension = extensionOf(file);
  log.write("image", "using the original file", { extension, bytes: file.size });
  return { bytes: await file.arrayBuffer(), extension };
}

function extensionOf(file: File): string {
  const fromType = /^image\/([a-z0-9]+)/i.exec(file.type)?.[1];
  const fromName = /\.([a-z0-9]+)$/i.exec(file.name)?.[1];
  return (fromType ?? fromName ?? "jpg").replace("jpeg", "jpg");
}
