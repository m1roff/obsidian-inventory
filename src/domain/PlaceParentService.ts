import { ReferenceLists } from "./ReferenceLists";
import { PlaceTree } from "./PlaceTree";

export type PlaceParentErrorCode = "unknown-place" | "unknown-parent" | "self" | "cycle";

export class PlaceParentError extends Error {
  constructor(readonly code: PlaceParentErrorCode) {
    super(code);
  }
}

export interface PlaceParentWriter {
  /** Writes the place note's `parent` link, or takes it away when the parent is null. */
  setParent(placePath: string, parent: string | null): Promise<void>;
}

/**
 * Puts a location inside another (or takes it out). One parent at most, and never a loop: a
 * place cannot go inside itself or inside something that stands inside it.
 */
export class PlaceParentService {
  constructor(
    private readonly writer: PlaceParentWriter,
    private readonly references: Pick<ReferenceLists, "places">,
  ) {}

  async set(placeName: string, parentName: string | null): Promise<void> {
    const places = this.references.places();
    const place = places.find((candidate) => candidate.name === placeName);
    if (!place) throw new PlaceParentError("unknown-place");

    if (parentName !== null) {
      if (!places.some((candidate) => candidate.name === parentName)) throw new PlaceParentError("unknown-parent");
      if (parentName === placeName) throw new PlaceParentError("self");
      if (!new PlaceTree(places).canStandInside(placeName, parentName)) throw new PlaceParentError("cycle");
    }
    await this.writer.setParent(place.path, parentName);
  }
}
