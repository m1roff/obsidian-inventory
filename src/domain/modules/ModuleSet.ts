import { FilamentModule } from "./FilamentModule";
import { FilamentSettings } from "./FilamentSettings";
import { StructureModule } from "./StructureModule";

/** The modules the owner turned on. */
export function enabledModules(filament: FilamentSettings): StructureModule[] {
  return filament.enabled ? [new FilamentModule()] : [];
}
