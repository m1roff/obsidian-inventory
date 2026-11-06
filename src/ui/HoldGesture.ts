import { Haptics, HapticStep, HapticStrength } from "./Haptics";

/** How long a finger holds before the long press fires (ms). */
export const DEFAULT_HOLD_MS = 720;

/** A finger that moves further than this is scrolling, not pressing. */
export const HOLD_TOLERANCE_PX = 10;

/**
 * While the finger holds: ticks that grow and come closer together, then a firm one when the
 * hold fires (at the hold time), so the hold feels like something charging up. `afterMs` counts
 * from the moment the finger touches down, not from the previous tick. A tick is a single
 * instant knock of the phone's motor, so `strength` is how hard it knocks, not how long.
 * Ticks that fall at or after the hold time never play: the hold has already fired.
 */
export const DEFAULT_HOLD_RAMP: readonly HapticStep[] = [
  { afterMs: 50, strength: "light" },
  { afterMs: 85, strength: "light" },
  { afterMs: 120, strength: "light" },
  { afterMs: 155, strength: "light" },
  { afterMs: 190, strength: "light" },
  { afterMs: 225, strength: "light" },
  { afterMs: 260, strength: "light" },
  { afterMs: 295, strength: "light" },
  { afterMs: 330, strength: "light" },
  { afterMs: 365, strength: "light" },
  { afterMs: 400, strength: "medium" },
  { afterMs: 435, strength: "medium" },
  { afterMs: 470, strength: "medium" },
  { afterMs: 505, strength: "medium" },
  { afterMs: 540, strength: "medium" },
  { afterMs: 575, strength: "medium" },
  { afterMs: 610, strength: "heavy" },
  { afterMs: 645, strength: "heavy" },
  { afterMs: 680, strength: "heavy" },
  { afterMs: 715, strength: "heavy" },
];

/** The firm tick at the moment the hold fires. */
export const DEFAULT_FINAL_STRENGTH: HapticStrength | null = "heavy";

export interface HoldConfig {
  readonly holdMs: number;
  readonly ramp: readonly HapticStep[];
  /** The tick at the moment the hold fires; null for none. */
  readonly finalStrength: HapticStrength | null;
}

export const DEFAULT_HOLD_CONFIG: HoldConfig = {
  holdMs: DEFAULT_HOLD_MS,
  ramp: DEFAULT_HOLD_RAMP,
  finalStrength: DEFAULT_FINAL_STRENGTH,
};

/**
 * A long press on an element: the ticks while the finger holds, then `onHold` with where the
 * finger is (also for a right click). The tap that ends a long press must not count as a tap:
 * ask `consumeHold()` in the click handler. The settings are read at each touch-down, so they
 * can be changed while the page is open.
 */
export class HoldGesture {
  private held = false;
  private justHeld = false;

  constructor(
    el: HTMLElement,
    private readonly haptics: Haptics,
    private readonly config: () => HoldConfig,
    private readonly onHold: (x: number, y: number) => void,
  ) {
    this.bind(el);
  }

  /** True once after a hold: the click that ends the hold is not a tap. */
  consumeHold(): boolean {
    const was = this.justHeld;
    this.justHeld = false;
    return was;
  }

  private bind(el: HTMLElement): void {
    let timer: number | null = null;
    let stopRamp: (() => void) | null = null;
    let startX = 0;
    let startY = 0;

    const cancel = (): void => {
      stopRamp?.();
      stopRamp = null;
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    };

    el.addEventListener("pointerdown", (event) => {
      this.held = false;
      this.justHeld = false;
      startX = event.clientX;
      startY = event.clientY;
      const { holdMs, ramp, finalStrength } = this.config();
      stopRamp = this.haptics.ramp(ramp);
      timer = window.setTimeout(() => {
        timer = null;
        // The hold fired: ticks that were still to come would only play over the menu.
        stopRamp?.();
        stopRamp = null;
        this.held = true;
        this.justHeld = true;
        if (finalStrength !== null) this.haptics.tap(finalStrength);
        this.onHold(startX, startY);
      }, holdMs);
    });
    el.addEventListener("pointermove", (event) => {
      if (
        Math.abs(event.clientX - startX) > HOLD_TOLERANCE_PX ||
        Math.abs(event.clientY - startY) > HOLD_TOLERANCE_PX
      ) {
        cancel();
      }
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(type, cancel);

    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!this.held) this.onHold(event.clientX, event.clientY);
    });
  }
}
