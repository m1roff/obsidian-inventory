import { describe, expect, it } from "vitest";
import { AddStockRequest } from "../../src/domain/AddStockRequest";
import { InventoryEntry } from "../../src/domain/InventoryEntry";
import { InventoryWriter, NewItemRecord, NewPositionRecord } from "../../src/domain/InventoryWriter";
import { Item } from "../../src/domain/Item";
import { MoveRequest } from "../../src/domain/MoveRequest";
import { StockError, StockErrorCode } from "../../src/domain/StockError";
import { PositionPatch, StockPosition } from "../../src/domain/StockPosition";
import { StockService } from "../../src/domain/StockService";
import { StockState } from "../../src/domain/StockState";

class FakeWriter implements InventoryWriter {
  calls: string[] = [];
  created: NewPositionRecord[] = [];
  updated: { path: string; patch: PositionPatch }[] = [];
  async createItem(_item: NewItemRecord): Promise<string> {
    return "";
  }
  async createPosition(position: NewPositionRecord): Promise<void> {
    this.calls.push("create");
    this.created.push(position);
  }
  async updatePosition(path: string, patch: PositionPatch): Promise<void> {
    this.calls.push("update");
    this.updated.push({ path, patch });
  }
}

const item = new Item("Inventory_Items/Spool.md", "Spool", "AB-CD-123", "Plastic", "", [], null, 0, 0);
const position = (quantity: number, location = "Shelf", state: StockState = "stored") =>
  new StockPosition("Inventory_Positions/p.md", item.path, quantity, location, state, 0, 0);
const clock = { now: () => new Date(2026, 7, 26, 21, 46, 54) };

function codeOf(fn: () => unknown): StockErrorCode {
  try {
    fn();
  } catch (error) {
    return (error as StockError).code;
  }
  throw new Error("expected a StockError");
}

describe("AddStockRequest", () => {
  it.each([
    ["location-missing", { location: "", quantity: 1 }],
    ["quantity-invalid", { location: "Shelf", quantity: 0 }],
    ["quantity-invalid", { location: "Shelf", quantity: 1.5 }],
    ["quantity-invalid", { location: "Shelf", quantity: Number.NaN }],
  ])("rejects with %s", (code, input) => {
    expect(codeOf(() => AddStockRequest.create(input))).toBe(code);
  });
});

describe("MoveRequest", () => {
  it.each([
    ["location-missing", { location: "", quantity: 1, state: "stored" as StockState }],
    ["quantity-invalid", { location: "Printer", quantity: 0, state: "stored" as StockState }],
    ["quantity-invalid", { location: "Printer", quantity: 3, state: "stored" as StockState }],
    ["quantity-invalid", { location: "Printer", quantity: 1.5, state: "stored" as StockState }],
    ["nothing-changes", { location: "Shelf", quantity: 1, state: "stored" as StockState }],
  ])("rejects with %s", (code, input) => {
    expect(codeOf(() => MoveRequest.create(position(2), input))).toBe(code);
  });

  it("allows the same location with another state (e.g. installing in place)", () => {
    const request = MoveRequest.create(position(1), { location: "Shelf", quantity: 1, state: "installed" });
    expect(request.plan()).toEqual({ kind: "relocate", patch: { location: "Shelf", state: "installed" } });
  });

  it("relocates the whole position when everything moves", () => {
    const request = MoveRequest.create(position(2), { location: "Printer", quantity: 2, state: "installed" });
    expect(request.plan()).toEqual({ kind: "relocate", patch: { location: "Printer", state: "installed" } });
  });

  it("moving part to 'used up' leaves the rest and records the units as consumed in the same place", () => {
    const request = MoveRequest.create(position(3), { location: "Shelf", quantity: 1, state: "consumed" });
    expect(request.plan()).toEqual({
      kind: "split",
      remaining: 2,
      moved: { quantity: 1, location: "Shelf", state: "consumed" },
    });
  });

  it("moving everything to 'thrown away' just changes the state", () => {
    const request = MoveRequest.create(position(2), { location: "Shelf", quantity: 2, state: "disposed" });
    expect(request.plan()).toEqual({ kind: "relocate", patch: { location: "Shelf", state: "disposed" } });
  });

  it("splits when only part moves", () => {
    const request = MoveRequest.create(position(3), { location: "Printer", quantity: 1, state: "installed" });
    expect(request.plan()).toEqual({
      kind: "split",
      remaining: 2,
      moved: { quantity: 1, location: "Printer", state: "installed" },
    });
  });
});

describe("StockService", () => {
  it("adds to the stored position in that place instead of making a duplicate", async () => {
    const writer = new FakeWriter();
    const entry = new InventoryEntry(item, [position(2, "Shelf", "stored"), position(1, "Printer", "installed")]);

    await new StockService(writer, clock).addStock(entry, AddStockRequest.create({ location: "Shelf", quantity: 3 }));

    expect(writer.created).toEqual([]);
    expect(writer.updated).toEqual([{ path: "Inventory_Positions/p.md", patch: { quantity: 5 } }]);
  });

  it("creates a stored position when there is none in that place", async () => {
    const writer = new FakeWriter();
    // the installed one in the printer must not absorb new stored units
    const entry = new InventoryEntry(item, [position(1, "Printer", "installed")]);

    await new StockService(writer, clock).addStock(entry, AddStockRequest.create({ location: "Printer", quantity: 2 }));

    expect(writer.updated).toEqual([]);
    expect(writer.created).toEqual([
      { itemPath: item.path, fileName: "Spool - 20260826-214654", quantity: 2, location: "Printer", state: "stored" },
    ]);
  });

  it("can restock an item that has no positions at all", async () => {
    const writer = new FakeWriter();
    await new StockService(writer, clock).addStock(
      new InventoryEntry(item, []),
      AddStockRequest.create({ location: "Shelf", quantity: 1 }),
    );
    expect(writer.created).toHaveLength(1);
  });

  it("relocates without creating anything", async () => {
    const writer = new FakeWriter();
    const entry = new InventoryEntry(item, [position(1)]);
    const request = MoveRequest.create(position(1), { location: "Printer", quantity: 1, state: "installed" });

    await new StockService(writer, clock).move(entry, request);

    expect(writer.created).toEqual([]);
    expect(writer.updated).toEqual([
      { path: "Inventory_Positions/p.md", patch: { location: "Printer", state: "installed" } },
    ]);
  });

  it("creates the new position before reducing the source on a split", async () => {
    const writer = new FakeWriter();
    const entry = new InventoryEntry(item, [position(3)]);
    const request = MoveRequest.create(position(3), { location: "Printer", quantity: 1, state: "installed" });

    await new StockService(writer, clock).move(entry, request);

    expect(writer.calls).toEqual(["create", "update"]);
    expect(writer.created).toEqual([
      {
        itemPath: item.path,
        fileName: "Spool - 20260826-214654",
        quantity: 1,
        location: "Printer",
        state: "installed",
      },
    ]);
    expect(writer.updated).toEqual([{ path: "Inventory_Positions/p.md", patch: { quantity: 2 } }]);
  });
});
