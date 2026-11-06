import { App } from "obsidian";
import { Place } from "../domain/Place";
import { parseTagList } from "../domain/TagList";
import { parseWikiLink } from "../domain/WikiLink";
import { ReferenceLists } from "../domain/ReferenceLists";
import { InventoryFolders } from "./InventoryFolders";

/** Kinds and locations are notes lying directly in their list folders. */
export class VaultReferenceLists implements ReferenceLists {
  constructor(
    private readonly app: App,
    private readonly folders: InventoryFolders,
  ) {}

  kinds(): string[] {
    return this.namesIn(this.folders.kinds);
  }

  tags(): string[] {
    return this.namesIn(this.folders.tags);
  }

  locations(): string[] {
    return this.places().map((place) => place.name);
  }

  places(): Place[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.parent?.path === this.folders.locations)
      .map((file) => {
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const id: unknown = fm?.id;
        const link = parseWikiLink(fm?.cover);
        return {
          name: file.basename,
          path: file.path,
          id: typeof id === "string" ? id.trim() : "",
          cover: link ? (this.app.metadataCache.getFirstLinkpathDest(link.target, file.path)?.path ?? null) : null,
          tags: parseTagList(fm?.tags),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private namesIn(folder: string): string[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.parent?.path === folder)
      .map((file) => file.basename)
      .sort((a, b) => a.localeCompare(b));
  }
}
