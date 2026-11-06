import { InventoryEntry } from "./InventoryEntry";
import { SortMode } from "./SortMode";

/** Newest first by the chosen date (oldest first when reversed); equal dates fall back to the name. */
export class InventorySorter {
  sort(entries: readonly InventoryEntry[], mode: SortMode, reversed = false): InventoryEntry[] {
    const date = (entry: InventoryEntry): number =>
      mode === "created" ? entry.item.createdAt : entry.lastUpdatedAt();
    const direction = reversed ? -1 : 1;

    return [...entries].sort(
      (a, b) => (date(b) - date(a)) * direction || a.item.name.localeCompare(b.item.name),
    );
  }
}
