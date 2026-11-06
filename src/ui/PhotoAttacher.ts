import { Notice } from "obsidian";
import { AttachCoverService } from "../domain/AttachCoverService";
import { CoverRemover } from "../domain/CoverWriter";
import { pickImageFile, prepareImage } from "../obsidian/ImagePicker";
import { STRINGS } from "./strings";

/**
 * Picks a photo and puts it on a note as its cover, with the notices and the busy state.
 * Knows nothing about which kind of note it is: that is decided by the service it is given
 * (an item card, a place). Whoever triggers it (a button, a menu item) just calls `attach`.
 */
export class PhotoAttacher {
  constructor(
    private readonly service: AttachCoverService,
    private readonly remover: CoverRemover | null = null,
  ) {}

  /**
   * Must be called straight from a tap or a menu choice: the system photo picker is blocked
   * unless it opens before the first `await`.
   */
  async attach(notePath: string, onBusy?: (busy: boolean) => void): Promise<void> {
    const file = await pickImageFile();
    if (!file) return;

    onBusy?.(true);
    const notice = new Notice(STRINGS.savingPhoto, 0);
    try {
      await this.service.attach(notePath, await prepareImage(file));
      new Notice(STRINGS.photoSaved);
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.photoFailed);
    } finally {
      notice.hide();
      onBusy?.(false);
    }
  }

  get canRemove(): boolean {
    return this.remover !== null;
  }

  /** Takes the photo off the note; the image file stays in the vault. */
  async remove(notePath: string): Promise<void> {
    if (!this.remover) return;
    try {
      await this.remover.remove(notePath);
      new Notice(STRINGS.photoRemoved);
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.photoFailed);
    }
  }
}
