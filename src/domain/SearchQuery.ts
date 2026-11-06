import { InventoryEntry } from "./InventoryEntry";
import { queryTags, tagsMatch } from "./TagQuery";

export const STATE_PREFIX = "state:";

/** A state as one search word: lower case, spaces as _. */
export function stateWord(state: string): string {
  return state.toLowerCase().replace(/\s+/g, "_");
}

/** The search text that finds the items with units in this state. */
export function stateQuery(state: string): string {
  return `${STATE_PREFIX}${stateWord(state)}`;
}

/** What a search looks at on one thing (an item, a location, a row of an export list). */
export interface Searchable {
  /** The tags the thing has itself: only these answer a `#tag` (tags are not inherited from what it holds). */
  readonly tags: readonly string[];
  /** The texts a plain word may be found in (the tags count too). */
  readonly texts: readonly string[];
  /** The thing's stock states, as search words; absent for things that have none (a location ignores `state:`). */
  readonly states?: readonly string[];
}

/**
 * The one search of the plugin, whatever list it narrows. Every whitespace-separated word must
 * match: a plain word is found in the texts or the tags; `#word` is the start of one of the own
 * tags; `state:name` is the start of one of the thing's states (spaces in a state's name are
 * written as _) and is ignored by things without states. A lone `#` or `state:` is the start of
 * typing and asks for nothing yet.
 */
export class SearchQuery {
  private constructor(
    readonly words: readonly string[],
    readonly tags: readonly string[],
    readonly states: readonly string[],
  ) {}

  static parse(raw: string): SearchQuery {
    const all = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const states = all
      .filter((word) => word.startsWith(STATE_PREFIX) && word.length > STATE_PREFIX.length)
      .map((word) => word.slice(STATE_PREFIX.length));
    const words = all.filter((word) => !word.startsWith("#") && !word.startsWith(STATE_PREFIX));
    return new SearchQuery(words, queryTags(raw), states);
  }

  get isEmpty(): boolean {
    return this.words.length === 0 && this.tags.length === 0 && this.states.length === 0;
  }

  matches(target: Searchable): boolean {
    if (!tagsMatch(target.tags, this.tags)) return false;
    if (target.states !== undefined) {
      const own = target.states;
      if (!this.states.every((state) => own.some((candidate) => candidate.startsWith(state)))) return false;
    }
    if (this.words.length === 0) return true;
    const haystack = [...target.texts, ...target.tags].join("\n").toLowerCase();
    return this.words.every((word) => haystack.includes(word));
  }

  /** The things the query leaves, in their order; everything when the query is empty. */
  filter<T>(things: readonly T[], look: (thing: T) => Searchable): T[] {
    return this.isEmpty ? [...things] : things.filter((thing) => this.matches(look(thing)));
  }
}

/** An item with its stock: name, id, kind, origin, the places its units lie in, and its states. */
export function searchableEntry(entry: InventoryEntry): Searchable {
  const { item, positions } = entry;
  return {
    tags: item.tags,
    texts: [item.name, item.id, item.kind, item.origin, ...positions.map((position) => position.location)],
    states: positions.map((position) => stateWord(position.state)),
  };
}

/** An item card alone, as in the label export list. */
export function searchableItem(item: { name: string; id: string; kind: string; origin: string; tags: readonly string[] }): Searchable {
  return { tags: item.tags, texts: [item.name, item.id, item.kind, item.origin] };
}

/** A location: its name, id and own tags. */
export function searchablePlace(place: { name: string; id: string; tags: readonly string[] }): Searchable {
  return { tags: place.tags, texts: [place.name, place.id] };
}
