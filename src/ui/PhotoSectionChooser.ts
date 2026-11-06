import { App, Modal, Setting } from "obsidian";
import {
  defaultTarget,
  outline,
  OutlineEntry,
  PhotoTarget,
  targetHeading,
  DEFAULT_PHOTO_HEADING,
} from "../domain/PhotoSections";
import { guardKeyboard } from "./KeyboardGuard";
import { STRINGS } from "./strings";

/** Says which section of a note the photos go under. */
export interface PhotoSectionChooser {
  /** The heading line to embed under, or null when the owner backed out. */
  choose(notePath: string, photoCount: number): Promise<string | null>;
}

/**
 * Shows the note's headings like the outline panel (every level, in order, indented) and a row
 * for a new section at the very end. Nothing is saved until the owner presses the button.
 */
export class VaultPhotoSectionChooser implements PhotoSectionChooser {
  constructor(private readonly app: App) {}

  async choose(notePath: string, photoCount: number): Promise<string | null> {
    const file = this.app.vault.getFileByPath(notePath);
    if (!file) return DEFAULT_PHOTO_HEADING;
    const entries = outline(await this.app.vault.read(file));
    return new Promise((resolve) => {
      new PhotoSectionModal(this.app, entries, photoCount, resolve).open();
    });
  }
}

class PhotoSectionModal extends Modal {
  private target: PhotoTarget;
  private settled = false;
  private rows = new Map<OutlineEntry | "new", HTMLElement>();
  private nameEl: HTMLInputElement | null = null;
  private errorEl: HTMLElement | null = null;
  private addButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly entries: readonly OutlineEntry[],
    private readonly photoCount: number,
    private readonly done: (heading: string | null) => void,
  ) {
    super(app);
    this.target = defaultTarget(entries);
    // The window may open from a tap inside a frame; do not try to give focus back on close.
    this.shouldRestoreSelection = false;
  }

  onOpen(): void {
    this.setTitle(STRINGS.photoSectionTitle(this.photoCount));
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("inventory-ui__section-modal");

    const list = contentEl.createDiv({ cls: "inventory-ui__section-list", attr: { role: "radiogroup" } });
    for (const entry of this.entries) this.renderEntry(list, entry);
    // Outside the scrolling list: when the keyboard comes up the list shrinks, and a field at
    // the bottom of it would slide out of sight under the finger that just tapped it.
    this.renderNew(contentEl);

    const actions = new Setting(contentEl);
    actions.settingEl.addClass("inventory-ui__modal-actions");
    this.errorEl = actions.infoEl.createDiv({ cls: "inventory-ui__error" });
    actions
      .addButton((button) => button.setButtonText(STRINGS.cancel).onClick(() => this.close()))
      .addButton((button) => {
        this.addButton = button.buttonEl;
        button.setButtonText(STRINGS.photoSectionAdd).setCta().onClick(() => this.submit());
      });

    this.refresh();
    guardKeyboard(this);
  }

  onClose(): void {
    this.contentEl.empty();
    this.finish(null);
  }

  private renderEntry(list: HTMLElement, entry: OutlineEntry): void {
    const row = list.createEl("button", {
      cls: "inventory-ui__section-row",
      attr: { role: "radio" },
    });
    // Indented by rank like the outline: a `##` sits one step in from a `#`.
    row.setAttribute("style", `--section-depth: ${entry.rank - 1}`);
    row.createSpan({ cls: "inventory-ui__section-rank", text: "#".repeat(entry.rank) });
    row.createSpan({ cls: "inventory-ui__section-text", text: entry.title });
    row.addEventListener("click", () => {
      this.target = { kind: "existing", heading: entry.heading };
      this.refresh();
    });
    this.rows.set(entry, row);
  }

  private renderNew(parent: HTMLElement): void {
    // A label, so a tap anywhere on the row puts the cursor in the field (the keyboard guard
    // treats a tap on a label as "doing something" and leaves the focus alone).
    const row = parent.createEl("label", { cls: "inventory-ui__section-row inventory-ui__section-row--new" });
    row.createSpan({ cls: "inventory-ui__section-text", text: `+ ${STRINGS.photoSectionNew}` });
    const input = row.createEl("input", {
      cls: "inventory-ui__section-name",
      attr: { type: "text", placeholder: STRINGS.photoSectionName },
    });
    input.value = this.target.kind === "new" ? this.target.name : "";
    const choose = (): void => {
      this.target = { kind: "new", name: input.value };
      this.refresh();
    };
    input.addEventListener("input", choose);
    input.addEventListener("focus", choose);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.submit();
      }
    });
    this.nameEl = input;
    this.rows.set("new", row);
  }

  /** Marks the chosen row and says whether Add can be pressed. */
  private refresh(): void {
    for (const [key, row] of this.rows) {
      const chosen =
        key === "new"
          ? this.target.kind === "new"
          : this.target.kind === "existing" && this.target.heading === key.heading;
      row.toggleClass("is-selected", chosen);
      row.setAttribute("aria-checked", String(chosen));
    }
    const ready = targetHeading(this.target) !== null;
    if (this.addButton) this.addButton.disabled = !ready;
    this.errorEl?.setText(ready ? "" : STRINGS.photoSectionNameEmpty);
  }

  private submit(): void {
    const heading = targetHeading(this.target);
    if (heading === null) return;
    this.finish(heading);
    this.close();
  }

  private finish(heading: string | null): void {
    if (this.settled) return;
    this.settled = true;
    this.done(heading);
  }
}
