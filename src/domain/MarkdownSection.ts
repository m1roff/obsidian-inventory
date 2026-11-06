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

  let end = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }

  let last = end - 1;
  while (last > headingIndex && lines[last].trim() === "") last--;

  const before = lines.slice(0, last + 1);
  const after = lines.slice(last + 1);
  const needsBlankBefore = last === headingIndex;
  const needsBlankAfter = after.length > 0 && after[0].trim() !== "";

  return [
    ...before,
    ...(needsBlankBefore ? [""] : []),
    line,
    ...(needsBlankAfter ? [""] : []),
    ...after,
  ].join("\n");
}

/** Appends a line at the very end of the note, separated from the text above by a blank line. */
export function appendToEnd(content: string, line: string): string {
  const body = content.replace(/\s+$/, "");
  return body === "" ? `${line}\n` : `${body}\n\n${line}\n`;
}
