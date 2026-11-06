import { describe, expect, it } from "vitest";
import { arrangeOptions, needsSearch, SelectOption } from "../../src/domain/OptionList";

const opt = (label: string, tail = false): SelectOption => ({ value: label, label, tail });
const labels = (options: SelectOption[]) => options.map((o) => o.label);

describe("needsSearch", () => {
  it("asks for the search field only for lists longer than five", () => {
    expect(needsSearch(5, 5)).toBe(false);
    expect(needsSearch(6, 5)).toBe(true);
    expect(needsSearch(0, 5)).toBe(false);
    expect(needsSearch(1, 0)).toBe(true);
    expect(needsSearch(9, 10)).toBe(false);
  });
});

describe("arrangeOptions", () => {
  const options = [opt("кладовая"), opt("Box B"), opt("box a"), opt("Принтер")];

  it("sorts alphabetically, ignoring case, across alphabets", () => {
    expect(labels(arrangeOptions(options, ""))).toEqual(["box a", "Box B", "кладовая", "Принтер"]);
  });

  it("filters by every word, in any order", () => {
    expect(labels(arrangeOptions(options, "ПРИН"))).toEqual(["Принтер"]);
    expect(arrangeOptions(options, "box принтер")).toEqual([]);
    expect(labels(arrangeOptions(options, "кл"))).toEqual(["кладовая"]);
    expect(arrangeOptions(options, "zzz")).toEqual([]);
  });

  it("keeps the given order when asked not to sort", () => {
    expect(labels(arrangeOptions([opt("stored"), opt("installed")], "", false))).toEqual(["stored", "installed"]);
  });

  it("keeps tail options last and filters them too", () => {
    const all = [opt("B"), opt("A"), opt("- Used up", true), opt("- Thrown away", true)];
    expect(labels(arrangeOptions(all, ""))).toEqual(["A", "B", "- Used up", "- Thrown away"]);
    expect(labels(arrangeOptions(all, "used"))).toEqual(["- Used up"]);
  });
});
