import { describe, expect, it } from "vitest";
import { AddReferenceError } from "../../src/domain/AddReferenceService";
import { DefaultLocation, DEFAULT_LOCATION_NAME } from "../../src/domain/DefaultLocation";
import { RenameReferenceService } from "../../src/domain/RenameReferenceService";
import { completeLists } from "../helpers/lists";

function setup(initial: string[], name = DEFAULT_LOCATION_NAME, ready = true) {
  const locations = [...initial];
  const store = { value: name };
  const lists = completeLists({
    kinds: () => [],
    tags: () => [],
    locations: () => locations,
    places: () => [],
  });
  const adder = {
    add: async (_kind: "kind" | "location" | "tag", n: string) => {
      locations.push(n);
      return n;
    },
  };
  const renamer = {
    rename: async (_kind: "kind" | "location" | "tag", from: string, to: string) => {
      locations[locations.indexOf(from)] = to;
    },
  };
  const rename = new RenameReferenceService(lists, renamer);
  const def = new DefaultLocation(lists, adder, rename, { name: () => store.value, setName: (n) => (store.value = n) }, () => ready);
  return { def, locations, store };
}

describe("DefaultLocation", () => {
  it("is created in an empty vault", async () => {
    const { def, locations } = setup([]);
    expect(def.current()).toBeNull();
    expect(await def.ensure()).toBe("Unsorted");
    expect(locations).toEqual(["Unsorted"]);
  });

  it("creates nothing before the vault is set up", async () => {
    const { def, locations } = setup([], "Unsorted", false);
    expect(await def.ensure()).toBeNull();
    expect(locations).toEqual([]);
  });

  it("uses the chosen one, ignoring case, else the first by name", async () => {
    expect(setup(["Shelf", "Box"], "shelf").def.current()).toBe("Shelf");
    expect(setup(["Shelf", "Box"], "Gone").def.current()).toBe("Box");
    const { def, locations } = setup(["Shelf"], "Gone");
    expect(await def.ensure()).toBe("Shelf");
    expect(locations).toEqual(["Shelf"]);
  });

  it("follows a rename and refuses a taken or bad name", async () => {
    const { def, store, locations } = setup(["Unsorted", "Shelf"]);
    expect(await def.rename(" Home ")).toBe("Home");
    expect(store.value).toBe("Home");
    expect(locations).toContain("Home");
    await expect(def.rename("shelf")).rejects.toBeInstanceOf(AddReferenceError);
    await expect(def.rename("a/b")).rejects.toMatchObject({ code: "name-invalid" });
  });
});
