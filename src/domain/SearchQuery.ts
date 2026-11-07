import { InventoryEntry } from "./InventoryEntry";
import { tagsMatch } from "./TagQuery";

export const STATE_PREFIX = "state:";

/** A state as one search word: lower case, spaces as _. */
export function stateWord(state: string): string {
  return state.toLowerCase().replace(/\s+/g, "_");
}

/** The search text that finds the items with units in this state. */
export function stateQuery(state: string): string {
  return `${STATE_PREFIX}${stateWord(state)}`;
}

/** What a search looks at on one thing (an item, a location, a row of an export list). */
export interface Searchable {
  /** The tags the thing has itself: only these answer a `#tag` (tags are not inherited from what it holds). */
  readonly tags: readonly string[];
  /** The texts a plain word may be found in (the tags count too). */
  readonly texts: readonly string[];
  /** The thing's stock states, as search words; absent for things that have none (a location ignores `state:`). */
  readonly states?: readonly string[];
}

/** What a term of the query looks for. */
type TermKind = "word" | "phrase" | "tag" | "state";

interface Term {
  readonly kind: TermKind;
  /** Lower case, without the quotes, the `#` or the `state:`. */
  readonly text: string;
  /** Written with a leading `-`: the thing must NOT have it. */
  readonly exclude: boolean;
}

/**
 * Cuts the text into terms. A term is a word, a `"phrase in quotes"` (an unclosed quote runs to
 * the end, so the list narrows while it is typed), `#tag` or `state:name`, any of them with a
 * leading `-` to leave out what has it. A `-` alone, `#` alone and `state:` alone are the start of
 * typing and ask for nothing yet.
 */
function terms(raw: string): Term[] {
  const found: Term[] = [];
  let i = 0;
  while (i < raw.length) {
    if (/\s/.test(raw[i])) {
      i++;
      continue;
    }
    const exclude = raw[i] === "-" && i + 1 < raw.length && !/\s/.test(raw[i + 1]);
    if (exclude) i++;

    let text: string;
    let phrase = false;
    if (raw[i] === '"') {
      phrase = true;
      const close = raw.indexOf('"', i + 1);
      text = raw.slice(i + 1, close === -1 ? raw.length : close);
      i = close === -1 ? raw.length : close + 1;
    } else {
      let end = i;
      while (end < raw.length && !/\s/.test(raw[end])) end++;
      text = raw.slice(i, end);
      i = end;
    }
    text = text.trim().toLowerCase();
    if (text === "" || text === "-") continue;

    if (phrase) found.push({ kind: "phrase", text, exclude });
    else if (text.startsWith("#")) {
      if (text.length > 1) found.push({ kind: "tag", text: text.slice(1), exclude });
    } else if (text.startsWith(STATE_PREFIX)) {
      if (text.length > STATE_PREFIX.length) found.push({ kind: "state", text: text.slice(STATE_PREFIX.length), exclude });
    } else found.push({ kind: "word", text, exclude });
  }
  return found;
}

/**
 * The one search of the plugin, whatever list it narrows. Every term must hold:
 * - a plain word is found in the texts or the tags, as part of a word;
 * - `"a phrase"` is found as it stands, in one text or tag (not across two);
 * - `#word` is the start of one of the thing's own tags;
 * - `state:name` is the start of one of its stock states (spaces in a state's name are written
 *   as _); things without states ignore it;
 * - a leading `-` turns any of these around: the thing must not have it.
 * Everything typed without quotes and minus works as it always did.
 */
export class SearchQuery {
  private constructor(private readonly all: readonly Term[]) {}

  static parse(raw: string): SearchQuery {
    return new SearchQuery(terms(raw));
  }

  get isEmpty(): boolean {
    return this.all.length === 0;
  }

  matches(target: Searchable): boolean {
    const fields = [...target.texts, ...target.tags].map((field) => field.toLowerCase());
    const haystack = fields.join("\n");
    return this.all.every((term) => this.holds(term, target, fields, haystack) !== term.exclude);
  }

  /** Whether the thing has what the term looks for (before a leading `-` turns it around). */
  private holds(term: Term, target: Searchable, fields: readonly string[], haystack: string): boolean {
    switch (term.kind) {
      case "word":
        return haystack.includes(term.text);
      case "phrase":
        return fields.some((field) => field.includes(term.text));
      case "tag":
        return tagsMatch(target.tags, [term.text]);
      case "state":
        // A thing without states has nothing to say about them: the term is left out of the match.
        if (target.states === undefined) return !term.exclude;
        return target.states.some((state) => state.startsWith(term.text));
    }
  }

  /** The things the query leaves, in their order; everything when the query is empty. */
  filter<T>(things: readonly T[], look: (thing: T) => Searchable): T[] {
    return this.isEmpty ? [...things] : things.filter((thing) => this.matches(look(thing)));
  }
}

/** An item with its stock: name, id, kind, origin, the places its units lie in, and its states. */
export function searchableEntry(entry: InventoryEntry): Searchable {
  const { item, positions } = entry;
  return {
    tags: item.tags,
    texts: [item.name, item.id, item.kind, item.origin, ...positions.map((position) => position.location)],
    states: positions.map((position) => stateWord(position.state)),
  };
}

/** An item card alone, as in the label export list. */
export function searchableItem(item: { name: string; id: string; kind: string; origin: string; tags: readonly string[] }): Searchable {
  return { tags: item.tags, texts: [item.name, item.id, item.kind, item.origin] };
}

/** A location: its name, id and own tags. */
export function searchablePlace(place: { name: string; id: string; tags: readonly string[] }): Searchable {
  return { tags: place.tags, texts: [place.name, place.id] };
}
