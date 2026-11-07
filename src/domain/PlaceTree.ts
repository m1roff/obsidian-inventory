import { SelectOption } from "./OptionList";
import { Place } from "./Place";

/** Between the names of a place's path: "Pantry › Shelf › Box". */
export const PATH_SEPARATOR = " › ";

type Linked = Pick<Place, "name" | "parent">;

/**
 * The locations as a tree: a location stands inside at most one other. Built from the places as
 * read; pure data. A loop (A inside B inside A, written by hand in the notes) cannot hang any
 * walk: every walk remembers where it has been and stops at a repeat.
 */
export class PlaceTree {
  private readonly parents = new Map<string, string>();
  private readonly children = new Map<string, string[]>();

  constructor(places: readonly Linked[]) {
    const names = new Set(places.map((place) => place.name));
    for (const place of places) {
      // A parent that is no location (a deleted note, a typo) or the place itself is no parent.
      if (place.parent === null || place.parent === place.name || !names.has(place.parent)) continue;
      this.parents.set(place.name, place.parent);
      const siblings = this.children.get(place.parent) ?? [];
      siblings.push(place.name);
      this.children.set(place.parent, siblings);
    }
  }

  parentOf(name: string): string | null {
    return this.parents.get(name) ?? null;
  }

  /** The places it stands inside, outermost first: Pantry, Shelf for a box on a shelf in the pantry. */
  ancestors(name: string): string[] {
    const chain: string[] = [];
    const seen = new Set<string>([name]);
    let next = this.parents.get(name);
    while (next !== undefined && !seen.has(next)) {
      chain.unshift(next);
      seen.add(next);
      next = this.parents.get(next);
    }
    return chain;
  }

  /** Where it stands, as one line ("Pantry › Shelf"), or null at the top level. */
  inside(name: string): string | null {
    const chain = this.ancestors(name);
    return chain.length === 0 ? null : chain.join(PATH_SEPARATOR);
  }

  /** Its own name after the places it stands inside: "Pantry › Shelf › Box". */
  fullPath(name: string): string {
    return [...this.ancestors(name), name].join(PATH_SEPARATOR);
  }

  /** Everything inside it, however deep, not counting itself. */
  descendants(name: string): Set<string> {
    const found = new Set<string>();
    const queue = [...(this.children.get(name) ?? [])];
    while (queue.length > 0) {
      const next = queue.pop() as string;
      if (found.has(next) || next === name) continue;
      found.add(next);
      queue.push(...(this.children.get(next) ?? []));
    }
    return found;
  }

  /** The place and everything inside it. */
  withDescendants(name: string): Set<string> {
    return new Set([name, ...this.descendants(name)]);
  }

  hasNested(name: string): boolean {
    return (this.children.get(name)?.length ?? 0) > 0;
  }

  /** A place may not be put inside itself or inside something that is inside it. */
  canStandInside(name: string, parent: string): boolean {
    return parent !== name && !this.descendants(name).has(parent);
  }

  /** The places this one may be put inside. */
  validParents(name: string, all: readonly string[]): string[] {
    return all.filter((candidate) => this.canStandInside(name, candidate));
  }

  /** The locations as list options: the path is the label, so a box inside the pantry reads "Pantry › Box". */
  options(names: readonly string[]): SelectOption[] {
    return names.map((name) => ({ value: name, label: this.fullPath(name) }));
  }
}
