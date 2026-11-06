import { Clock, formatStamp } from "./Clock";
import { InventoryRepository } from "./InventoryRepository";
import { InventoryWriter } from "./InventoryWriter";
import { IdGenerator } from "./IdGenerator";
import { AddItemError, NewItemDraft } from "./NewItemDraft";

export interface AddedItem {
  readonly id: string;
  readonly name: string;
  /** The new card's note. */
  readonly path: string;
}

/** Adds an item card together with its first stock position. */
export class AddItemService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly writer: InventoryWriter,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async add(draft: NewItemDraft): Promise<AddedItem> {
    const entries = this.repository.loadEntries();

    const lowerName = draft.name.toLowerCase();
    if (entries.some((entry) => entry.item.name.toLowerCase() === lowerName)) {
      throw new AddItemError("name-taken");
    }

    const usedIds = new Set(
      entries.map((entry) => entry.item.id.toUpperCase()).filter(Boolean),
    );
    const id = this.ids.generate("item", usedIds);

    const itemPath = await this.writer.createItem({
      name: draft.name,
      id,
      kind: draft.kind,
      tags: draft.tags,
      details: draft.details,
    });
    await this.writer.createPosition({
      itemPath,
      fileName: `${draft.name} - ${formatStamp(this.clock.now())}`,
      quantity: draft.quantity,
      location: draft.location,
      state: "stored",
    });

    return { id, name: draft.name, path: itemPath };
  }
}
