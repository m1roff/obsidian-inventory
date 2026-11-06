import { Clock, formatStamp } from "./Clock";
import { InventoryEntry } from "./InventoryEntry";
import { AddStockRequest } from "./AddStockRequest";
import { InventoryWriter } from "./InventoryWriter";
import { MoveRequest } from "./MoveRequest";

/** Changes to existing stock: adding more and moving. */
export class StockService {
  constructor(
    private readonly writer: InventoryWriter,
    private readonly clock: Clock,
  ) {}

  /** Adds units to the stored position in that place, or starts a new one. */
  async addStock(entry: InventoryEntry, request: AddStockRequest): Promise<void> {
    const existing = entry.positionAt(request.location, "stored");
    if (existing) {
      await this.writer.updatePosition(existing.path, {
        quantity: existing.quantity + request.quantity,
      });
      return;
    }
    await this.writer.createPosition({
      itemPath: entry.item.path,
      fileName: `${entry.item.name} - ${formatStamp(this.clock.now())}`,
      quantity: request.quantity,
      location: request.location,
      state: "stored",
    });
  }

  async move(entry: InventoryEntry, request: MoveRequest): Promise<void> {
    const plan = request.plan();
    const { position } = request;

    if (plan.kind === "relocate") {
      await this.writer.updatePosition(position.path, plan.patch);
      return;
    }

    // Create first: if the second step fails, units are duplicated rather than lost.
    await this.writer.createPosition({
      itemPath: entry.item.path,
      fileName: `${entry.item.name} - ${formatStamp(this.clock.now())}`,
      quantity: plan.moved.quantity,
      location: plan.moved.location,
      state: plan.moved.state,
    });
    await this.writer.updatePosition(position.path, {
      quantity: plan.remaining,
    });
  }
}
