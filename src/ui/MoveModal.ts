import { App, Modal, Setting } from "obsidian";
import { AddReferenceService } from "../domain/AddReferenceService";
import { InventoryEntry } from "../domain/InventoryEntry";
import { MoveRequest } from "../domain/MoveRequest";
import { SelectOption } from "../domain/OptionList";
import { ReferenceLists } from "../domain/ReferenceLists";
import { StockError } from "../domain/StockError";
import { StockPosition } from "../domain/StockPosition";
import { StockService } from "../domain/StockService";
import { StockState, StockStatePolicy } from "../domain/StockState";
import { Haptics } from "./Haptics";
import { QuantityField } from "./QuantityField";
import { SelectField } from "./SelectField";
import { guardKeyboard } from "./KeyboardGuard";
import { STRINGS } from "./strings";

type ExitState = "consumed" | "disposed";

const EXIT_LABELS: Record<ExitState, string> = {
  consumed: STRINGS.exitConsumed,
  disposed: STRINGS.exitDisposed,
};

const EXITS: readonly ExitState[] = ["consumed", "disposed"];

// Option values of "To": "loc:<location>" or "exit:<state>".
const locationValue = (location: string): string => `loc:${location}`;
const exitValue = (state: ExitState): string => `exit:${state}`;

export interface MoveModalOptions {
  /** Pick lists longer than this get a search field. */
  readonly searchThreshold: () => number;
  readonly entry: InventoryEntry;
  readonly service: StockService;
  /** The owner's list of states: what a unit can be while it is somewhere, in their order. */
  readonly states: () => StockStatePolicy;
  readonly references: ReferenceLists;
  readonly addReference: AddReferenceService;
  readonly haptics: Haptics;
  /** `to` is a location name, or "Used up" / "Thrown away". */
  readonly onMoved: (quantity: number, to: string) => void;
}

export class MoveModal extends Modal {
  private readonly positions: StockPosition[];
  private position: StockPosition;
  private destination: string;
  private state: StockState;
  private quantity = "1";
  private stateField: SelectField | null = null;
  private quantityField: QuantityField | null = null;
  private errorEl: HTMLElement | null = null;
  private busy = false;

  constructor(
    app: App,
    private readonly options: MoveModalOptions,
  ) {
    super(app);
    this.positions = options.entry.availablePositions();
    this.position = this.positions[0];
    this.state = this.position.state;
    this.destination = this.defaultDestination(this.position);
  }

  onOpen(): void {
    this.setTitle(STRINGS.moveTitle(this.options.entry.item.name));
    const { contentEl } = this;
    contentEl.addClass("inventory-ui__modal");
    contentEl.empty();

    if (this.positions.length > 1) {
      new SelectField(this.app, contentEl, {
        searchThreshold: this.options.searchThreshold,
        label: STRINGS.fieldFrom,
        options: () =>
          this.positions.map((position, index) => ({
            value: String(index),
            label: this.positionLabel(position),
          })),
        value: "0",
        onChange: (value) => this.selectPosition(Number(value)),
        alphabetical: false,
      });
    } else {
      new Setting(contentEl)
        .setName(STRINGS.fieldFrom)
        .setDesc(this.positionLabel(this.position));
    }

    new SelectField(this.app, contentEl, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldTo,
      options: () => this.destinationOptions(),
      value: this.destination,
      onChange: (value) => {
        this.destination = value;
        this.updateStateVisibility();
      },
      create: {
        promptTitle: STRINGS.newLocation,
        create: async (name) =>
          locationValue(await this.options.addReference.add("location", name)),
      },
    });

    this.stateField = new SelectField(this.app, contentEl, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldState,
      options: () =>
        this.options.states().placeStates().map((state) => ({
          value: state,
          label: STRINGS.stateLabel(state),
        })),
      value: this.state,
      onChange: (value) => (this.state = value),
      alphabetical: false,
    });
    this.updateStateVisibility();

    this.quantityField = new QuantityField(contentEl, STRINGS.fieldQuantity, {
      initial: this.quantity,
      haptics: this.options.haptics,
      max: this.position.quantity,
      onChange: (value) => (this.quantity = value),
      onEnter: () => {
        void this.submit();
      },
    });

    this.errorEl = contentEl.createDiv({ cls: "inventory-ui__error" });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(STRINGS.move)
          .setCta()
          .onClick(() => {
            void this.submit();
          }),
      )
      .settingEl.addClass("inventory-ui__modal-actions");

    guardKeyboard(this);
  }

  /** Locations (alphabetical), then the two ways units leave stock. */
  private destinationOptions(): SelectOption[] {
    return [
      ...this.options.references.locations().map((location) => ({
        value: locationValue(location),
        label: location,
      })),
      ...EXITS.map((exit) => ({
        value: exitValue(exit),
        label: `- ${EXIT_LABELS[exit]}`,
        tail: true,
      })),
    ];
  }

  private selectPosition(index: number): void {
    this.position = this.positions[index];
    this.state = this.position.state;
    this.stateField?.setValue(this.state);
    this.quantityField?.setMax(this.position.quantity);
  }

  /** State only matters when the units stay somewhere. */
  private updateStateVisibility(): void {
    this.stateField?.setting.settingEl.toggleClass(
      "inventory-ui__hidden",
      this.destination.startsWith("exit:"),
    );
  }

  /** First location that differs from where the units are now. */
  private defaultDestination(position: StockPosition): string {
    const other = this.options.references
      .locations()
      .find((location) => location !== position.location);
    return other !== undefined ? locationValue(other) : exitValue("consumed");
  }

  private positionLabel(position: StockPosition): string {
    return `${position.location} × ${position.quantity} (${STRINGS.stateLabel(position.state)})`;
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorEl?.setText("");

    try {
      const quantity = Number(this.quantity);
      const { input, label } = this.target(quantity);
      const request = MoveRequest.create(this.position, input);
      await this.options.service.move(this.options.entry, request);
      this.options.onMoved(quantity, label);
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

  /** Leaving stock keeps the units' last location, so the note still says where they were. */
  private target(quantity: number): {
    input: { location: string; quantity: number; state: StockState };
    label: string;
  } {
    if (this.destination.startsWith("exit:")) {
      const state = this.destination.slice("exit:".length) as ExitState;
      return {
        input: { location: this.position.location, quantity, state },
        label: EXIT_LABELS[state],
      };
    }
    const location = this.destination.slice("loc:".length);
    return { input: { location, quantity, state: this.state }, label: location };
  }
}
