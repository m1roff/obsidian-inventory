import { describe, expect, it } from "vitest";
import { AddReferenceError } from "../../src/domain/AddReferenceService";
import { PlaceTagService } from "../../src/domain/PlaceTagService";

function setup(existing: string[], failWith?: AddReferenceError) {
  const written: { path: string; tags: readonly string[] }[] = [];
  const created: string[] = [];
  const service = new PlaceTagService(
    { setTags: async (path, tags) => void written.push({ path, tags }) },
    { tags: () => existing } as never,
    {
      add: async (_kind: string, name: string) => {
        if (failWith) throw failWith;
        created.push(name);
        return name;
      },
    } as never,
  );
  return { service, written, created };
}

describe("PlaceTagService", () => {
  it("writes the cleaned, de-duplicated tags and makes notes for the new ones only", async () => {
    const { service, written, created } = setup(["garage"]);
    const saved = await service.save("Box.md", ["#Garage", "garage", "metal", "two words", ""]);
    expect(saved).toEqual(["Garage", "metal"]);
    expect(created).toEqual(["metal"]);
    expect(written).toEqual([{ path: "Box.md", tags: ["Garage", "metal"] }]);
  });

  it("can empty the tags", async () => {
    const { service, written } = setup([]);
    await service.save("Box.md", []);
    expect(written).toEqual([{ path: "Box.md", tags: [] }]);
  });

  it("does not stop when the tag note appeared meanwhile", async () => {
    const { service, written } = setup([], new AddReferenceError("name-taken"));
    await service.save("Box.md", ["new"]);
    expect(written).toHaveLength(1);
  });
});
