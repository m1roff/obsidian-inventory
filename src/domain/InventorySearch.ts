import { InventoryEntry } from "./InventoryEntry";
import { SearchQuery, searchableEntry } from "./SearchQuery";

export { stateQuery, stateWord } from "./SearchQuery";

/** The items a query leaves (see `SearchQuery` for what the words mean). */
export class InventorySearch {
  filter(entries: readonly InventoryEntry[], query: string): InventoryEntry[] {
    return SearchQuery.parse(query).filter(entries, searchableEntry);
  }
}
