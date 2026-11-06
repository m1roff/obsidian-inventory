import { AddItemError, NewItemDraft } from "../domain/NewItemDraft";
import { AddReferenceError, AddReferenceService } from "../domain/AddReferenceService";
import { AddItemService } from "../domain/AddItemService";

const KINDS = ["Tool", "Consumables", "Fasteners"];
const LOCATIONS = ["Garage shelf", "Workshop box", "Kitchen drawer"];
const ITEMS = [
  { name: "Hex key set", kind: "Tool", location: "Garage shelf", quantity: 1 },
  { name: "Screwdriver Phillips", kind: "Tool", location: "Kitchen drawer", quantity: 2 },
  { name: "Super glue", kind: "Consumables", location: "Workshop box", quantity: 3 },
  { name: "Duct tape", kind: "Consumables", location: "Garage shelf", quantity: 2 },
  { name: "Cable ties", kind: "Consumables", location: "Kitchen drawer", quantity: 100 },
  { name: "M3 bolts", kind: "Fasteners", location: "Workshop box", quantity: 50 },
  { name: "M4 nuts", kind: "Fasteners", location: "Workshop box", quantity: 40 },
  { name: "Wood screws 4x30", kind: "Fasteners", location: "Garage shelf", quantity: 25 },
];

export interface SeedResult {
  readonly added: number;
  readonly skipped: number;
}

/**
 * Development only: a few kinds, locations and items, made with the plugin's own
 * services (so ids and notes are exactly what real use makes). It works on a phone,
 * where the reset script cannot run. Safe to run twice: what exists is skipped.
 */
export class SampleDataSeeder {
  constructor(
    private readonly references: AddReferenceService,
    private readonly items: AddItemService,
  ) {}

  async seed(): Promise<SeedResult> {
    let added = 0;
    let skipped = 0;

    for (const name of KINDS) {
      (await this.tryAdd(() => this.references.add("kind", name), AddReferenceError)) ? added++ : skipped++;
    }
    for (const name of LOCATIONS) {
      (await this.tryAdd(() => this.references.add("location", name), AddReferenceError)) ? added++ : skipped++;
    }
    for (const item of ITEMS) {
      const draft = NewItemDraft.create(item);
      (await this.tryAdd(() => this.items.add(draft), AddItemError)) ? added++ : skipped++;
    }
    return { added, skipped };
  }

  /** True when added; false when it was already there (a "name taken" answer). */
  private async tryAdd(
    action: () => Promise<unknown>,
    expected: typeof AddReferenceError | typeof AddItemError,
  ): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (error) {
      if (error instanceof expected && error.code === "name-taken") return false;
      throw error;
    }
  }
}
