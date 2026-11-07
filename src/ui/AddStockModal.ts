import { App, Modal, Setting } from "obsidian";
import { AddReferenceService } from "../domain/AddReferenceService";
import { AddStockRequest } from "../domain/AddStockRequest";
import { InventoryEntry } from "../domain/InventoryEntry";
import { ReferenceLists } from "../domain/ReferenceLists";
import { StockError } from "../domain/StockError";
import { StockService } from "../domain/StockService";
import { Haptics } from "./Haptics";
import { QuantityField } from "./QuantityField";
import { SelectField } from "./SelectField";
import { guardKeyboard } from "./KeyboardGuard";
import { STRINGS } from "./strings";

export interface AddStockModalOptions {
  /** Pick lists longer than this get a search field. */
  readonly searchThreshold: () => number;
  readonly entry: InventoryEntry;
  readonly service: StockService;
  readonly references: ReferenceLists;
  readonly addReference: AddReferenceService;
  readonly haptics: Haptics;
  readonly onAdded: (quantity: number, to: string) => void;
}

/** Puts more units of an existing item somewhere, e.g. after buying more. */
export class AddStockModal extends Modal {
  private readonly locations: string[];
  private location: string;
  private quantity = "1";
  private errorEl: HTMLElement | null = null;
  private busy = false;

  constructor(
    app: App,
    private readonly options: AddStockModalOptions,
  ) {
    super(app);
    this.locations = options.references.locations();
    // Most likely the new units go where the existing ones are.
    this.location = options.entry.places()[0]?.location ?? this.locations[0] ?? "";
  }

  onOpen(): void {
    this.setTitle(STRINGS.addMoreTitle(this.options.entry.item.name));
    const { contentEl } = this;
    contentEl.addClass("inventory-ui__modal");
    contentEl.empty();

    new SelectField(this.app, contentEl, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldLocation,
      options: () => this.options.references.locationOptions(),
      value: this.location,
      onChange: (value) => (this.location = value),
      create: {
        promptTitle: STRINGS.newLocation,
        create: (name) => this.options.addReference.add("location", name),
      },
    });

    new QuantityField(contentEl, STRINGS.fieldQuantity, {
      initial: this.quantity,
      haptics: this.options.haptics,
      onChange: (value) => (this.quantity = value),
      onEnter: () => {
        void this.submit();
      },
    });

    this.errorEl = contentEl.createDiv({ cls: "inventory-ui__error" });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(STRINGS.addButton)
          .setCta()
          .onClick(() => {
            void this.submit();
          }),
      )
      .settingEl.addClass("inventory-ui__modal-actions");

    guardKeyboard(this);
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorEl?.setText("");

    try {
      const quantity = Number(this.quantity);
      const request = AddStockRequest.create({
        location: this.location,
        quantity,
      });
      await this.options.service.addStock(this.options.entry, request);
      this.options.onAdded(quantity, this.location);
      this.close();
    } catch (error) {
      if (error instanceof StockError) {
        this.errorEl?.setText(STRINGS.stockErrors[error.code]);
      } else {
        console.error(error);
        this.errorEl?.setText(STRINGS.unexpectedError);
      }
    } finally {
      this.busy = false;
    }
  }
}
