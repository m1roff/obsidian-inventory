import { describe, expect, it } from "vitest";
import { Place } from "../../src/domain/Place";
import { IdGenerator } from "../../src/domain/IdGenerator";
import { PlaceIds } from "../../src/domain/PlaceIds";

function setup(places: Place[]) {
  const written: Array<[string, string]> = [];
  let counter = 0;
  // Every generated id differs: the random source keeps counting up
  const generator = new IdGenerator({
    nextInt: (max) => Math.floor(counter++ / 2) % max,
  });
  const lists = { kinds: () => [], tags: () => [], locations: () => places.map((p) => p.name), places: () => places };
  const writer = {
    async setId(path: string, id: string) {
      written.push([path, id]);
    },
  };
  return { service: new PlaceIds(lists, generator, writer), written };
}

describe("PlaceIds", () => {
  it("keeps an existing id and writes nothing", async () => {
    const { service, written } = setup([{ name: "Shelf", path: "Shelf.md", id: "LC-AB-123", cover: null, tags: [] }]);
    expect(await service.ensure({ name: "Shelf", path: "Shelf.md", id: "LC-AB-123", cover: null, tags: [] })).toBe("LC-AB-123");
    expect(written).toEqual([]);
  });

  it("writes a new id for a place without one", async () => {
    const place = { name: "Box", path: "Box.md", id: "", cover: null, tags: [] };
    const { service, written } = setup([place]);
    const id = await service.ensure(place);
    expect(id).toMatch(/^LC-[A-HJKMN-Z]{2}-\d{3}$/);
    expect(written).toEqual([["Box.md", id]]);
  });

  it("gives ids only to places that lack one, all different, and counts them", async () => {
    const { service, written } = setup([
      { name: "A", path: "A.md", id: "LC-AA-000", cover: null, tags: [] },
      { name: "B", path: "B.md", id: "", cover: null, tags: [] },
      { name: "C", path: "C.md", id: "", cover: null, tags: [] },
    ]);
    expect(await service.assignMissing()).toBe(2);
    expect(written.map(([path]) => path)).toEqual(["B.md", "C.md"]);
    const ids = written.map(([, id]) => id);
    expect(new Set([...ids, "LC-AA-000"]).size).toBe(3);
  });

  it("does nothing when every place has an id", async () => {
    const { service, written } = setup([{ name: "A", path: "A.md", id: "LC-AA-000", cover: null, tags: [] }]);
    expect(await service.assignMissing()).toBe(0);
    expect(written).toEqual([]);
  });
});

describe("PlaceIds.withoutId", () => {
  it("lists only the places that have no id", () => {
    const { service } = setup([
      { name: "Shelf", path: "Shelf.md", id: "LC-AB-123", cover: null, tags: [] },
      { name: "Box", path: "Box.md", id: "", cover: null, tags: [] },
    ]);
    expect(service.withoutId().map((p) => p.name)).toEqual(["Box"]);
  });
});
