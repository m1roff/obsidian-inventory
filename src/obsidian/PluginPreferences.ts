import { Plugin } from "obsidian";
import {
  DashboardPreferences,
  DashboardPreferencesStore,
  DEFAULT_DASHBOARD_PREFERENCES,
  parseDashboardPreferences,
} from "../domain/DashboardPreferences";

/** Dashboard preferences, kept in the plugin's data.json (per vault, not in any note). */
export class PluginPreferences implements DashboardPreferencesStore {
  private current: DashboardPreferences = DEFAULT_DASHBOARD_PREFERENCES;

  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<void> {
    const raw: unknown = await this.plugin.loadData();
    this.current = parseDashboardPreferences(raw);
  }

  get(): DashboardPreferences {
    return this.current;
  }

  set(next: DashboardPreferences): void {
    this.current = next;
    this.plugin.saveData(next).catch((error: unknown) => {
      console.error("Could not save the dashboard preferences", error);
    });
  }
}
