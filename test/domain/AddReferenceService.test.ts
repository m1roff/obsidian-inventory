import { describe, expect, it } from "vitest";
import { IdGenerator } from "../../src/domain/IdGenerator";
import { AddReferenceError, AddReferenceService, ReferenceKind, ReferenceWriter } from "../../src/domain/AddReferenceService";

class FakeWriter implements ReferenceWriter {
  created: [ReferenceKind, string][] = [];
  ids: Array<string | undefined> = [];
  async create(kind: ReferenceKind, name: string, id?: string): Promise<void> {
    this.created.push([kind, name]);
    this.ids.push(id);
  }
}
const lists = {
  kinds: () => ["Tool", "Consumables"],
  tags: () => ["M3"],
  locations: () => ["Shelf"],
  places: () => [{ name: "Shelf", path: "Shelf.md", id: "LC-HH-111", cover: null, tags: [] }],
};
const ids = new IdGenerator({ nextInt: () => 7 });

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as AddReferenceError).code;
  }
  throw new Error("expected an AddReferenceError");
}

describe("AddReferenceService", () => {
  it("creates the entry and returns the trimmed name", async () => {
    const writer = new FakeWriter();
    const name = await new AddReferenceService(lists, writer, ids).add("kind", "  Glue ");
    expect(name).toBe("Glue");
    expect(writer.created).toEqual([["kind", "Glue"]]);
  });

  it("rejects empty and unusable names", async () => {
    const service = new AddReferenceService(lists, new FakeWriter(), ids);
    expect(await codeOf(service.add("kind", "   "))).toBe("name-empty");
    expect(await codeOf(service.add("location", "a/b"))).toBe("name-invalid");
  });

  it("rejects a duplicate in the same list, ignoring case, but not in the other list", async () => {
    const writer = new FakeWriter();
    const service = new AddReferenceService(lists, writer, ids);
    expect(await codeOf(service.add("kind", "tool"))).toBe("name-taken");
    // "Tool" is a kind, but may also be a location
    await service.add("location", "Tool");
    expect(writer.created).toEqual([["location", "Tool"]]);
  });

  it("gives a new location an id (a different one from the existing) and a kind none", async () => {
    const writer = new FakeWriter();
    const service = new AddReferenceService(lists, writer, ids);
    await service.add("location", "Drawer");
    await service.add("kind", "Glue");
    expect(writer.ids[0]).toMatch(/^LC-[A-HJKMN-Z]{2}-\d{3}$/);
    expect(writer.ids[0]).not.toBe("LC-HH-111");
    expect(writer.ids[1]).toBeUndefined();
  });
});

describe("AddReferenceService tag names", () => {
  it("does not accept a space in a tag, but does in a kind", async () => {
    const writer = new FakeWriter();
    const service = new AddReferenceService(lists, writer, ids);
    expect(await codeOf(service.add("tag", "New tag"))).toBe("tag-spaces");
    await service.add("kind", "Spare parts");
    expect(await service.add("tag", "New_tag")).toBe("New_tag");
  });
});
