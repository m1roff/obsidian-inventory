/** Words of what is typed, split on whitespace; the last one is the one being typed. */
function lastToken(typed: string): string {
  return typed.split(/\s+/).pop() ?? "";
}

/** The part of a word after an optional leading `-`, if it is a `#tag` in the making. */
function tagPart(word: string): string | null {
  const bare = word.startsWith("-") ? word.slice(1) : word;
  return bare.startsWith("#") ? bare.slice(1) : null;
}

/**
 * The tags to offer while a `#word` (or `-#word`, a tag to leave out) is being typed at the end:
 * those of `available` that start with it, not already used earlier in the text, by name, at most
 * `max`. Nothing when the last word is not a tag in the making.
 */
export function suggestTags(typed: string, available: readonly string[], max: number): string[] {
  const prefix = tagPart(lastToken(typed))?.toLowerCase();
  if (prefix === undefined) return [];

  const used = new Set(
    typed
      .toLowerCase()
      .split(/\s+/)
      .map(tagPart)
      .filter((tag): tag is string => tag !== null),
  );
  const unique = new Map<string, string>();
  for (const tag of available) {
    if (!unique.has(tag.toLowerCase())) unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()]
    .filter((tag) => tag.toLowerCase().startsWith(prefix) && !used.has(tag.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, max);
}

/** The text with the word being typed replaced by the chosen tag (a leading `-` kept), and a space after it for the next word. */
export function withTag(typed: string, tag: string): string {
  const words = typed.split(/\s+/);
  const last = words[words.length - 1];
  words[words.length - 1] = `${last.startsWith("-") ? "-" : ""}#${tag}`;
  return `${words.join(" ")} `;
}
