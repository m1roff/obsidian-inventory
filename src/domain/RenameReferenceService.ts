import { AddReferenceError, ReferenceKind } from "./AddReferenceService";
import { hasForbiddenCharacters } from "./NoteName";
import { ReferenceLists } from "./ReferenceLists";

export interface ReferenceRenamer {
  /** Renames the note; links to it follow. */
  rename(kind: ReferenceKind, oldName: string, newName: string): Promise<void>;
}

/** Renames a kind, location or tag with the same name rules as adding one. */
export class RenameReferenceService {
  constructor(
    private readonly lists: ReferenceLists,
    private readonly renamer: ReferenceRenamer,
  ) {}

  /** Returns the name as it was stored. */
  async rename(kind: ReferenceKind, oldName: string, rawName: string): Promise<string> {
    const name = rawName.trim();
    if (name === "") throw new AddReferenceError("name-empty");
    if (hasForbiddenCharacters(name)) throw new AddReferenceError("name-invalid");
    if (kind === "tag" && /\s/.test(name)) throw new AddReferenceError("tag-spaces");
    if (name === oldName) return name;

    const existing =
      kind === "kind" ? this.lists.kinds() : kind === "tag" ? this.lists.tags() : this.lists.locations();
    const lower = name.toLowerCase();
    const sameAsOld = lower === oldName.toLowerCase();
    if (!sameAsOld && existing.some((candidate) => candidate.toLowerCase() === lower)) {
      throw new AddReferenceError("name-taken");
    }
    await this.renamer.rename(kind, oldName, name);
    return name;
  }
}
