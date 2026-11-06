import { Item } from "../domain/Item";
import { StockPosition } from "../domain/StockPosition";
import { DEFAULT_STOCK_STATE_POLICY, parseStockState, StockStatePolicy } from "../domain/StockState";
import { linkDisplayName, parseWikiLink } from "../domain/WikiLink";

export interface NoteRef {
  readonly path: string;
  readonly basename: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface LinkResolver {
  /** Vault path of the note a link points to, or null if it does not resolve. */
  resolvePath(target: string, sourcePath: string): string | null;
}

export type Frontmatter = Record<string, unknown>;

/** Turns raw frontmatter into typed domain objects at the system boundary. */
export class FrontmatterMapper {
  constructor(
    private readonly links: LinkResolver,
    /** The owner's list of states, read at the moment a position is read (it can change in settings). */
    private readonly states: () => StockStatePolicy = () => DEFAULT_STOCK_STATE_POLICY,
  ) {}

  toItem(note: NoteRef, fm: Frontmatter): Item {
    const kindLink = parseWikiLink(fm.kind);
    const coverLink = parseWikiLink(fm.cover);

    return new Item(
      note.path,
      note.basename,
      this.text(fm.id),
      kindLink ? linkDisplayName(kindLink) : "",
      this.text(fm.origin),
      this.textList(fm.tags),
      coverLink ? this.links.resolvePath(coverLink.target, note.path) : null,
      note.createdAt,
      note.updatedAt,
    );
  }

  /** Null when the position is unusable (broken product link, bad quantity or state). */
  toPosition(note: NoteRef, fm: Frontmatter): StockPosition | null {
    const productLink = parseWikiLink(fm.Product);
    if (!productLink) return null;

    const productPath = this.links.resolvePath(productLink.target, note.path);
    if (productPath === null) return null;

    const quantity = Number(fm.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) return null;

    const policy = this.states();
    const state = parseStockState(fm.State, policy);
    if (state === null) return null;

    const locationLink = parseWikiLink(fm.Location);
    return new StockPosition(
      note.path,
      productPath,
      quantity,
      locationLink ? linkDisplayName(locationLink) : "",
      state,
      note.createdAt,
      note.updatedAt,
      policy.counts(state),
    );
  }

  private text(raw: unknown): string {
    return typeof raw === "string" || typeof raw === "number"
      ? String(raw).trim()
      : "";
  }

  private textList(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
    }
    const single = this.text(raw);
    return single === "" ? [] : [single];
  }
}
