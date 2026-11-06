export interface RandomSource {
  /** Uniform-ish integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** What an id is for. Only these two exist so far. */
export type IdKind = "item" | "place";

/**
 * The first two letters of an id tell what it belongs to. A few groups are
 * reserved, so a kind that appears later can take its own without clashing
 * with ids that already stick on bags and labels. Ordinary item ids never
 * start with any of these.
 */
const RESERVED_PREFIXES = {
  place: "LC",
  kind: "KD",
  tag: "TG",
  kit: "KT",
  project: "PR",
} as const;

// No I, L, O: easy to confuse with 1 and 0 when written by hand.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const MAX_ATTEMPTS = 1000;

/**
 * Short ids that are easy to write on a bag or label by hand: two letters
 * that say what it is, two random letters, three digits (`KX-RM-482` for an
 * item, `LC-RM-482` for a place).
 */
export class IdGenerator {
  constructor(private readonly random: RandomSource) {}

  generate(kind: IdKind, used: ReadonlySet<string>): string {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = `${this.prefix(kind)}-${this.letters(2)}-${this.digits(3)}`;
      if (!used.has(candidate)) return candidate;
    }
    throw new Error(`Could not generate a unique ${kind} id`);
  }

  private prefix(kind: IdKind): string {
    if (kind === "place") return RESERVED_PREFIXES.place;

    const reserved = new Set<string>(Object.values(RESERVED_PREFIXES));
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = this.letters(2);
      if (!reserved.has(candidate)) return candidate;
    }
    throw new Error("Could not pick a prefix for an item id");
  }

  private letters(count: number): string {
    return Array.from(
      { length: count },
      () => LETTERS[this.random.nextInt(LETTERS.length)],
    ).join("");
  }

  private digits(count: number): string {
    return Array.from({ length: count }, () => String(this.random.nextInt(10))).join("");
  }
}
