import { Plugin } from "obsidian";
import { Haptics } from "./Haptics";

/** Where the plugin's own switches and checkboxes live: its dashboard, its windows, its settings. */
const OWN_SURFACES = ".inventory-ui, .inventory-ui__framed, .inventory-ui__structure-modal, .inventory-ui__settings";

/**
 * One listener for every switch and checkbox of the plugin: flipping one gives a light tick.
 * It reacts only to a checkbox changing inside the plugin's own surfaces, so other plugins'
 * switches stay quiet, and it costs nothing while nothing is flipped.
 */
export function installToggleHaptics(plugin: Plugin, haptics: Haptics): void {
  plugin.registerDomEvent(document, "change", (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    if (target.closest(OWN_SURFACES) === null) return;
    haptics.tap("light");
  });
}
