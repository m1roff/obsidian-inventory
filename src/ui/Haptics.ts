export type HapticStrength = "light" | "medium" | "heavy";

/** Whatever the device can do to give a touch: a tick under the finger. */
export interface HapticDevice {
  pulse(strength: HapticStrength): void;
}

/** One tick of a ramp: how long after the start, and how strong. */
export interface HapticStep {
  readonly afterMs: number;
  readonly strength: HapticStrength;
}

/** Timers, so that a ramp can be tested without waiting. */
export interface HapticTimers {
  set(run: () => void, ms: number): number;
  clear(id: number): void;
}

const DENY_PATTERN: readonly HapticStep[] = [
  { afterMs: 0, strength: "heavy" },
  { afterMs: 90, strength: "heavy" },
];

const windowTimers: HapticTimers = {
  set: (run, ms) => window.setTimeout(run, ms),
  clear: (id) => window.clearTimeout(id),
};

/**
 * A small tick under the finger (a switch flipped), or a ramp of growing ticks while a long press
 * is held, so the finger feels that something is about to happen. Does nothing when the owner
 * turned it off, and never throws: feedback is a nicety, not a reason to break an action.
 */
export class Haptics {
  constructor(
    private readonly device: HapticDevice,
    private readonly enabled: () => boolean,
    private readonly timers: HapticTimers = windowTimers,
  ) {}

  tap(strength: HapticStrength = "light"): void {
    if (!this.enabled()) return;
    try {
      this.device.pulse(strength);
    } catch {
      // No feedback is fine.
    }
  }

  /** "Not allowed": two quick firm knocks, unlike the single soft tick of an accepted action. */
  deny(): void {
    this.ramp(DENY_PATTERN);
  }

  /**
   * Plays the steps one after another from now. Returns a function that stops what has not played
   * yet (the finger lifted or moved). The timers live only as long as the press, a fraction of a second.
   */
  ramp(steps: readonly HapticStep[]): () => void {
    if (!this.enabled()) return () => undefined;
    const ids = steps.map((step) => this.timers.set(() => this.tap(step.strength), step.afterMs));
    return () => ids.forEach((id) => this.timers.clear(id));
  }
}
