import { Item } from "./Item";
import { StockPosition } from "./StockPosition";
import { StockState, StockStatePolicy } from "./StockState";

export interface Place {
  readonly location: string;
  readonly quantity: number;
}

/** An item together with all of its stock positions. */
export class InventoryEntry {
  constructor(
    readonly item: Item,
    readonly positions: readonly StockPosition[],
  ) {}

  /** Latest change to the card or to any of its stock positions. */
  lastUpdatedAt(): number {
    return Math.max(
      this.item.updatedAt,
      ...this.positions.map((position) => position.updatedAt),
    );
  }

  availableQuantity(): number {
    return this.availablePositions().reduce(
      (sum, position) => sum + position.quantity,
      0,
    );
  }

  /** Available quantity grouped by location, in order of first appearance. */
  places(): Place[] {
    const byLocation = new Map<string, number>();
    for (const position of this.availablePositions()) {
      byLocation.set(
        position.location,
        (byLocation.get(position.location) ?? 0) + position.quantity,
      );
    }
    return [...byLocation].map(([location, quantity]) => ({
      location,
      quantity,
    }));
  }

  /** The position holding units in this exact place and state, if there is one. */
  positionAt(location: string, state: StockState): StockPosition | undefined {
    return this.positions.find(
      (position) => position.location === location && position.state === state,
    );
  }

  availablePositions(): StockPosition[] {
    return this.positions.filter((position) => position.isAvailable());
  }

  /**
   * Units that are somewhere but do not count as in stock (for example defective ones),
   * by state in the owner's order: shown next to the count so they are not forgotten.
   */
  uncountedByState(policy: StockStatePolicy): Array<{ state: StockState; quantity: number }> {
    return policy.visibleUncounted().flatMap((state) => {
      const quantity = this.positions
        .filter((position) => position.state === state)
        .reduce((sum, position) => sum + position.quantity, 0);
      return quantity > 0 ? [{ state, quantity }] : [];
    });
  }
}
