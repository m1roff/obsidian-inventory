import type { StructureLayout } from "../structure/StructureLayout";
import type { FileClassSpec, FileSpec } from "../structure/StructureSkeleton";
import type { StockStatePolicy } from "../StockState";

/**
 * An optional part of the structure the owner can turn on (for example filament).
 * It adds its own class notes and Bases files to the skeleton; the core knows nothing about it.
 */
export interface StructureModule {
  readonly id: string;
  /** A short name for the interface. */
  readonly title: string;
  fileClasses(layout: StructureLayout): FileClassSpec[];
  files(layout: StructureLayout, states: StockStatePolicy): FileSpec[];
}
