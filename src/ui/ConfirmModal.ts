import { App, Modal, Setting } from "obsidian";
import { frameModal } from "./ModalFrame";
import { STRINGS } from "./strings";

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  /** Names the action touches, shown as a list under the message. */
  readonly items?: readonly string[];
  readonly onConfirm: () => void;
}

/** Asks before something that cannot be undone. */
export function confirmAction(app: App, options: ConfirmOptions): void {
  new ConfirmModal(app, options).open();
}

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly options: ConfirmOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    frameModal(this);
    this.setTitle(this.options.title);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", { text: this.options.message });
    if (this.options.items && this.options.items.length > 0) {
      const list = contentEl.createEl("ul", { cls: "inventory-ui__confirm-items" });
      for (const item of this.options.items) list.createEl("li", { text: item });
    }

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText(STRINGS.cancel).onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText(this.options.confirmLabel)
          .setWarning()
          .onClick(() => {
            this.close();
            this.options.onConfirm();
          }),
      );
  }
}
