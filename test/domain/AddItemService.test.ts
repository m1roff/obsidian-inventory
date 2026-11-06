import { describe, expect, it } from "vitest";
import { AddItemService } from "../../src/domain/AddItemService";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { InventoryWriter, NewItemRecord, NewPositionRecord } from "../../src/domain/InventoryWriter";
import { IdGenerator } from "../../src/domain/IdGenerator";
import { Item } from "../../src/domain/Item";
import { NewItemDraft } from "../../src/domain/NewItemDraft";
import { PositionPatch } from "../../src/domain/StockPosition";

class FakeWriter implements InventoryWriter {
  items: NewItemRecord[] = [];
  positions: NewPositionRecord[] = [];
  async createItem(item: NewItemRecord): Promise<string> {
    this.items.push(item);
    return `Inventory_Items/${item.name}.md`;
  }
  async createPosition(position: NewPositionRecord): Promise<void> {
    this.positions.push(position);
  }
  async updatePosition(_path: string, _patch: PositionPatch): Promise<void> {}
}

const existing = new InventoryEntry(
  new Item("Inventory_Items/Spool.md", "Spool", "AB-CD-123", "Plastic", "", [], null, 0, 0),
  [],
);
const repository = { loadEntries: () => [existing] };
const clock = { now: () => new Date(2026, 7, 26, 21, 46, 54) };
// first id candidate collides with the existing AB-CD-123, the next one is free
const ids = new IdGenerator({
  nextInt: (() => {
    const values = [0, 1, 2, 3, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let i = 0;
    return (max: number) => values[i++ % values.length] % max;
  })(),
});
const draft = (name: string) =>
  NewItemDraft.create({ name, kind: "Tool", location: "Box", quantity: 2 });

describe("AddItemService", () => {
  it("creates the card and the first position", async () => {
    const writer = new FakeWriter();
    const service = new AddItemService(repository, writer, ids, clock);

    const added = await service.add(draft("Hex Key"));

    expect(added.name).toBe("Hex Key");
    expect(added.id).not.toBe("AB-CD-123");
    expect(writer.items).toEqual([{ name: "Hex Key", id: added.id, kind: "Tool", tags: [], details: null }]);
    expect(writer.positions).toEqual([
      {
        itemPath: "Inventory_Items/Hex Key.md",
        fileName: "Hex Key - 20260826-214654",
        quantity: 2,
        location: "Box",
        state: "stored",
      },
    ]);
  });

  it("refuses a name that already exists, ignoring case", async () => {
    const writer = new FakeWriter();
    const service = new AddItemService(repository, writer, ids, clock);

    await expect(service.add(draft("spool"))).rejects.toMatchObject({ code: "name-taken" });
    expect(writer.items).toEqual([]);
  });
});

describe("AddItemService tags", () => {
  it("passes the chosen tags to the card, without repeats", async () => {
    const writer = new FakeWriter();
    const service = new AddItemService(repository, writer, ids, clock);
    const draft = NewItemDraft.create({ name: "Nozzle", kind: "Tool", location: "Box", quantity: 1, tags: ["Filament", " Filament ", "3dPrinter"] });
    await service.add(draft);
    expect(writer.items[0].tags).toEqual(["Filament", "3dPrinter"]);
  });
});
