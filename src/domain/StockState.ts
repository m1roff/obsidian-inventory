/** A state's name, as written in a position's `State` field. Built-in ones are below; the owner can add more. */
export type StockState = string;

/** The states the plugin itself knows what to do with. They cannot be removed. */
export const BUILT_IN_STATES = ["stored", "installed", "defective", "consumed", "disposed"] as const;

/** States a unit passes through on its way out of stock ("Used up", "Thrown away"). */
export const EXIT_STATES: readonly StockState[] = ["consumed", "disposed"];

/** One state in the owner's list. */
export interface StockStateSetting {
  readonly name: StockState;
  /** Units in this state count as "in stock". */
  readonly counts: boolean;
}

/** Factory list and order: what "reset" goes back to. */
export const DEFAULT_STOCK_STATES: readonly StockStateSetting[] = [
  { name: "stored", counts: true },
  { name: "installed", counts: true },
  { name: "defective", counts: false },
  { name: "consumed", counts: false },
  { name: "disposed", counts: false },
];

export type StockStateErrorCode = "name-empty" | "name-invalid" | "name-taken" | "in-use";

/** How many positions sit in a state right now. */
export interface StateUsageLookup {
  count(state: StockState): number;
}

export class StockStateError extends Error {
  constructor(readonly code: StockStateErrorCode) {
    super(code);
    this.name = "StockStateError";
  }
}

export function isBuiltInState(name: StockState): boolean {
  return (BUILT_IN_STATES as readonly string[]).includes(name);
}

/**
 * The owner's list of states, in their order, and what each means for the stock count.
 * Pure: every change returns a new list.
 */
export class StockStatePolicy {
  private readonly byName: Map<string, StockStateSetting>;

  constructor(readonly states: readonly StockStateSetting[]) {
    this.byName = new Map(states.map((state) => [state.name.toLowerCase(), state]));
  }

  names(): StockState[] {
    return this.states.map((state) => state.name);
  }

  /** A state nobody listed (typed by hand in a note) is not counted. */
  counts(name: StockState): boolean {
    return this.byName.get(name.toLowerCase())?.counts ?? false;
  }

  /** States a unit can sit in while it still exists somewhere, in the owner's order. */
  placeStates(): StockState[] {
    return this.names().filter((name) => !EXIT_STATES.includes(name));
  }

  /** States not counted but still "somewhere" (for example defective): worth showing next to the count. */
  visibleUncounted(): StockState[] {
    return this.placeStates().filter((name) => !this.counts(name));
  }

  /** The list's own spelling of a name typed in a note, or the text as it was. */
  canonical(name: StockState): StockState {
    return this.byName.get(name.toLowerCase())?.name ?? name;
  }

  has(name: StockState): boolean {
    return this.byName.has(name.toLowerCase());
  }

  add(rawName: string, counts: boolean): StockStatePolicy {
    const name = rawName.trim();
    if (name === "") throw new StockStateError("name-empty");
    if (/[\\/:*?"<>|#^[\]\n]/.test(name)) throw new StockStateError("name-invalid");
    if (this.has(name)) throw new StockStateError("name-taken");
    return new StockStatePolicy([...this.states, { name, counts }]);
  }

  /**
   * Built-in states stay; only the owner's own can be removed, and only while no position
   * is in that state (otherwise those positions would hold a state the list does not know).
   */
  remove(name: StockState, usage: StateUsageLookup): StockStatePolicy {
    if (isBuiltInState(name)) return this;
    if (usage.count(name) > 0) throw new StockStateError("in-use");
    return new StockStatePolicy(this.states.filter((state) => state.name !== name));
  }

  setCounts(name: StockState, counts: boolean): StockStatePolicy {
    return new StockStatePolicy(
      this.states.map((state) => (state.name === name ? { ...state, counts } : state)),
    );
  }

  /** Moves a state one place up (-1) or down (+1). */
  shift(name: StockState, direction: -1 | 1): StockStatePolicy {
    const from = this.states.findIndex((state) => state.name === name);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= this.states.length) return this;
    const next = [...this.states];
    [next[from], next[to]] = [next[to], next[from]];
    return new StockStatePolicy(next);
  }
}

export const DEFAULT_STOCK_STATE_POLICY = new StockStatePolicy(DEFAULT_STOCK_STATES);

/**
 * Reads the saved list. The built-in states are always there (a missing one is put back
 * at the end); anything unreadable is skipped.
 */
export function parseStockStates(raw: unknown): StockStateSetting[] {
  const result: StockStateSetting[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const entry of raw as unknown[]) {
      if (typeof entry !== "object" || entry === null) continue;
      const { name, counts } = entry as { name?: unknown; counts?: unknown };
      if (typeof name !== "string" || name.trim() === "") continue;
      const key = name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ name: name.trim(), counts: counts === true });
    }
  }
  for (const builtIn of DEFAULT_STOCK_STATES) {
    // A missing built-in state comes back at the end, in its default order.
    if (!seen.has(builtIn.name)) result.push({ ...builtIn });
  }
  return result.length > 0 ? result : [...DEFAULT_STOCK_STATES];
}

/** Unknown spelling kept as typed; a state is any non-empty text. */
export function parseStockState(raw: unknown, policy: StockStatePolicy = DEFAULT_STOCK_STATE_POLICY): StockState | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text === "" ? null : policy.canonical(text);
}
