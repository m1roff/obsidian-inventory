import { App } from "obsidian";
import { AttachOptions, CoverWriter, shouldWriteCover } from "../domain/CoverWriter";
import { DebugLog, NO_DEBUG_LOG } from "../domain/DebugLog";
import { appendToSection } from "../domain/MarkdownSection";
import { VaultImageStore } from "./VaultImageStore";

/** An item card: the photo is embedded into the chosen section (by default "Real photo") and may become the cover. */
export class VaultCoverWriter implements CoverWriter {
  private readonly images: VaultImageStore;

  constructor(
    private readonly app: App,
    private readonly log: DebugLog = NO_DEBUG_LOG,
  ) {
    this.images = new VaultImageStore(app, log);
  }

  async attach(itemPath: string, fileName: string, bytes: ArrayBuffer, options: AttachOptions): Promise<void> {
    const card = this.app.vault.getFileByPath(itemPath);
    if (!card) throw new Error(`Item card not found: ${itemPath}`);

    const image = await this.images.save(fileName, itemPath, bytes);
    const link = this.images.linkFrom(image, itemPath);
    this.log.write("item-cover", "link built", { link });

    await this.app.vault.process(card, (content) => appendToSection(content, options.heading, `!${link}`));
    this.log.write("item-cover", "embed added to the photo section");
    if (options.cover === "none") {
      this.log.write("item-cover", "cover left as it is", { heading: options.heading });
      return;
    }
    let written = false;
    await this.app.fileManager.processFrontMatter(card, (fm: Record<string, unknown>) => {
      written = shouldWriteCover(options.cover, fm.cover);
      if (written) fm.cover = link;
    });
    this.log.write("item-cover", written ? "cover property written" : "cover kept, it was set", {
      cover: link,
      mode: options.cover,
      heading: options.heading,
    });
  }
}
