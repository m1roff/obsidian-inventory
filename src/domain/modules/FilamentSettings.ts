import { DEFAULT_FILAMENT_KIND } from "./FilamentModule";

/** The owner's choices for the filament module. */
export interface FilamentSettings {
  /** The module is on: the structure has its class and table, Add item offers its fields. */
  readonly enabled: boolean;
  /** Picking this kind in Add item shows the filament fields. */
  readonly kind: string;
}

export const DEFAULT_FILAMENT_SETTINGS: FilamentSettings = {
  enabled: false,
  kind: DEFAULT_FILAMENT_KIND,
};

export function parseFilamentSettings(raw: unknown): FilamentSettings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_FILAMENT_SETTINGS;
  const { enabled, kind } = raw as Record<string, unknown>;
  const name = typeof kind === "string" ? kind.trim() : "";
  return { enabled: enabled === true, kind: name === "" ? DEFAULT_FILAMENT_KIND : name };
}
