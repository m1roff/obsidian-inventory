import { App } from "obsidian";
import { CoverRemover, CoverWriter } from "../domain/CoverWriter";
import { DebugLog, NO_DEBUG_LOG } from "../domain/DebugLog";
import { appendToEnd } from "../domain/MarkdownSection";
import { VaultImageStore } from "./VaultImageStore";

/**
 * A place note: the photo is embedded at the end of the note and becomes its `cover`.
 * The embed in the text matters for Attachment Steward: it finds the owner of a new image by
 * the links in the note body, a bare `cover` property is not always counted.
 */
export class VaultPlaceCoverWriter implements CoverWriter, CoverRemover {
  private readonly images: VaultImageStore;

  constructor(
    private readonly app: App,
    private readonly log: DebugLog = NO_DEBUG_LOG,
  ) {
    this.images = new VaultImageStore(app, log);
  }

  async attach(placePath: string, fileName: string, bytes: ArrayBuffer): Promise<void> {
    const note = this.app.vault.getFileByPath(placePath);
    if (!note) throw new Error(`Place note not found: ${placePath}`);

    const image = await this.images.save(fileName, placePath, bytes);
    const link = this.images.linkFrom(image, placePath);
    this.log.write("place-cover", "link built", { link });
    // Right after saving, so the image gets an owner before Steward's grace period ends.
    await this.app.vault.process(note, (content) => appendToEnd(content, `!${link}`));
    this.log.write("place-cover", "embed added to the end of the note");
    await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
      fm.cover = link;
    });
    this.log.write("place-cover", "cover property written", { cover: link });
  }

  async remove(placePath: string): Promise<void> {
    const note = this.app.vault.getFileByPath(placePath);
    if (!note) throw new Error(`Place note not found: ${placePath}`);
    await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
      fm.cover = "";
    });
  }
}
