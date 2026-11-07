import { setIcon } from "obsidian";
import { InventoryEntry } from "../domain/InventoryEntry";
import { InventoryRepository } from "../domain/InventoryRepository";
import { InventorySearch } from "../domain/InventorySearch";
import { InventorySorter } from "../domain/InventorySorter";
import { DashboardPreferencesStore, placeItemLimit } from "../domain/DashboardPreferences";
import { entriesInLocation } from "../domain/LocationBoard";
import { Place } from "../domain/Place";
import { PlaceTree } from "../domain/PlaceTree";
import { ItemRow } from "./ItemRow";
import { SearchField } from "./SearchField";
import { STRINGS } from "./strings";

export interface PlaceItemsDeps {
  readonly repository: InventoryRepository;
  /** The locations as a tree, read when the panel is drawn. */
  readonly tree: () => PlaceTree;
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
  /** "Inside: Pantry › Shelf", or hidden at the top level. */
  readonly inside: HTMLElement;
  readonly searchWrap: HTMLElement;
  readonly search: SearchField;
  readonly list: HTMLElement;
  readonly footer: HTMLElement;
  /** The items of this place as of the last read of the vault: typing filters these, it does not read again. */
  pool: InventoryEntry[];
  query: string;
  expanded: boolean;
}

/** What the owner left in a place's panel: kept while Obsidian is open, so coming back finds it as it was. */
interface PanelMemory {
  query: string;
  expanded: boolean;
}

/**
 * The items stored in one place, drawn under the buttons in the place's note with the same
 * rows as the dashboard. The vault is read when the panel is drawn (the note opened or
 * something changed), never while the owner types in the search field. The search field,
 * what was typed and whether the list is open all survive a redraw, and also leaving the note
 * for an item card and coming back: they are remembered per place in memory (a few words each,
 * dropped again once the panel is back to its plain state), with no timers and no file writes.
 */
export class PlaceItemsPanel {
  private readonly memory = new Map<string, PanelMemory>();
  private readonly parts = new WeakMap<HTMLElement, Parts>();
  /** The place each panel shows now, read when its button is pressed (the place may be renamed). */
  private readonly current = new WeakMap<HTMLElement, Place>();

  constructor(private readonly deps: PlaceItemsDeps) {}

  render(host: HTMLElement, place: Place): void {
    this.current.set(host, place);
    const parts = this.partsOf(host, place);
    const tree = this.deps.tree();
    parts.pool = entriesInLocation(this.deps.repository.loadEntries(), place.name, tree);
    // Where this place stands, so the note says where the box is.
    const inside = tree.inside(place.name);
    parts.inside.setText(inside === null ? "" : STRINGS.tileInside(inside));
    parts.inside.toggleClass("inventory-ui__hidden", inside === null);
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

    const inside = host.createDiv({ cls: "inventory-ui__place-inside inventory-ui__hidden" });

    // The field and its tag chips share one wrapper, so a place without items can hide them together.
    const searchWrap = host.createDiv();
    const left = this.memory.get(place.path);
    let parts: Parts | null = null;
    const search = new SearchField(searchWrap, {
      placeholder: STRINGS.placeItemsSearch,
      initial: left?.query ?? "",
      // The tags of the items of this place only: that is what the search narrows here.
      tags: () => (parts?.pool ?? []).flatMap((entry) => entry.item.tags),
      onChange: (query) => {
        if (!parts) return;
        parts.query = query;
        this.draw(parts);
      },
      showHelp: () => this.deps.preferences.get().settings.showSearchHelp,
    });
    const list = host.createDiv({ cls: "inventory-ui__list inventory-ui__place-items-list" });
    const footer = host.createDiv({ cls: "inventory-ui__place-items-footer" });

    const created: Parts = {
      placePath: place.path,
      count,
      inside,
      searchWrap,
      search,
      list,
      footer,
      pool: [],
      query: left?.query ?? "",
      expanded: left?.expanded ?? false,
    };
    parts = created;
    this.parts.set(host, created);
    return created;
  }

  /** Keeps what the owner set for this place, or forgets it when it is the plain state again. */
  private remember(parts: Parts): void {
    if (parts.query === "" && !parts.expanded) this.memory.delete(parts.placePath);
    else this.memory.set(parts.placePath, { query: parts.query, expanded: parts.expanded });
  }

  private draw(parts: Parts): void {
    this.remember(parts);
    parts.search.syncHelp();
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
