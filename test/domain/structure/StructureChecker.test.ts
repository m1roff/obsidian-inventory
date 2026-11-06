import { describe, expect, it } from "vitest";
import { DEFAULT_STOCK_STATE_POLICY } from "../../../src/domain/StockState";
import { StructureChecker, StructureVault } from "../../../src/domain/structure/StructureChecker";
import { StructureLayout } from "../../../src/domain/structure/StructureLayout";
import { buildSkeleton } from "../../../src/domain/structure/StructureSkeleton";

class FakeVault implements StructureVault {
  folders = new Set<string>();
  texts = new Map<string, string>();
  frontmatter = new Map<string, Record<string, unknown>>();

  folderExists(path: string): boolean {
    return this.folders.has(path);
  }
  fileExists(path: string): boolean {
    return this.texts.has(path) || this.frontmatter.has(path);
  }
  async readText(path: string): Promise<string | null> {
    return this.texts.get(path) ?? null;
  }
  async readFrontmatter(path: string): Promise<Record<string, unknown> | null> {
    return this.frontmatter.get(path) ?? null;
  }
}

/** A vault that already matches the skeleton exactly. */
function completeVault(layout: StructureLayout): FakeVault {
  const skeleton = buildSkeleton(layout);
  const vault = new FakeVault();
  skeleton.folders.forEach((f) => vault.folders.add(f));
  skeleton.files.forEach((f) => vault.texts.set(f.path, f.content));
  skeleton.fileClasses.forEach((c) => vault.frontmatter.set(c.path, { ...c.data }));
  return vault;
}

describe("StructureChecker", () => {
  const layout = new StructureLayout("Inventory");
  const skeleton = buildSkeleton(layout);

  it("reports a first run for an empty vault, everything fixable", async () => {
    const report = await new StructureChecker(new FakeVault()).check(skeleton);
    expect(report.isEmpty).toBe(true);
    expect(report.manual).toEqual([]);
    expect(report.fixable.length).toBe(report.issues.length);
  });

  it("finds nothing wrong in a complete vault", async () => {
    const report = await new StructureChecker(completeVault(layout)).check(skeleton);
    expect(report.isHealthy).toBe(true);
  });

  it("offers to add a missing field and leaves the owner's own fields alone", async () => {
    const vault = completeVault(layout);
    const path = `${layout.fileClasses}/Stock position.md`;
    const data = { ...(vault.frontmatter.get(path) as Record<string, unknown>) };
    const fields = (data.fields as Array<{ name: string }>).filter((f) => f.name !== "State");
    fields.push({ name: "my_own_field" });
    data.fields = fields;
    vault.frontmatter.set(path, data);

    const report = await new StructureChecker(vault).check(skeleton);
    expect(report.issues.map((i) => [i.code, i.detail])).toEqual([["field-missing", "State"]]);
    expect(report.issues[0].fix?.kind).toBe("add-field");
  });

  it("offers to replace a field that has another type", async () => {
    const vault = completeVault(layout);
    const path = `${layout.fileClasses}/Stock position.md`;
    const data = { ...(vault.frontmatter.get(path) as Record<string, unknown>) };
    data.fields = (data.fields as Array<{ name: string; type: string }>).map((f) =>
      f.name === "quantity" ? { ...f, type: "Input" } : f,
    );
    vault.frontmatter.set(path, data);

    const report = await new StructureChecker(vault).check(skeleton);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ code: "field-type", severity: "warning" });
    expect(report.issues[0].fix).toMatchObject({ kind: "replace-field", classPath: path });
  });

  it("patches only the formula when that is all an old Bases file lacks", async () => {
    const vault = completeVault(layout);
    const oldText = skeleton.files
      .find((f) => f.path === layout.itemsBase)!
      .content.replace(/totalQuantity: .*/, "totalQuantity: old()")
      .replace("name: All", "name: My own name");
    vault.texts.set(layout.itemsBase, oldText);

    const report = await new StructureChecker(vault).check(skeleton);
    const issue = report.issues.find((i) => i.code === "file-paths");
    expect(issue?.fix).toMatchObject({ kind: "patch-file", path: layout.itemsBase, formulas: ["totalQuantity"] });
    const patched = (issue?.fix as { content: string }).content;
    expect(patched).toContain("name: My own name");
    expect(patched).not.toContain("old()");
  });

  it("warns when a Bases view or a class points at other folders", async () => {
    const vault = completeVault(layout);
    vault.texts.set(layout.itemsBase, 'file.inFolder("Inventory_Items")');
    const path = `${layout.fileClasses}/Inventory-List.md`;
    vault.frontmatter.set(path, { ...(vault.frontmatter.get(path) as object), filesPaths: ["old/places"] });

    const report = await new StructureChecker(vault).check(skeleton);
    // The edited Bases file misses both the items folder and the counted-states formula: one issue, one fix.
    expect(report.issues.map((i) => i.code).sort()).toEqual(["class-folder", "file-paths"]);
    expect(report.issues.find((i) => i.code === "file-paths")?.fix).toMatchObject({
      kind: "replace-file",
      path: layout.itemsBase,
    });
    expect(report.issues.find((i) => i.code === "class-folder")?.fix).toMatchObject({
      kind: "add-class-folder",
      folder: layout.locations,
    });
    expect(report.fixable).toHaveLength(2);
  });

  it("follows a renamed base folder", async () => {
    const other = new StructureLayout("Home stuff");
    const report = await new StructureChecker(completeVault(other)).check(buildSkeleton(other));
    expect(report.isHealthy).toBe(true);
    expect(buildSkeleton(other).folders[0]).toBe("Home stuff");
  });
});

describe("StructureChecker choices and counted states", () => {
  const layout = new StructureLayout("Inventory");

  it("offers to add a state the State field does not list yet", async () => {
    const policy = DEFAULT_STOCK_STATE_POLICY.add("On loan", true);
    const skeleton = buildSkeleton(layout, policy);
    const vault = completeVault(layout); // built from the default states
    const report = await new StructureChecker(vault).check(skeleton);

    const choice = report.issues.find((i) => i.code === "field-values-missing");
    expect(choice).toMatchObject({ detail: "State", found: "On loan" });
    expect(choice?.fix).toMatchObject({ kind: "add-option", fieldName: "State", value: "On loan" });
  });

  it("writes the Bases formulas so only counted states add up", () => {
    const skeleton = buildSkeleton(layout, DEFAULT_STOCK_STATE_POLICY);
    const items = skeleton.files.find((f) => f.path === layout.itemsBase);
    expect(items?.content).toContain('["stored", "installed"].contains(value.asFile().properties.State)');
    const changed = buildSkeleton(layout, DEFAULT_STOCK_STATE_POLICY.setCounts("defective", true));
    expect(changed.files.find((f) => f.path === layout.itemsBase)?.content).toContain(
      '["stored", "installed", "defective"].contains',
    );
  });

  it("warns when a Bases view does not use the current counted states", async () => {
    const vault = completeVault(layout);
    const policy = DEFAULT_STOCK_STATE_POLICY.setCounts("defective", true);
    const report = await new StructureChecker(vault).check(buildSkeleton(layout, policy));
    expect(report.issues.filter((i) => i.code === "file-paths").map((i) => i.path)).toEqual([layout.itemsBase]);
  });
});
