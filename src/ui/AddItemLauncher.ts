import { App } from "obsidian";
import { AddItemService } from "../domain/AddItemService";
import { AddReferenceService } from "../domain/AddReferenceService";
import { DashboardPreferencesStore } from "../domain/DashboardPreferences";
import { DefaultLocation } from "../domain/DefaultLocation";
import { InventoryRepository } from "../domain/InventoryRepository";
import { ReferenceLists } from "../domain/ReferenceLists";
import { SimilarItemFinder } from "../domain/SimilarItemFinder";
import { AddedItem } from "../domain/AddItemService";
import { AddItemDefaults, AddItemFormState, AddItemModal } from "./AddItemModal";
import { Haptics } from "./Haptics";

export interface AddItemLauncherDeps {
  readonly service: AddItemService;
  readonly references: ReferenceLists;
  readonly addReference: AddReferenceService;
  readonly preferences: DashboardPreferencesStore;
  readonly defaultLocation: DefaultLocation;
  readonly haptics: Haptics;
  readonly repository: InventoryRepository;
  readonly similar: SimilarItemFinder;
}

export interface AddItemRequest {
  /** A form that was left open to look at a card, to be restored. */
  readonly initial?: AddItemFormState;
  /** The place the item must go to: the form shows it and does not let it be changed. */
  readonly fixedLocation?: string;
  readonly onOpenCard: (path: string, form: AddItemFormState) => void;
  /** `openNote`: the form was closed after this one, so the new card should open. */
  readonly onAdded: (added: AddedItem, openNote: boolean) => void;
}

/**
 * Opens the Add item form. The dashboard and the list inside a place's note both start it
 * from here, so the form is wired up in one place. It remembers the kind and place used last,
 * so the next item starts from them wherever the form was opened.
 */
export class AddItemLauncher {
  private lastUsed: AddItemDefaults = { kind: "", location: "" };

  constructor(
    private readonly app: App,
    private readonly deps: AddItemLauncherDeps,
  ) {}

  open(request: AddItemRequest): void {
    // A default location always exists: make sure of it before the form needs it.
    void this.deps.defaultLocation
      .ensure()
      .catch((error: unknown) => console.error(error))
      .then(() => this.show(request));
  }

  private show(request: AddItemRequest): void {
    const { deps } = this;
    new AddItemModal(this.app, {
      service: deps.service,
      references: deps.references,
      addReference: deps.addReference,
      searchThreshold: () => deps.preferences.get().settings.searchThreshold,
      filament: () => deps.preferences.get().settings.filament,
      defaults: this.lastUsed,
      defaultLocation: () => deps.defaultLocation.current(),
      fixedLocation: request.fixedLocation,
      haptics: deps.haptics,
      initial: request.initial,
      entries: deps.repository.loadEntries(),
      similar: deps.similar,
      onOpenCard: request.onOpenCard,
      onAdded: (added, used, openNote) => {
        // An item put into a fixed place says nothing about where the next one should go.
        this.lastUsed = request.fixedLocation ? { kind: used.kind, location: this.lastUsed.location } : used;
        request.onAdded(added, openNote);
      },
    }).open();
  }
}
