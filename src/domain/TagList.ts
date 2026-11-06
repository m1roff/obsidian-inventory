/** Tags as a list of plain names from a property: a list, or a single text, anything else is none. */
export function parseTagList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string" || typeof raw === "number") {
    const single = String(raw).trim();
    return single === "" ? [] : [single];
  }
  return [];
}

/** A tag as stored: no leading hashes, no spaces around; null when nothing is left or it has a space inside. */
export function cleanTag(raw: string): string | null {
  const clean = raw.replace(/^#+/, "").trim();
  return clean === "" || /\s/.test(clean) ? null : clean;
}

/**
 * One cloud of tags from several lists (the tags list, the tags written on items and places):
 * cleaned, each name once (any case), first spelling kept, in the order met. Obsidian does not
 * treat anything with a space as a tag, so such names are dropped.
 */
export function mergeTagNames(...lists: ReadonlyArray<readonly string[]>): string[] {
  const all = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      const clean = cleanTag(raw);
      if (clean !== null && !all.has(clean.toLowerCase())) all.set(clean.toLowerCase(), clean);
    }
  }
  return [...all.values()];
}
