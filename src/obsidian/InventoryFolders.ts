export interface InventoryFolders {
  readonly items: string;
  readonly positions: string;
  readonly kinds: string;
  readonly locations: string;
  readonly tags: string;
}

export function isInFolder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`);
}
