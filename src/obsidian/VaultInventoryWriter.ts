import { App, TFile } from "obsidian";
import {
  InventoryWriter,
  NewItemRecord,
  NewPositionRecord,
} from "../domain/InventoryWriter";
import { PositionPatch } from "../domain/StockPosition";
import { InventoryFolders } from "./InventoryFolders";

// The skeleton of a new item card: sections for the stock table, the shop card and photos.
const ITEM_BODY = `
## Stock

![[Stock positions.base#Current Product]]


## Item card


## Order details


# Extra description


## Real photo


## Item card photos
`;

const ITEM_CLASS = "Inventory item file class";

type Frontmatter = Record<string, unknown>;

export class VaultInventoryWriter implements InventoryWriter {
  constructor(
    private readonly app: App,
    private readonly folders: InventoryFolders,
  ) {}

  async createItem(item: NewItemRecord): Promise<string> {
    const path = `${this.folders.items}/${item.name}.md`;
    const file = await this.app.vault.create(path, ITEM_BODY);
    const kind = this.link(this.folders.kinds, item.kind, path);

    await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      fm.fileClass = item.details
        ? [item.details.fileClass, ITEM_CLASS]
        : ITEM_CLASS;
      fm.id = item.id;
      fm.kind = kind;
      fm.origin = "";
      fm.tags = [...item.tags];
      fm.price = "";
      fm.currency = "EUR";
      fm.cover = "";
      if (item.details) Object.assign(fm, item.details.fields);
    });
    return path;
  }

  async createPosition(position: NewPositionRecord): Promise<void> {
    const path = this.freePositionPath(position.fileName);
    const file = await this.app.vault.create(path, "");

    const product = this.app.vault.getFileByPath(position.itemPath);
    const productLink = product
      ? this.app.fileManager.generateMarkdownLink(product, path)
      : `[[${position.itemPath}]]`;
    const location = this.link(this.folders.locations, position.location, path);

    await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      fm.fileClass = "Stock position";
      fm.Product = productLink;
      fm.quantity = position.quantity;
      fm.Location = location;
      fm.State = position.state;
    });
  }

  async updatePosition(path: string, patch: PositionPatch): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) throw new Error(`Position note not found: ${path}`);

    const location =
      patch.location === undefined
        ? undefined
        : this.link(this.folders.locations, patch.location, path);

    await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      if (patch.quantity !== undefined) fm.quantity = patch.quantity;
      if (location !== undefined) fm.Location = location;
      if (patch.state !== undefined) fm.State = patch.state;
    });
  }

  /** Two moves within one second must not collide on the file name. */
  private freePositionPath(fileName: string): string {
    const base = `${this.folders.positions}/${fileName}`;
    let path = `${base}.md`;
    for (let n = 2; this.app.vault.getFileByPath(path); n++) {
      path = `${base} ${n}.md`;
    }
    return path;
  }

  /** Link to a list note, written the way the user's link settings prescribe. */
  private link(folder: string, name: string, sourcePath: string): string {
    const note = this.app.vault.getFileByPath(`${folder}/${name}.md`);
    return note instanceof TFile
      ? this.app.fileManager.generateMarkdownLink(note, sourcePath)
      : `[[${name}]]`;
  }
}
