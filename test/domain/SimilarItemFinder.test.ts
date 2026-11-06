import { describe, expect, it } from "vitest";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { Item } from "../../src/domain/Item";
import { SimilarItemFinder } from "../../src/domain/SimilarItemFinder";

const entry = (name: string) =>
  new InventoryEntry(new Item(`Inventory_Items/${name}.md`, name, "", "", "", [], null, 0, 0), []);

const entries = [
  entry("Hex Key 2.0 (130mm)"),
  entry("Hex Key 1.5 (47mm)"),
  entry("Nozzle 0.4 hardened steel"),
  entry("Набор пружин"),
  entry("Набор пружин 1"),
];
const names = (found: InventoryEntry[]) => found.map((e) => e.item.name);
const finder = new SimilarItemFinder();

describe("SimilarItemFinder", () => {
  it("says nothing for less than two characters", () => {
    expect(finder.find(entries, "h")).toEqual({ exact: null, similar: [] });
    expect(finder.find(entries, "   ")).toEqual({ exact: null, similar: [] });
  });

  it("suggests items by the first typed letters, ignoring case", () => {
    expect(names(finder.find(entries, "he").similar)).toEqual([
      "Hex Key 1.5 (47mm)",
      "Hex Key 2.0 (130mm)",
    ]);
  });

  it("matches several words in any order", () => {
    expect(names(finder.find(entries, "steel nozzle").similar)).toEqual([
      "Nozzle 0.4 hardened steel",
    ]);
  });

  it("reports an exact match separately from similar ones", () => {
    const result = finder.find(entries, " набор ПРУЖИН ");
    expect(result.exact?.item.name).toBe("Набор пружин");
    expect(names(result.similar)).toEqual(["Набор пружин 1"]);
  });

  it("finds an existing shorter name inside a longer typed one", () => {
    const result = finder.find(entries, "Набор пружин 1 большой");
    expect(names(result.similar)).toEqual(["Набор пружин", "Набор пружин 1"]);
  });

  it("returns nothing when no name matches", () => {
    expect(finder.find(entries, "клей")).toEqual({ exact: null, similar: [] });
  });
});
