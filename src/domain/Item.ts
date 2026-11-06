export class Item {
  constructor(
    readonly path: string,
    readonly name: string,
    readonly id: string,
    readonly kind: string,
    readonly origin: string,
    readonly tags: readonly string[],
    readonly coverPath: string | null,
    readonly createdAt: number,
    readonly updatedAt: number,
  ) {}
}
