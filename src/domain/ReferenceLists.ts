import { Place } from "./Place";

/** Names a new item can be filed under. */
export interface ReferenceLists {
  kinds(): string[];
  /** Tags the owner has in the list (notes in the tags folder). */
  tags(): string[];
  locations(): string[];
  /** The same locations as notes: with their path and id. */
  places(): Place[];
}
