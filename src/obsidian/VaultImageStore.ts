import { App, TFile } from "obsidian";

/** Saves an image into the vault by Obsidian's own attachment rules. */
export class VaultImageStore {
  constructor(private readonly app: App) {}

  /**
   * Where the file ends up is the vault's attachment setting (and plugins such as Attachment
   * Steward, which may move it later and keep the links intact).
   */
  async save(fileName: string, nearNotePath: string, bytes: ArrayBuffer): Promise<TFile> {
    const path = await this.app.fileManager.getAvailablePathForAttachment(fileName, nearNotePath);
    return this.app.vault.createBinary(path, bytes);
  }

  /** The text `[[image.jpg]]` as a link from the note: what goes into `cover`. */
  linkFrom(image: TFile, notePath: string): string {
    const link = this.app.fileManager.generateMarkdownLink(image, notePath);
    return link.startsWith("!") ? link.slice(1) : link;
  }
}
