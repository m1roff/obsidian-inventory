import { Notice, Setting } from "obsidian";
import { labelsCsv, labelsFileName, LabelRow, LabelSelection } from "../domain/LabelExport";
import { saveTextFile } from "./FileDownload";
import { STRINGS } from "./strings";

/** What the list shows for one thing that can get a label. */
export interface LabelSubject {
  readonly path: string;
  readonly name: string;
  /** Empty when the thing has no id yet. */
  readonly id: string;
}

export interface LabelExportConfig<T extends LabelSubject> {
  readonly name: string;
  readonly desc: string;
  readonly emptyText: string;
  /** Goes into the file name: "locations" gives locations-labels_<date>.csv. */
  readonly fileWhat: string;
  /** Called each time the block opens, to read what the list needs once (not on every tick). */
  readonly refresh?: () => void;
  /** Extra controls above the list (a filter); `redraw` shows the list again after a change. */
  readonly drawFilter?: (parent: HTMLElement, redraw: () => void) => void;
  /** The things to list, in the order to show, after the filter. */
  readonly subjects: () => T[];
  /** A line under the list, for what was left out, or null. */
  readonly note?: () => string | null;
  readonly rows: (chosen: T[]) => Promise<LabelRow[]>;
}

/**
 * The settings block that exports labels as a CSV table: a ticked list, select all and
 * deselect all, and the export button. What was unticked is kept while the settings stay
 * open, so a second export does not start from scratch.
 */
export class LabelExportPanel<T extends LabelSubject> {
  private readonly selection = new LabelSelection();
  private busy = false;

  constructor(private readonly config: LabelExportConfig<T>) {}

  render(parent: HTMLElement): void {
    this.config.refresh?.();
    new Setting(parent).setName(this.config.name).setDesc(this.config.desc).setHeading();
    const host = parent.createDiv({ cls: "inventory-ui__export" });
    this.config.drawFilter?.(host, () => this.draw(list));
    const list = host.createDiv();
    this.draw(list);
  }

  private draw(host: HTMLElement): void {
    host.empty();
    const subjects = this.config.subjects();
    if (subjects.length === 0) {
      host.createEl("p", { text: this.config.emptyText, cls: "inventory-ui__export-empty" });
      return;
    }

    const count = host.createDiv({ cls: "inventory-ui__export-count" });
    const actions = new Setting(host)
      .addButton((button) =>
        button.setButtonText(STRINGS.exportSelectAll).onClick(() => {
          this.selection.selectAll();
          this.draw(host);
        }),
      )
      .addButton((button) =>
        button.setButtonText(STRINGS.exportDeselectAll).onClick(() => {
          this.selection.deselectAll(subjects);
          this.draw(host);
        }),
      )
      .addButton((button) =>
        button.setButtonText(STRINGS.exportButton).setCta().onClick(() => {
          void this.export(subjects);
        }),
      );
    const exportEl = actions.controlEl.querySelector<HTMLButtonElement>("button.mod-cta");

    const list = host.createDiv({ cls: "inventory-ui__export-list" });
    for (const subject of subjects) {
      const row = list.createEl("label", { cls: "inventory-ui__export-row" });
      const box = row.createEl("input", { attr: { type: "checkbox" } });
      box.checked = this.selection.isSelected(subject);
      row.createSpan({ text: subject.name, cls: "inventory-ui__export-name" });
      row.createSpan({
        text: subject.id === "" ? STRINGS.exportNoId : subject.id,
        cls: "inventory-ui__export-id",
      });
      box.addEventListener("change", () => {
        this.selection.set(subject, box.checked);
        this.refresh(count, exportEl, subjects);
      });
    }
    const note = this.config.note?.();
    if (note) host.createDiv({ text: note, cls: "inventory-ui__export-count" });
    this.refresh(count, exportEl, subjects);
  }

  /** The counter and whether export makes sense (at least one ticked). */
  private refresh(count: HTMLElement, exportEl: HTMLButtonElement | null, subjects: readonly T[]): void {
    const selected = this.selection.selected(subjects).length;
    count.setText(STRINGS.exportSelectedCount(selected, subjects.length));
    if (exportEl) exportEl.disabled = selected === 0 || this.busy;
  }

  private async export(subjects: readonly T[]): Promise<void> {
    const chosen = this.selection.selected(subjects);
    if (chosen.length === 0 || this.busy) return;
    this.busy = true;
    try {
      const rows = await this.config.rows(chosen);
      const outcome = await saveTextFile(labelsFileName(this.config.fileWhat, new Date()), labelsCsv(rows));
      if (outcome !== "cancelled") new Notice(STRINGS.exportDone(rows.length));
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        // Writing ids took long enough for the phone to forget the tap: they are saved now, a second tap shares at once.
        new Notice(STRINGS.exportTapAgain);
        return;
      }
      console.error(error);
      new Notice(STRINGS.unexpectedError);
    } finally {
      this.busy = false;
    }
  }
}
