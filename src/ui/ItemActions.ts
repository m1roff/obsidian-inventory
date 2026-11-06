import { App, Notice } from "obsidian";
import { AddReferenceService } from "../domain/AddReferenceService";
import { InventoryEntry } from "../domain/InventoryEntry";
import { ReferenceLists } from "../domain/ReferenceLists";
import { StockService } from "../domain/StockService";
import { StockStatePolicy } from "../domain/StockState";
import { AddStockModal } from "./AddStockModal";
import { Haptics } from "./Haptics";
import { MoveModal } from "./MoveModal";
import { PhotoAttacher } from "./PhotoAttacher";
import { STRINGS } from "./strings";

export interface ItemAction {
  readonly id: string;
  readonly label: string;
  isEnabled(entry: InventoryEntry): boolean;
  run(entry: InventoryEntry): Promise<void> | void;
}

export interface ItemActionsDeps {
  readonly stock: StockService;
  readonly photos: PhotoAttacher;
  readonly haptics: Haptics;
  readonly references: ReferenceLists;
  readonly addReference: AddReferenceService;
  readonly searchThreshold: () => number;
  readonly states: () => StockStatePolicy;
}

/**
 * What you can do with one item. The main screen and the item card both render
 * their buttons from `all()`, so an action added here shows up in both places.
 */
export class ItemActions {
  constructor(
    private readonly app: App,
    private readonly deps: ItemActionsDeps,
  ) {}

  /** The functional actions: what changes stock. */
  all(): ItemAction[] {
    return [
      {
        id: "add-more",
        label: `+ ${STRINGS.addMore}`,
        // Also for an item that ran out: this is how it gets restocked.
        isEnabled: () => true,
        run: (entry) => this.addMore(entry),
      },
      {
        id: "move",
        label: STRINGS.move,
        isEnabled: (entry) => entry.availableQuantity() > 0,
        run: (entry) => this.move(entry),
      },
    ];
  }

  addMore(entry: InventoryEntry): void {
    new AddStockModal(this.app, {
      entry,
      service: this.deps.stock,
      references: this.deps.references,
      addReference: this.deps.addReference,
      searchThreshold: this.deps.searchThreshold,
      haptics: this.deps.haptics,
      onAdded: (quantity, to) => {
        new Notice(STRINGS.addedMore(entry.item.name, quantity, to));
      },
    }).open();
  }

  move(entry: InventoryEntry): void {
    if (entry.availablePositions().length === 0) return;
    new MoveModal(this.app, {
      entry,
      service: this.deps.stock,
      references: this.deps.references,
      addReference: this.deps.addReference,
      searchThreshold: this.deps.searchThreshold,
      haptics: this.deps.haptics,
      states: this.deps.states,
      onMoved: (quantity, to) => {
        new Notice(STRINGS.moved(entry.item.name, quantity, to));
      },
    }).open();
  }

  /** The photo of an item card: picked by a tap on its cover tile. */
  addPhoto(entry: InventoryEntry, onBusy?: (busy: boolean) => void): Promise<void> {
    return this.deps.photos.attach(entry.item.path, onBusy);
  }
}
