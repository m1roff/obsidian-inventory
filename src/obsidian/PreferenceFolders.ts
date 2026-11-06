import { DashboardPreferencesStore } from "../domain/DashboardPreferences";
import { StructureLayout } from "../domain/structure/StructureLayout";
import { InventoryFolders } from "./InventoryFolders";

/** The folders the plugin reads, following the base folder setting live. */
export class PreferenceFolders implements InventoryFolders {
  constructor(private readonly preferences: DashboardPreferencesStore) {}

  layout(): StructureLayout {
    return new StructureLayout(this.preferences.get().settings.baseFolder);
  }

  get items(): string {
    return this.layout().items;
  }
  get positions(): string {
    return this.layout().positions;
  }
  get kinds(): string {
    return this.layout().kinds;
  }
  get locations(): string {
    return this.layout().locations;
  }
  get tags(): string {
    return this.layout().tags;
  }
}
