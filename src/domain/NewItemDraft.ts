import type { ItemDetails } from "./FilamentDetails";
import { hasForbiddenCharacters } from "./NoteName";

export type AddItemErrorCode =
  | "name-empty"
  | "name-invalid"
  | "name-taken"
  | "kind-missing"
  | "location-missing"
  | "quantity-invalid"
  | "details-missing";

export class AddItemError extends Error {
  constructor(readonly code: AddItemErrorCode) {
    super(code);
    this.name = "AddItemError";
  }
}

export interface NewItemInput {
  readonly name: string;
  readonly kind: string;
  readonly location: string;
  readonly quantity: number;
  /** Names from the tags list; optional. */
  readonly tags?: readonly string[];
  /** Extra class, fields and tags of a special kind of item (filament). */
  readonly details?: ItemDetails;
}

/** A validated request to add an item with its first stock position. */
export class NewItemDraft {
  private constructor(
    readonly name: string,
    readonly kind: string,
    readonly location: string,
    readonly quantity: number,
    readonly tags: readonly string[],
    readonly details: ItemDetails | null,
  ) {}

  /** Every problem of the input at once, so a form can mark all its wrong fields. */
  static problems(input: NewItemInput): AddItemErrorCode[] {
    const found: AddItemErrorCode[] = [];
    const name = input.name.trim();
    if (name === "") found.push("name-empty");
    else if (hasForbiddenCharacters(name)) found.push("name-invalid");
    if (input.kind === "") found.push("kind-missing");
    if (input.location === "") found.push("location-missing");
    if (!Number.isInteger(input.quantity) || input.quantity < 1) found.push("quantity-invalid");
    return found;
  }

  static create(input: NewItemInput): NewItemDraft {
    const first = NewItemDraft.problems(input)[0];
    if (first) throw new AddItemError(first);
    const name = input.name.trim();
    const details = input.details ?? null;
    const tags = [
      ...new Set([...(input.tags ?? []), ...(details?.tags ?? [])].map((tag) => tag.trim()).filter(Boolean)),
    ];
    return new NewItemDraft(name, input.kind, input.location, input.quantity, tags, details);
  }
}
