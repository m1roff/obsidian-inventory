import { describe, expect, it } from "vitest";
import { StructureApplier, StructureWriter } from "../../../src/domain/structure/StructureApplier";
import { StructureChecker } from "../../../src/domain/structure/StructureChecker";
import { StructureLayout } from "../../../src/domain/structure/StructureLayout";
import { SetupStatus } from "../../../src/domain/structure/SetupStatus";
import { buildSkeleton } from "../../../src/domain/structure/StructureSkeleton";
import { buildTree } from "../../../src/domain/structure/StructureTree";

const emptyVault = {
  folderExists: () => false,
  fileExists: () => false,
  readText: async () => null,
  readFrontmatter: async () => null,
};

describe("StructureApplier", () => {
  it("applies folders before files, classes before their fields", async () => {
    const layout = new StructureLayout("Inventory");
    const skeleton = buildSkeleton(layout);
    const report = await new StructureChecker(emptyVault).check(skeleton);

    const calls: string[] = [];
    const writer: StructureWriter = {
      createFolder: async () => void calls.push("folder"),
      createFile: async () => void calls.push("file"),
      createClass: async () => void calls.push("class"),
      addField: async () => void calls.push("field"),
      addOption: async () => void calls.push("option"),
      replaceFile: async () => void calls.push("replace-file"),
      replaceField: async () => void calls.push("replace-field"),
      addClassFolder: async () => void calls.push("class-folder"),
    };
    const result = await new StructureApplier(writer).apply([...report.fixable].reverse());

    expect(result.failed).toEqual([]);
    expect(result.applied).toBe(report.fixable.length);
    expect(calls.indexOf("file")).toBeGreaterThan(calls.lastIndexOf("folder"));
    expect(calls.indexOf("class")).toBeGreaterThan(calls.lastIndexOf("file"));
  });

  it("keeps going when one fix fails and reports it", async () => {
    const layout = new StructureLayout("Inventory");
    const report = await new StructureChecker(emptyVault).check(buildSkeleton(layout));
    const writer: StructureWriter = {
      createFolder: async (path) => {
        if (path.endsWith("kinds")) throw new Error("boom");
      },
      createFile: async () => {},
      createClass: async () => {},
      addField: async () => {},
      addOption: async () => {},
      replaceFile: async () => {},
      replaceField: async () => {},
      addClassFolder: async () => {},
    };
    const result = await new StructureApplier(writer).apply(report.fixable);
    expect(result.failed).toHaveLength(1);
    expect(result.applied).toBe(report.fixable.length - 1);
  });
});

describe("buildTree", () => {
  it("nests entries under the base folder and marks the missing ones", async () => {
    const layout = new StructureLayout("Inventory");
    const skeleton = buildSkeleton(layout);
    const report = await new StructureChecker(emptyVault).check(skeleton);
    const tree = buildTree(skeleton, report);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ name: "Inventory", kind: "folder", status: "missing" });
    const names = tree[0].children.map((c) => c.name);
    expect(names).toContain("_inventory_config");
    expect(names).toContain("Stock positions.base");
    const config = tree[0].children.find((c) => c.name === "_inventory_config");
    const classes = config?.children.find((c) => c.name === "fileclasses");
    expect(classes?.children.map((c) => c.kind)).toEqual(["class", "class", "class"]);
  });
});

describe("SetupStatus", () => {
  it("mutes initialization until the plugins are there", async () => {
    const report = await new StructureChecker(emptyVault).check(buildSkeleton(new StructureLayout("Inventory")));
    const without = new SetupStatus([{ id: "fileclass", name: "Fileclass", installed: false }], report);
    expect(without.canInitialize).toBe(false);
    expect(without.dashboardAvailable).toBe(false);

    const ready = new SetupStatus([{ id: "fileclass", name: "Fileclass", installed: true }], report);
    expect(ready.canInitialize).toBe(true);
  });
});
