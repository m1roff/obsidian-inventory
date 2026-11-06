export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** Stays after the alphabetical ones, in the given order (e.g. "Used up"). */
  readonly tail?: boolean;
}

/** A list with more options than the threshold gets a quick search field; a short one does not. */
export function needsSearch(optionCount: number, threshold: number): boolean {
  return optionCount > threshold;
}

/**
 * Options matching the query (every word must occur in the label, case does
 * not matter), alphabetically unless told otherwise; `tail` options come last.
 */
export function arrangeOptions(
  options: readonly SelectOption[],
  query: string,
  alphabetical = true,
): SelectOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = options.filter((option) => {
    const label = option.label.toLowerCase();
    return words.every((word) => label.includes(word));
  });

  const head = matches.filter((option) => !option.tail);
  const tail = matches.filter((option) => option.tail);
  if (alphabetical) {
    head.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }
  return [...head, ...tail];
}
