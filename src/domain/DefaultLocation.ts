import { AddReferenceService } from "./AddReferenceService";
import { ReferenceLists } from "./ReferenceLists";
import { RenameReferenceService } from "./RenameReferenceService";

/** The name of the location that exists from the very start. */
export const DEFAULT_LOCATION_NAME = "Unsorted";

/** Where the chosen name of the default location is kept. */
export interface DefaultLocationStore {
  name(): string;
  setName(name: string): void;
}

/**
 * The location a new item goes to unless another is picked. There is always one: a fresh
 * install gets it created, and if the chosen one vanished (renamed by hand), the first location
 * by name stands in. The owner can pick another one and rename it.
 */
export class DefaultLocation {
  constructor(
    private readonly lists: Pick<ReferenceLists, "locations">,
    private readonly adder: Pick<AddReferenceService, "add">,
    private readonly renamer: Pick<RenameReferenceService, "rename">,
    private readonly store: DefaultLocationStore,
    /** Creating a note needs the lists folder, which exists once the vault is set up. */
    private readonly ready: () => boolean = () => true,
  ) {}

  /** The default location right now, or null while there is no location at all. */
  current(): string | null {
    const all = this.lists.locations();
    const wanted = this.store.name().toLowerCase();
    const hit = all.find((name) => name.toLowerCase() === wanted);
    if (hit !== undefined) return hit;
    return [...all].sort((a, b) => a.localeCompare(b))[0] ?? null;
  }

  /** Makes sure a default location exists; returns it (null if the vault is not set up yet). */
  async ensure(): Promise<string | null> {
    const current = this.current();
    if (current !== null) return current;
    if (!this.ready()) return null;
    return this.adder.add("location", this.store.name());
  }

  choose(name: string): void {
    this.store.setName(name);
  }

  /** Renames the default location; the choice follows the new name. */
  async rename(rawName: string): Promise<string> {
    const current = this.current();
    if (current === null) return this.adder.add("location", rawName);
    const name = await this.renamer.rename("location", current, rawName);
    this.store.setName(name);
    return name;
  }
}
