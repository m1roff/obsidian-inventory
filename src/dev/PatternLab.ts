import { App, Modal, Notice, Plugin, Setting } from "obsidian";

/**
 * Development only (compiled out of production builds). A bench for raw vibration patterns:
 * you type the numbers, press Play, and the phone plays them with one `navigator.vibrate` call.
 * Nothing here is used by the plugin itself.
 */
export function addPatternLab(plugin: Plugin): void {
  plugin.addCommand({
    id: "dev-pattern-lab",
    name: "Dev: vibration pattern lab",
    callback: () => new PatternLabModal(plugin.app).open(),
  });
}

const STORAGE_KEY = "inventory-ui-dev-patterns";
const DEFAULT_PATTERNS = ["30", "40, 30, 40", "20, 10, 20, 10, 20, 10, 60"];

/** "40, 30, 40" -> [40, 30, 40]; null when something is not a number of ms. */
function parsePattern(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter((part) => part !== "");
  if (parts.length === 0) return null;
  const numbers = parts.map(Number);
  return numbers.every((n) => Number.isFinite(n) && n >= 0) ? numbers : null;
}

/** The same numbers in words: what the phone will do. */
function describe(pattern: number[]): string {
  const steps = pattern.map((ms, index) => `${index % 2 === 0 ? "buzz" : "silence"} ${ms}`);
  const total = pattern.reduce((sum, ms) => sum + ms, 0);
  return `${steps.join(", ")}. Total ${total} ms.`;
}

class PatternLabModal extends Modal {
  private patterns: string[];

  constructor(app: App) {
    super(app);
    this.patterns = this.load();
  }

  onOpen(): void {
    this.setTitle("Vibration pattern lab");
    this.draw();
  }

  private draw(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("p", {
      text:
        "A pattern is a list of numbers in milliseconds: how long to buzz, how long to stay silent, how long to " +
        "buzz, how long to stay silent, and so on. It always starts with a buzz. Example: 100, 50, 100 means " +
        "buzz 100 ms, silence 50 ms, buzz 100 ms. Separate numbers with commas or spaces. The whole list goes " +
        "to the phone in one call, and the phone plays it by itself.",
    });

    this.patterns.forEach((text, index) => {
      const row = new Setting(contentEl).setName(`Pattern ${index + 1}`);
      const hint = row.descEl.createDiv();
      const explain = (value: string): void => {
        const parsed = parsePattern(value);
        hint.setText(parsed ? describe(parsed) : "Not a list of numbers");
      };
      explain(text);
      row
        .addText((input) => {
          input.setValue(text).onChange((value) => {
            this.patterns[index] = value;
            this.save();
            explain(value);
          });
        })
        .addButton((button) =>
          button
            .setButtonText("Play")
            .setCta()
            .onClick(() => this.play(this.patterns[index])),
        )
        .addButton((button) =>
          button.setButtonText("Remove").onClick(() => {
            this.patterns.splice(index, 1);
            this.save();
            this.draw();
          }),
        );
    });

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText("Add pattern").onClick(() => {
          this.patterns.push("50, 50, 50");
          this.save();
          this.draw();
        }),
      )
      .addButton((button) => button.setButtonText("Stop").onClick(() => navigator.vibrate(0)));
  }

  private play(text: string): void {
    const pattern = parsePattern(text);
    if (!pattern) {
      new Notice("Not a list of numbers");
      return;
    }
    if (typeof navigator.vibrate !== "function") {
      new Notice("This device has no navigator.vibrate");
      return;
    }
    const accepted = navigator.vibrate(pattern);
    new Notice(`Playing: ${pattern.join(", ")} (phone says ${String(accepted)})`);
  }

  private load(): string[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
        return parsed;
      }
    } catch {
      // Start from the examples.
    }
    return [...DEFAULT_PATTERNS];
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.patterns));
    } catch {
      // Not remembered between openings: fine for a bench.
    }
  }
}
