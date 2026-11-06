import { AddReferenceError, AddReferenceService } from "./AddReferenceService";
import { ReferenceLists } from "./ReferenceLists";
import { cleanTag } from "./TagList";

export interface PlaceTagWriter {
  /** Replaces the place note's tags with exactly these. */
  setTags(placePath: string, tags: readonly string[]): Promise<void>;
}

/**
 * Sets the tags of a location. They are tags in the same cloud as the items' ones, so a tag
 * the tags list does not have yet gets its note, like for an item.
 */
export class PlaceTagService {
  constructor(
    private readonly writer: PlaceTagWriter,
    private readonly references: ReferenceLists,
    private readonly addReference: AddReferenceService,
  ) {}

  async save(placePath: string, tags: readonly string[]): Promise<string[]> {
    const clean: string[] = [];
    for (const raw of tags) {
      const tag = cleanTag(raw);
      if (tag !== null && !clean.some((own) => own.toLowerCase() === tag.toLowerCase())) clean.push(tag);
    }

    const known = new Set(this.references.tags().map((tag) => tag.toLowerCase()));
    for (const tag of clean) {
      if (known.has(tag.toLowerCase())) continue;
      try {
        await this.addReference.add("tag", tag);
      } catch (error) {
        // The note appeared meanwhile: the tag exists, which is all that is needed.
        if (!(error instanceof AddReferenceError && error.code === "name-taken")) throw error;
      }
    }
    await this.writer.setTags(placePath, clean);
    return clean;
  }
}
