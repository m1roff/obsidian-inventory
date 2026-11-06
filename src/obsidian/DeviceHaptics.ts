import { Platform } from "obsidian";
import { HapticDevice, HapticStrength } from "../ui/Haptics";

type Fn = (...args: unknown[]) => unknown;

/** The Capacitor Haptics plugin of the mobile app, if the page can reach it. */
function capacitorHaptics(): Record<string, Fn> | null {
  const capacitor = (window as unknown as Record<string, unknown>).Capacitor;
  if (typeof capacitor !== "object" || capacitor === null) return null;
  const plugins = (capacitor as Record<string, unknown>).Plugins;
  if (typeof plugins !== "object" || plugins === null) return null;
  const haptics = (plugins as Record<string, unknown>).Haptics;
  return typeof haptics === "object" && haptics !== null ? (haptics as Record<string, Fn>) : null;
}

/**
 * The phone's own tick when the app lets the page reach it, else a short vibration, else
 * nothing. Only on a phone or tablet: a computer has nothing to feel.
 */
export class DeviceHaptics implements HapticDevice {
  pulse(strength: HapticStrength): void {
    if (!Platform.isMobile) return;

    const haptics = capacitorHaptics();
    if (haptics && typeof haptics.impact === "function") {
      const result = haptics.impact({ style: strength === "heavy" ? "HEAVY" : strength === "medium" ? "MEDIUM" : "LIGHT" });
      // The call is asynchronous: a failure must not surface as an unhandled rejection.
      if (result instanceof Promise) result.catch(() => undefined);
      return;
    }
    if (typeof navigator.vibrate === "function") navigator.vibrate(strength === "heavy" ? 40 : strength === "medium" ? 25 : 12);
  }
}
