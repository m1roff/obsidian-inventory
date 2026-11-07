/** How a list of items is drawn: the full rows, or square tiles with just the photo, name and id. */
export type ItemsView = "list" | "tiles";

export const ITEMS_VIEWS: readonly ItemsView[] = ["list", "tiles"];

export const DEFAULT_ITEMS_VIEW: ItemsView = "list";

/** Anything that is not a known view (an old file, a typo) gives the default. */
export function parseItemsView(raw: unknown): ItemsView {
  return ITEMS_VIEWS.find((view) => view === raw) ?? DEFAULT_ITEMS_VIEW;
}
