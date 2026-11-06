import { App } from "obsidian";
import { Clock } from "../domain/Clock";
import { DebugLog, formatLogLine } from "../domain/DebugLog";

/** Past this size the older half of the file is dropped, so a forgotten switch cannot fill the phone. */
const MAX_CHARS = 300_000;

/**
 * The debug log as a text file in the plugin's own folder (hidden from the notes list, kept out
 * of the vault's content). Nothing is written while the switch is off. Lines are appended one at
 * a time in order; events are rare (a photo, a tap), so there is no timer and no polling.
 */
export class FileDebugLog implements DebugLog {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly app: App,
    private readonly path: string,
    private readonly isOn: () => boolean,
    private readonly clock: Clock,
  ) {}

  get enabled(): boolean {
    return this.isOn();
  }

  write(scope: string, message: string, details?: Record<string, unknown>): void {
    if (!this.isOn()) return;
    const line = `${formatLogLine(this.clock.now(), scope, message, details)}\n`;
    this.queue = this.queue.then(() => this.append(line)).catch((error: unknown) => {
      console.error("Could not write the debug log", error);
    });
  }

  /** The whole log, or an empty text when nothing was written yet. */
  async read(): Promise<string> {
    await this.queue;
    const adapter = this.app.vault.adapter;
    return (await adapter.exists(this.path)) ? adapter.read(this.path) : "";
  }

  async clear(): Promise<void> {
    await this.queue;
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(this.path)) await adapter.remove(this.path);
  }

  private async append(line: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    const stat = await adapter.stat(this.path);
    if (stat && stat.size > MAX_CHARS) {
      const text = await adapter.read(this.path);
      await adapter.write(this.path, text.slice(Math.floor(text.length / 2)));
    }
    await adapter.append(this.path, line);
  }
}
