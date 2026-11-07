import { ReferenceLists } from "../../src/domain/ReferenceLists";
import { PlaceTree } from "../../src/domain/PlaceTree";

/** A full ReferenceLists for a test: the tree and the options are derived from the places. */
export function completeLists(base: Omit<ReferenceLists, "placeTree" | "locationOptions">): ReferenceLists {
  return {
    ...base,
    placeTree: () => new PlaceTree(base.places()),
    locationOptions: () => new PlaceTree(base.places()).options(base.locations()),
  };
}
