export interface WikiLink {
  readonly target: string;
  readonly alias: string | null;
}

/**
 * Parses a frontmatter value like `[[Folder/Note|Alias]]` or `[[Note#Heading]]`.
 * Returns null for anything that is not a non-empty wiki link.
 */
export function parseWikiLink(raw: unknown): WikiLink | null {
  if (typeof raw !== "string") return null;

  const match = /^\s*\[\[([^\]]*)\]\]\s*$/.exec(raw);
  if (!match) return null;

  const [rawTarget, rawAlias] = match[1].split("|", 2);
  const target = rawTarget.split("#", 1)[0].trim();
  if (target === "") return null;

  const alias = rawAlias?.trim() ?? "";
  return { target, alias: alias === "" ? null : alias };
}

/** Last path segment: `Folder/Note` -> `Note`. */
export function linkDisplayName(link: WikiLink): string {
  if (link.alias) return link.alias;
  const segments = link.target.split("/");
  return segments[segments.length - 1];
}
