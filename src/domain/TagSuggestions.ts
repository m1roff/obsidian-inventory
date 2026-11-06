/** Words of what is typed, split on whitespace; the last one is the one being typed. */
function lastToken(typed: string): string {
  return typed.split(/\s+/).pop() ?? "";
}

/**
 * The tags to offer while a `#word` is being typed at the end: those of `available` that start
 * with it, not already used earlier in the text, by name, at most `max`. Nothing when the last word
 * is not a tag in the making.
 */
export function suggestTags(typed: string, available: readonly string[], max: number): string[] {
  const token = lastToken(typed);
  if (!token.startsWith("#")) return [];

  const prefix = token.slice(1).toLowerCase();
  const used = new Set(
    typed
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.startsWith("#"))
      .map((word) => word.slice(1)),
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

/** The text with the word being typed replaced by the chosen tag, and a space after it for the next word. */
export function withTag(typed: string, tag: string): string {
  const words = typed.split(/\s+/);
  words[words.length - 1] = `#${tag}`;
  return `${words.join(" ")} `;
}
