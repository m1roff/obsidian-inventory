import { Clock, formatPhotoStamp } from "./Clock";
import { CoverImage, CoverWriter } from "./CoverWriter";

/** Adds a photo to a note (an item card, a place) and makes it the cover; which note is up to the writer. */
export class AttachCoverService {
  constructor(
    private readonly writer: CoverWriter,
    private readonly clock: Clock,
  ) {}

  async attach(notePath: string, image: CoverImage): Promise<void> {
    // Same naming as the vault's existing photos: 2026-08-23-23_26_35_540-image.jpg
    const fileName = `${formatPhotoStamp(this.clock.now())}-image.${this.extension(image)}`;
    await this.writer.attach(notePath, fileName, image.bytes);
  }

  private extension(image: CoverImage): string {
    const clean = image.extension.toLowerCase().replace(/[^a-z0-9]/g, "");
    return clean === "" ? "jpg" : clean;
  }
}
