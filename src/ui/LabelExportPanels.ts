import { App } from "obsidian";
import { InventoryEntry } from "../domain/InventoryEntry";
import { itemLabelRows, LocationLabelExport } from "../domain/LabelExport";
import { entriesInLocation } from "../domain/LocationBoard";
import { Item } from "../domain/Item";
import { Place } from "../domain/Place";
import { searchableItem, searchablePlace } from "../domain/SearchQuery";
import { LabelExportPanel } from "./LabelExportPanel";
import { SelectField } from "./SelectField";
import { STRINGS } from "./strings";

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export interface LocationExportDeps {
  readonly places: () => Place[];
  readonly vaultName: () => string;
  readonly exporter: LocationLabelExport;
}

/** The export block for locations. */
export function locationExportPanel(deps: LocationExportDeps): LabelExportPanel<Place> {
  return new LabelExportPanel<Place>({
    name: STRINGS.exportLocationsName,
    desc: STRINGS.exportLocationsDesc,
    emptyText: STRINGS.exportNoPlaces,
    fileWhat: "locations",
    subjects: () => deps.places().slice().sort(byName),
    searchable: searchablePlace,
    rows: (chosen) => deps.exporter.rows(chosen, deps.vaultName()),
  });
}

export interface ItemExportDeps {
  readonly app: App;
  readonly entries: () => readonly InventoryEntry[];
  readonly locations: () => string[];
  readonly vaultName: () => string;
  readonly searchThreshold: () => number;
}

/**
 * The export block for items, with a filter by location (items that have units in stock there).
 * The vault is read once, when the block opens; items without an id are skipped, as a label
 * needs an id to point at.
 */
export function itemExportPanel(deps: ItemExportDeps): LabelExportPanel<Item> {
  let entries: readonly InventoryEntry[] = [];
  let location = "";
  let withoutId = 0;

  return new LabelExportPanel<Item>({
    name: STRINGS.exportItemsName,
    desc: STRINGS.exportItemsDesc,
    emptyText: STRINGS.exportNoItems,
    fileWhat: "items",
    refresh: () => {
      entries = deps.entries();
    },
    drawFilter: (parent, redraw) => {
      const field = new SelectField(deps.app, parent, {
        searchThreshold: deps.searchThreshold,
        label: STRINGS.exportItemsLocation,
        alphabetical: false,
        options: () => [
          { value: "", label: STRINGS.exportAllLocations },
          ...deps
            .locations()
            .slice()
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
            .map((name) => ({ value: name, label: name })),
        ],
        value: location,
        onChange: (value) => {
          location = value;
          redraw();
        },
      });
      field.setting.setDesc(STRINGS.exportItemsLocationDesc);
      field.setting.settingEl.addClass("inventory-ui__select-inline");
    },
    subjects: () => {
      const pool = location === "" ? entries : entriesInLocation(entries, location);
      const items = pool.map((entry) => entry.item);
      withoutId = items.filter((item) => item.id.trim() === "").length;
      return items.filter((item) => item.id.trim() !== "").sort(byName);
    },
    searchable: searchableItem,
    note: () => (withoutId > 0 ? STRINGS.exportItemsSkipped(withoutId) : null),
    rows: (chosen) => Promise.resolve(itemLabelRows(chosen, deps.vaultName())),
  });
}
