import { listHeadings } from "./MarkdownSection";

/** The section photos go to when the owner has not chosen another one. */
export const DEFAULT_PHOTO_SECTION = "Real photo";
export const DEFAULT_PHOTO_HEADING = `## ${DEFAULT_PHOTO_SECTION}`;

/** The rank a section made from a typed name gets. */
const NEW_SECTION_RANK = 2;

/** One row of the note's outline, in the order the note has it. */
export interface OutlineEntry {
  readonly rank: number;
  /** What the owner reads: the heading without its hashes. */
  readonly title: string;
  /** The exact heading line the photos are put under. */
  readonly heading: string;
}

/** Where the photos go: under a heading the note has, or under a new one at the very end. */
export type PhotoTarget =
  | { readonly kind: "existing"; readonly heading: string }
  | { readonly kind: "new"; readonly name: string };

/** The note's headings as an outline. A heading that repeats is listed once (the first one is where photos go). */
export function outline(content: string): OutlineEntry[] {
  const seen = new Set<string>();
  const entries: OutlineEntry[] = [];
  for (const { rank, line } of listHeadings(content)) {
    if (seen.has(line)) continue;
    seen.add(line);
    entries.push({ rank, title: line.replace(/^#+\s*/, ""), heading: line });
  }
  return entries;
}

/** What is chosen when the list opens: the "Real photo" section if the note has it, else a new one by that name. */
export function defaultTarget(entries: readonly OutlineEntry[]): PhotoTarget {
  const own = entries.find((entry) => entry.heading === DEFAULT_PHOTO_HEADING);
  return own
    ? { kind: "existing", heading: own.heading }
    : { kind: "new", name: DEFAULT_PHOTO_SECTION };
}

/** The heading line for a typed section name, or null when nothing usable was typed. */
export function newSectionHeading(name: string): string | null {
  const clean = name.replace(/^#+/, "").replace(/\s+/g, " ").trim();
  return clean === "" ? null : `${"#".repeat(NEW_SECTION_RANK)} ${clean}`;
}

/** The heading to put photos under for a choice, or null while the choice is not complete. */
export function targetHeading(target: PhotoTarget): string | null {
  return target.kind === "existing" ? target.heading : newSectionHeading(target.name);
}
