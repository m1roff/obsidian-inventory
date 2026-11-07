import { describe, expect, it } from "vitest";
import { PlaceParentError, PlaceParentService } from "../../src/domain/PlaceParentService";

const place = (name: string, parent: string | null) => ({
  name,
  path: `${name}.md`,
  id: "",
  cover: null,
  tags: [],
  parent,
});

function setup() {
  const written: Array<[string, string | null]> = [];
  const places = [place("Pantry", null), place("Shelf", "Pantry"), place("Box", "Shelf"), place("Garage", null)];
  const service = new PlaceParentService(
    { setParent: async (path, parent) => void written.push([path, parent]) },
    { places: () => places },
  );
  return { service, written };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as PlaceParentError).code;
  }
  throw new Error("expected a PlaceParentError");
}

describe("PlaceParentService", () => {
  it("writes the parent into the place's note, and takes it out with null", async () => {
    const { service, written } = setup();
    await service.set("Box", "Garage");
    await service.set("Shelf", null);
    expect(written).toEqual([
      ["Box.md", "Garage"],
      ["Shelf.md", null],
    ]);
  });

  it("refuses a place inside itself, inside what is inside it, and unknown names", async () => {
    const { service, written } = setup();
    expect(await codeOf(service.set("Box", "Box"))).toBe("self");
    expect(await codeOf(service.set("Pantry", "Box"))).toBe("cycle");
    expect(await codeOf(service.set("Pantry", "Shelf"))).toBe("cycle");
    expect(await codeOf(service.set("Box", "Nowhere"))).toBe("unknown-parent");
    expect(await codeOf(service.set("Nowhere", "Box"))).toBe("unknown-place");
    expect(written).toEqual([]);
  });
});
