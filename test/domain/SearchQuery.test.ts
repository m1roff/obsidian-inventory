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
});
