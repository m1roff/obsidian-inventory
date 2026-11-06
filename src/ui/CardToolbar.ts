import { MarkdownView, Plugin, setIcon, WorkspaceLeaf } from "obsidian";
import { BarButton, BarSource } from "./CardBar";
import { INVENTORY_ICON_ID } from "./InventoryIcon";
import { STRINGS } from "./strings";

const BAR_CLASS = "inventory-ui__card-bar";
const REFRESH_DELAY_MS = 150;

export interface CardToolbarDeps {
  /** Who owns which notes (items, places, ...) and what their bar holds. */
  readonly sources: readonly BarSource[];
  /** `fromLeaf` is the tab the button was pressed in. */
  readonly openInventory: (fromLeaf: WorkspaceLeaf) => void;
}

/**
 * Puts a bar of buttons into every open note that a source owns (item cards,
 * place notes), under its properties. Which buttons, and which notes, is the
 * sources' business; this class only places and redraws the bar. Nothing is
 * written into the notes.
 */
export class CardToolbar {
  private timer: number | null = null;
  /** Set when something happened that can change what the bar shows. */
  private dirty = true;

  constructor(
    private readonly plugin: Plugin,
    private readonly deps: CardToolbarDeps,
  ) {}

  start(): void {
    const { workspace, metadataCache } = this.plugin.app;
    const changed = (): void => {
      this.dirty = true;
      this.scheduleRefresh();
    };

    this.plugin.registerEvent(workspace.on("file-open", changed));
    this.plugin.registerEvent(workspace.on("active-leaf-change", changed));
    this.plugin.registerEvent(workspace.on("layout-change", changed));
    this.plugin.registerEvent(metadataCache.on("changed", changed));
    this.plugin.registerEvent(metadataCache.on("resolved", changed));
    workspace.onLayoutReady(changed);

    this.plugin.register(() => this.removeAll());
  }

  private scheduleRefresh(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.refresh();
    }, REFRESH_DELAY_MS);
  }

  private refresh(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;

      const existing = view.containerEl.querySelector(`.${BAR_CLASS}`);
      const file = view.file;
      // Raw markdown has no properties block to anchor to and no use for the buttons.
      if (!file || this.isSourceMode(view)) {
        existing?.remove();
        continue;
      }

      if (existing?.instanceOf(HTMLElement) && !this.dirty) {
        this.place(existing, view);
        continue;
      }

      const buttons = this.buttonsFor(file.path);
      if (!buttons) {
        existing?.remove();
        continue;
      }

      const bar = existing?.instanceOf(HTMLElement) ? existing : this.createBar();
      this.place(bar, view);
      this.render(bar, file.path, buttons, leaf);
    }
    this.dirty = false;
  }

  private buttonsFor(path: string): BarButton[] | null {
    for (const source of this.deps.sources) {
      const buttons = source.buttonsFor(path);
      if (buttons) return buttons;
    }
    return null;
  }

  /** Source mode (raw text), as opposed to Live Preview and reading mode. */
  private isSourceMode(view: MarkdownView): boolean {
    return view.getMode() === "source" && view.getState().source === true;
  }

  private createBar(): HTMLElement {
    return createDiv({ cls: BAR_CLASS });
  }

  /**
   * Right under the note's properties, i.e. above the stock table. That spot
   * is part of the note's own scrolling content, so on a phone it is clear of
   * the floating header. Without properties it goes above the content instead.
   */
  private place(bar: HTMLElement, view: MarkdownView): void {
    const properties = Array.from(
      view.contentEl.querySelectorAll(".metadata-container"),
    ).find((el) => el.instanceOf(HTMLElement) && el.offsetParent !== null);

    if (properties) {
      if (properties.nextElementSibling !== bar) properties.after(bar);
    } else if (bar.nextElementSibling !== view.contentEl) {
      view.contentEl.before(bar);
    }
  }

  private render(
    bar: HTMLElement,
    path: string,
    buttons: readonly BarButton[],
    leaf: WorkspaceLeaf,
  ): void {
    // Only what the buttons depend on: the note and which buttons are usable.
    const signature = JSON.stringify([path, buttons.map((b) => [b.id, b.enabled])]);
    if (bar.dataset.signature === signature) return;
    bar.dataset.signature = signature;
    bar.empty();

    for (const entry of buttons) {
      const button = bar.createEl("button", { cls: "inventory-ui__action" });
      if (entry.icon) {
        button.setAttribute("aria-label", entry.label);
        setIcon(button.createSpan(), entry.icon);
        button.createSpan({ text: entry.label });
      } else {
        button.setText(entry.label);
      }
      button.disabled = !entry.enabled;
      button.addEventListener("click", () => {
        void entry.run();
      });
    }

    const open = bar.createEl("button", {
      cls: "inventory-ui__action",
      attr: { "aria-label": STRINGS.openInventory },
    });
    setIcon(open.createSpan(), INVENTORY_ICON_ID);
    open.createSpan({ text: STRINGS.viewTitle });
    open.addEventListener("click", () => this.deps.openInventory(leaf));
  }

  private removeAll(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        view.containerEl.querySelector(`.${BAR_CLASS}`)?.remove();
      }
    }
  }
}
