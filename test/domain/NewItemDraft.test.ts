import { describe, expect, it } from "vitest";
import { AddItemError, NewItemDraft } from "../../src/domain/NewItemDraft";

const valid = { name: "  Hex Key 2.0 (130mm) ", kind: "Tool", location: "Box", quantity: 1 };

describe("NewItemDraft", () => {
  it("trims the name", () => {
    expect(NewItemDraft.create(valid).name).toBe("Hex Key 2.0 (130mm)");
  });

  it.each([
    ["name-empty", { name: "   " }],
    ["name-invalid", { name: "a/b" }],
    ["name-invalid", { name: "what?" }],
    ["kind-missing", { kind: "" }],
    ["location-missing", { location: "" }],
    ["quantity-invalid", { quantity: 0 }],
    ["quantity-invalid", { quantity: 1.5 }],
    ["quantity-invalid", { quantity: Number.NaN }],
  ])("rejects with %s", (code, patch) => {
    try {
      NewItemDraft.create({ ...valid, ...patch });
      expect.unreachable();
    } catch (error) {
      expect((error as AddItemError).code).toBe(code);
    }
  });
});

describe("NewItemDraft.problems", () => {
  it("lists every wrong field at once", () => {
    expect(NewItemDraft.problems({ name: " ", kind: "", location: "", quantity: 0 })).toEqual([
      "name-empty",
      "kind-missing",
      "location-missing",
      "quantity-invalid",
    ]);
    expect(NewItemDraft.problems({ name: "ok", kind: "Tool", location: "Box", quantity: 1 })).toEqual([]);
  });
});
