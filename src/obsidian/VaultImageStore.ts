import { App, TFile } from "obsidian";
import { DebugLog, NO_DEBUG_LOG } from "../domain/DebugLog";

/** How long after saving the image is looked at again: time for Attachment Steward to move it. */
const SETTLE_CHECK_MS = 4000;

/** Saves an image into the vault by Obsidian's own attachment rules. */
export class VaultImageStore {
  constructor(
    private readonly app: App,
    private readonly log: DebugLog = NO_DEBUG_LOG,
  ) {}

  /**
   * Where the file ends up is the vault's attachment setting (and plugins such as Attachment
   * Steward, which may move it later and keep the links intact).
   */
  async save(fileName: string, nearNotePath: string, bytes: ArrayBuffer): Promise<TFile> {
    const path = await this.app.fileManager.getAvailablePathForAttachment(fileName, nearNotePath);
    const image = await this.app.vault.createBinary(path, bytes);
    this.log.write("store", "image saved", { path: image.path, bytes: bytes.byteLength });
    this.watchPlacement(image, nearNotePath);
    return image;
  }

  /**
   * Debug only: looks once more a few seconds later, to see whether another plugin moved the
   * image and whether the note still points at it. One timer per saved photo, nothing otherwise.
   */
  private watchPlacement(image: TFile, notePath: string): void {
    if (!this.log.enabled) return;
    const savedAt = image.path;
    window.setTimeout(() => {
      const links = this.app.metadataCache.resolvedLinks[notePath] ?? {};
      this.log.write("store", `${SETTLE_CHECK_MS / 1000} s after saving`, {
        savedAs: savedAt,
        nowAt: image.path,
        moved: image.path !== savedAt,
        stillInVault: this.app.vault.getFileByPath(image.path) !== null,
        noteLinksToIt: links[image.path] !== undefined,
      });
    }, SETTLE_CHECK_MS);
  }

  /** The text `[[image.jpg]]` as a link from the note: what goes into `cover`. */
  linkFrom(image: TFile, notePath: string): string {
    const link = this.app.fileManager.generateMarkdownLink(image, notePath);
    return link.startsWith("!") ? link.slice(1) : link;
  }
}
