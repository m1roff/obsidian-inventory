import { App, Modal, Notice, Setting } from "obsidian";
import { PlaceTagService } from "../domain/PlaceTagService";
import { ReferenceLists } from "../domain/ReferenceLists";
import { AddReferenceService } from "../domain/AddReferenceService";
import { InventoryEntry } from "../domain/InventoryEntry";
import { mergeTagNames } from "../domain/TagList";
import { TagsField } from "./TagsField";
import { STRINGS } from "./strings";

export interface PlaceTagsEditorDeps {
  readonly service: PlaceTagService;
  readonly references: ReferenceLists;
  readonly addReference: AddReferenceService;
  /** The items as of now, for the tags written on them (read when the picker opens). */
  readonly entries: () => readonly InventoryEntry[];
  readonly searchThreshold: () => number;
  /** Called after the tags were saved, so the open screens redraw. */
  readonly onSaved: () => void;
}

/** The place whose tags are edited: only what the window needs. */
export interface PlaceTagsTarget {
  readonly name: string;
  readonly path: string;
  readonly tags: readonly string[];
}

/** Opens the window that changes the tags of a location. */
export class PlaceTagsEditor {
  constructor(
    private readonly app: App,
    private readonly deps: PlaceTagsEditorDeps,
  ) {}

  edit(place: PlaceTagsTarget): void {
    new PlaceTagsModal(this.app, this.deps, place).open();
  }
}

class PlaceTagsModal extends Modal {
  private tags: string[];

  constructor(
    app: App,
    private readonly deps: PlaceTagsEditorDeps,
    private readonly place: PlaceTagsTarget,
  ) {
    super(app);
    this.tags = [...place.tags];
  }

  onOpen(): void {
    this.setTitle(STRINGS.placeTagsTitle(this.place.name));
    const { contentEl } = this;
    contentEl.empty();

    new TagsField(this.app, contentEl, {
      label: STRINGS.fieldTags,
      initial: this.tags,
      // The one cloud: the tags list, the tags written on items and on places.
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
      .addButton((button) => button.setButtonText(STRINGS.cancel).onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText(STRINGS.placeTagsSave)
          .setCta()
          .onClick(() => void this.save()),
      )
      .settingEl.addClass("inventory-ui__modal-actions");
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async save(): Promise<void> {
    try {
      await this.deps.service.save(this.place.path, this.tags);
      new Notice(STRINGS.placeTagsSaved);
      this.deps.onSaved();
      this.close();
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.unexpectedError);
    }
  }
}
