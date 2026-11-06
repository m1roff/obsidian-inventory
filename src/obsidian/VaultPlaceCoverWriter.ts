import { App } from "obsidian";
import { CoverRemover, CoverWriter } from "../domain/CoverWriter";
import { VaultImageStore } from "./VaultImageStore";

/** A place note: the photo only becomes its `cover`, nothing is written into the text. */
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
