import { parseWikiLink } from "./WikiLink";

/** A location note: where stock can lie. `id` is empty until one is assigned. */
export interface Place {
  readonly name: string;
  readonly path: string;
  readonly id: string;
  /** Vault path of the place's photo (its `cover`), or null. */
  readonly cover: string | null;
  /** The tags written on the place's note: the same cloud as the items' ones. */
  readonly tags: readonly string[];
  /** The name of the location this one stands inside (its `parent` link), or null. */
  readonly parent: string | null;
}

/**
 * The name a `parent` property points at: `[[Pantry]]` or `[[Lists/Pantry|Pantry]]` give
 * "Pantry". Anything that is not a link, or an empty one, is no parent.
 */
export function parsePlaceParent(raw: unknown): string | null {
  const link = parseWikiLink(raw);
  if (link === null) return null;
  const last = link.target.split("/").pop() ?? "";
  const name = last.replace(/\.md$/i, "").trim();
  return name === "" ? null : name;
}
