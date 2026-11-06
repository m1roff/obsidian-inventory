/**
 * Appends a line to the end of the section under `heading` (an exact heading
 * line such as `## Photo`). The section is created at the end if it is missing.
 */
export function appendToSection(
  content: string,
  heading: string,
  line: string,
): string {
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((l) => l.trim() === heading);

  if (headingIndex === -1) {
    return `${content.replace(/\s+$/, "")}\n\n${heading}\n\n${line}\n`;
  }

  // The section runs until the next heading of the same or a higher rank: a `#` section
  // keeps its `##` subsections, a `##` section ends at the next `##` (or `#`).
  const rank = headingRank(heading) ?? 6;
  let end = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const next = headingRank(lines[i]);
    if (next !== null && next <= rank) {
      end = i;
      break;
    }
  }

  let last = end - 1;
  while (last > headingIndex && lines[last].trim() === "") last--;

  const before = lines.slice(0, last + 1);
  const after = lines.slice(last + 1);
  // Under text a blank line keeps the picture out of its paragraph; under another embed they stack.
  const needsBlankBefore = last === headingIndex || !/^!\[\[/.test(lines[last].trim());
  const needsBlankAfter = after.length > 0 && after[0].trim() !== "";

  return [
    ...before,
    ...(needsBlankBefore ? [""] : []),
    line,
    ...(needsBlankAfter ? [""] : []),
    ...after,
  ].join("\n");
}

/** 1 for `# Title`, 2 for `## Title`, and so on; null when the line is not a heading. */
function headingRank(line: string): number | null {
  const match = /^(#{1,6})\s+\S/.exec(line.trim());
  return match ? match[1].length : null;
}

export interface NoteHeading {
  /** 1 for `#`, 2 for `##`, and so on. */
  readonly rank: number;
  /** The heading as it stands in the note, trimmed: `## Real photo`. */
  readonly line: string;
}

/**
 * Every heading of the note in the order it stands, like the outline panel. The properties
 * block and fenced code are skipped: a `# comment` in a code sample is not a heading.
 */
export function listHeadings(content: string): NoteHeading[] {
  const lines = content.split("\n");
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const close = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (close !== -1) start = close + 1;
  }

  const found: NoteHeading[] = [];
  let fence: string | null = null;
  for (const line of lines.slice(start)) {
    const mark = /^\s*(```|~~~)/.exec(line)?.[1];
    if (mark) {
      if (fence === null) fence = mark;
      else if (fence === mark) fence = null;
      continue;
    }
    const rank = fence === null ? headingRank(line) : null;
    if (rank !== null) found.push({ rank, line: line.trim() });
  }
  return found;
}

/** The headings of one rank (`1` = a single `#`) in the order they stand, as the exact lines. */
export function findHeadings(content: string, rank: number): string[] {
  return listHeadings(content)
    .filter((heading) => heading.rank === rank)
    .map((heading) => heading.line);
}
