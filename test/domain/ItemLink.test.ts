import { describe, expect, it } from "vitest";
import {
  buildItemLink,
  buildPlaceLink,
  findEntryById,
  findPlaceById,
  parseScanned,
} from "../../src/domain/ItemLink";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { Item } from "../../src/domain/Item";

describe("item and place links", () => {
  it("round-trips an item id, including a vault name with spaces", () => {
    const link = buildItemLink("My Inventory", "AB-CD-123");
    expect(link.startsWith("obsidian://inventory-ui?")).toBe(true);
    expect(parseScanned(link)).toEqual({ kind: "item", id: "AB-CD-123" });
  });

  it("tells a place link from an item link", () => {
    const link = buildPlaceLink("Inventory", "LC-482-915");
    expect(parseScanned(link)).toEqual({ kind: "place", id: "LC-482-915" });
  });

  it("takes plain text as an item id itself", () => {
    expect(parseScanned("  AB-CD-123 ")).toEqual({ kind: "item", id: "AB-CD-123" });
  });

  it("gives null for empty text or a link without an id", () => {
    expect(parseScanned("   ")).toBeNull();
    expect(parseScanned("obsidian://inventory-ui?vault=X")).toBeNull();
  });
});

describe("findEntryById", () => {
  const entry = (id: string) =>
    ({ item: { id, path: `Inventory_Items/${id}.md` } as unknown as Item }) as InventoryEntry;

  it("matches ignoring case and spaces, and finds nothing for an unknown id", () => {
    const entries = [entry("AB-CD-123"), entry("ZZ-YY-999")];
    expect(findEntryById(entries, " ab-cd-123 ")).toBe(entries[0]);
    expect(findEntryById(entries, "nope")).toBeUndefined();
  });
});

describe("findPlaceById", () => {
  const places = [
    { name: "Shelf", path: "Shelf.md", id: "LC-111-111", cover: null },
    { name: "Box", path: "Box.md", id: "", cover: null },
  ];

  it("finds a place by id, and never matches an empty id", () => {
    expect(findPlaceById(places, " lc-111-111 ")?.name).toBe("Shelf");
    expect(findPlaceById(places, "")).toBeUndefined();
    expect(findPlaceById(places, "LC-999-999")).toBeUndefined();
  });
});
