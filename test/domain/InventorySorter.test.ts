import { describe, expect, it } from "vitest";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { InventorySorter } from "../../src/domain/InventorySorter";
import { Item } from "../../src/domain/Item";
import { StockPosition } from "../../src/domain/StockPosition";

const entry = (name: string, createdAt: number, updatedAt: number, positionUpdatedAt: number[] = []) => {
  const item = new Item(`Inventory_Items/${name}.md`, name, "", "", "", [], null, createdAt, updatedAt);
  const positions = positionUpdatedAt.map(
    (at, i) => new StockPosition(`p${i}.md`, item.path, 1, "Shelf", "stored", 0, at),
  );
  return new InventoryEntry(item, positions);
};
const names = (entries: InventoryEntry[]) => entries.map((e) => e.item.name);
const sorter = new InventorySorter();

describe("InventoryEntry.lastUpdatedAt", () => {
  it("is the latest of the card and its positions", () => {
    expect(entry("A", 1, 10, [5, 30, 20]).lastUpdatedAt()).toBe(30);
    expect(entry("A", 1, 40, [5]).lastUpdatedAt()).toBe(40);
    expect(entry("A", 1, 10).lastUpdatedAt()).toBe(10);
  });
});

describe("InventorySorter", () => {
  const entries = [
    entry("Old but touched", 100, 110, [900]),
    entry("New", 300, 300),
    entry("Middle", 200, 500),
  ];

  it("puts the most recently added first", () => {
    expect(names(sorter.sort(entries, "created"))).toEqual(["New", "Middle", "Old but touched"]);
  });

  it("puts the most recently updated first, counting stock changes", () => {
    expect(names(sorter.sort(entries, "updated"))).toEqual(["Old but touched", "Middle", "New"]);
  });

  it("falls back to the name when dates are equal", () => {
    const same = [entry("B", 1, 1), entry("A", 1, 1)];
    expect(names(sorter.sort(same, "created"))).toEqual(["A", "B"]);
  });

  it("does not change the input", () => {
    const input = [...entries];
    sorter.sort(input, "created");
    expect(input).toEqual(entries);
  });
});
