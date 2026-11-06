import { Clock, formatPhotoStamp } from "./Clock";
import { AttachOptions, CoverImage, CoverWriter } from "./CoverWriter";
import { DEFAULT_PHOTO_HEADING } from "./PhotoSections";

const DEFAULT_OPTIONS: AttachOptions = { cover: "replace", heading: DEFAULT_PHOTO_HEADING };

/** Adds a photo to a note (an item card, a place) and makes it the cover; which note is up to the writer. */
export class AttachCoverService {
  constructor(
    private readonly writer: CoverWriter,
    private readonly clock: Clock,
  ) {}

  async attach(notePath: string, image: CoverImage, options: AttachOptions = DEFAULT_OPTIONS): Promise<void> {
    // Same naming as the vault's existing photos: 2026-08-23-23_26_35_540-image.jpg
    const fileName = `${formatPhotoStamp(this.clock.now())}-image.${this.extension(image)}`;
    await this.writer.attach(notePath, fileName, image.bytes, options);
  }

  /**
   * Several photos picked at once, one after another in the order given. Only the first becomes
   * the cover (as `options.cover` says), the rest are added to the note beside it.
   */
  async attachAll(
    notePath: string,
    images: readonly CoverImage[],
    options: AttachOptions = DEFAULT_OPTIONS,
  ): Promise<void> {
    for (const [index, image] of images.entries()) {
      await this.attach(notePath, image, index === 0 ? options : { ...options, cover: "none" });
    }
  }

  private extension(image: CoverImage): string {
    const clean = image.extension.toLowerCase().replace(/[^a-z0-9]/g, "");
    return clean === "" ? "jpg" : clean;
  }
}
