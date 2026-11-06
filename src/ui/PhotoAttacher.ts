import { Notice, Platform } from "obsidian";
import { AttachCoverService } from "../domain/AttachCoverService";
import { CoverRemover } from "../domain/CoverWriter";
import { describeError, DebugLog, NO_DEBUG_LOG } from "../domain/DebugLog";
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
    private readonly log: DebugLog = NO_DEBUG_LOG,
  ) {}

  /**
   * Must be called straight from a tap or a menu choice: the system photo picker is blocked
   * unless it opens before the first `await`.
   */
  async attach(notePath: string, onBusy?: (busy: boolean) => void): Promise<void> {
    this.log.write("photo", "attach requested", {
      note: notePath,
      mobile: Platform.isMobile,
      ios: Platform.isIosApp,
      phone: Platform.isPhone,
      tablet: Platform.isTablet,
    });
    const file = await pickImageFile(this.log);
    if (!file) {
      this.log.write("photo", "nothing was picked, stopping");
      return;
    }

    onBusy?.(true);
    const notice = new Notice(STRINGS.savingPhoto, 0);
    try {
      const image = await prepareImage(file, this.log);
      await this.service.attach(notePath, image);
      this.log.write("photo", "attached", { note: notePath });
      new Notice(STRINGS.photoSaved);
    } catch (error) {
      console.error(error);
      this.log.write("photo", "attach failed", { error: describeError(error) });
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
      this.log.write("photo", "removed", { note: notePath });
      new Notice(STRINGS.photoRemoved);
    } catch (error) {
      console.error(error);
      this.log.write("photo", "remove failed", { error: describeError(error) });
      new Notice(STRINGS.photoFailed);
    }
  }
}
