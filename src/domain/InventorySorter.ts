import { InventoryEntry } from "./InventoryEntry";
import { SortMode } from "./SortMode";

/** Newest first by the chosen date; equal dates fall back to the name. */
export class InventorySorter {
  sort(entries: readonly InventoryEntry[], mode: SortMode): InventoryEntry[] {
    const date = (entry: InventoryEntry): number =>
      mode === "created" ? entry.item.createdAt : entry.lastUpdatedAt();

    return [...entries].sort(
      (a, b) => date(b) - date(a) || a.item.name.localeCompare(b.item.name),
    );
  }
}
