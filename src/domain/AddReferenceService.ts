import { hasForbiddenCharacters } from "./NoteName";
import { IdGenerator } from "./IdGenerator";
import { ReferenceLists } from "./ReferenceLists";

export type ReferenceKind = "kind" | "location" | "tag";

export type ReferenceErrorCode = "name-empty" | "name-invalid" | "name-taken" | "tag-spaces";

export class AddReferenceError extends Error {
  constructor(readonly code: ReferenceErrorCode) {
    super(code);
    this.name = "AddReferenceError";
  }
}

export interface ReferenceWriter {
  /** `id` is given for a location, and only for a location. */
  create(kind: ReferenceKind, name: string, id?: string): Promise<void>;
}

/** Adds a new kind or location to the lists items can be filed under. */
export class AddReferenceService {
  constructor(
    private readonly lists: ReferenceLists,
    private readonly writer: ReferenceWriter,
    private readonly ids: IdGenerator,
  ) {}

  /** Returns the name as it was stored. */
  async add(kind: ReferenceKind, rawName: string): Promise<string> {
    const name = rawName.trim();
    if (name === "") throw new AddReferenceError("name-empty");
    if (hasForbiddenCharacters(name)) throw new AddReferenceError("name-invalid");
    // Obsidian does not accept a space inside a tag: such a tag would be struck out in the note.
    if (kind === "tag" && /\s/.test(name)) throw new AddReferenceError("tag-spaces");

    const existing =
      kind === "kind" ? this.lists.kinds() : kind === "tag" ? this.lists.tags() : this.lists.locations();
    const lower = name.toLowerCase();
    if (existing.some((candidate) => candidate.toLowerCase() === lower)) {
      throw new AddReferenceError("name-taken");
    }

    if (kind === "location") {
      const used = new Set(this.lists.places().map((place) => place.id));
      await this.writer.create(kind, name, this.ids.generate("place", used));
    } else {
      await this.writer.create(kind, name);
    }
    return name;
  }
}
