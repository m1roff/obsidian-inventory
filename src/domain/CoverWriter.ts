export interface CoverImage {
  readonly bytes: ArrayBuffer;
  /** File extension without a dot, e.g. `jpg`. */
  readonly extension: string;
}

export interface CoverWriter {
  /**
   * Stores the image in the vault and makes it the cover of the note (an item card also
   * embeds it). Where the file ends up is up to the vault's attachment settings (and plugins).
   */
  attach(notePath: string, fileName: string, bytes: ArrayBuffer): Promise<void>;
}

/** Takes the cover off a note. The image file itself stays in the vault. */
export interface CoverRemover {
  remove(notePath: string): Promise<void>;
}
