export type StockErrorCode =
  | "not-available"
  | "location-missing"
  | "quantity-invalid"
  | "nothing-changes";

export class StockError extends Error {
  constructor(readonly code: StockErrorCode) {
    super(code);
    this.name = "StockError";
  }
}
