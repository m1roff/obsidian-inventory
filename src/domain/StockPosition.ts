import { DEFAULT_STOCK_STATE_POLICY, StockState } from "./StockState";

/** A change to apply to an existing position; absent fields stay as they are. */
export interface PositionPatch {
  readonly quantity?: number;
  readonly location?: string;
  readonly state?: StockState;
}

export class StockPosition {
  constructor(
    readonly path: string,
    readonly productPath: string,
    readonly quantity: number,
    readonly location: string,
    readonly state: StockState,
    readonly createdAt: number,
    readonly updatedAt: number,
    /** Whether this state counts as in stock; decided by the owner's list when the position is read. */
    private readonly counted: boolean = DEFAULT_STOCK_STATE_POLICY.counts(state),
  ) {}

  isAvailable(): boolean {
    return this.counted;
  }
}
