import { Place } from "./Place";
import { IdGenerator } from "./IdGenerator";
import { ReferenceLists } from "./ReferenceLists";

export interface PlaceIdWriter {
  setId(placePath: string, id: string): Promise<void>;
}

/** Gives places the id their QR labels carry. Never changes an id that exists. */
export class PlaceIds {
  constructor(
    private readonly lists: ReferenceLists,
    private readonly generator: IdGenerator,
    private readonly writer: PlaceIdWriter,
  ) {}

  /** The place's id; a place without one gets a new one written to its note. */
  async ensure(place: Place): Promise<string> {
    if (place.id !== "") return place.id;
    const id = this.generator.generate("place", this.usedIds());
    await this.writer.setId(place.path, id);
    return id;
  }

  /**
   * Ids of the given places, in the same order; those without one get a new one.
   * The used ids are tracked here, because the vault may not show a just-written id yet.
   */
  async ensureMany(places: readonly Place[]): Promise<string[]> {
    const used = this.usedIds();
    const ids: string[] = [];
    for (const place of places) {
      if (place.id !== "") {
        ids.push(place.id);
        continue;
      }
      const id = this.generator.generate("place", used);
      await this.writer.setId(place.path, id);
      used.add(id);
      ids.push(id);
    }
    return ids;
  }

  /** The places that have no id yet. */
  withoutId(): Place[] {
    return this.lists.places().filter((place) => place.id === "");
  }

  /** Gives an id to every place that has none. Returns how many got one. */
  async assignMissing(): Promise<number> {
    const used = this.usedIds();
    let assigned = 0;
    for (const place of this.lists.places()) {
      if (place.id !== "") continue;
      const id = this.generator.generate("place", used);
      await this.writer.setId(place.path, id);
      used.add(id);
      assigned++;
    }
    return assigned;
  }

  private usedIds(): Set<string> {
    return new Set(
      this.lists
        .places()
        .map((place) => place.id)
        .filter((id) => id !== ""),
    );
  }
}
