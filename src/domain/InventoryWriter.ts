import type { ItemDetails } from "./FilamentDetails";
import { PositionPatch } from "./StockPosition";
import { StockState } from "./StockState";

export interface NewItemRecord {
  readonly name: string;
  readonly id: string;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly details: ItemDetails | null;
}

export interface NewPositionRecord {
  readonly itemPath: string;
  readonly fileName: string;
  readonly quantity: number;
  readonly location: string;
  readonly state: StockState;
}

export interface InventoryWriter {
  /** Creates the item card and returns its path. */
  createItem(item: NewItemRecord): Promise<string>;
  createPosition(position: NewPositionRecord): Promise<void>;
  updatePosition(path: string, patch: PositionPatch): Promise<void>;
}
