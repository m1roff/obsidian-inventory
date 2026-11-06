import { App } from "obsidian";
import { CoverRemover, CoverWriter } from "../domain/CoverWriter";
import { appendToEnd } from "../domain/MarkdownSection";
import { VaultImageStore } from "./VaultImageStore";

/**
 * A place note: the photo is embedded at the end of the note and becomes its `cover`.
 * The embed in the text matters for Attachment Steward: it finds the owner of a new image by
 * the links in the note body, a bare `cover` property is not always counted.
 */
export class VaultPlaceCoverWriter implements CoverWriter, CoverRemover {
  private readonly images: VaultImageStore;

  constructor(private readonly app: App) {
    this.images = new VaultImageStore(app);
  }

  async attach(placePath: string, fileName: string, bytes: ArrayBuffer): Promise<void> {
    const note = this.app.vault.getFileByPath(placePath);
    if (!note) throw new Error(`Place note not found: ${placePath}`);

    const image = await this.images.save(fileName, placePath, bytes);
    const link = this.images.linkFrom(image, placePath);
    // Right after saving, so the image gets an owner before Steward's grace period ends.
    await this.app.vault.process(note, (content) => appendToEnd(content, `!${link}`));
    await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
      fm.cover = link;
    });
  }

  async remove(placePath: string): Promise<void> {
    const note = this.app.vault.getFileByPath(placePath);
    if (!note) throw new Error(`Place note not found: ${placePath}`);
    await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
      fm.cover = "";
    });
  }
}
