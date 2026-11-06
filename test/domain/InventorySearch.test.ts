import { describe, expect, it } from "vitest";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { InventorySearch } from "../../src/domain/InventorySearch";
import { Item } from "../../src/domain/Item";
import { StockPosition } from "../../src/domain/StockPosition";

function entry(name: string, id: string, kind: string, tags: string[], location?: string) {
  const item = new Item(`Inventory_Items/${name}.md`, name, id, kind, "", tags, null, 0, 0);
  const positions = location
    ? [new StockPosition("p.md", item.path, 1, location, "stored", 0, 0)]
    : [];
  return new InventoryEntry(item, positions);
}

const entries = [
  entry("PLA Matte Charcoal", "TST-100-001", "Plastic for 3d", ["Filament"], "Shelf"),
  entry("Hex Key 2.0", "TSTA-100-003", "Tool", [], "Box A"),
  entry("Super Glue", "TST-100-008", "Consumables", []),
];

const names = (found: InventoryEntry[]) => found.map((e) => e.item.name);

describe("InventorySearch", () => {
  const search = new InventorySearch();

  it("returns everything for an empty query", () => {
    expect(search.filter(entries, "  ")).toHaveLength(3);
  });

  it("matches name, id, kind, tag and location, ignoring case", () => {
    expect(names(search.filter(entries, "charcoal"))).toEqual(["PLA Matte Charcoal"]);
    expect(names(search.filter(entries, "tsta-100"))).toEqual(["Hex Key 2.0"]);
    expect(names(search.filter(entries, "TOOL"))).toEqual(["Hex Key 2.0"]);
    expect(names(search.filter(entries, "filament"))).toEqual(["PLA Matte Charcoal"]);
    expect(names(search.filter(entries, "box a"))).toEqual(["Hex Key 2.0"]);
  });

  it("requires every word to match", () => {
    expect(names(search.filter(entries, "pla shelf"))).toEqual(["PLA Matte Charcoal"]);
    expect(search.filter(entries, "pla tool")).toEqual([]);
  });
});

describe("InventorySearch tags", () => {
  const mk = (name: string, tags: string[]) =>
    new InventoryEntry(new Item(`Items/${name}.md`, name, "", "Tool", "", tags, null, 0, 0), []);
  const a = mk("Nozzle", ["3dPrinter"]);
  const b = mk("Spool", ["3dPrinter", "Filament"]);
  const c = mk("Bolts", ["M3"]);
  const search = new InventorySearch();

  it("filters by a #tag", () => {
    expect(search.filter([a, b, c], "#3dprinter")).toEqual([a, b]);
  });

  it("matches the start of a tag while typing", () => {
    expect(search.filter([a, b, c], "#fil")).toEqual([b]);
  });

  it("needs every tag, and still applies the other words", () => {
    expect(search.filter([a, b, c], "#3dprinter #filament")).toEqual([b]);
    expect(search.filter([a, b, c], "#3dprinter nozzle")).toEqual([a]);
  });

  it("does not filter by a lone #", () => {
    expect(search.filter([a, b, c], "#")).toEqual([a, b, c]);
  });
});
