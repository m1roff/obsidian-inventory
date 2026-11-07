import { Menu, setIcon } from "obsidian";
import { ItemsView } from "../domain/ItemsView";
import { STRINGS } from "./strings";

const ICONS: Record<ItemsView, string> = { list: "layout-list", tiles: "layout-grid" };
const LABELS: Record<ItemsView, () => string> = {
  list: () => STRINGS.viewList,
  tiles: () => STRINGS.viewTiles,
};

/**
 * A small button that shows the current view of a list of items and opens a menu to pick
 * another (like the view switch in a file manager). Does not know what is being drawn: it
 * tells `onPick` the choice and the owner of the list redraws.
 */
export function renderItemsViewSwitch(
  parent: HTMLElement,
  current: () => ItemsView,
  onPick: (view: ItemsView) => void,
): HTMLElement {
  const button = parent.createEl("button", {
    cls: "inventory-ui__view-switch",
    attr: { "aria-label": STRINGS.viewLabel },
  });
  const icon = button.createSpan({ cls: "inventory-ui__view-switch-icon" });
  setIcon(button.createSpan({ cls: "inventory-ui__view-switch-chevron" }), "chevrons-up-down");

  const sync = (): void => {
    icon.empty();
    setIcon(icon, ICONS[current()]);
  };
  sync();

  button.addEventListener("click", (event) => {
    const menu = new Menu();
    for (const view of Object.keys(ICONS) as ItemsView[]) {
      menu.addItem((item) =>
        item
          .setTitle(LABELS[view]())
          .setIcon(ICONS[view])
          .setChecked(view === current())
          .onClick(() => {
            onPick(view);
            sync();
          }),
      );
    }
    menu.showAtMouseEvent(event);
  });
  return button;
}
