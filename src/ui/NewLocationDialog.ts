import { App, Modal, Setting } from "obsidian";
import { AddReferenceError, AddReferenceService } from "../domain/AddReferenceService";
import { InventoryEntry } from "../domain/InventoryEntry";
import { PlaceParentError, PlaceParentService } from "../domain/PlaceParentService";
import { PlaceTagService } from "../domain/PlaceTagService";
import { ReferenceLists } from "../domain/ReferenceLists";
import { mergeTagNames } from "../domain/TagList";
import { guardKeyboard } from "./KeyboardGuard";
import { SelectField } from "./SelectField";
import { TagsField } from "./TagsField";
import { STRINGS } from "./strings";

export interface NewLocationDialogDeps {
  readonly addReference: AddReferenceService;
  readonly tagService: PlaceTagService;
  readonly parentService: PlaceParentService;
  readonly references: ReferenceLists;
  readonly entries: () => readonly InventoryEntry[];
  readonly searchThreshold: () => number;
  /** The path of the note a location of this name gets. */
  readonly placePath: (name: string) => string;
  /** A location was added: the screens redraw. */
  readonly onAdded: () => void;
}

/** Opens the window that adds a location, with its tags. */
export class NewLocationDialog {
  constructor(
    private readonly app: App,
    private readonly deps: NewLocationDialogDeps,
  ) {}

  open(): void {
    new NewLocationModal(this.app, this.deps).open();
  }
}

/**
 * Name and tags of a new location. With "Add several in a row" on, the window stays after each
 * one: the name is emptied for the next, the tags stay as they are. With it off the window closes
 * and nothing is kept.
 */
class NewLocationModal extends Modal {
  private name = "";
  private tags: string[] = [];
  /** The location it goes inside; empty for the top level. */
  private parent = "";
  private several = false;
  private busy = false;
  private nameInput: HTMLInputElement | null = null;
  private errorEl: HTMLElement | null = null;

  constructor(
    app: App,
    private readonly deps: NewLocationDialogDeps,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(STRINGS.newLocation);
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName(STRINGS.fieldName).addText((text) => {
      text.setValue(this.name);
      this.nameInput = text.inputEl;
      text.onChange((value) => {
        this.name = value;
        this.errorEl?.setText("");
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    // Optional: a box that stands in the pantry says so right here.
    new SelectField(this.app, contentEl, {
      searchThreshold: this.deps.searchThreshold,
      label: STRINGS.fieldInside,
      options: () => [
        { value: "", label: STRINGS.insideNone, tail: true },
        ...this.deps.references.locationOptions(),
      ],
      value: this.parent,
      onChange: (value) => (this.parent = value),
    });

    new TagsField(this.app, contentEl, {
      label: STRINGS.fieldTags,
      initial: this.tags,
      available: () =>
        mergeTagNames(
          this.deps.references.tags(),
          this.deps.entries().flatMap((entry) => entry.item.tags),
          this.deps.references.places().flatMap((place) => place.tags),
        ),
      create: (name) => this.deps.addReference.add("tag", name),
      searchThreshold: this.deps.searchThreshold,
      onChange: (tags) => (this.tags = tags),
    });

    new Setting(contentEl)
      .setName(STRINGS.addSeveralName)
      .addToggle((toggle) => toggle.setValue(this.several).onChange((value) => (this.several = value)));

    const actions = new Setting(contentEl);
    actions.settingEl.addClass("inventory-ui__modal-actions");
    this.errorEl = actions.infoEl.createDiv({ cls: "inventory-ui__error" });
    actions.addButton((button) =>
      button
        .setButtonText(STRINGS.addButton)
        .setCta()
        .onClick(() => void this.submit()),
    );

    guardKeyboard(this);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const name = await this.deps.addReference.add("location", this.name);
      if (this.tags.length > 0) await this.deps.tagService.save(this.deps.placePath(name), this.tags);
      if (this.parent !== "") await this.deps.parentService.set(name, this.parent);
      this.deps.onAdded();
      if (this.several) {
        // The next one: the name is empty again, the tags stay.
        this.name = "";
        if (this.nameInput) {
          this.nameInput.value = "";
          this.nameInput.focus();
        }
        this.errorEl?.setText("");
      } else {
        this.close();
      }
    } catch (error) {
      if (error instanceof AddReferenceError) {
        this.errorEl?.setText(STRINGS.referenceErrors[error.code]);
      } else if (error instanceof PlaceParentError) {
        this.errorEl?.setText(STRINGS.placeParentErrors[error.code]);
      } else {
        console.error(error);
        this.errorEl?.setText(STRINGS.unexpectedError);
      }
    } finally {
      this.busy = false;
    }
  }
}
