import { describe, expect, it } from "vitest";
import { linkDisplayName, parseWikiLink } from "../../src/domain/WikiLink";

describe("parseWikiLink", () => {
  it("parses a plain link", () => {
    expect(parseWikiLink("[[Note]]")).toEqual({ target: "Note", alias: null });
  });

  it("parses a path with alias, as the stock position template writes it", () => {
    expect(parseWikiLink("[[Inventory_Items/Hex Key|Hex Key]]")).toEqual({
      target: "Inventory_Items/Hex Key",
      alias: "Hex Key",
    });
  });

  it("drops a heading part", () => {
    expect(parseWikiLink("[[Note#Heading]]")?.target).toBe("Note");
  });

  it.each([["" ], ["Note"], ["[[]]"], [null], [42]])(
    "returns null for %j",
    (raw) => {
      expect(parseWikiLink(raw)).toBeNull();
    },
  );
});

describe("linkDisplayName", () => {
  it("prefers the alias, then the last path segment", () => {
    expect(linkDisplayName({ target: "a/b/Note", alias: null })).toBe("Note");
    expect(linkDisplayName({ target: "a/b/Note", alias: "Shown" })).toBe("Shown");
  });
});
