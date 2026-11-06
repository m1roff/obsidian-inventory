import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOCK_STATE_POLICY,
  DEFAULT_STOCK_STATES,
  parseStockStates,
  StockStateError,
  StockStatePolicy,
} from "../../src/domain/StockState";

describe("StockStatePolicy", () => {
  it("counts stored and installed by default, not defective or the exits", () => {
    const p = DEFAULT_STOCK_STATE_POLICY;
    expect(p.counts("stored")).toBe(true);
    expect(p.counts("installed")).toBe(true);
    expect(p.counts("defective")).toBe(false);
    expect(p.counts("consumed")).toBe(false);
    expect(p.counts("disposed")).toBe(false);
  });

  it("offers every state except the exits as a place state, in the owner's order", () => {
    expect(DEFAULT_STOCK_STATE_POLICY.placeStates()).toEqual(["stored", "installed", "defective"]);
    const reordered = DEFAULT_STOCK_STATE_POLICY.shift("defective", -1);
    expect(reordered.placeStates()).toEqual(["stored", "defective", "installed"]);
  });

  it("shows uncounted place states next to the count, but not the exits", () => {
    expect(DEFAULT_STOCK_STATE_POLICY.visibleUncounted()).toEqual(["defective"]);
  });

  it("adds an own state, once, and rejects bad names", () => {
    const next = DEFAULT_STOCK_STATE_POLICY.add("On loan", true);
    expect(next.counts("on loan")).toBe(true);
    expect(() => next.add("ON LOAN", true)).toThrowError(StockStateError);
    expect(() => next.add("  ", true)).toThrowError(StockStateError);
    expect(() => next.add("a/b", true)).toThrowError(StockStateError);
  });

  it("removes only the owner's own states", () => {
    const next = DEFAULT_STOCK_STATE_POLICY.add("On loan", true);
    const unused = { count: () => 0 };
    expect(next.remove("On loan", unused).names()).toEqual(DEFAULT_STOCK_STATE_POLICY.names());
    expect(next.remove("stored", unused).names()).toContain("stored");
  });

  it("refuses to remove a state that positions are still in", () => {
    const next = DEFAULT_STOCK_STATE_POLICY.add("On loan", true);
    const used = { count: (state: string) => (state === "On loan" ? 2 : 0) };
    expect(() => next.remove("On loan", used)).toThrowError(StockStateError);
  });

  it("changes whether a state counts", () => {
    expect(DEFAULT_STOCK_STATE_POLICY.setCounts("defective", true).counts("defective")).toBe(true);
  });

  it("does not move a state past either end", () => {
    expect(DEFAULT_STOCK_STATE_POLICY.shift("stored", -1).names()).toEqual(DEFAULT_STOCK_STATE_POLICY.names());
    expect(DEFAULT_STOCK_STATE_POLICY.shift("disposed", 1).names()).toEqual(DEFAULT_STOCK_STATE_POLICY.names());
  });
});

describe("parseStockStates", () => {
  it("gives the factory list for nothing readable", () => {
    expect(parseStockStates(undefined)).toEqual([...DEFAULT_STOCK_STATES]);
    expect(parseStockStates("x")).toEqual([...DEFAULT_STOCK_STATES]);
  });

  it("keeps the saved order and the owner's own states", () => {
    const saved = [
      { name: "installed", counts: true },
      { name: "On loan", counts: true },
      { name: "stored", counts: false },
    ];
    const names = parseStockStates(saved).map((s) => s.name);
    expect(names.slice(0, 3)).toEqual(["installed", "On loan", "stored"]);
  });

  it("puts a missing built-in state back", () => {
    const names = parseStockStates([{ name: "stored", counts: true }]).map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["stored", "installed", "defective", "consumed", "disposed"]));
  });

  it("skips duplicates and unreadable entries", () => {
    const result = parseStockStates([{ name: "stored", counts: true }, { name: "STORED", counts: false }, 7, null, { name: "" }]);
    expect(result.filter((s) => s.name.toLowerCase() === "stored")).toHaveLength(1);
  });
});

describe("StockStatePolicy.constructor", () => {
  it("treats an unlisted name as not counted", () => {
    expect(new StockStatePolicy([]).counts("anything")).toBe(false);
  });
});
