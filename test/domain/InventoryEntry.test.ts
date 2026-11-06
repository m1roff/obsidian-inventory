import { describe, expect, it } from "vitest";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { Item } from "../../src/domain/Item";
import { StockPosition } from "../../src/domain/StockPosition";
import { DEFAULT_STOCK_STATE_POLICY, StockState } from "../../src/domain/StockState";

const item = new Item("Inventory_Items/Spool.md", "Spool", "TST-1", "Plastic", "", [], null, 0, 0);
const position = (quantity: number, location: string, state: StockState) =>
  new StockPosition(`Inventory_Positions/${location}.md`, item.path, quantity, location, state, 0, 0);

describe("InventoryEntry", () => {
  it("counts only available positions", () => {
    const entry = new InventoryEntry(item, [
      position(1, "Shelf", "stored"),
      position(1, "Printer", "installed"),
      position(5, "Trash", "disposed"),
      position(2, "Gone", "consumed"),
      position(3, "Box", "defective"),
    ]);
    expect(entry.availableQuantity()).toBe(2);
  });

  it("groups available quantity by location", () => {
    const entry = new InventoryEntry(item, [
      position(1, "Shelf", "stored"),
      position(2, "Shelf", "stored"),
      position(1, "Printer", "installed"),
      position(1, "Trash", "disposed"),
    ]);
    expect(entry.places()).toEqual([
      { location: "Shelf", quantity: 3 },
      { location: "Printer", quantity: 1 },
    ]);
  });

  it("is empty without positions", () => {
    const entry = new InventoryEntry(item, []);
    expect(entry.availableQuantity()).toBe(0);
    expect(entry.places()).toEqual([]);
  });

  it("finds a position by exact place and state", () => {
    const entry = new InventoryEntry(item, [
      position(1, "Shelf", "stored"),
      position(1, "Shelf", "installed"),
    ]);
    expect(entry.positionAt("Shelf", "installed")?.state).toBe("installed");
    expect(entry.positionAt("Shelf", "defective")).toBeUndefined();
    expect(entry.positionAt("Box", "stored")).toBeUndefined();
  });
});

describe("InventoryEntry.uncountedByState", () => {
  it("lists defective units next to the count, but not used up or thrown away ones", () => {
    const entry = new InventoryEntry(item, [
      position(3, "Shelf", "stored"),
      position(2, "Shelf", "defective"),
      position(5, "Shelf", "consumed"),
    ]);
    expect(entry.availableQuantity()).toBe(3);
    expect(entry.uncountedByState(DEFAULT_STOCK_STATE_POLICY)).toEqual([{ state: "defective", quantity: 2 }]);
  });
});
