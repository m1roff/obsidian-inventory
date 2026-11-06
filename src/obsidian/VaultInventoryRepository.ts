import { App } from "obsidian";
import { InventoryEntry } from "../domain/InventoryEntry";
import { InventoryRepository } from "../domain/InventoryRepository";
import { Item } from "../domain/Item";
import { StockPosition } from "../domain/StockPosition";
import { Frontmatter, FrontmatterMapper, LinkResolver } from "./FrontmatterMapper";
import { StockStatePolicy } from "../domain/StockState";
import { InventoryFolders, isInFolder } from "./InventoryFolders";

class MetadataCacheLinkResolver implements LinkResolver {
  constructor(private readonly app: App) {}

  resolvePath(target: string, sourcePath: string): string | null {
    return (
      this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path ??
      null
    );
  }
}

export class VaultInventoryRepository implements InventoryRepository {
  private readonly mapper: FrontmatterMapper;

  constructor(
    private readonly app: App,
    private readonly folders: InventoryFolders,
    states: () => StockStatePolicy,
  ) {
    this.mapper = new FrontmatterMapper(new MetadataCacheLinkResolver(app), states);
  }

  loadEntries(): InventoryEntry[] {
    const items: Item[] = [];
    const positionsByProduct = new Map<string, StockPosition[]>();

    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm: Frontmatter =
        this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const note = {
        path: file.path,
        basename: file.basename,
        createdAt: file.stat.ctime,
        updatedAt: file.stat.mtime,
      };

      if (isInFolder(file.path, this.folders.items)) {
        items.push(this.mapper.toItem(note, fm));
      } else if (isInFolder(file.path, this.folders.positions)) {
        const position = this.mapper.toPosition(note, fm);
        if (position === null) continue;
        const list = positionsByProduct.get(position.productPath) ?? [];
        list.push(position);
        positionsByProduct.set(position.productPath, list);
      }
    }

    return items
      // Order is up to the caller (see InventorySorter); by name is just stable.
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (item) =>
          new InventoryEntry(item, positionsByProduct.get(item.path) ?? []),
      );
  }
}
