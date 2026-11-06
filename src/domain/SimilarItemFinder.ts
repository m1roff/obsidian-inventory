import { InventoryEntry } from "./InventoryEntry";

export interface SimilarItems {
  /** Item whose name equals the typed text (ignoring case), if any. */
  readonly exact: InventoryEntry | null;
  /** Other items with a similar name, best matches first. */
  readonly similar: InventoryEntry[];
}

/** Fewer typed characters than this give no suggestions. */
export const MIN_QUERY_LENGTH = 2;
const MAX_SIMILAR = 5;

/** Finds existing items while a new name is being typed, to avoid duplicates. */
export class SimilarItemFinder {
  find(entries: readonly InventoryEntry[], typed: string): SimilarItems {
    const text = typed.trim().toLowerCase();
    if (text.length < MIN_QUERY_LENGTH) return { exact: null, similar: [] };

    const words = text.split(/\s+/);
    const matches = entries.filter((entry) => {
      const name = entry.item.name.toLowerCase();
      return words.every((word) => name.includes(word)) || text.includes(name);
    });

    const exact =
      matches.find((entry) => entry.item.name.toLowerCase() === text) ?? null;
    const similar = matches
      .filter((entry) => entry !== exact)
      .sort(
        (a, b) =>
          this.rank(a, text) - this.rank(b, text) ||
          a.item.name.localeCompare(b.item.name),
      )
      .slice(0, MAX_SIMILAR);

    return { exact, similar };
  }

  private rank(entry: InventoryEntry, text: string): number {
    return entry.item.name.toLowerCase().startsWith(text) ? 0 : 1;
  }
}
