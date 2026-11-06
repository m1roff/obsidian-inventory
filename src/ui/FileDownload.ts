import { Platform } from "obsidian";

export type SaveOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Hands a text file to the user. A byte order mark goes first: without it programs like
 * Excel and P-touch Editor often read non-English letters as garbage.
 */
export async function saveTextFile(fileName: string, text: string, mimeType = "text/csv"): Promise<SaveOutcome> {
  return saveFile(new File(["﻿", text], fileName, { type: `${mimeType};charset=utf-8` }));
}

/**
 * Hands a ready file to the user: on a phone through the share sheet (Save to Files,
 * AirDrop, Mail...), the same way QR labels are shared; on a computer through the
 * browser's download.
 *
 * On a phone the share sheet opens only right after a tap: call this from the tap handler
 * without waiting for anything slow first. If the phone refuses, the error is a
 * DOMException named NotAllowedError.
 */
export async function saveFile(file: File): Promise<SaveOutcome> {
  if (Platform.isMobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      // Closing the share sheet counts as an error too: not worth a message.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const link = createEl("a", { attr: { href: url, download: file.name } });
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
