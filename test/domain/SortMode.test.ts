import { describe, expect, it } from "vitest";
import { chooseSort } from "../../src/domain/SortMode";

describe("chooseSort", () => {
  it("flips the direction when the chosen sort is pressed again", () => {
    expect(chooseSort({ mode: "created", reversed: false }, "created")).toEqual({ mode: "created", reversed: true });
    expect(chooseSort({ mode: "created", reversed: true }, "created")).toEqual({ mode: "created", reversed: false });
  });

  it("starts another sort in its natural direction", () => {
    expect(chooseSort({ mode: "created", reversed: true }, "updated")).toEqual({ mode: "updated", reversed: false });
  });
});
