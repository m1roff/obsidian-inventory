/**
 * Sets one formula in the text of a Bases file and leaves everything else as it is: the other
 * formulas, the owner's own columns, views and sorting. Works on lines, so nothing is
 * re-written that was not asked for.
 */
export function setFormula(text: string, name: string, expression: string): string {
  const lines = text.split("\n");
  const head = lines.findIndex((line) => /^formulas:\s*$/.test(line));
  const entry = (indent: string): string => `${indent}${name}: ${expression}`;

  if (head === -1) {
    const block = ["formulas:", entry("  ")];
    const views = lines.findIndex((line) => /^views:/.test(line));
    if (views === -1) {
      const body = text.endsWith("\n") ? text : `${text}\n`;
      return `${body}${block.join("\n")}\n`;
    }
    lines.splice(views, 0, ...block);
    return lines.join("\n");
  }

  // The block: the lines after "formulas:" that are indented (or empty), up to the next key.
  let end = head + 1;
  while (end < lines.length && (lines[end] === "" || /^\s/.test(lines[end]))) end++;
  // Trailing empty lines belong after the block, not in it.
  while (end > head + 1 && lines[end - 1] === "") end--;

  const own = new RegExp(`^(\\s+)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\s|$)`);
  for (let i = head + 1; i < end; i++) {
    const match = own.exec(lines[i]);
    if (!match) continue;
    const indent = match[1];
    // The old value may go on over several lines (a block scalar): those go with it.
    let last = i + 1;
    while (last < end && lines[last] !== "" && lines[last].length - lines[last].trimStart().length > indent.length) last++;
    lines.splice(i, last - i, entry(indent));
    return lines.join("\n");
  }
  lines.splice(end, 0, entry("  "));
  return lines.join("\n");
}
