import { describe, expect, it } from "vitest";
import { AddItemError, NewItemDraft } from "../../src/domain/NewItemDraft";
import { FilamentDetails } from "../../src/domain/FilamentDetails";
import { StateUsage } from "../../src/domain/StateUsage";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { InventorySearch, stateQuery } from "../../src/domain/InventorySearch";
import { Item } from "../../src/domain/Item";
import { StockPosition } from "../../src/domain/StockPosition";
import { parseFilamentSettings } from "../../src/domain/modules/FilamentSettings";
import { FilamentModule } from "../../src/domain/modules/FilamentModule";
import { StructureChecker } from "../../src/domain/structure/StructureChecker";
import { StructureLayout } from "../../src/domain/structure/StructureLayout";
import { isReplacement } from "../../src/domain/structure/StructureReport";
import { buildSkeleton } from "../../src/domain/structure/StructureSkeleton";
import { buildTree } from "../../src/domain/structure/StructureTree";

const input = {
  material: "PLA",
  spoolFormat: "Spool",
  variant: "Matte",
  colorId: "11101",
  colorName: "Matte Charcoal",
};

describe("FilamentDetails", () => {
  it("builds the name the way the owner writes it", () => {
    expect(FilamentDetails.nameOf(input)).toBe("PLA Matte Charcoal 11101 With Spool");
    expect(FilamentDetails.nameOf({ ...input, colorName: "Charcoal" })).toBe("PLA Matte Charcoal 11101 With Spool");
    expect(FilamentDetails.nameOf({ ...input, material: "PETG", variant: "Basic", colorId: "30105", colorName: "Black", spoolFormat: "Refill" })).toBe(
      "PETG Basic Black 30105 Refill",
    );
  });

  it("skips what is empty", () => {
    expect(FilamentDetails.nameOf({ ...input, variant: "", colorId: "", colorName: "Charcoal" })).toBe("PLA Charcoal With Spool");
  });

  it("asks for material, format and color name", () => {
    expect(() => FilamentDetails.create({ ...input, colorName: " " })).toThrowError(AddItemError);
    expect(() => FilamentDetails.create({ ...input, material: "" })).toThrowError(AddItemError);
  });

  it("gives the class, fields and tags of a filament card", () => {
    const details = FilamentDetails.create(input).toDetails();
    expect(details.fileClass).toBe("Filament");
    expect(details.fields).toMatchObject({ material: "PLA", spool_format: "Spool", variant: "Matte", ColorID: "11101", ColorName: "Matte Charcoal" });
    expect(details.tags).toEqual(["3dPrinter", "Filament"]);
  });

  it("merges the card's own tags with the filament ones, once", () => {
    const draft = NewItemDraft.create({
      name: "x",
      kind: "Plastic for 3d",
      location: "Box",
      quantity: 1,
      tags: ["Filament", "Dry"],
      details: FilamentDetails.create(input).toDetails(),
    });
    expect(draft.tags).toEqual(["Filament", "Dry", "3dPrinter"]);
  });
});

describe("filament settings", () => {
  it("is off by default and keeps a usable kind", () => {
    expect(parseFilamentSettings(undefined)).toEqual({ enabled: false, kind: "Plastic for 3d" });
    expect(parseFilamentSettings({ enabled: true, kind: "  " })).toEqual({ enabled: true, kind: "Plastic for 3d" });
    expect(parseFilamentSettings({ enabled: true, kind: " Resin " })).toEqual({ enabled: true, kind: "Resin" });
  });
});

describe("filament module in the skeleton", () => {
  const layout = new StructureLayout("Inventory");

  it("adds nothing when it is off", () => {
    const skeleton = buildSkeleton(layout);
    expect(skeleton.fileClasses.map((c) => c.name)).not.toContain("Filament");
    expect(skeleton.files.map((f) => f.path)).not.toContain(layout.filamentBase);
  });

  it("adds its class and table, marked as the module's, when it is on", () => {
    const skeleton = buildSkeleton(layout, undefined, [new FilamentModule()]);
    const cls = skeleton.fileClasses.find((c) => c.name === "Filament");
    expect(cls?.module).toBe("filament");
    expect(cls?.fields.map((f) => f.name)).toEqual(["material", "spool_format", "variant", "ColorID", "ColorName"]);
    expect(skeleton.files.find((f) => f.path === layout.filamentBase)?.module).toBe("filament");
  });

  it("marks the tree nodes of the module", async () => {
    const skeleton = buildSkeleton(layout, undefined, [new FilamentModule()]);
    const nothing = {
      folderExists: () => false,
      fileExists: () => false,
      readText: () => Promise.resolve(null),
      readFrontmatter: () => Promise.resolve(null),
    };
    const report = await new StructureChecker(nothing).check(skeleton);
    const flat: Array<{ path: string; module?: string }> = [];
    const walk = (nodes: ReturnType<typeof buildTree>): void =>
      nodes.forEach((n) => {
        flat.push(n);
        walk([...n.children]);
      });
    walk(buildTree(skeleton, report));
    expect(flat.filter((n) => n.module === "filament").map((n) => n.path).sort()).toEqual(
      [layout.filamentBase, `${layout.fileClasses}/Filament.md`].sort(),
    );
  });
});

describe("replace fixes", () => {
  const layout = new StructureLayout("Inventory");

  it("tells replacing fixes from adding ones", async () => {
    const skeleton = buildSkeleton(layout);
    const vault = {
      folderExists: () => true,
      fileExists: () => true,
      readText: () => Promise.resolve("old"),
      readFrontmatter: () => Promise.resolve({}),
    };
    const report = await new StructureChecker(vault).check(skeleton);
    const replacing = report.fixable.filter((i) => i.fix && isReplacement(i.fix));
    expect(replacing.map((i) => i.fix?.kind)).toContain("replace-file");
    expect(report.fixable.some((i) => i.fix?.kind === "add-field")).toBe(true);
  });
});

const item = new Item("Inventory_Items/Spool.md", "Spool", "TST-1", "Plastic", "", [], null, 0, 0);
const at = (state: string) => new StockPosition(`Inventory_Positions/${state}.md`, item.path, 1, "Box", state, 0, 0);

describe("StateUsage and the state search", () => {
  const entries = [
    new InventoryEntry(item, [at("stored"), at("On loan"), at("on loan")]),
    new InventoryEntry(new Item("Inventory_Items/Bolt.md", "Bolt", "TST-2", "Fastener", "", [], null, 0, 0), [at("stored")]),
  ];

  it("counts positions per state, ignoring case", () => {
    const usage = new StateUsage(entries);
    expect(usage.count("On loan")).toBe(2);
    expect(usage.count("stored")).toBe(2);
    expect(usage.count("defective")).toBe(0);
  });

  it("finds the items with units in a state, also with spaces in its name", () => {
    const search = new InventorySearch();
    expect(stateQuery("On loan")).toBe("state:on_loan");
    expect(search.filter(entries, "state:on_loan").map((e) => e.item.name)).toEqual(["Spool"]);
    expect(search.filter(entries, "state:stor").map((e) => e.item.name)).toEqual(["Spool", "Bolt"]);
    expect(search.filter(entries, "state:stored bolt").map((e) => e.item.name)).toEqual(["Bolt"]);
  });
});
