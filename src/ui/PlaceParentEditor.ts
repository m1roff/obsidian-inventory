import { App, Notice } from "obsidian";
import { SelectOption } from "../domain/OptionList";
import { PlaceParentError, PlaceParentService } from "../domain/PlaceParentService";
import { ReferenceLists } from "../domain/ReferenceLists";
import { OptionSuggestModal } from "./SelectField";
import { STRINGS } from "./strings";

export interface PlaceParentEditorDeps {
  readonly service: PlaceParentService;
  readonly references: ReferenceLists;
  readonly searchThreshold: () => number;
  /** Called after the parent was saved, so the open screens redraw. */
  readonly onSaved: () => void;
}

/** The place whose parent is changed: only what the window needs. */
export interface PlaceParentTarget {
  readonly name: string;
}

/**
 * Opens the list of the locations a place can be put inside (not itself, not what stands inside
 * it), labelled with their paths, with a way to take it out again.
 */
export class PlaceParentEditor {
  constructor(
    private readonly app: App,
    private readonly deps: PlaceParentEditorDeps,
  ) {}

  edit(place: PlaceParentTarget): void {
    const tree = this.deps.references.placeTree();
    const current = tree.parentOf(place.name);
    const valid = tree.validParents(place.name, this.deps.references.locations());
    const options: SelectOption[] = tree.options(valid);
    if (current !== null) options.push({ value: "", label: STRINGS.insideNone, tail: true });

    const modal = new OptionSuggestModal(this.app, {
      options,
      alphabetical: true,
      searchThreshold: this.deps.searchThreshold(),
      canAdd: false,
      selected: current ?? undefined,
      onPick: (value) => {
        void this.save(place.name, value === "" ? null : value);
      },
      onAdd: () => undefined,
    });
    modal.setPlaceholder(STRINGS.insidePickTitle(place.name));
    modal.open();
  }

  private async save(name: string, parent: string | null): Promise<void> {
    try {
      await this.deps.service.set(name, parent);
      this.deps.onSaved();
      new Notice(STRINGS.insideSaved(name, parent));
    } catch (error) {
      if (error instanceof PlaceParentError) new Notice(STRINGS.placeParentErrors[error.code]);
      else {
        console.error(error);
        new Notice(STRINGS.unexpectedError);
      }
    }
  }
}
