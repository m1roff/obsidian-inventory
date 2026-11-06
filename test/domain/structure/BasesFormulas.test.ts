import { describe, expect, it } from "vitest";
import { setFormula } from "../../../src/domain/structure/BasesFormulas";

const base = `filters:
  and:
    - file.inFolder("Items")
formulas:
  updatedAt: file.mtime
  totalQuantity: old.formula()
  mine: 1 + 1
views:
  - type: table
    name: My own view
    order:
      - formula.totalQuantity
`;

describe("setFormula", () => {
  it("replaces one formula and leaves the rest of the file alone", () => {
    const out = setFormula(base, "totalQuantity", "new.formula()");
    expect(out).toBe(base.replace("old.formula()", "new.formula()"));
  });

  it("adds a formula that is missing to the block", () => {
    const out = setFormula(base, "extra", "2");
    expect(out).toContain("  mine: 1 + 1\n  extra: 2\nviews:");
  });

  it("makes the block when there is none, before the views", () => {
    const out = setFormula("filters:\n  and: []\nviews:\n  - type: table\n", "a", "1");
    expect(out).toBe("filters:\n  and: []\nformulas:\n  a: 1\nviews:\n  - type: table\n");
  });

  it("takes the continuation lines of a multi-line value with it", () => {
    const multi = "formulas:\n  a: |\n    long\n    value\n  b: 2\n";
    expect(setFormula(multi, "a", "1")).toBe("formulas:\n  a: 1\n  b: 2\n");
  });
});
