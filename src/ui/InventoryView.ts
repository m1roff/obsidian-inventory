import {
  ItemView,
  Notice,
  setIcon,
  TFile,
  ViewStateResult,
  WorkspaceLeaf,
} from "obsidian";
import { AddItemService } from "../domain/AddItemService";
import { AddReferenceError, AddReferenceService } from "../domain/AddReferenceService";
import { DefaultLocation } from "../domain/DefaultLocation";
import { InventoryEntry } from "../domain/InventoryEntry";
import { InventoryRepository } from "../domain/InventoryRepository";
import { InventorySearch } from "../domain/InventorySearch";
import {
  entriesInLocation,
  LocationBoard,
  LocationPreferencesStore,
  withSelectedFirst,
} from "../domain/LocationBoard";
import {
  DashboardPreferencesStore,
  visibleWhenFolded,
} from "../domain/DashboardPreferences";
import { InventorySorter } from "../domain/InventorySorter";
import { findPlaceById, parseScanned } from "../domain/ItemLink";
import { QrDecoder } from "../domain/QrCode";
import { ReferenceLists } from "../domain/ReferenceLists";
import { SimilarItemFinder } from "../domain/SimilarItemFinder";
import { chooseSort, SortMode } from "../domain/SortMode";
import {
  AddItemDefaults,
  AddItemFormState,
  AddItemModal,
  parseFormState,
} from "./AddItemModal";
import { ItemActions } from "./ItemActions";
import type { SettingsTab } from "./InventorySettingTab";
import { LocationBoardPanel } from "./LocationBoardPanel";
import { promptForName } from "./NamePrompt";
import { PlaceQr } from "./PlaceQr";
import { scanQrFromPhoto } from "./QrScanner";
import { INVENTORY_ICON_ID } from "./InventoryIcon";
import { Haptics } from "./Haptics";
import { PhotoAttacher } from "./PhotoAttacher";
import { SetupPanel } from "./SetupPanel";
import { StockStatePolicy } from "../domain/StockState";
import { SetupService } from "../domain/structure/SetupService";
import { STRINGS } from "./strings";

export const INVENTORY_VIEW_TYPE = "inventory-ui-view";

/** The "#" list under the search field shows at most this many tags. */
const MAX_TAG_SUGGESTIONS = 8;
const REFRESH_DELAY_MS = 300;

export interface InventoryViewDeps {
  readonly repository: InventoryRepository;
  readonly search: InventorySearch;
  readonly sorter: InventorySorter;
  readonly references: ReferenceLists;
  readonly addItem: AddItemService;
  readonly similar: SimilarItemFinder;
  readonly actions: ItemActions;
  readonly addReference: AddReferenceService;
  /** The location a new item goes to by default (and its upkeep). */
  readonly defaultLocation: DefaultLocation;
  /** Photo of a location: picked from the tile's menu. */
  readonly placePhotos: PhotoAttacher;
  readonly haptics: Haptics;
  readonly locationBoard: LocationBoard;
  readonly preferences: DashboardPreferencesStore;
  readonly qrDecoder: QrDecoder;
  readonly placeQr: PlaceQr;
  /** Opens the plugin settings on the given tab. */
  readonly openSettings: (tab: SettingsTab) => void;
  readonly setup: SetupService;
  readonly states: () => StockStatePolicy;
  /** Called when the dashboard goes away, with what it was showing. */
  readonly rememberFilter: (filter: { query: string; location: string | null }) => void;
}

export class InventoryView extends ItemView {
  private query = "";
  /** Show only what is in stock in this location (set by tapping its tile). */
  private locationFilter: string | null = null;
  private board: LocationBoardPanel | null = null;
  private itemsIconEl: HTMLElement | null = null;
  private itemsCountEl: HTMLElement | null = null;
  private sortButtons = new Map<SortMode, HTMLElement>();
  private searchEl: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;
  private tagSuggestEl: HTMLElement | null = null;
  private searchClearEl: HTMLElement | null = null;
  /** Tags seen on the items at the last redraw: what "#" offers while typing. */
  private knownTags: string[] = [];
  private refreshTimer: number | null = null;
  private setupEl: HTMLElement | null = null;
  private inSetup = false;
  /** Something changed while the dashboard was not on screen: redraw when it comes back. */
  private staleWhileHidden = false;
  private addDraft: AddItemFormState | null = null;
  private lastUsed: AddItemDefaults = { kind: "", location: "" };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: InventoryViewDeps,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return INVENTORY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return STRINGS.viewTitle;
  }

  getIcon(): string {
    return INVENTORY_ICON_ID;
  }

  getState(): Record<string, unknown> {
    return {
      query: this.query,
      location: this.locationFilter,
      addDraft: this.addDraft,
    };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const saved = state as {
      query?: unknown;
      location?: unknown;
      addDraft?: unknown;
    } | null;
    this.query = typeof saved?.query === "string" ? saved.query : "";
    this.locationFilter =
      typeof saved?.location === "string" ? saved.location : null;
    // Coming back from a card opened out of the add form: bring the form back.
    const draft = parseFormState(saved?.addDraft);
    if (draft) {
      window.setTimeout(() => this.openAddModal(draft), 0);
    }
    if (this.searchEl) this.searchEl.value = this.query;
    this.renderList();
    await super.setState(state, result);
  }

  onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("inventory-ui");

    const toolbar = root.createDiv({ cls: "inventory-ui__toolbar" });
    const searchWrap = toolbar.createDiv({ cls: "inventory-ui__search-wrap" });
    this.searchEl = searchWrap.createEl("input", {
      cls: "inventory-ui__search",
      type: "search",
      placeholder: STRINGS.searchPlaceholder,
    });
    this.searchEl.value = this.query;
    const clearButton = searchWrap.createEl("button", {
      cls: "inventory-ui__search-clear",
      attr: { "aria-label": STRINGS.searchClear },
    });
    setIcon(clearButton, "x");
    this.searchClearEl = clearButton;
    const syncClear = (): void => this.syncSearchClear();
    syncClear();
    this.searchEl.addEventListener("input", () => {
      this.query = this.searchEl?.value ?? "";
      syncClear();
      this.renderList();
      this.updateTagSuggestions();
    });
    // Keeps the focus in the field, so the keyboard stays up for a new search.
    clearButton.addEventListener("mousedown", (event) => event.preventDefault());
    clearButton.addEventListener("click", () => {
      if (!this.searchEl) return;
      this.searchEl.value = "";
      this.query = "";
      syncClear();
      this.renderList();
      this.updateTagSuggestions();
      this.searchEl.focus();
    });
    this.searchEl.addEventListener("blur", () => {
      // A little later, so a tap on a suggestion still lands.
      window.setTimeout(() => this.tagSuggestEl?.hide(), 150);
    });

    const scanButton = toolbar.createEl("button", {
      cls: "inventory-ui__add",
      attr: { "aria-label": STRINGS.qrScan },
    });
    setIcon(scanButton, "scan");
    scanButton.addEventListener("click", () => {
      void this.scanQr();
    });

    const addButton = toolbar.createEl("button", {
      cls: "inventory-ui__add mod-cta",
      attr: { "aria-label": STRINGS.addItem },
    });
    setIcon(addButton, "plus");
    addButton.addEventListener("click", () => this.openAddModal());

    this.tagSuggestEl = root.createDiv({ cls: "inventory-ui__tag-suggest" });
    this.tagSuggestEl.hide();

    // Only the search row stays put; the sort switch scrolls away with the list.
    const scroll = root.createDiv({ cls: "inventory-ui__scroll" });
    this.scrollEl = scroll;
    this.board = new LocationBoardPanel(
      scroll.createDiv({ cls: "inventory-ui__board" }),
      {
        app: this.app,
        preferences: this.locationPreferences(),
        onSelect: (location) => this.showLocation(location),
        onOpen: (tile) => {
          void this.openCard(tile.path);
        },
        onAddLocation: () => this.addLocation(),
        onOpenSettings: () => this.deps.openSettings("locations"),
        onQr: (tile) => {
          void this.deps.placeQr.open(tile);
        },
        photos: this.deps.placePhotos,
        haptics: this.deps.haptics,
        coverUrl: (path) => this.coverUrl(path),
        showCovers: () => this.deps.preferences.get().settings.showPlaceCovers,
        foldedCount: () => this.deps.preferences.get().settings.foldedLocationCount,
        onPreferencesChanged: () => this.renderList(),
      },
    );
    this.renderItemsHeader(scroll.createDiv({ cls: "inventory-ui__info" }));
    this.listEl = scroll.createDiv({ cls: "inventory-ui__list" });
    // A real element, not padding: padding at the end of a scroll area is not
    // reliably counted on iOS, and the last row ended up under the navigation bar.
    scroll.createDiv({ cls: "inventory-ui__bottom-spacer" });

    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.scheduleRefresh()),
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.scheduleRefresh()),
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.scheduleRefresh()),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        if (!this.staleWhileHidden || !this.contentEl.isShown()) return;
        this.staleWhileHidden = false;
        this.syncSetup();
        this.renderList();
      }),
    );

    this.setupEl = root.createDiv({ cls: "inventory-ui__setup" });
    this.setupEl.hide();
    this.syncSetup();

    this.renderList();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.deps.rememberFilter({ query: this.query, location: this.locationFilter });
    return Promise.resolve();
  }

  /**
   * Until the structure exists the dashboard shows the setup steps instead of itself.
   * One folder lookup, so it is safe to call on every refresh.
   */
  private syncSetup(): void {
    const needed = !this.deps.setup.isInitialized();
    if (needed === this.inSetup) return;
    this.inSetup = needed;
    this.contentEl.toggleClass("is-setup", needed);
    if (!this.setupEl) return;
    if (!needed) {
      this.setupEl.hide();
      this.setupEl.empty();
      this.renderList();
      return;
    }
    this.setupEl.show();
    void new SetupPanel(this.setupEl, this.deps.setup, () => {
      // A fresh vault starts with its default location.
      void this.deps.defaultLocation
        .ensure()
        .catch((error: unknown) => console.error(error))
        .then(() => this.syncSetup());
    }).render();
  }

  /** The board only knows about the location part of the preferences. */
  private locationPreferences(): LocationPreferencesStore {
    const store = this.deps.preferences;
    return {
      get: () => store.get().locations,
      set: (next) => store.set({ ...store.get(), locations: next }),
    };
  }

  /**
   * "Items N" folds the list away, like the locations block. The sort switch is
   * on the same row, so it stays visible when the list is folded.
   */
  private renderItemsHeader(parent: HTMLElement): void {
    const lead = parent.createDiv({ cls: "inventory-ui__board-head" });
    const toggle = lead.createEl("button", {
      cls: "inventory-ui__board-toggle",
    });
    this.itemsIconEl = toggle.createSpan();
    toggle.createSpan({ text: STRINGS.itemsTitle });
    this.itemsCountEl = toggle.createSpan({ cls: "inventory-ui__board-count" });
    toggle.addEventListener("click", () => {
      this.setItemsExpanded(!this.deps.preferences.get().itemsExpanded);
    });

    // The settings of items (label export), one tap away.
    const settings = lead.createEl("button", {
      cls: "inventory-ui__board-settings",
      attr: { "aria-label": STRINGS.itemsSettings },
    });
    setIcon(settings, "settings");
    settings.addEventListener("click", () => this.deps.openSettings("items"));

    this.renderSortSwitch(parent);
  }

  /**
   * While the word being typed starts with "#", offers the tags that fit it. Runs on typing
   * only, and reads the tags already known from the last redraw plus the tags list.
   */
  private updateTagSuggestions(): void {
    const box = this.tagSuggestEl;
    if (!box) return;
    box.empty();

    const typed = this.searchEl?.value ?? "";
    const token = typed.split(/\s+/).pop() ?? "";
    if (!token.startsWith("#")) {
      box.hide();
      return;
    }

    const prefix = token.slice(1).toLowerCase();
    const used = new Set(
      typed
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.startsWith("#"))
        .map((word) => word.slice(1)),
    );
    const all = new Map<string, string>();
    for (const tag of [...this.knownTags, ...this.deps.references.tags()]) {
      if (!all.has(tag.toLowerCase())) all.set(tag.toLowerCase(), tag);
    }
    const matches = [...all.values()]
      .filter((tag) => tag.toLowerCase().startsWith(prefix) && !used.has(tag.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_TAG_SUGGESTIONS);

    if (matches.length === 0) {
      box.hide();
      return;
    }
    for (const tag of matches) {
      const chip = box.createEl("button", { cls: "inventory-ui__chip", text: `#${tag}` });
      // Keep the focus in the search field, so the keyboard stays up.
      chip.addEventListener("pointerdown", (event) => event.preventDefault());
      chip.addEventListener("click", () => this.pickTag(tag));
    }
    box.show();
  }

  private pickTag(tag: string): void {
    const input = this.searchEl;
    if (!input) return;
    const words = input.value.split(/\s+/);
    words[words.length - 1] = `#${tag}`;
    input.value = `${words.join(" ")} `;
    this.query = input.value;
    this.renderList();
    this.updateTagSuggestions();
    input.focus();
  }

  private setItemsExpanded(expanded: boolean): void {
    const current = this.deps.preferences.get();
    this.deps.preferences.set({ ...current, itemsExpanded: expanded });
    this.renderList();
  }

  private scrollToTop(smooth: boolean): void {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.scrollEl?.scrollTo({ top: 0, behavior: smooth && !reduced ? "smooth" : "auto" });
  }

  /**
   * Folded, the last line of the list ("Show all N items"). Open, it stays at the bottom
   * edge of the screen once the owner has scrolled past the first screen, so the way
   * back is under the thumb: no scrolling up through hundreds of rows. Pure CSS
   * (sticky), so it costs nothing while scrolling.
   */
  private renderListFooter(parent: HTMLElement, total: number, expanded: boolean): void {
    const bar = parent.createDiv({
      cls: `inventory-ui__list-footer ${expanded ? "is-sticky" : ""}`,
    });
    const group = bar.createDiv({ cls: "inventory-ui__list-footer-group" });

    const button = (label: string, icon: string, cls: string, onClick: () => void): void => {
      const el = group.createEl("button", { cls: `inventory-ui__footer-button ${cls}` });
      setIcon(el.createSpan(), icon);
      el.createSpan({ text: label });
      el.addEventListener("click", onClick);
    };

    if (!expanded) {
      button(STRINGS.itemsShowAll(total), "chevrons-down", "mod-cta", () =>
        this.setItemsExpanded(true),
      );
      return;
    }
    button(STRINGS.itemsCollapse, "chevrons-up", "", () => {
      this.setItemsExpanded(false);
      this.scrollToTop(false);
    });
    button(STRINGS.backToTop, "arrow-up", "", () => this.scrollToTop(true));
  }

  /** Two-way switch: newest added first, or most recently updated first. */
  private renderSortSwitch(parent: HTMLElement): void {
    const group = parent.createDiv({
      cls: "inventory-ui__sort",
      attr: { role: "group", "aria-label": STRINGS.sortLabel },
    });
    group.createSpan({ cls: "inventory-ui__sort-label", text: STRINGS.sortLabel });

    const options: [SortMode, string, string][] = [
      ["created", STRINGS.sortCreated, STRINGS.sortCreatedHint],
      ["updated", STRINGS.sortUpdated, STRINGS.sortUpdatedHint],
    ];
    this.sortButtons.clear();
    for (const [mode, label, hint] of options) {
      const button = group.createEl("button", {
        cls: "inventory-ui__sort-button",
        attr: { "aria-label": hint },
      });
      button.createSpan({ text: label });
      button.createSpan({ cls: "inventory-ui__sort-arrow" });
      button.addEventListener("click", () => {
        const prefs = this.deps.preferences.get();
        const next = chooseSort({ mode: prefs.itemsSort, reversed: prefs.itemsSortReversed }, mode);
        this.deps.preferences.set({
          ...prefs,
          itemsSort: next.mode,
          itemsSortReversed: next.reversed,
        });
        this.updateSortButtons();
        this.renderList();
      });
      this.sortButtons.set(mode, button);
    }
    this.updateSortButtons();
  }

  private updateSortButtons(): void {
    const { itemsSort, itemsSortReversed } = this.deps.preferences.get();
    for (const [mode, button] of this.sortButtons) {
      const active = mode === itemsSort;
      button.toggleClass("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      // The chosen button shows which way it runs; pressing it again flips the direction.
      const arrow = button.querySelector<HTMLElement>(".inventory-ui__sort-arrow");
      if (arrow) {
        arrow.empty();
        if (active) setIcon(arrow, itemsSortReversed ? "arrow-up" : "arrow-down");
      }
    }
  }

  /** Draws everything again, e.g. after the settings or a reset changed. */
  refresh(): void {
    this.syncSetup();
    this.updateSortButtons();
    this.renderList();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      // A dashboard in a background tab is not drawn: a sync can fire dozens of changes
      // and each redraw reads the whole vault. It catches up when it is shown again.
      if (!this.contentEl.isShown()) {
        this.staleWhileHidden = true;
        return;
      }
      this.syncSetup();
      this.renderList();
    }, REFRESH_DELAY_MS);
  }

  /** The "x" in the search field shows only while there is something to clear. */
  private syncSearchClear(): void {
    this.searchClearEl?.toggleClass("is-visible", (this.searchEl?.value ?? "") !== "");
  }

  private renderList(): void {
    this.syncSearchClear();
    if (!this.listEl || this.inSetup) return;

    const all = this.deps.repository.loadEntries();
    this.knownTags = [...new Set(all.flatMap((entry) => entry.item.tags))];

    const tiles = this.deps.locationBoard.tiles(
      this.deps.references.places(),
      all,
      this.deps.preferences.get().locations,
    );
    // A filter on a location that is gone (renamed, deleted) would show nothing.
    if (this.locationFilter && !tiles.some((t) => t.name === this.locationFilter)) {
      this.locationFilter = null;
    }
    this.board?.render(withSelectedFirst(tiles, this.locationFilter), this.locationFilter);

    const pool = this.locationFilter
      ? entriesInLocation(all, this.locationFilter)
      : all;
    const shown = this.deps.sorter.sort(
      this.deps.search.filter(pool, this.query),
      this.deps.preferences.get().itemsSort,
      this.deps.preferences.get().itemsSortReversed,
    );

    const { itemsExpanded: expanded, settings } = this.deps.preferences.get();
    this.itemsCountEl?.setText(String(shown.length));
    if (this.itemsIconEl) {
      setIcon(this.itemsIconEl, expanded ? "chevron-down" : "chevron-right");
      this.itemsIconEl.parentElement?.setAttribute("aria-expanded", String(expanded));
      this.itemsIconEl.parentElement?.setAttribute(
        "aria-label",
        expanded ? STRINGS.itemsCollapse : STRINGS.itemsExpand,
      );
    }

    this.listEl.empty();

    if (shown.length === 0) {
      if (all.length === 0) this.renderEmptyInventory(this.listEl);
      else this.listEl.createDiv({ cls: "inventory-ui__empty", text: STRINGS.empty });
      return;
    }
    const firstScreen = settings.foldedItemCount;
    const visible = visibleWhenFolded(shown, expanded, firstScreen);
    for (const entry of visible.slice(0, firstScreen)) this.renderRow(this.listEl, entry);

    if (shown.length <= firstScreen) return;
    if (!expanded) {
      // Folded: the button is simply the last line, so the home screen stays calm.
      this.renderListFooter(this.listEl, shown.length, false);
      return;
    }
    // Open: the rest of the rows and the bar live in one block that starts after the first
    // screen. A sticky bar cannot rise above its block, so it only shows once the owner has
    // scrolled past the first screen, and never covers the top of the list.
    const rest = this.listEl.createDiv({ cls: "inventory-ui__list-rest" });
    for (const entry of visible.slice(firstScreen)) this.renderRow(rest, entry);
    this.renderListFooter(rest, shown.length, true);
  }

  /** Nothing in the inventory at all: a hint and the way to the first item. */
  private renderEmptyInventory(parent: HTMLElement): void {
    const box = parent.createDiv({ cls: "inventory-ui__empty inventory-ui__empty-inventory" });
    box.createDiv({ text: STRINGS.emptyInventory });
    const add = box.createEl("button", { cls: "inventory-ui__board-empty-add mod-cta" });
    setIcon(add.createSpan(), "plus");
    add.createSpan({ text: STRINGS.addItem });
    add.addEventListener("click", () => this.openAddModal());
  }

  private addLocation(): void {
    promptForName(this.app, STRINGS.newLocation, (typed) => {
      this.deps.addReference.add("location", typed).then(
        () => this.refresh(),
        (error: unknown) => {
          if (error instanceof AddReferenceError) {
            new Notice(STRINGS.referenceErrors[error.code]);
            return;
          }
          console.error(error);
          new Notice(STRINGS.unexpectedError);
        },
      );
    });
  }

  private renderRow(parent: HTMLElement, entry: InventoryEntry): void {
    const { item } = entry;
    const quantity = entry.availableQuantity();

    const row = parent.createDiv({ cls: "inventory-ui__row" });
    const top = row.createDiv({ cls: "inventory-ui__row-top" });

    this.renderCover(top, entry);

    const main = top.createEl("button", {
      cls: "inventory-ui__row-main",
      attr: { "aria-label": `${STRINGS.openCard}: ${item.name}` },
    });
    main.addEventListener("click", () => {
      void this.openCard(item.path);
    });

    const text = main.createDiv({ cls: "inventory-ui__text" });
    text.createDiv({ cls: "inventory-ui__name", text: item.name });

    const meta = text.createDiv({ cls: "inventory-ui__meta" });
    if (item.id) meta.createSpan({ cls: "inventory-ui__id", text: item.id });
    if (item.kind) meta.createSpan({ text: item.kind });
    if (item.tags.length > 0) {
      meta.createSpan({
        cls: "inventory-ui__tags",
        text: item.tags.map((tag) => `#${tag}`).join(" "),
      });
    }

    const places = entry
      .places()
      .map((place) => `${place.location} × ${place.quantity}`)
      .join(", ");
    text.createDiv({
      cls: "inventory-ui__places",
      text: places || STRINGS.outOfStock,
    });
    // Units that are somewhere but not counted (defective, ...): next to the number, not forgotten.
    const uncounted = entry.uncountedByState(this.deps.states());
    if (uncounted.length > 0) {
      text.createDiv({
        cls: "inventory-ui__uncounted",
        text: STRINGS.uncounted(
          uncounted.map((u) => `${u.quantity} ${STRINGS.stateLabel(u.state).toLowerCase()}`).join(", "),
        ),
      });
    }

    main.createDiv({
      cls:
        quantity > 0
          ? "inventory-ui__qty"
          : "inventory-ui__qty inventory-ui__qty--zero",
      text: String(quantity),
    });

    const actionsEl = row.createDiv({ cls: "inventory-ui__actions" });
    for (const action of this.deps.actions.all()) {
      const button = actionsEl.createEl("button", {
        cls: "inventory-ui__action",
        text: action.label,
      });
      button.disabled = !action.isEnabled(entry);
      button.addEventListener("click", () => {
        void action.run(entry);
      });
    }
  }

  /** The photo, or a tap target that adds one. */
  private renderCover(parent: HTMLElement, entry: InventoryEntry): void {
    const { item } = entry;
    const coverUrl = this.coverUrl(item.coverPath);
    const cover = parent.createEl("button", {
      cls: "inventory-ui__cover",
      attr: {
        "aria-label": coverUrl
          ? `${STRINGS.openCard}: ${item.name}`
          : `${STRINGS.addPhoto}: ${item.name}`,
      },
    });

    if (coverUrl) {
      cover.createEl("img", { attr: { src: coverUrl, alt: "" } });
      cover.addEventListener("click", () => {
        void this.openCard(item.path);
      });
      return;
    }

    cover.addClass("inventory-ui__cover--empty");
    setIcon(cover, "camera");
    cover.addEventListener("click", () => {
      void this.deps.actions.addPhoto(entry, (busy) => {
        if (busy) {
          cover.addClass("inventory-ui__cover--busy");
          setIcon(cover, "loader");
        } else {
          this.scheduleRefresh();
        }
      });
    });
  }

  /**
   * Photo of a label. An item label puts its id into the search; a place
   * label filters the list by that place. Nothing is saved.
   */
  private async scanQr(): Promise<void> {
    const scanned = await scanQrFromPhoto(this.deps.qrDecoder);
    const code = scanned === null ? null : parseScanned(scanned);
    if (code === null) {
      new Notice(STRINGS.qrNotFound);
      return;
    }

    if (code.kind === "item") {
      this.setQuery(code.id);
      return;
    }
    const place = findPlaceById(this.deps.references.places(), code.id);
    if (!place) {
      new Notice(STRINGS.qrNoPlace(code.id));
      return;
    }
    this.showLocation(place.name);
  }

  /** Shows only what is in stock in this place (null: everything), with a clean search. */
  showLocation(location: string | null): void {
    this.locationFilter = location;
    if (location !== null) this.setQuery("");
    else this.renderList();
  }

  /** Shows what a search finds, over the whole inventory (no place filter). */
  showSearch(query: string): void {
    this.locationFilter = null;
    this.setQuery(query);
  }

  private setQuery(query: string): void {
    this.query = query;
    if (this.searchEl) this.searchEl.value = query;
    this.renderList();
  }

  private openAddModal(initial?: AddItemFormState): void {
    // A default location always exists: make sure of it before the form needs it.
    void this.deps.defaultLocation
      .ensure()
      .catch((error: unknown) => console.error(error))
      .then(() => this.showAddModal(initial));
  }

  private showAddModal(initial?: AddItemFormState): void {
    new AddItemModal(this.app, {
      service: this.deps.addItem,
      references: this.deps.references,
      addReference: this.deps.addReference,
      searchThreshold: () => this.deps.preferences.get().settings.searchThreshold,
      filament: () => this.deps.preferences.get().settings.filament,
      defaults: this.lastUsed,
      defaultLocation: () => this.deps.defaultLocation.current(),
      haptics: this.deps.haptics,
      initial,
      entries: this.deps.repository.loadEntries(),
      similar: this.deps.similar,
      onOpenCard: (path, form) => {
        void this.openCard(path, form);
      },
      onAdded: (added, used, openNote) => {
        this.lastUsed = used;
        new Notice(STRINGS.added(added.name, added.id));
        this.scheduleRefresh();
        if (openNote) void this.openCard(added.path);
      },
    }).open();
  }

  private coverUrl(path: string | null): string | null {
    if (path === null) return null;
    const file = this.app.vault.getFileByPath(path);
    return file ? this.app.vault.getResourcePath(file) : null;
  }

  /** `form` is remembered in the navigation history so "back" returns to it. */
  private async openCard(
    path: string,
    form: AddItemFormState | null = null,
  ): Promise<void> {
    this.addDraft = form;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.leaf.openFile(file);
  }
}
