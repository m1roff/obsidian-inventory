import { InventoryEntry } from "./InventoryEntry";
import { StateUsageLookup, StockState } from "./StockState";

/** How many positions (all of them, counted in stock or not) sit in each state. */
export class StateUsage implements StateUsageLookup {
  private readonly counts = new Map<string, number>();

  constructor(entries: readonly InventoryEntry[]) {
    for (const entry of entries) {
      for (const position of entry.positions) {
        const key = position.state.toLowerCase();
        this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
      }
    }
  }

  count(state: StockState): number {
    return this.counts.get(state.toLowerCase()) ?? 0;
  }
}
