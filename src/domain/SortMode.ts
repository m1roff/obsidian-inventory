export const SORT_MODES = ["created", "updated"] as const;

/** `created`: newest added first. `updated`: most recently changed first. */
export type SortMode = (typeof SORT_MODES)[number];

export const DEFAULT_SORT_MODE: SortMode = "created";

export function parseSortMode(raw: unknown): SortMode {
  return SORT_MODES.find((mode) => mode === raw) ?? DEFAULT_SORT_MODE;
}

/** A sort and which way it runs: `reversed` flips the natural direction of that sort (newest first, A to Z). */
export interface SortChoice<M> {
  readonly mode: M;
  readonly reversed: boolean;
}

/**
 * What a press on a sort button does: the button that is already chosen flips the direction,
 * another one is chosen and starts in its natural direction.
 */
export function chooseSort<M>(current: SortChoice<M>, picked: M): SortChoice<M> {
  return picked === current.mode ? { mode: picked, reversed: !current.reversed } : { mode: picked, reversed: false };
}
