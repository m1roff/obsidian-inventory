/** A location note: where stock can lie. `id` is empty until one is assigned. */
export interface Place {
  readonly name: string;
  readonly path: string;
  readonly id: string;
  /** Vault path of the place's photo (its `cover`), or null. */
  readonly cover: string | null;
}
