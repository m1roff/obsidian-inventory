/** How a list of items is drawn: the full rows, or square tiles with just the photo, name and id. */
export type ItemsView = "list" | "tiles";

export const ITEMS_VIEWS: readonly ItemsView[] = ["list", "tiles"];

export const DEFAULT_ITEMS_VIEW: ItemsView = "list";

/** Anything that is not a known view (an old file, a typo) gives the default. */
export function parseItemsView(raw: unknown): ItemsView {
  return ITEMS_VIEWS.find((view) => view === raw) ?? DEFAULT_ITEMS_VIEW;
}

/**
 * How many tiles to show first so the last row is full: `count` rounded up to whole rows.
 * The rest of the list starts on a new row, so a short last row would leave a gap before it.
 */
export function wholeRows(count: number, columns: number): number {
  if (columns <= 1) return count;
  return Math.ceil(count / columns) * columns;
}
