import { StockError } from "./StockError";

export interface AddStockInput {
  readonly location: string;
  readonly quantity: number;
}

/** A validated request to put more units of an item somewhere (e.g. after buying). */
export class AddStockRequest {
  private constructor(
    readonly location: string,
    readonly quantity: number,
  ) {}

  static create(input: AddStockInput): AddStockRequest {
    if (input.location === "") throw new StockError("location-missing");
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new StockError("quantity-invalid");
    }
    return new AddStockRequest(input.location, input.quantity);
  }
}
