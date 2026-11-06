/** The plugin's default base folder: everything it owns lives under it. */
export const DEFAULT_BASE_FOLDER = "Inventory";

/**
 * Where everything lives in the vault. The names inside the base folder are fixed,
 * only the base folder itself can be renamed (a setting).
 */
export class StructureLayout {
  readonly root: string;

  constructor(baseFolder: string) {
    this.root = normalizeBaseFolder(baseFolder);
  }

  get items(): string {
    return this.join("Inventory_Items");
  }
  get positions(): string {
    return this.join("Inventory_Positions");
  }
  get config(): string {
    return this.join("_inventory_config");
  }
  get fileClasses(): string {
    return `${this.config}/fileclasses`;
  }
  get lists(): string {
    return `${this.config}/lists`;
  }
  get kinds(): string {
    return `${this.lists}/kinds`;
  }
  get locations(): string {
    return `${this.lists}/locations`;
  }
  get tags(): string {
    return `${this.lists}/tags`;
  }

  get itemsBase(): string {
    return this.join("Inventory items.base");
  }
  get positionsBase(): string {
    return this.join("Stock positions.base");
  }
  get filamentBase(): string {
    return this.join("Filament.base");
  }
  get listsBase(): string {
    return `${this.config}/Lists.base`;
  }
  get imagesBase(): string {
    return `${this.config}/Current note images.base`;
  }

  /** The path inside the base folder, or just the name when the base folder is empty. */
  private join(name: string): string {
    return this.root === "" ? name : `${this.root}/${name}`;
  }
}

/** Trims slashes and spaces; an empty or blank value means the vault root. */
export function normalizeBaseFolder(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/** Whether the base folder name is usable (no path tricks, no characters Obsidian forbids). */
export function isValidBaseFolder(value: string): boolean {
  const normalized = normalizeBaseFolder(value);
  if (normalized === "") return false;
  if (normalized.split("/").some((part) => part === "." || part === "..")) return false;
  return !/[:*?"<>|]/.test(normalized);
}
