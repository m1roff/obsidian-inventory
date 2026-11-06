export interface CoverImage {
  readonly bytes: ArrayBuffer;
  /** File extension without a dot, e.g. `jpg`. */
  readonly extension: string;
}

/** What a photo does to the note's `cover`: replace it, fill it only when empty, or leave it. */
export type CoverMode = "replace" | "ifEmpty" | "none";

export interface AttachOptions {
  readonly cover: CoverMode;
  /** The exact heading line the photo is embedded under, e.g. `## Real photo`. */
  readonly heading: string;
}

/** Whether the cover should be written now, given what the note has. */
export function shouldWriteCover(mode: CoverMode, current: unknown): boolean {
  if (mode === "none") return false;
  if (mode === "replace") return true;
  if (current === undefined || current === null) return true;
  return typeof current === "string" && current.trim() === "";
}

export interface CoverWriter {
  /**
   * Stores the image in the vault, embeds it in the section `options.heading` of the note and
   * sets the cover as `options.cover` says. Where the file ends up is up to the vault's
   * attachment settings (and plugins).
   */
  attach(notePath: string, fileName: string, bytes: ArrayBuffer, options: AttachOptions): Promise<void>;
}

/** Takes the cover off a note. The image file itself stays in the vault. */
export interface CoverRemover {
  remove(notePath: string): Promise<void>;
}
