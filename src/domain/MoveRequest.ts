import { PositionPatch, StockPosition } from "./StockPosition";
import { StockError } from "./StockError";
import { StockState } from "./StockState";

export interface MoveInput {
  readonly location: string;
  readonly quantity: number;
  readonly state: StockState;
}

export interface MovedPart {
  readonly quantity: number;
  readonly location: string;
  readonly state: StockState;
}

export type MovePlan =
  | { readonly kind: "relocate"; readonly patch: PositionPatch }
  | {
      readonly kind: "split";
      readonly remaining: number;
      readonly moved: MovedPart;
    };

/** A validated request to move some units of a position elsewhere. */
export class MoveRequest {
  private constructor(
    readonly position: StockPosition,
    private readonly input: MoveInput,
  ) {}

  static create(position: StockPosition, input: MoveInput): MoveRequest {
    if (!position.isAvailable()) throw new StockError("not-available");
    if (input.location === "") throw new StockError("location-missing");
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > position.quantity
    ) {
      throw new StockError("quantity-invalid");
    }
    if (input.location === position.location && input.state === position.state) {
      throw new StockError("nothing-changes");
    }
    return new MoveRequest(position, input);
  }

  /**
   * Moving everything relocates the position itself. Moving a part reduces the
   * source and puts the moved units into a new position. Nothing is merged or
   * deleted, so no note ever disappears.
   */
  plan(): MovePlan {
    const { location, quantity, state } = this.input;
    if (quantity === this.position.quantity) {
      return { kind: "relocate", patch: { location, state } };
    }
    return {
      kind: "split",
      remaining: this.position.quantity - quantity,
      moved: { quantity, location, state },
    };
  }
}
