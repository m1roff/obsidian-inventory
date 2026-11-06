import { InventoryEntry } from "./InventoryEntry";
import { Place } from "./Place";

/** The part after `obsidian://` that routes a link to this plugin. */
export const ITEM_LINK_ACTION = "inventory-ui";

/**
 * The text a QR label carries. It points at the item by its id (not by file
 * name), so renaming the note does not break labels that are already stuck on.
 */
export function buildItemLink(vaultName: string, id: string): string {
  return linkWith(vaultName, "id", id);
}

/** Same for a place; the `place` parameter tells the two kinds of label apart. */
export function buildPlaceLink(vaultName: string, id: string): string {
  return linkWith(vaultName, "place", id);
}

function linkWith(vaultName: string, key: string, id: string): string {
  const vault = encodeURIComponent(vaultName);
  return `obsidian://${ITEM_LINK_ACTION}?vault=${vault}&${key}=${encodeURIComponent(id)}`;
}

export type ScannedCode =
  | { readonly kind: "item"; readonly id: string }
  | { readonly kind: "place"; readonly id: string };

/**
 * What scanned text points at: an item or a place, from our link; any other
 * text is taken as an item id itself (e.g. a plain QR with the id written in
 * it). Null if empty.
 */
export function parseScanned(scanned: string): ScannedCode | null {
  const text = scanned.trim();
  if (text === "") return null;

  if (text.startsWith(`obsidian://${ITEM_LINK_ACTION}`)) {
    const params = new URLSearchParams(text.split("?")[1] ?? "");
    const place = params.get("place")?.trim() ?? "";
    if (place !== "") return { kind: "place", id: place };
    const id = params.get("id")?.trim() ?? "";
    return id === "" ? null : { kind: "item", id };
  }
  return { kind: "item", id: text };
}

export function findEntryById(
  entries: readonly InventoryEntry[],
  id: string,
): InventoryEntry | undefined {
  const wanted = id.trim().toLowerCase();
  return entries.find((entry) => entry.item.id.trim().toLowerCase() === wanted);
}

export function findPlaceById(places: readonly Place[], id: string): Place | undefined {
  const wanted = id.trim().toLowerCase();
  return wanted === "" ? undefined : places.find((place) => place.id.trim().toLowerCase() === wanted);
}
