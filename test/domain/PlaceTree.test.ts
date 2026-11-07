import { describe, expect, it } from "vitest";
import { parsePlaceParent } from "../../src/domain/Place";
import { PlaceTree } from "../../src/domain/PlaceTree";

const p = (name: string, parent: string | null) => ({ name, parent });

describe("PlaceTree", () => {
  const tree = new PlaceTree([p("Pantry", null), p("Shelf", "Pantry"), p("Box", "Shelf"), p("Garage", null)]);

  it("tells the parent, the places it stands inside and the path", () => {
    expect(tree.parentOf("Box")).toBe("Shelf");
    expect(tree.parentOf("Pantry")).toBeNull();
    expect(tree.ancestors("Box")).toEqual(["Pantry", "Shelf"]);
    expect(tree.inside("Box")).toBe("Pantry › Shelf");
    expect(tree.inside("Pantry")).toBeNull();
    expect(tree.fullPath("Box")).toBe("Pantry › Shelf › Box");
    expect(tree.fullPath("Garage")).toBe("Garage");
  });

  it("finds everything inside a place, however deep", () => {
    expect([...tree.descendants("Pantry")].sort()).toEqual(["Box", "Shelf"]);
    expect([...tree.withDescendants("Shelf")].sort()).toEqual(["Box", "Shelf"]);
    expect(tree.descendants("Box").size).toBe(0);
    expect(tree.hasNested("Pantry")).toBe(true);
    expect(tree.hasNested("Box")).toBe(false);
  });

  it("does not let a place go inside itself or inside what is inside it", () => {
    expect(tree.canStandInside("Pantry", "Pantry")).toBe(false);
    expect(tree.canStandInside("Pantry", "Box")).toBe(false);
    expect(tree.canStandInside("Pantry", "Garage")).toBe(true);
    expect(tree.canStandInside("Box", "Pantry")).toBe(true);
    expect(tree.validParents("Shelf", ["Pantry", "Shelf", "Box", "Garage"])).toEqual(["Pantry", "Garage"]);
  });

  it("labels the options with the path, so the list reads as a tree", () => {
    expect(tree.options(["Box", "Garage"])).toEqual([
      { value: "Box", label: "Pantry › Shelf › Box" },
      { value: "Garage", label: "Garage" },
    ]);
  });

  it("ignores a parent that is no location, and a place that points at itself", () => {
    const odd = new PlaceTree([p("A", "Gone"), p("B", "B")]);
    expect(odd.parentOf("A")).toBeNull();
    expect(odd.parentOf("B")).toBeNull();
    expect(odd.inside("A")).toBeNull();
  });

  it("survives a loop written by hand: every walk stops", () => {
    const loop = new PlaceTree([p("A", "B"), p("B", "C"), p("C", "A")]);
    expect(loop.ancestors("A")).toEqual(["C", "B"]);
    expect(loop.inside("A")).toBe("C › B");
    expect([...loop.descendants("A")].sort()).toEqual(["B", "C"]);
    expect(loop.canStandInside("A", "B")).toBe(false);
  });
});

describe("parsePlaceParent", () => {
  it("reads the name from a link, with or without a folder or an alias", () => {
    expect(parsePlaceParent("[[Pantry]]")).toBe("Pantry");
    expect(parsePlaceParent("[[Inventory/lists/locations/Pantry|Pantry]]")).toBe("Pantry");
    expect(parsePlaceParent("[[Pantry.md]]")).toBe("Pantry");
  });

  it("gives null for anything that is not a link", () => {
    expect(parsePlaceParent("Pantry")).toBeNull();
    expect(parsePlaceParent("")).toBeNull();
    expect(parsePlaceParent(undefined)).toBeNull();
    expect(parsePlaceParent("[[ ]]")).toBeNull();
  });
});
