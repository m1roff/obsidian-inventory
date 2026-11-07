import { SelectOption } from "./OptionList";
import { Place } from "./Place";
import { PlaceTree } from "./PlaceTree";

/** Names a new item can be filed under. */
export interface ReferenceLists {
  kinds(): string[];
  /** Tags the owner has in the list (notes in the tags folder). */
  tags(): string[];
  locations(): string[];
  /** The same locations as notes: with their path and id. */
  places(): Place[];
  /** The locations as a tree: which stands inside which. */
  placeTree(): PlaceTree;
  /** The locations as list options, labelled with their path ("Pantry › Box"). */
  locationOptions(): SelectOption[];
}
