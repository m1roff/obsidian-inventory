import { App, Menu, Notice, setIcon } from "obsidian";
import { visibleWhenFolded } from "../domain/DashboardPreferences";
import {
  LOCATION_SORT_MODES,
  LocationPreferences,
  LocationPreferencesStore,
  LocationSortMode,
  LocationTile,
  movePinned,
  togglePinned,
} from "../domain/LocationBoard";
import { Haptics } from "./Haptics";
import { DEFAULT_HOLD_CONFIG, HoldGesture } from "./HoldGesture";
import { PhotoAttacher } from "./PhotoAttacher";
import { STRINGS } from "./strings";

export interface LocationBoardPanelDeps {
  /** Opens the plugin settings on the Locations tab. */
  readonly onOpenSettings: () => void;
  readonly app: App;
  readonly preferences: LocationPreferencesStore;
  /** How many tiles a folded block still shows. */
  readonly foldedCount: () => number;
  /** "Filter" was pressed: the location, or null when the active filter is cleared. */
  readonly onSelect: (location: string | null) => void;
  /** A tap on the tile: open the location's note. */
  readonly onOpen: (tile: LocationTile) => void;
  readonly onQr: (tile: LocationTile) => void;
  /** Picks, replaces and takes off the tile's photo. */
  readonly photos: PhotoAttacher;
  /** The address an image file can be shown from, or null. */
  readonly coverUrl: (path: string | null) => string | null;
  /** A tick under the finger when a long press is about to open the menu. */
  readonly haptics: Haptics;
  /** The setting: show the photos at all. */
  readonly showCovers: () => boolean;
  /** Asks for a name and creates a location; shown when there are none yet. */
  readonly onAddLocation: () => void;
  /** Called after a preference changed; the owner draws the panel again. */
  readonly onPreferencesChanged: () => void;
}

const SORT_LABELS: Record<LocationSortMode, string> = {
  alpha: STRINGS.boardSortAlpha,
  added: STRINGS.boardSortAdded,
  updated: STRINGS.boardSortUpdated,
};

/**
 * Small tiles with the locations and what is left in each. Folded, only the
 * first few show (pinned ones come first); expanding pushes the list below
 * it down. A tap on a tile opens the location's note; its buttons are right
 * there: filter the list by it, make its QR label. A long press (or a right
 * click) opens the menu: pin or unpin and move it, add, replace or remove its photo.
 */
export class LocationBoardPanel {
  constructor(
    private readonly el: HTMLElement,
    private readonly deps: LocationBoardPanelDeps,
  ) {}

  render(tiles: LocationTile[], selected: string | null): void {
    this.el.empty();
    this.el.removeClass("inventory-ui__hidden");
    if (tiles.length === 0) {
      this.renderEmpty();
      return;
    }

    const preferences = this.deps.preferences.get();
    this.renderHeader(tiles.length, preferences);
    if (preferences.expanded) this.renderSortSwitch(preferences);

    const grid = this.el.createDiv({ cls: "inventory-ui__board-grid" });
    const shown = visibleWhenFolded(tiles, preferences.expanded, this.deps.foldedCount());
    for (const tile of shown) this.renderTile(grid, tile, tile.name === selected);
  }

  /** No locations yet: say what they are and offer to add the first one. */
  private renderEmpty(): void {
    const box = this.el.createDiv({ cls: "inventory-ui__board-empty" });
    box.createDiv({ cls: "inventory-ui__board-empty-title", text: STRINGS.boardEmptyTitle });
    box.createDiv({ cls: "inventory-ui__board-empty-hint", text: STRINGS.boardEmptyHint });
    const add = box.createEl("button", { cls: "inventory-ui__board-empty-add" });
    setIcon(add.createSpan(), "plus");
    add.createSpan({ text: STRINGS.boardAddLocation });
    add.addEventListener("click", () => this.deps.onAddLocation());
  }

  private renderHeader(count: number, preferences: LocationPreferences): void {
    const head = this.el.createDiv({ cls: "inventory-ui__board-head" });
    const toggle = head.createEl("button", {
      cls: "inventory-ui__board-toggle",
      attr: {
        "aria-expanded": String(preferences.expanded),
        "aria-label": preferences.expanded ? STRINGS.boardCollapse : STRINGS.boardExpand,
      },
    });
    setIcon(
      toggle.createSpan(),
      preferences.expanded ? "chevron-down" : "chevron-right",
    );
    toggle.createSpan({ text: STRINGS.boardTitle });
    toggle.createSpan({ cls: "inventory-ui__board-count", text: String(count) });
    toggle.addEventListener("click", () =>
      this.update({ expanded: !preferences.expanded }),
    );

    // Adds a location on its own, without having to add an item first.
    const add = head.createEl("button", {
      cls: "inventory-ui__board-add",
      attr: { "aria-label": STRINGS.boardAddLocation },
    });
    setIcon(add, "plus");
    add.addEventListener("click", () => this.deps.onAddLocation());

    // The settings of locations, one tap away instead of the menu and a hunt for the tab.
    const settings = head.createEl("button", {
      cls: "inventory-ui__board-settings",
      attr: { "aria-label": STRINGS.boardSettings },
    });
    setIcon(settings, "settings");
    settings.addEventListener("click", () => this.deps.onOpenSettings());
  }

  private renderSortSwitch(preferences: LocationPreferences): void {
    const group = this.el.createDiv({
      cls: "inventory-ui__sort",
      attr: { role: "group", "aria-label": STRINGS.sortLabel },
    });
    for (const mode of LOCATION_SORT_MODES) {
      const button = group.createEl("button", {
        cls: "inventory-ui__sort-button",
        text: SORT_LABELS[mode],
        attr: { "aria-pressed": String(mode === preferences.sort) },
      });
      button.toggleClass("is-active", mode === preferences.sort);
      button.addEventListener("click", () => this.update({ sort: mode }));
    }
  }

  private renderTile(parent: HTMLElement, tile: LocationTile, selected: boolean): void {
    const card = parent.createDiv({ cls: "inventory-ui__board-tile" });
    card.toggleClass("is-selected", selected);
    card.toggleClass("is-pinned", tile.pinned);
    this.renderCover(card, tile);

    // The long press (pin) belongs to this part only, not to the buttons below.
    const body = card.createDiv({ cls: "inventory-ui__board-tile-body" });
    const top = body.createDiv({ cls: "inventory-ui__board-tile-top" });
    top.createSpan({ cls: "inventory-ui__board-tile-name", text: tile.name });
    if (tile.pinned) setIcon(top.createSpan(), "pin");
    body.createDiv({
      cls:
        tile.quantity > 0
          ? "inventory-ui__board-tile-qty"
          : "inventory-ui__board-tile-qty inventory-ui__board-tile-qty--zero",
      text: String(tile.quantity),
    });
    const hold = this.attachGestures(body, tile);
    body.addEventListener("click", () => {
      // A long press that opened the menu must not also open the note.
      if (hold.consumeHold()) return;
      this.deps.onOpen(tile);
    });

    const actions = card.createDiv({ cls: "inventory-ui__board-tile-actions" });
    this.addAction(
      actions,
      selected ? "filter-x" : "filter",
      selected ? STRINGS.placeClear : STRINGS.placeApply,
      selected ? STRINGS.placeClearAria : STRINGS.placeApplyAria,
      () => this.deps.onSelect(selected ? null : tile.name),
      selected,
    );
    this.addAction(actions, "qr-code", STRINGS.placeQr, STRINGS.placeQrAria, () =>
      this.deps.onQr(tile),
    );
  }

  /** The photo behind the tile: loaded lazily and decoded off the main thread, under a dark wash. */
  private renderCover(card: HTMLElement, tile: LocationTile): void {
    const url = this.deps.showCovers() ? this.deps.coverUrl(tile.cover) : null;
    if (url === null) return;
    card.addClass("has-cover");
    card.createEl("img", {
      cls: "inventory-ui__board-tile-cover",
      attr: { src: url, alt: "", loading: "lazy", decoding: "async" },
    });
  }

  /** An icon button; the word next to the icon shows on a computer and hides on a phone. */
  private addAction(
    parent: HTMLElement,
    icon: string,
    label: string,
    aria: string,
    onClick: () => void,
    pressed?: boolean,
  ): void {
    const button = parent.createEl("button", {
      cls: "inventory-ui__board-action",
      attr: { "aria-label": aria },
    });
    if (pressed !== undefined) {
      button.setAttribute("aria-pressed", String(pressed));
      button.toggleClass("is-active", pressed);
    }
    setIcon(button.createSpan(), icon);
    button.createSpan({ cls: "inventory-ui__board-action-label", text: label });
    button.addEventListener("click", onClick);
  }

  /** The long press of the tile opens its menu; its timing is in HoldGesture.ts. */
  private attachGestures(body: HTMLElement, tile: LocationTile): HoldGesture {
    return new HoldGesture(
      body,
      this.deps.haptics,
      () => DEFAULT_HOLD_CONFIG,
      (x, y) => this.openMenu(tile, x, y),
    );
  }

  private togglePin(tile: LocationTile): void {
    const pinned = this.deps.preferences.get().pinned;
    this.update({ pinned: togglePinned(pinned, tile.name) });
    if (!tile.pinned) new Notice(STRINGS.pinned(tile.name));
  }

  private openMenu(tile: LocationTile, x: number, y: number): void {
    const pinned = this.deps.preferences.get().pinned;
    const index = pinned.indexOf(tile.name);
    const menu = new Menu();

    // The picker must open straight from the choice, so the handler calls it without awaiting.
    menu.addItem((item) =>
      item
        .setTitle(tile.cover ? STRINGS.tileReplacePhoto : STRINGS.tileSetPhoto)
        .setIcon("image-plus")
        .onClick(() => {
          void this.deps.photos.attach(tile.path);
        }),
    );
    if (tile.cover && this.deps.photos.canRemove) {
      menu.addItem((item) =>
        item
          .setTitle(STRINGS.tileRemovePhoto)
          .setIcon("image-minus")
          .onClick(() => {
            void this.deps.photos.remove(tile.path);
          }),
      );
    }
    menu.addSeparator();

    if (!tile.pinned) {
      menu.addItem((item) =>
        item.setTitle(STRINGS.pin).setIcon("pin").onClick(() => this.togglePin(tile)),
      );
    } else {
      menu.addItem((item) =>
        item
          .setTitle(STRINGS.moveLeft)
          .setIcon("arrow-left")
          .setDisabled(index <= 0)
          .onClick(() => this.update({ pinned: movePinned(pinned, tile.name, -1) })),
      );
      menu.addItem((item) =>
        item
          .setTitle(STRINGS.moveRight)
          .setIcon("arrow-right")
          .setDisabled(index === pinned.length - 1)
          .onClick(() => this.update({ pinned: movePinned(pinned, tile.name, 1) })),
      );
      menu.addItem((item) =>
        item.setTitle(STRINGS.unpin).setIcon("pin-off").onClick(() => this.togglePin(tile)),
      );
    }
    menu.showAtPosition({ x, y });
  }

  private update(patch: Partial<LocationPreferences>): void {
    this.deps.preferences.set({ ...this.deps.preferences.get(), ...patch });
    this.deps.onPreferencesChanged();
  }
}
