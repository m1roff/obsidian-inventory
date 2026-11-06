import { App, Modal, Setting } from "obsidian";
import { guardKeyboard } from "./KeyboardGuard";
import { STRINGS } from "./strings";

/** Asks for a name, e.g. for a new kind or location. */
export function promptForName(
  app: App,
  title: string,
  onSubmit: (name: string) => void,
  /** Spaces cannot be typed (a tag has none). */
  noSpaces = false,
): void {
  new NamePromptModal(app, title, onSubmit, noSpaces).open();
}

class NamePromptModal extends Modal {
  private value = "";

  constructor(
    app: App,
    private readonly title: string,
    private readonly onSubmit: (name: string) => void,
    private readonly noSpaces: boolean,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.title);
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName(STRINGS.fieldName).addText((text) => {
      text.onChange((value) => {
        if (this.noSpaces && /\s/.test(value)) {
          value = value.replace(/\s+/g, "");
          text.setValue(value);
        }
        this.value = value;
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(STRINGS.addButton)
          .setCta()
          .onClick(() => this.submit()),
      )
      .settingEl.addClass("inventory-ui__modal-actions");

    guardKeyboard(this);
  }

  private submit(): void {
    this.close();
    this.onSubmit(this.value);
  }
}
