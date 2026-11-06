import { InventoryEntry } from "../domain/InventoryEntry";
import { InventoryRepository } from "../domain/InventoryRepository";
import { isInFolder } from "../obsidian/InventoryFolders";
import { BarButton, BarSource } from "./CardBar";
import { ItemActions } from "./ItemActions";
import { QrLabels } from "./QrLabels";
import { STRINGS } from "./strings";

/** The bar of an item card: the stock actions, and the QR label. */
export class ItemBarSource implements BarSource {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly actions: ItemActions,
    private readonly qrLabels: QrLabels,
    private readonly itemsFolder: () => string,
  ) {}

  buttonsFor(path: string): BarButton[] | null {
    if (!isInFolder(path, this.itemsFolder())) return null;
    const entry = this.entryAt(path);
    if (!entry) return null;

    const stock = this.actions.all().map(
      (action): BarButton => ({
        id: action.id,
        label: action.label,
        icon: null,
        enabled: action.isEnabled(entry),
        // The bar is only redrawn when the buttons change, so the entry known
        // now may be out of date by the click (e.g. after adding more units).
        run: () => action.run(this.entryAt(path) ?? entry),
      }),
    );

    // Not a stock action, so it lives only here (the parity rule is about stock changes).
    const qr: BarButton = {
      id: "qr",
      label: STRINGS.qrButton,
      icon: "qr-code",
      enabled: true,
      run: () => this.qrLabels.openItem(this.entryAt(path) ?? entry),
    };
    return [...stock, qr];
  }

  private entryAt(path: string): InventoryEntry | undefined {
    return this.repository.loadEntries().find((entry) => entry.item.path === path);
  }
}
