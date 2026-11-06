import { describe, expect, it } from "vitest";
import { shouldWriteCover } from "../../src/domain/CoverWriter";
import {
  DEFAULT_PHOTO_HEADING,
  defaultTarget,
  newSectionHeading,
  outline,
  targetHeading,
} from "../../src/domain/PhotoSections";

const note = "---\nid: X\n---\n# Extra description\n## Real photo\ntext\n### Deep\n# Gallery\n# Gallery\n";

describe("outline", () => {
  it("lists every heading in the order of the note with its rank, skipping the properties", () => {
    expect(outline(note).map((entry) => [entry.rank, entry.title])).toEqual([
      [1, "Extra description"],
      [2, "Real photo"],
      [3, "Deep"],
      [1, "Gallery"],
    ]);
  });

  it("is empty for a note without headings", () => {
    expect(outline("---\nid: X\n---\njust text\n")).toEqual([]);
  });
});

describe("defaultTarget", () => {
  it("picks the Real photo section when the note has it", () => {
    expect(defaultTarget(outline(note))).toEqual({ kind: "existing", heading: DEFAULT_PHOTO_HEADING });
  });

  it("offers a new Real photo section when it does not", () => {
    expect(defaultTarget(outline("# Gallery\n"))).toEqual({ kind: "new", name: "Real photo" });
  });
});

describe("newSectionHeading", () => {
  it("makes a second-rank heading from the typed name", () => {
    expect(newSectionHeading("  Box   photos ")).toBe("## Box photos");
    expect(newSectionHeading("## Already hashed")).toBe("## Already hashed");
  });

  it("is null for an empty name", () => {
    expect(newSectionHeading("  ")).toBeNull();
    expect(newSectionHeading("##")).toBeNull();
  });
});

describe("targetHeading", () => {
  it("uses the heading as it is or the typed name", () => {
    expect(targetHeading({ kind: "existing", heading: "# Gallery" })).toBe("# Gallery");
    expect(targetHeading({ kind: "new", name: "Parts" })).toBe("## Parts");
    expect(targetHeading({ kind: "new", name: "" })).toBeNull();
  });
});

describe("shouldWriteCover", () => {
  it("replace always writes, none never, ifEmpty only over an empty cover", () => {
    expect(shouldWriteCover("replace", "[[a.jpg]]")).toBe(true);
    expect(shouldWriteCover("none", "")).toBe(false);
    expect(shouldWriteCover("ifEmpty", "")).toBe(true);
    expect(shouldWriteCover("ifEmpty", undefined)).toBe(true);
    expect(shouldWriteCover("ifEmpty", null)).toBe(true);
    expect(shouldWriteCover("ifEmpty", "[[a.jpg]]")).toBe(false);
  });
});
