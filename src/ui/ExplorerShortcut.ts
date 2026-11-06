import { Plugin, setIcon } from "obsidian";
import { INVENTORY_ICON_ID } from "./InventoryIcon";
import { STRINGS } from "./strings";

const CLASS = "inventory-ui__explorer-link";

/**
 * A button at the top of the file explorer (the left menu) that opens the dashboard,
 * so it is one tap away from anywhere. It looks at the explorer only when the layout
 * changes (a tab opened, a panel shown), never on a timer, and adds the button once.
 * It relies on the explorer's page structure, which Obsidian does not promise; if
 * that changes, the button just does not appear and nothing else breaks.
 */
export class ExplorerShortcut {
  constructor(
    private readonly plugin: Plugin,
    private readonly open: () => void,
  ) {}

  start(): void {
    const { workspace } = this.plugin.app;
    this.plugin.registerEvent(workspace.on("layout-change", () => this.sync()));
    // A drawer that was closed when the layout last changed shows up here.
    this.plugin.registerEvent(workspace.on("active-leaf-change", () => this.sync()));
    workspace.onLayoutReady(() => this.sync());
    this.plugin.register(() => this.remove());
  }

  private sync(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("file-explorer")) {
      const container = leaf.view.containerEl;
      if (container.querySelector(`.${CLASS}`)) continue;
      // The explorer has no ".view-content": its tree is ".nav-files-container". The button goes
      // right above the tree; on a phone the explorer's own buttons sit below it.
      const tree = container.querySelector(".nav-files-container");
      const content = tree ?? container.querySelector(".view-content");
      if (!content) continue;

      const button = createEl("button", { cls: CLASS, attr: { "aria-label": STRINGS.openInventory } });
      setIcon(button.createSpan(), INVENTORY_ICON_ID);
      button.createSpan({ text: STRINGS.openInventory });
      button.addEventListener("click", () => this.open());
      if (tree) tree.before(button);
      else content.prepend(button);
    }
  }

  private remove(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("file-explorer")) {
      leaf.view.containerEl.querySelectorAll(`.${CLASS}`).forEach((el) => el.remove());
    }
  }
}
