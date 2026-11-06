export const SORT_MODES = ["created", "updated"] as const;

/** `created`: newest added first. `updated`: most recently changed first. */
export type SortMode = (typeof SORT_MODES)[number];

export const DEFAULT_SORT_MODE: SortMode = "created";

export function parseSortMode(raw: unknown): SortMode {
  return SORT_MODES.find((mode) => mode === raw) ?? DEFAULT_SORT_MODE;
}
