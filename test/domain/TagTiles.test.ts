import { describe, expect, it } from "vitest";
import { LocationTile, tilesMatching } from "../../src/domain/LocationBoard";
import { cleanTag, mergeTagNames, parseTagList } from "../../src/domain/TagList";
import { queryTags, tagsMatch } from "../../src/domain/TagQuery";

const tile = (name: string, tags: string[]): LocationTile => ({
  name,
  path: `${name}.md`,
  id: "",
  itemCount: 0,
  cover: null,
  tags,
  pinned: false,
  lastAddedAt: 0,
  lastUpdatedAt: 0,
});

describe("queryTags and tagsMatch", () => {
  it("takes the #words of a query, lowercase, and ignores a lone #", () => {
    expect(queryTags("Glue #Garage # #shelf")).toEqual(["garage", "shelf"]);
  });

  it("matches when every wanted tag is the start of some own tag", () => {
    expect(tagsMatch(["Garage", "Metal"], ["gar", "met"])).toBe(true);
    expect(tagsMatch(["Garage"], ["kitchen"])).toBe(false);
    expect(tagsMatch([], [])).toBe(true);
    expect(tagsMatch([], ["a"])).toBe(false);
  });
});

describe("tilesMatching", () => {
  const tiles = [tile("Box", ["garage"]), tile("Drawer", ["kitchen"]), tile("Shelf", [])];

  it("leaves every place for an empty query", () => {
    expect(tilesMatching(tiles, "  ", null).map((t) => t.name)).toEqual(["Box", "Drawer", "Shelf"]);
  });

  it("finds a place by a plain word in its name or id", () => {
    expect(tilesMatching(tiles, "draw", null).map((t) => t.name)).toEqual(["Drawer"]);
  });

  it("keeps only the places that have the tag themselves", () => {
    expect(tilesMatching(tiles, "#gar", null).map((t) => t.name)).toEqual(["Box"]);
  });

  it("keeps the place that is doing the filtering", () => {
    expect(tilesMatching(tiles, "#gar", "Shelf").map((t) => t.name)).toEqual(["Box", "Shelf"]);
  });
});

describe("tag lists", () => {
  it("reads a list, a single text or nothing", () => {
    expect(parseTagList([" a ", 3, "b", ""])).toEqual(["a", "b"]);
    expect(parseTagList("solo")).toEqual(["solo"]);
    expect(parseTagList(5)).toEqual(["5"]);
    expect(parseTagList(null)).toEqual([]);
  });

  it("cleans a tag and merges lists into one cloud", () => {
    expect(cleanTag("#Tag")).toBe("Tag");
    expect(cleanTag("two words")).toBeNull();
    expect(mergeTagNames(["Garage", "tool"], ["garage", "#Metal", "has space"])).toEqual(["Garage", "tool", "Metal"]);
  });
});
