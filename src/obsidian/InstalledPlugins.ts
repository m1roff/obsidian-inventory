import { App } from "obsidian";
import { PluginRequirements } from "../domain/structure/SetupService";
import { PluginRequirement } from "../domain/structure/SetupStatus";

/** The plugin id of Fileclass (Metadata Menu): it draws the field forms and class views. */
export const FILECLASS_PLUGIN_ID = "fileclass";

/**
 * Looks at which plugins are on. Obsidian has no public API for this, so it reads
 * the plugin manager's own state; if that is not there, the plugin counts as missing.
 */
export class InstalledPlugins implements PluginRequirements {
  constructor(private readonly app: App) {}

  current(): PluginRequirement[] {
    const plugins = this.app.plugins.plugins;
    const core = this.app.internalPlugins;
    return [
      {
        id: FILECLASS_PLUGIN_ID,
        name: "Fileclass",
        installed: plugins?.[FILECLASS_PLUGIN_ID] !== undefined,
      },
      {
        id: "bases",
        name: "Bases (core plugin)",
        installed: Boolean(core?.getEnabledPluginById?.("bases")),
      },
    ];
  }
}
