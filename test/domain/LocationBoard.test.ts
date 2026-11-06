import { describe, expect, it } from "vitest";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { Item } from "../../src/domain/Item";
import {
  DEFAULT_LOCATION_PREFERENCES,
  entriesInLocation,
  LocationBoard,
  LocationPreferences,
  movePinned,
  parseLocationPreferences,
  togglePinned,
  withSelectedFirst,
} from "../../src/domain/LocationBoard";
import { StockPosition } from "../../src/domain/StockPosition";
import { StockState } from "../../src/domain/StockState";

const position = (location: string, quantity: number, state: StockState, created: number, updated: number) =>
  new StockPosition(`p-${location}-${created}.md`, "Inventory_Items/X.md", quantity, location, state, created, updated);
const entry = (name: string, positions: StockPosition[]) =>
  new InventoryEntry(new Item(`Inventory_Items/${name}.md`, name, "", "", "", [], null, 0, 0), positions);

const entries = [
  entry("Spool", [position("Shelf", 2, "stored", 100, 500), position("Printer", 1, "installed", 300, 300)]),
  entry("Key", [position("Box", 4, "stored", 200, 200), position("Shelf", 1, "consumed", 50, 900)]),
];
const locations = ["Shelf", "Box", "Printer", "Empty"];
const prefs = (patch: Partial<LocationPreferences> = {}): LocationPreferences => ({ ...DEFAULT_LOCATION_PREFERENCES, ...patch });
const names = (tiles: { name: string }[]) => tiles.map((t) => t.name);
const board = new LocationBoard();

const placesOf = (names: string[]) => names.map((name) => ({ name, path: `${name}.md`, id: "", cover: null, tags: [] }));

describe("LocationBoard", () => {
  it("counts the items that have units in stock there, not the units, and shows empty locations too", () => {
    const tiles = board.tiles(placesOf(locations), entries, prefs());
    const counts = Object.fromEntries(tiles.map((t) => [t.name, t.itemCount]));
    // Key has only a consumed position on the shelf, so it does not count there.
    expect(counts).toEqual({ Shelf: 1, Box: 1, Printer: 1, Empty: 0 });
  });

  it("counts an item once even when it has several positions in one place", () => {
    const twice = [entry("Twice", [position("Shelf", 1, "stored", 1, 1), position("Shelf", 5, "stored", 2, 2)])];
    expect(board.tiles(placesOf(["Shelf"]), twice, prefs())[0]?.itemCount).toBe(1);
  });

  it("sorts alphabetically by default", () => {
    expect(names(board.tiles(placesOf(locations), entries, prefs()))).toEqual(["Box", "Empty", "Printer", "Shelf"]);
  });

  it("sorts by where something was added last (position created)", () => {
    expect(names(board.tiles(placesOf(locations), entries, prefs({ sort: "added" })))).toEqual(["Printer", "Box", "Shelf", "Empty"]);
  });

  it("sorts by where something changed last, counting consumed units too", () => {
    expect(names(board.tiles(placesOf(locations), entries, prefs({ sort: "updated" })))).toEqual(["Shelf", "Printer", "Box", "Empty"]);
  });

  it("puts pinned locations first in their own order, whatever the sort", () => {
    const tiles = board.tiles(placesOf(locations), entries, prefs({ pinned: ["Printer", "Empty"], sort: "added" }));
    expect(names(tiles)).toEqual(["Printer", "Empty", "Box", "Shelf"]);
    expect(tiles.map((t) => t.pinned)).toEqual([true, true, false, false]);
  });

  it("ignores pinned names that no longer exist", () => {
    expect(names(board.tiles(placesOf(locations), entries, prefs({ pinned: ["Gone"] })))).toEqual(["Box", "Empty", "Printer", "Shelf"]);
  });
});

describe("pinning", () => {
  it("toggles a pin at the end of the list", () => {
    expect(togglePinned(["A"], "B")).toEqual(["A", "B"]);
    expect(togglePinned(["A", "B"], "A")).toEqual(["B"]);
  });

  it("moves a pinned location, staying within bounds", () => {
    expect(movePinned(["A", "B", "C"], "B", -1)).toEqual(["B", "A", "C"]);
    expect(movePinned(["A", "B", "C"], "B", 1)).toEqual(["A", "C", "B"]);
    expect(movePinned(["A", "B", "C"], "A", -1)).toEqual(["A", "B", "C"]);
    expect(movePinned(["A", "B", "C"], "C", 1)).toEqual(["A", "B", "C"]);
    expect(movePinned(["A"], "X", 1)).toEqual(["A"]);
  });
});

describe("entriesInLocation", () => {
  it("returns items with units in stock there", () => {
    expect(names(entriesInLocation(entries, "Shelf").map((e) => ({ name: e.item.name })))).toEqual(["Spool"]);
    // the Key's only unit on the Shelf is consumed
    expect(entriesInLocation(entries, "Box")).toHaveLength(1);
    expect(entriesInLocation(entries, "Empty")).toEqual([]);
  });
});

describe("parseLocationPreferences", () => {
  it("falls back to defaults on anything odd", () => {
    expect(parseLocationPreferences(null)).toEqual(DEFAULT_LOCATION_PREFERENCES);
    expect(parseLocationPreferences({ pinned: "x", sort: "weird", expanded: 1 })).toEqual(DEFAULT_LOCATION_PREFERENCES);
  });

  it("reads valid values", () => {
    expect(parseLocationPreferences({ pinned: ["A", 3, "B"], sort: "updated", reversed: true, expanded: true })).toEqual({
      pinned: ["A", "B"],
      sort: "updated",
      reversed: true,
      expanded: true,
    });
  });
});

describe("sort direction", () => {
  it("runs A to Z, and Z to A when reversed", () => {
    expect(names(board.tiles(placesOf(locations), entries, prefs()))).toEqual(["Box", "Empty", "Printer", "Shelf"]);
    expect(names(board.tiles(placesOf(locations), entries, prefs({ reversed: true })))).toEqual(["Shelf", "Printer", "Empty", "Box"]);
  });

  it("puts the oldest first for a date sort when reversed", () => {
    expect(names(board.tiles(placesOf(locations), entries, prefs({ sort: "added" })))).toEqual(["Printer", "Box", "Shelf", "Empty"]);
    expect(names(board.tiles(placesOf(locations), entries, prefs({ sort: "added", reversed: true })))).toEqual(["Empty", "Shelf", "Box", "Printer"]);
  });
});

describe("withSelectedFirst", () => {
  const tiles = board.tiles(placesOf(locations), entries, prefs({ pinned: ["Printer", "Empty"] }));

  it("puts the filtering location first even when others are pinned, keeping the rest in order", () => {
    expect(names(withSelectedFirst(tiles, "Shelf"))).toEqual(["Shelf", "Printer", "Empty", "Box"]);
    expect(names(withSelectedFirst(tiles, "Empty"))).toEqual(["Empty", "Printer", "Box", "Shelf"]);
  });

  it("changes nothing without a filter or for an unknown name", () => {
    expect(names(withSelectedFirst(tiles, null))).toEqual(names(tiles));
    expect(names(withSelectedFirst(tiles, "Gone"))).toEqual(names(tiles));
  });
});
