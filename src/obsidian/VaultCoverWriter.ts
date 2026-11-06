import { App } from "obsidian";
import { CoverWriter } from "../domain/CoverWriter";
import { appendToSection } from "../domain/MarkdownSection";
import { VaultImageStore } from "./VaultImageStore";

// Section of the item card skeleton where real photos are embedded.
const REAL_PHOTO_HEADING = "## Real photo";

/** An item card: the photo is embedded into its "real photo" section and becomes the cover. */
export class VaultCoverWriter implements CoverWriter {
  private readonly images: VaultImageStore;

  constructor(private readonly app: App) {
    this.images = new VaultImageStore(app);
  }

  async attach(itemPath: string, fileName: string, bytes: ArrayBuffer): Promise<void> {
    const card = this.app.vault.getFileByPath(itemPath);
    if (!card) throw new Error(`Item card not found: ${itemPath}`);

    const image = await this.images.save(fileName, itemPath, bytes);
    const link = this.images.linkFrom(image, itemPath);

    await this.app.vault.process(card, (content) => appendToSection(content, REAL_PHOTO_HEADING, `!${link}`));
    await this.app.fileManager.processFrontMatter(card, (fm: Record<string, unknown>) => {
      fm.cover = link;
    });
  }
}
