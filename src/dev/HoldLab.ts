import { App, Modal, Notice, Plugin, Setting } from "obsidian";
import { DeviceHaptics } from "../obsidian/DeviceHaptics";
import { confirmAction } from "../ui/ConfirmModal";
import { Haptics, HapticDevice, HapticStrength } from "../ui/Haptics";
import {
  DEFAULT_FINAL_STRENGTH,
  DEFAULT_HOLD_MS,
  DEFAULT_HOLD_RAMP,
  HoldConfig,
  HoldGesture,
} from "../ui/HoldGesture";

/**
 * Development only (compiled out of production builds). A bench for the long press: change the
 * hold time and the list of ticks, then hold the pad and feel it. It runs the real HoldGesture
 * with the numbers typed here, and changes nothing anywhere else; when the feel is right,
 * "Copy as code" gives the lines to put into HoldGesture.ts.
 */
export function addHoldLab(plugin: Plugin): void {
  plugin.addCommand({
    id: "dev-hold-lab",
    name: "Dev: long press lab",
    callback: () => new HoldLabModal(plugin.app).open(),
  });
}

/** The bench edits its steps in place. */
interface EditableStep {
  afterMs: number;
  strength: HapticStrength;
}

const STRENGTHS: readonly HapticStrength[] = ["light", "medium", "heavy"];

const STORAGE_KEY = "inventory-ui-dev-hold-lab";

/** What the bench remembers between openings, so a stray tap or a closed window loses nothing. */
interface SavedLab {
  holdMs: number;
  addStepMs: number;
  finalStrength: HapticStrength | null;
  steps: EditableStep[];
}

interface RecordedPulse {
  readonly strength: HapticStrength;
  /** ms from the finger touching down to the moment our code asked for the tick. */
  readonly at: number;
}

/**
 * Sits in front of the real device and writes down when our code asks for each tick. That is the
 * moment of the call, not the moment the motor moves: the phone adds its own delay after it.
 */
class RecordingDevice implements HapticDevice {
  readonly pulses: RecordedPulse[] = [];

  constructor(
    private readonly inner: HapticDevice,
    private readonly sinceTouch: () => number,
  ) {}

  clear(): void {
    this.pulses.length = 0;
  }

  pulse(strength: HapticStrength): void {
    this.pulses.push({ strength, at: this.sinceTouch() });
    this.inner.pulse(strength);
  }
}

class HoldLabModal extends Modal {
  private holdMs = DEFAULT_HOLD_MS;
  /** A new tick goes this many ms after the last one. */
  private addStepMs = 50;
  /** The tick at the moment the hold fires; null for none. */
  private finalStrength: HapticStrength | null = DEFAULT_FINAL_STRENGTH;
  private steps: EditableStep[] = DEFAULT_HOLD_RAMP.map((step) => ({ ...step }));
  private pressStartedAt = 0;
  private readonly recorder = new RecordingDevice(new DeviceHaptics(), () => Math.round(performance.now() - this.pressStartedAt));
  private readonly haptics = new Haptics(this.recorder, () => true);
  private stepsEl: HTMLElement | null = null;
  private topEl: HTMLElement | null = null;
  private warningEl: HTMLElement | null = null;

  constructor(app: App) {
    super(app);
    this.restore();
  }

  private restore(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const saved = (raw ? JSON.parse(raw) : null) as Partial<SavedLab> | null;
      if (!saved || !Array.isArray(saved.steps)) return;
      const steps = saved.steps.filter(
        (step): step is EditableStep =>
          typeof step?.afterMs === "number" && STRENGTHS.includes(step.strength),
      );
      this.steps = steps;
      if (typeof saved.holdMs === "number") this.holdMs = saved.holdMs;
      if (typeof saved.addStepMs === "number") this.addStepMs = saved.addStepMs;
      if (saved.finalStrength === null || STRENGTHS.includes(saved.finalStrength as HapticStrength)) {
        this.finalStrength = saved.finalStrength ?? null;
      }
    } catch {
      // Start from the defaults.
    }
  }

  private persist(): void {
    const saved: SavedLab = {
      holdMs: this.holdMs,
      addStepMs: this.addStepMs,
      finalStrength: this.finalStrength,
      steps: this.steps,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Not remembered: fine for a bench.
    }
  }

  onOpen(): void {
    this.setTitle("Long press lab");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("inventory-ui__lab");
    // The settings and the list scroll above; the buttons and the pad stay where they are.
    const top = contentEl.createDiv({ cls: "inventory-ui__lab-top" });
    const bottom = contentEl.createDiv({ cls: "inventory-ui__lab-bottom" });
    this.topEl = top;

    top.createEl("p", {
      text:
        "Hold time: how long the finger must stay before the menu would open. Ticks: afterMs counts from the " +
        "moment the finger touches down (not from the previous tick); strength is how hard the knock is, a tick " +
        "itself is an instant knock with no length. A tick at or after the hold time never plays.",
    });

    new Setting(top)
      .setName("Hold time (ms)")
      .addText((text) => {
        text.inputEl.type = "number";
        text.setValue(String(this.holdMs)).onChange((value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) this.holdMs = parsed;
          this.persist();
          this.checkSteps();
        });
      });

    new Setting(top)
      .setName("Final tick")
      .setDesc("The knock at the moment the hold fires (the menu would open). Not part of the list. Set none to feel only the list.")
      .addButton((button) => {
        const label = (): string => this.finalStrength ?? "none";
        button.setButtonText(label()).onClick(() => {
          const order: Array<HapticStrength | null> = [null, ...STRENGTHS];
          this.finalStrength = order[(order.indexOf(this.finalStrength) + 1) % order.length];
          button.setButtonText(label());
          this.persist();
        });
      });

    new Setting(top)
      .setName("New tick step (ms)")
      .setDesc("\"Add tick\" puts the new tick this many ms after the last one.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.setValue(String(this.addStepMs)).onChange((value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) this.addStepMs = parsed;
          this.persist();
        });
      });

    this.stepsEl = top.createDiv();
    this.warningEl = top.createEl("p", { cls: "inventory-ui__error" });
    this.drawSteps();

    new Setting(bottom)
      .addButton((button) =>
        button.setButtonText("Add tick").onClick(() => {
          const last = this.steps[this.steps.length - 1];
          // The new tick is as strong as the one it follows.
          this.steps.push({ afterMs: (last?.afterMs ?? 0) + this.addStepMs, strength: last?.strength ?? "light" });
          this.persist();
          this.drawSteps();
          // The new tick is at the end of the list: bring it into view, the buttons do not move.
          this.topEl?.scrollTo({ top: this.topEl.scrollHeight });
        }),
      )
      .addButton((button) =>
        button.setButtonText("Reset").onClick(() => {
          confirmAction(this.app, {
            title: "Reset the lab?",
            message: "The hold time, the final tick, the step and the whole list of ticks go back to the values in HoldGesture.ts. What you set here is lost.",
            confirmLabel: "Reset",
            onConfirm: () => {
              this.holdMs = DEFAULT_HOLD_MS;
              this.addStepMs = 50;
              this.finalStrength = DEFAULT_FINAL_STRENGTH;
              this.steps = DEFAULT_HOLD_RAMP.map((step) => ({ ...step }));
              this.persist();
              this.onOpen();
            },
          });
        }),
      )
      .addButton((button) =>
        button.setButtonText("Copy as code").onClick(() => {
          void navigator.clipboard.writeText(this.asCode());
          new Notice("Copied: paste it into HoldGesture.ts");
        }),
      );

    const pad = bottom.createDiv({ cls: "inventory-ui__lab-pad" });
    const timings = bottom.createDiv({ cls: "inventory-ui__lab-timings" });
    const clock = pad.createDiv({ cls: "inventory-ui__lab-clock", text: "Hold here" });
    const log = pad.createDiv({ cls: "inventory-ui__lab-log" });

    // The live counter runs only while a finger is down: one frame callback per screen refresh.
    let startedAt = 0;
    let frame: number | null = null;
    let firedAt: number | null = null;
    const elapsed = (): number => Math.round(performance.now() - startedAt);
    const tick = (): void => {
      clock.setText(`${elapsed()} ms`);
      frame = window.requestAnimationFrame(tick);
    };
    const stop = (): void => {
      if (frame === null) return;
      window.cancelAnimationFrame(frame);
      frame = null;
      const released = elapsed();
      clock.setText(`${released} ms`);
      log.setText(
        firedAt === null
          ? `Released at ${released} ms, before the hold time (${this.holdMs} ms): no long press`
          : `Long press fired at ${firedAt} ms, released at ${released} ms`,
      );
      this.showTimings(timings, firedAt);
    };

    // Registered before the gesture's own listener, so the first tick is timed from the touch itself.
    pad.addEventListener("pointerdown", () => {
      this.pressStartedAt = performance.now();
      this.recorder.clear();
    });
    new HoldGesture(pad, this.haptics, () => this.config(), () => {
      firedAt = elapsed();
      new Notice("Long press worked: the menu would open here");
    });
    pad.addEventListener("pointerdown", () => {
      startedAt = performance.now();
      firedAt = null;
      log.setText("");
      if (frame === null) tick();
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) pad.addEventListener(type, stop);
  }

  /**
   * After a press: when our code asked for each tick, against when it was planned. The call is
   * made by a timer, so it can run a few ms late; the motor then adds its own delay.
   */
  private showTimings(el: HTMLElement, firedAt: number | null): void {
    el.empty();
    const planned = [...this.steps]
      .filter((step) => step.afterMs < this.holdMs)
      .sort((a, b) => a.afterMs - b.afterMs)
      .map((step) => step.afterMs);
    if (this.finalStrength !== null && firedAt !== null) planned.push(this.holdMs);

    this.recorder.pulses.forEach((pulse, index) => {
      const plan = planned[index];
      const late = plan === undefined ? "" : ` (planned ${plan} ms, ${pulse.at - plan >= 0 ? "+" : ""}${pulse.at - plan} ms)`;
      el.createDiv({ text: `Tick ${index + 1}, ${pulse.strength}: asked at ${pulse.at} ms${late}` });
    });
    if (this.recorder.pulses.length === 0) {
      el.createDiv({ text: "No tick was asked for." });
    }
  }

  private config(): HoldConfig {
    return { holdMs: this.holdMs, ramp: this.steps, finalStrength: this.finalStrength };
  }

  private drawSteps(): void {
    const el = this.stepsEl;
    if (!el) return;
    el.empty();
    this.steps.forEach((step, index) => {
      new Setting(el)
        .setName(`Tick ${index + 1}`)
        .addText((text) => {
          text.inputEl.type = "number";
          text.setValue(String(step.afterMs)).onChange((value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed >= 0) step.afterMs = parsed;
            this.persist();
            this.checkSteps();
          });
        })
        .addButton((button) =>
          button.setButtonText(step.strength).onClick(() => {
            step.strength = STRENGTHS[(STRENGTHS.indexOf(step.strength) + 1) % STRENGTHS.length];
            button.setButtonText(step.strength);
            this.persist();
          }),
        )
        .addButton((button) =>
          button.setButtonText("Remove").onClick(() => {
            this.steps.splice(index, 1);
            this.persist();
            this.drawSteps();
          }),
        );
    });
    this.checkSteps();
  }

  private checkSteps(): void {
    const late = this.steps.filter((step) => step.afterMs >= this.holdMs);
    this.warningEl?.setText(
      late.length === 0 ? "" : `${late.length} tick(s) are at or after the hold time and will never play.`,
    );
  }

  private asCode(): string {
    const ramp = [...this.steps]
      .sort((a, b) => a.afterMs - b.afterMs)
      .map((step) => `  { afterMs: ${step.afterMs}, strength: "${step.strength}" },`)
      .join("\n");
    return `export const DEFAULT_HOLD_MS = ${this.holdMs};\n\nexport const DEFAULT_FINAL_STRENGTH: HapticStrength | null = ${this.finalStrength === null ? "null" : `"${this.finalStrength}"`};\n\nexport const DEFAULT_HOLD_RAMP: readonly HapticStep[] = [\n${ramp}\n];\n`;
  }
}
