import { describe, expect, it } from "vitest";
import { SearchQuery, Searchable, searchablePlace } from "../../src/domain/SearchQuery";
import { suggestTags, withTag } from "../../src/domain/TagSuggestions";

const printed: Searchable = {
  tags: ["garage", "Metal"],
  texts: ["Ik. Printed products", "LC-GK-284"],
};
const matches = (query: string, target: Searchable = printed): boolean => SearchQuery.parse(query).matches(target);

describe("SearchQuery", () => {
  it("passes everything for an empty query, a lone # or a lone state:", () => {
    expect(SearchQuery.parse("").isEmpty).toBe(true);
    expect(SearchQuery.parse("  #  state:").isEmpty).toBe(true);
    expect(matches("  #  ")).toBe(true);
  });

  it("finds plain words in the texts and in the tags, any case, all of them", () => {
    expect(matches("printed")).toBe(true);
    expect(matches("gk-284 print")).toBe(true);
    expect(matches("metal")).toBe(true);
    expect(matches("printed wood")).toBe(false);
  });

  it("asks a #tag to be the start of one of the own tags", () => {
    expect(matches("#gar")).toBe(true);
    expect(matches("#kitchen")).toBe(false);
    expect(matches("#gar printed")).toBe(true);
    expect(matches("#gar wood")).toBe(false);
  });

  it("matches states for things that have them and ignores state: for those that do not", () => {
    const withStates: Searchable = { tags: [], texts: ["Glue"], states: ["stored", "in_use"] };
    expect(matches("state:sto", withStates)).toBe(true);
    expect(matches("state:in_u", withStates)).toBe(true);
    expect(matches("state:broken", withStates)).toBe(false);
    expect(matches("state:broken")).toBe(true);
  });

  it("looks at a place by name, id and own tags only", () => {
    const place = searchablePlace({ name: "Garage", id: "LC-AB-123", tags: ["tools"] });
    expect(matches("garage", place)).toBe(true);
    expect(matches("ab-123", place)).toBe(true);
    expect(matches("#tools", place)).toBe(true);
    expect(matches("glue", place)).toBe(false);
  });

  it("filters a list in its order and keeps all for an empty query", () => {
    const list = ["a1", "b2", "a3"];
    const look = (text: string): Searchable => ({ tags: [], texts: [text] });
    expect(SearchQuery.parse("a").filter(list, look)).toEqual(["a1", "a3"]);
    expect(SearchQuery.parse("").filter(list, look)).toEqual(list);
  });
});

describe("SearchQuery phrases and exclusion", () => {
  const glue: Searchable = {
    tags: ["3dprint", "filament"],
    texts: ["Super glue", "Tube of glue", "Ik. Printed"],
    states: ["stored"],
  };

  it("finds a phrase only as it stands inside one text", () => {
    expect(matches('"super glue"', glue)).toBe(true);
    expect(matches('"glue super"', glue)).toBe(false);
    // the words are in two different texts, so as a phrase they are not there
    expect(matches('"glue ik."', glue)).toBe(false);
    // but as two plain words they are
    expect(matches("glue ik.", glue)).toBe(true);
  });

  it("treats an unclosed quote as a phrase to the end", () => {
    expect(matches('"super gl', glue)).toBe(true);
    expect(matches('"super xx', glue)).toBe(false);
  });

  it("leaves out what is written with a leading minus", () => {
    expect(matches("-wood", glue)).toBe(true);
    expect(matches("-glue", glue)).toBe(false);
    expect(matches('-"super glue"', glue)).toBe(false);
    expect(matches('-"super wood"', glue)).toBe(true);
    expect(matches("glue -tube", glue)).toBe(false);
  });

  it("excludes by tag and state", () => {
    expect(matches("#3dprint -#filament", glue)).toBe(false);
    expect(matches("#3dprint -#resin", glue)).toBe(true);
    expect(matches("-state:stored", glue)).toBe(false);
    expect(matches("-state:consumed", glue)).toBe(true);
  });

  it("applies exclusion to a place by name, id and own tags, and ignores states", () => {
    const place = searchablePlace({ name: "Garage", id: "LC-AB-123", tags: ["tools"] });
    expect(matches("-garage", place)).toBe(false);
    expect(matches("-#tools", place)).toBe(false);
    expect(matches("-#wood", place)).toBe(true);
    expect(matches("-state:stored", place)).toBe(true);
  });

  it("does not take a minus inside a word, and a lone minus asks for nothing", () => {
    const part: Searchable = { tags: [], texts: ["LC-GK-284"] };
    expect(matches("gk-284", part)).toBe(true);
    expect(SearchQuery.parse("-").isEmpty).toBe(true);
    expect(SearchQuery.parse('"" -""').isEmpty).toBe(true);
  });
});

describe("suggestTags and withTag", () => {
  const tags = ["garage", "Gardening", "metal", "Garage"];

  it("offers nothing unless the last word starts with #", () => {
    expect(suggestTags("glue", tags, 8)).toEqual([]);
    expect(suggestTags("#gar glue", tags, 8)).toEqual([]);
  });

  it("offers the tags that start with what is typed, once each, sorted, up to the limit", () => {
    expect(suggestTags("glue #gar", tags, 8)).toEqual(["garage", "Gardening"]);
    expect(suggestTags("#", tags, 2)).toEqual(["garage", "Gardening"]);
  });

  it("does not offer a tag that is already in the text", () => {
    expect(suggestTags("#metal #m", tags, 8)).toEqual([]);
  });

  it("puts the chosen tag in place of the word being typed and leaves a space", () => {
    expect(withTag("glue #ga", "garage")).toBe("glue #garage ");
  });

  it("offers tags to leave out after a minus and keeps the minus", () => {
    expect(suggestTags("glue -#me", tags, 8)).toEqual(["metal"]);
    expect(suggestTags("#metal -#m", tags, 8)).toEqual([]);
    expect(withTag("glue -#me", "metal")).toBe("glue -#metal ");
  });
});
