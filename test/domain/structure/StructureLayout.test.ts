import { describe, expect, it } from "vitest";
import { isValidBaseFolder, StructureLayout } from "../../../src/domain/structure/StructureLayout";

describe("StructureLayout", () => {
  it("puts everything under the base folder", () => {
    const layout = new StructureLayout("Inventory");
    expect(layout.items).toBe("Inventory/Inventory_Items");
    expect(layout.locations).toBe("Inventory/_inventory_config/lists/locations");
    expect(layout.listsBase).toBe("Inventory/_inventory_config/Lists.base");
    expect(layout.itemsBase).toBe("Inventory/Inventory items.base");
  });

  it("trims slashes and spaces", () => {
    expect(new StructureLayout(" /Home/stuff/ ").root).toBe("Home/stuff");
  });

  it("rejects empty names and path tricks", () => {
    expect(isValidBaseFolder("")).toBe(false);
    expect(isValidBaseFolder("../x")).toBe(false);
    expect(isValidBaseFolder("a:b")).toBe(false);
    expect(isValidBaseFolder("Home inventory")).toBe(true);
  });
});
