import { Notice, Setting } from "obsidian";
import { labelsCsv, labelsFileName, LabelSelection, LocationLabelExport } from "../domain/LabelExport";
import { Place } from "../domain/Place";
import { saveTextFile } from "./FileDownload";
import { STRINGS } from "./strings";

export interface LocationExportDeps {
  readonly places: () => Place[];
  readonly vaultName: () => string;
  readonly exporter: LocationLabelExport;
}

/**
 * The settings block that exports labels of locations: a ticked list, select all and
 * deselect all, and the export button. What was unticked is kept while the settings stay
 * open, so a second export does not start from scratch.
 */
export class LocationExportPanel {
  private readonly selection = new LabelSelection();
  private busy = false;

  constructor(private readonly deps: LocationExportDeps) {}

  render(parent: HTMLElement): void {
    new Setting(parent).setName(STRINGS.exportLocationsName).setDesc(STRINGS.exportLocationsDesc).setHeading();
    const host = parent.createDiv({ cls: "inventory-ui__export" });
    this.draw(host);
  }

  private draw(host: HTMLElement): void {
    host.empty();
    const places = this.deps
      .places()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (places.length === 0) {
      host.createEl("p", { text: STRINGS.exportNoPlaces, cls: "inventory-ui__export-empty" });
      return;
    }

    const count = host.createDiv({ cls: "inventory-ui__export-count" });
    const exportButton = new Setting(host)
      .addButton((button) =>
        button.setButtonText(STRINGS.exportSelectAll).onClick(() => {
          this.selection.selectAll();
          this.draw(host);
        }),
      )
      .addButton((button) =>
        button.setButtonText(STRINGS.exportDeselectAll).onClick(() => {
          this.selection.deselectAll(places);
          this.draw(host);
        }),
      )
      .addButton((button) => {
        button.setButtonText(STRINGS.exportButton).setCta().onClick(() => {
          void this.export(places);
        });
        return button;
      });
    const exportEl = exportButton.controlEl.querySelector<HTMLButtonElement>("button.mod-cta");

    const list = host.createDiv({ cls: "inventory-ui__export-list" });
    for (const place of places) {
      const row = list.createEl("label", { cls: "inventory-ui__export-row" });
      const box = row.createEl("input", { attr: { type: "checkbox" } });
      box.checked = this.selection.isSelected(place);
      row.createSpan({ text: place.name, cls: "inventory-ui__export-name" });
      row.createSpan({
        text: place.id === "" ? STRINGS.exportNoId : place.id,
        cls: "inventory-ui__export-id",
      });
      box.addEventListener("change", () => {
        this.selection.set(place, box.checked);
        this.refresh(count, exportEl, places);
      });
    }
    this.refresh(count, exportEl, places);
  }

  /** The counter and whether export makes sense (at least one location ticked). */
  private refresh(count: HTMLElement, exportEl: HTMLButtonElement | null, places: readonly Place[]): void {
    const selected = this.selection.selected(places).length;
    count.setText(STRINGS.exportSelectedCount(selected, places.length));
    if (exportEl) exportEl.disabled = selected === 0 || this.busy;
  }

  private async export(places: readonly Place[]): Promise<void> {
    const chosen = this.selection.selected(places);
    if (chosen.length === 0 || this.busy) return;
    this.busy = true;
    try {
      const rows = await this.deps.exporter.rows(chosen, this.deps.vaultName());
      const outcome = await saveTextFile(labelsFileName("locations", new Date()), labelsCsv(rows));
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
