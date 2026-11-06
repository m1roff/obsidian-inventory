import { describe, expect, it } from "vitest";
import { Haptics, HapticStrength } from "../../src/ui/Haptics";

function setup(enabled = true) {
  const played: HapticStrength[] = [];
  const scheduled = new Map<number, () => void>();
  let next = 1;
  const timers = {
    set: (run: () => void) => {
      scheduled.set(next, run);
      return next++;
    },
    clear: (id: number) => void scheduled.delete(id),
  };
  const state = { enabled };
  const haptics = new Haptics({ pulse: (s) => void played.push(s) }, () => state.enabled, timers);
  return { haptics, played, scheduled, state };
}

describe("Haptics", () => {
  it("ticks only when it is on", () => {
    const { haptics, played, state } = setup();
    haptics.tap();
    state.enabled = false;
    haptics.tap("heavy");
    expect(played).toEqual(["light"]);
  });

  it("never throws when the device fails", () => {
    const haptics = new Haptics({ pulse: () => { throw new Error("no"); } }, () => true);
    expect(() => haptics.tap()).not.toThrow();
  });

  it("plays a ramp step by step, and a stopped ramp plays no more", () => {
    const { haptics, played, scheduled } = setup();
    const stop = haptics.ramp([
      { afterMs: 100, strength: "light" },
      { afterMs: 200, strength: "medium" },
    ]);
    const [first, second] = [...scheduled.values()];
    first();
    stop();
    expect(scheduled.size).toBe(0);
    expect(played).toEqual(["light"]);
    second?.();
  });

  it("schedules nothing for a ramp when it is off", () => {
    const { haptics, scheduled } = setup(false);
    haptics.ramp([{ afterMs: 100, strength: "light" }])();
    expect(scheduled.size).toBe(0);
  });
});

describe("Haptics deny", () => {
  it("knocks twice, firmly", () => {
    const { haptics, played, scheduled } = setup();
    haptics.deny();
    [...scheduled.values()].forEach((run) => run());
    expect(played).toEqual(["heavy", "heavy"]);
  });
});
