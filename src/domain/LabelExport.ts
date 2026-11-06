import { formatStamp } from "./Clock";
import { buildPlaceLink } from "./ItemLink";
import { Place } from "./Place";
import { PlaceIds } from "./PlaceIds";

/** One label in the table a label printer program reads: what to print and what the code carries. */
export interface LabelRow {
  readonly id: string;
  readonly name: string;
  readonly link: string;
}

export const LABEL_COLUMNS = ["id", "name", "link"] as const;

/** File name of an export: what it holds, then the local date and time down to the second. */
export function labelsFileName(what: string, date: Date): string {
  return `${what}-labels_${formatStamp(date)}.csv`;
}

/** A CSV field: quoted when it holds a comma, a quote or a line break, quotes doubled. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The table as CSV text: a header line, then one line per label. */
export function labelsCsv(rows: readonly LabelRow[]): string {
  const lines = [LABEL_COLUMNS.join(","), ...rows.map((row) => LABEL_COLUMNS.map((column) => csvField(row[column])).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Which places are left out of an export (for example the ones already printed).
 * It remembers what is left OUT, so a place added later is ticked by default.
 */
export class LabelSelection {
  private readonly excluded = new Set<string>();

  isSelected(place: Place): boolean {
    return !this.excluded.has(place.path);
  }

  set(place: Place, selected: boolean): void {
    if (selected) this.excluded.delete(place.path);
    else this.excluded.add(place.path);
  }

  selectAll(): void {
    this.excluded.clear();
  }

  deselectAll(places: readonly Place[]): void {
    for (const place of places) this.excluded.add(place.path);
  }

  selected(places: readonly Place[]): Place[] {
    return places.filter((place) => this.isSelected(place));
  }
}

/** Builds the label table for places. A place without an id gets one first, like on its QR button. */
export class LocationLabelExport {
  constructor(private readonly placeIds: PlaceIds) {}

  async rows(places: readonly Place[], vaultName: string): Promise<LabelRow[]> {
    const ids = await this.placeIds.ensureMany(places);
    return places.map((place, index) => ({
      id: ids[index] ?? "",
      name: place.name,
      link: buildPlaceLink(vaultName, ids[index] ?? ""),
    }));
  }
}
