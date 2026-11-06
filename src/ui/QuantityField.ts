import { Setting } from "obsidian";
import { Haptics } from "./Haptics";

export interface QuantityFieldOptions {
  readonly initial: string;
  /** Upper bound for the stepper and the typed value. */
  readonly max?: number;
  readonly onChange: (value: string) => void;
  readonly onEnter?: () => void;
  /** A tick for each step, and a "not allowed" knock at the lower or upper bound. */
  readonly haptics?: Haptics;
}

/**
 * Quantity with - and + buttons. On a phone the number keypad has no "done"
 * key and covers the lower part of a modal, so most changes should not need it.
 */
export class QuantityField {
  private readonly input: HTMLInputElement;
  private max: number | null;

  constructor(
    parent: HTMLElement,
    label: string,
    private readonly options: QuantityFieldOptions,
  ) {
    this.max = options.max ?? null;

    const setting = new Setting(parent).setName(label);
    const control = setting.controlEl;
    control.addClass("inventory-ui__stepper");

    const minus = control.createEl("button", {
      cls: "inventory-ui__step",
      text: "−",
      attr: { "aria-label": "-1" },
    });
    this.input = control.createEl("input", {
      cls: "inventory-ui__quantity-input",
      type: "number",
    });
    const plus = control.createEl("button", {
      cls: "inventory-ui__step",
      text: "+",
      attr: { "aria-label": "+1" },
    });

    this.input.min = "1";
    this.input.step = "1";
    this.input.inputMode = "numeric";
    this.input.value = options.initial;

    this.input.addEventListener("input", () => options.onChange(this.input.value));
    this.input.addEventListener("focus", () => {
      // Once the keyboard is up, bring the field back into view above it.
      window.setTimeout(
        () => this.input.scrollIntoView({ block: "center", behavior: "smooth" }),
        300,
      );
      this.input.select();
    });
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && options.onEnter) {
        event.preventDefault();
        options.onEnter();
      }
    });
    minus.addEventListener("click", () => this.step(-1, minus));
    plus.addEventListener("click", () => this.step(1, plus));
  }

  /** Changes the upper bound and pulls the current value down if it is above it. */
  setMax(max: number): void {
    this.max = max;
    if (Number(this.input.value) > max) this.set(max);
  }

  private step(delta: number, button: HTMLElement): void {
    const current = Number.isFinite(Number(this.input.value)) ? Number(this.input.value) : 0;
    const next = Math.max(1, current + delta);
    const bounded = this.max === null ? next : Math.min(this.max, next);
    if (bounded === current) {
      this.refuse(button);
      return;
    }
    this.options.haptics?.tap("light");
    this.set(bounded);
  }

  /** The value cannot go that way: the button shakes (and knocks on a phone) instead of doing nothing. */
  private refuse(button: HTMLElement): void {
    this.options.haptics?.deny();
    button.removeClass("is-refused");
    // Reading a layout property restarts the animation when it is pressed again at once.
    void button.offsetWidth;
    button.addClass("is-refused");
    button.addEventListener("animationend", () => button.removeClass("is-refused"), { once: true });
  }

  private set(value: number): void {
    this.input.value = String(value);
    this.options.onChange(this.input.value);
  }
}
