import { InventoryEntry } from "./InventoryEntry";

export interface InventoryRepository {
  loadEntries(): InventoryEntry[];
}
