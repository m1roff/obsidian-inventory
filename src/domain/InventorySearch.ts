import { InventoryEntry } from "./InventoryEntry";

const STATE_PREFIX = "state:";

/** A state as one search word: lower case, spaces as _. */
export function stateWord(state: string): string {
  return state.toLowerCase().replace(/\s+/g, "_");
}

/** The search text that finds the items with units in this state. */
export function stateQuery(state: string): string {
  return `${STATE_PREFIX}${stateWord(state)}`;
}

/**
 * Every whitespace-separated word of the query must match somewhere. A word that starts
 * with # is a tag: the item must have a tag that starts with the rest of the word. A word
 * `state:name` keeps items that have a position in a state starting with that name (spaces in
 * the state's name are written as _).
 */
export class InventorySearch {
  filter(
    entries: readonly InventoryEntry[],
    query: string,
  ): InventoryEntry[] {
    const all = query.toLowerCase().split(/\s+/).filter(Boolean);
    // A lone "#" is just the start of typing a tag: it filters nothing yet.
    const tags = all.filter((word) => word.startsWith("#") && word.length > 1).map((word) => word.slice(1));
    const states = all
      .filter((word) => word.startsWith(STATE_PREFIX) && word.length > STATE_PREFIX.length)
      .map((word) => word.slice(STATE_PREFIX.length));
    const words = all.filter((word) => !word.startsWith("#") && !word.startsWith(STATE_PREFIX));
    if (words.length === 0 && tags.length === 0 && states.length === 0) return [...entries];

    return entries.filter((entry) => {
      const itemTags = entry.item.tags.map((tag) => tag.toLowerCase());
      if (!tags.every((tag) => itemTags.some((own) => own.startsWith(tag)))) return false;
      const ownStates = entry.positions.map((position) => stateWord(position.state));
      if (!states.every((state) => ownStates.some((own) => own.startsWith(state)))) return false;
      if (words.length === 0) return true;
      const haystack = this.haystack(entry);
      return words.every((word) => haystack.includes(word));
    });
  }

  private haystack(entry: InventoryEntry): string {
    const { item, positions } = entry;
    return [
      item.name,
      item.id,
      item.kind,
      item.origin,
      ...item.tags,
      ...positions.map((position) => position.location),
    ]
      .join("\n")
      .toLowerCase();
  }
}
