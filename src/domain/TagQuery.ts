/** The tags a search query asks for: each `#word` (lone `#` is the start of typing and asks for nothing), lowercase, without the hash. */
export function queryTags(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.startsWith("#") && word.length > 1)
    .map((word) => word.slice(1));
}

/** Whether a thing with these own tags has, for every wanted tag, a tag that starts with it. */
export function tagsMatch(own: readonly string[], wanted: readonly string[]): boolean {
  if (wanted.length === 0) return true;
  const lower = own.map((tag) => tag.toLowerCase());
  return wanted.every((tag) => lower.some((candidate) => candidate.startsWith(tag)));
}
