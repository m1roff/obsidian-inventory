import { setIcon } from "obsidian";
import { InventoryEntry } from "../domain/InventoryEntry";
import { ItemsView } from "../domain/ItemsView";
import { StockStatePolicy } from "../domain/StockState";
import { ItemActions } from "./ItemActions";
import { OpenIntent, openIntentOf } from "./OpenIntent";
import { STRINGS } from "./strings";

export interface ItemRowDeps {
  readonly states: () => StockStatePolicy;
  readonly actions: ItemActions;
  /**
   * Opens the item's card note: in this tab by default, in a new background tab (or split, or window)
   * when the owner held Cmd (Ctrl) while tapping, to open several cards and work through them.
   */
  readonly openCard: (path: string, intent: OpenIntent) => void;
  /** Where the photo can be shown from, or null when there is none. */
  readonly coverUrl: (path: string | null) => string | null;
  /** Something the row did (a photo was added) that the list should show: redraw it. */
  readonly onChanged: () => void;
}

/**
 * One item in a list (or a tile): photo, name, id, tags, where it lies, the stock number and the stock
 * actions. The dashboard and the list inside a place's note draw their rows with this one
 * class, so a row looks and behaves the same everywhere.
 */
export class ItemRow {
  constructor(private readonly deps: ItemRowDeps) {}

  render(parent: HTMLElement, entry: InventoryEntry, view: ItemsView = "list"): void {
    if (view === "tiles") {
      this.renderTile(parent, entry);
      return;
    }
    const { item } = entry;
    const quantity = entry.availableQuantity();

    const row = parent.createDiv({ cls: "inventory-ui__row" });
    const top = row.createDiv({ cls: "inventory-ui__row-top" });

    this.renderCover(top, entry);

    const main = top.createEl("button", {
      cls: "inventory-ui__row-main",
      attr: { "aria-label": `${STRINGS.openCard}: ${item.name}` },
    });
    main.addEventListener("click", (event) => {
      this.deps.openCard(item.path, openIntentOf(event));
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

  /**
   * The square view: the photo, the name and the id, and the stock actions as icons. Tapping
   * the photo or the name opens the card; the empty photo tile still adds a photo.
   */
  private renderTile(parent: HTMLElement, entry: InventoryEntry): void {
    const { item } = entry;
    const tile = parent.createDiv({ cls: "inventory-ui__tile" });
    this.renderCover(tile, entry);

    const main = tile.createEl("button", {
      cls: "inventory-ui__tile-main",
      attr: { "aria-label": `${STRINGS.openCard}: ${item.name}` },
    });
    main.addEventListener("click", (event) => {
      this.deps.openCard(item.path, openIntentOf(event));
    });
    main.createDiv({ cls: "inventory-ui__tile-name", text: item.name });
    if (item.id) main.createDiv({ cls: "inventory-ui__id", text: item.id });

    const actionsEl = tile.createDiv({ cls: "inventory-ui__tile-actions" });
    for (const action of this.deps.actions.all()) {
      const button = actionsEl.createEl("button", {
        cls: "inventory-ui__action",
        attr: { "aria-label": action.label },
      });
      setIcon(button, action.icon);
      button.disabled = !action.isEnabled(entry);
      button.addEventListener("click", () => {
        void action.run(entry);
      });
    }
  }

  /** The photo, or a tap target that adds one. */
  private renderCover(parent: HTMLElement, entry: InventoryEntry): void {
    const { item } = entry;
    const coverUrl = this.deps.coverUrl(item.coverPath);
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
      cover.addEventListener("click", (event) => {
        this.deps.openCard(item.path, openIntentOf(event));
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
          this.deps.onChanged();
        }
      });
    });
  }
}
