import { App, Modal, Notice, Plugin, Setting } from "obsidian";

/**
 * Development only (compiled out of production builds). Finds out what kind of touch feedback
 * this device lets a plugin use. Each way has its own button, because feedback usually needs a
 * real tap, not a command from the palette.
 */
export function addHapticsProbe(plugin: Plugin): void {
  plugin.addCommand({
    id: "dev-haptics-probe",
    name: "Dev: haptics probe",
    callback: () => new HapticsProbeModal(plugin.app).open(),
  });
}

type Fn = (...args: unknown[]) => unknown;

/** The Capacitor Haptics plugin, if the app exposes it to the page. */
function capacitorHaptics(): Record<string, Fn> | null {
  const capacitor = (window as unknown as Record<string, unknown>).Capacitor;
  if (typeof capacitor !== "object" || capacitor === null) return null;
  const plugins = (capacitor as Record<string, unknown>).Plugins;
  if (typeof plugins !== "object" || plugins === null) return null;
  const haptics = (plugins as Record<string, unknown>).Haptics;
  return typeof haptics === "object" && haptics !== null ? (haptics as Record<string, Fn>) : null;
}

class HapticsProbeModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Haptics probe");
    const { contentEl } = this;
    contentEl.empty();

    const capacitor = (window as unknown as Record<string, unknown>).Capacitor;
    const haptics = capacitorHaptics();
    const lines = [
      `navigator.vibrate: ${typeof navigator.vibrate === "function" ? "present" : "missing"}`,
      `window.Capacitor: ${capacitor ? "present" : "missing"}`,
      `Capacitor Haptics: ${haptics ? `present (${Object.keys(haptics).join(", ") || "no methods listed"})` : "missing"}`,
    ];
    for (const line of lines) contentEl.createEl("p", { text: line });

    new Setting(contentEl)
      .setName("navigator.vibrate(40)")
      .setDesc("Plain vibration. Works on Android, not on iPhone.")
      .addButton((button) =>
        button.setButtonText("Try").onClick(() => {
          const ok = typeof navigator.vibrate === "function" ? navigator.vibrate(40) : false;
          new Notice(`vibrate returned ${String(ok)}`);
        }),
      );

    new Setting(contentEl)
      .setName("Capacitor Haptics impact")
      .setDesc("A soft tap, if the app lets the page reach it.")
      .addButton((button) =>
        button.setButtonText("Try").onClick(() => {
          const impact = haptics?.impact ?? haptics?.selectionChanged;
          if (!impact) {
            new Notice("No Capacitor Haptics here");
            return;
          }
          try {
            const result = impact.call(haptics, { style: "MEDIUM" });
            new Notice(`Capacitor haptics called: ${String(result)}`);
          } catch (error) {
            new Notice(`Capacitor haptics failed: ${String(error)}`);
          }
        }),
      );

    const trick = new Setting(contentEl)
      .setName("Switch checkbox")
      .setDesc("The iOS 17.4+ trick: toggling a switch-style checkbox ticks. Flip it by hand.");
    const box = trick.controlEl.createEl("input", { type: "checkbox" });
    box.setAttribute("switch", "");
  }
}
