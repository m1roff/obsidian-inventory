import { describe, expect, it } from "vitest";
import { DEFAULT_STOCK_STATES, StockStatePolicy } from "../src/domain/StockState";
import { FrontmatterMapper, LinkResolver } from "../src/obsidian/FrontmatterMapper";

const known: Record<string, string> = {
  "Inventory_Items/Hex Key": "Inventory_Items/Hex Key.md",
  Spool: "Inventory_Items/Spool.md",
  "photo.jpg": "Attachments/photo.jpg",
};

const resolver: LinkResolver = {
  resolvePath: (target) => known[target] ?? null,
};
const mapper = new FrontmatterMapper(resolver);

describe("FrontmatterMapper.toItem", () => {
  it("maps frontmatter to an item", () => {
    const item = mapper.toItem(
      { path: "Inventory_Items/Spool.md", basename: "Spool", createdAt: 1700, updatedAt: 1800 },
      { id: "TST-1", kind: "[[Plastic for 3d]]", origin: "Bambu", tags: ["a", "b"], cover: "[[photo.jpg]]" },
    );
    expect(item).toMatchObject({
      name: "Spool",
      id: "TST-1",
      kind: "Plastic for 3d",
      origin: "Bambu",
      tags: ["a", "b"],
      coverPath: "Attachments/photo.jpg",
      createdAt: 1700,
      updatedAt: 1800,
    });
  });

  it("tolerates empty and odd values", () => {
    const item = mapper.toItem(
      { path: "Inventory_Items/X.md", basename: "X", createdAt: 0, updatedAt: 0 },
      { id: 12, kind: "", cover: "", tags: "single" },
    );
    expect(item).toMatchObject({ id: "12", kind: "", coverPath: null, tags: ["single"] });
  });
});

describe("FrontmatterMapper.toPosition", () => {
  const note = { path: "Inventory_Positions/p.md", basename: "p", createdAt: 0, updatedAt: 0 };

  it("maps a position with a full-path link and alias", () => {
    const position = mapper.toPosition(note, {
      Product: "[[Inventory_Items/Hex Key|Hex Key]]",
      quantity: 3,
      Location: "[[Test Box A]]",
      State: "stored",
    });
    expect(position).toMatchObject({
      productPath: "Inventory_Items/Hex Key.md",
      quantity: 3,
      location: "Test Box A",
      state: "stored",
    });
  });

  it.each([
    ["broken product link", { Product: "[[Missing]]", quantity: 1, State: "stored" }],
    ["bad quantity", { Product: "[[Spool]]", quantity: "many", State: "stored" }],
    ["no state", { Product: "[[Spool]]", quantity: 1 }],
    ["blank state", { Product: "[[Spool]]", quantity: 1, State: "  " }],
    ["no product", { quantity: 1, State: "stored" }],
  ])("skips a position with %s", (_name, fm) => {
    expect(mapper.toPosition(note, fm)).toBeNull();
  });
});

describe("FrontmatterMapper.toPosition with the owner's states", () => {
  const note = { path: "Positions/a.md", basename: "a", createdAt: 1, updatedAt: 2 };
  const resolver = { resolvePath: (target: string) => `Items/${target}.md` };

  it("keeps a state nobody listed, as not counted", () => {
    const mapper = new FrontmatterMapper(resolver);
    const position = mapper.toPosition(note, { Product: "[[Spool]]", quantity: 1, State: "lost" });
    expect(position?.state).toBe("lost");
    expect(position?.isAvailable()).toBe(false);
  });

  it("counts a state the owner marked as counted, and spells it as listed", () => {
    const policy = new StockStatePolicy([...DEFAULT_STOCK_STATES, { name: "On loan", counts: true }]);
    const mapper = new FrontmatterMapper(resolver, () => policy);
    const position = mapper.toPosition(note, { Product: "[[Spool]]", quantity: 2, State: "on loan" });
    expect(position?.state).toBe("On loan");
    expect(position?.isAvailable()).toBe(true);
  });
});
