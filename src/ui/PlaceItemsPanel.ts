import { setIcon } from "obsidian";
import { InventoryEntry } from "../domain/InventoryEntry";
import { InventoryRepository } from "../domain/InventoryRepository";
import { InventorySearch } from "../domain/InventorySearch";
import { InventorySorter } from "../domain/InventorySorter";
import { DashboardPreferencesStore, placeItemLimit } from "../domain/DashboardPreferences";
import { entriesInLocation } from "../domain/LocationBoard";
import { Place } from "../domain/Place";
import { ItemRow } from "./ItemRow";
import { STRINGS } from "./strings";

export interface PlaceItemsDeps {
  readonly repository: InventoryRepository;
  readonly search: InventorySearch;
  readonly sorter: InventorySorter;
  readonly preferences: DashboardPreferencesStore;
  readonly row: ItemRow;
  /** Starts adding an item that goes to this place. */
  readonly onAdd: (place: Place) => void;
}

/** What one drawn panel holds on to between redraws: its parts and what the owner typed. */
interface Parts {
  readonly placePath: string;
  readonly count: HTMLElement;
  readonly searchWrap: HTMLElement;
  readonly input: HTMLInputElement;
  readonly list: HTMLElement;
  readonly footer: HTMLElement;
  /** The items of this place as of the last read of the vault: typing filters these, it does not read again. */
  pool: InventoryEntry[];
  query: string;
  expanded: boolean;
}

/**
 * The items stored in one place, drawn under the buttons in the place's note with the same
 * rows as the dashboard. The vault is read when the panel is drawn (the note opened or
 * something changed), never while the owner types in the search field. The search field,
 * what was typed and whether the list is open all survive a redraw.
 */
export class PlaceItemsPanel {
  private readonly parts = new WeakMap<HTMLElement, Parts>();
  /** The place each panel shows now, read when its button is pressed (the place may be renamed). */
  private readonly current = new WeakMap<HTMLElement, Place>();

  constructor(private readonly deps: PlaceItemsDeps) {}

  render(host: HTMLElement, place: Place): void {
    this.current.set(host, place);
    const parts = this.partsOf(host, place);
    parts.pool = entriesInLocation(this.deps.repository.loadEntries(), place.name);
    this.draw(parts);
  }

  private partsOf(host: HTMLElement, place: Place): Parts {
    const known = this.parts.get(host);
    if (known && known.placePath === place.path && host.contains(known.list)) return known;

    host.empty();
    const head = host.createDiv({ cls: "inventory-ui__place-items-head" });
    head.createSpan({ text: STRINGS.placeItemsTitle });
    const count = head.createSpan({ cls: "inventory-ui__board-count" });
    const add = head.createEl("button", { cls: "inventory-ui__action inventory-ui__place-items-add" });
    setIcon(add.createSpan(), "plus");
    add.createSpan({ text: STRINGS.addItem });
    add.addEventListener("click", () => {
      const current = this.current.get(host);
      if (current) this.deps.onAdd(current);
    });

    const searchWrap = host.createDiv({ cls: "inventory-ui__search-wrap" });
    const input = searchWrap.createEl("input", {
      cls: "inventory-ui__search",
      attr: { type: "search", placeholder: STRINGS.placeItemsSearch, "aria-label": STRINGS.placeItemsSearch },
    });
    const list = host.createDiv({ cls: "inventory-ui__list inventory-ui__place-items-list" });
    const footer = host.createDiv({ cls: "inventory-ui__place-items-footer" });

    const parts: Parts = { placePath: place.path, count, searchWrap, input, list, footer, pool: [], query: "", expanded: false };
    input.addEventListener("input", () => {
      parts.query = input.value;
      this.draw(parts);
    });
    this.parts.set(host, parts);
    return parts;
  }

  private draw(parts: Parts): void {
    const { settings, itemsSort, itemsSortReversed } = this.deps.preferences.get();
    const found = this.deps.search.filter(parts.pool, parts.query);
    const sorted = this.deps.sorter.sort(found, itemsSort, itemsSortReversed);

    parts.count.setText(String(parts.pool.length));
    // Nothing here: no point in a search field.
    parts.searchWrap.toggleClass("inventory-ui__hidden", parts.pool.length === 0);

    parts.list.empty();
    if (parts.pool.length === 0) {
      parts.list.createDiv({ cls: "inventory-ui__empty", text: STRINGS.placeItemsEmpty });
    } else if (sorted.length === 0) {
      parts.list.createDiv({ cls: "inventory-ui__empty", text: STRINGS.placeItemsNoMatch });
    }

    const limit = placeItemLimit(settings.placeItemsShown);
    const shown = parts.expanded ? sorted : sorted.slice(0, limit);
    for (const entry of shown) this.deps.row.render(parts.list, entry);

    parts.footer.empty();
    if (sorted.length > limit) {
      const toggle = parts.footer.createEl("button", {
        cls: "inventory-ui__action",
        text: parts.expanded ? STRINGS.itemsCollapse : STRINGS.itemsShowAll(sorted.length),
      });
      toggle.addEventListener("click", () => {
        parts.expanded = !parts.expanded;
        this.draw(parts);
      });
    }
  }
}
