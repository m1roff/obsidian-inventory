import { App, TFile } from "obsidian";
import { PlaceIdWriter } from "../domain/PlaceIds";
import { PlaceParentWriter } from "../domain/PlaceParentService";
import { PlaceTagWriter } from "../domain/PlaceTagService";
import { ReferenceKind, ReferenceWriter } from "../domain/AddReferenceService";
import { ReferenceRenamer } from "../domain/RenameReferenceService";
import { InventoryFolders } from "./InventoryFolders";

// Same body as the other location notes: what lies there, from the stock table.
const LOCATION_BODY = "## Contents\n\n![[Stock positions.base#Current Location]]\n";

/** A kind or location is a small note in the lists folder. */
export class VaultReferenceWriter implements ReferenceWriter, ReferenceRenamer, PlaceIdWriter, PlaceTagWriter, PlaceParentWriter {
  constructor(
    private readonly app: App,
    private readonly folders: InventoryFolders,
  ) {}

  async create(kind: ReferenceKind, name: string, id?: string): Promise<void> {
    const folder =
      kind === "kind" ? this.folders.kinds : kind === "tag" ? this.folders.tags : this.folders.locations;
    const body = kind === "location" ? LOCATION_BODY : "";
    const file = await this.app.vault.create(`${folder}/${name}.md`, body);

    await this.app.fileManager.processFrontMatter(
      file,
      (fm: Record<string, unknown>) => {
        fm.fileClass = "Inventory-List";
        if (id !== undefined) fm.id = id;
        fm.comment = "";
        fm.cover = "";
        if (kind === "location") fm.tags = [];
      },
    );
  }

  async rename(kind: ReferenceKind, oldName: string, newName: string): Promise<void> {
    const folder =
      kind === "kind" ? this.folders.kinds : kind === "tag" ? this.folders.tags : this.folders.locations;
    const file = this.app.vault.getAbstractFileByPath(`${folder}/${oldName}.md`);
    if (!(file instanceof TFile)) throw new Error(`No note for ${oldName}`);
    // The file manager, not the vault: it rewrites the links that point at the note.
    await this.app.fileManager.renameFile(file, `${folder}/${newName}.md`);
  }

  async setTags(placePath: string, tags: readonly string[]): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(placePath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${placePath}`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm.tags = [...tags];
    });
  }

  async setParent(placePath: string, parent: string | null): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(placePath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${placePath}`);
    // A real link, so Obsidian updates it when the parent note is renamed.
    const target = parent === null ? null : this.app.vault.getFileByPath(`${this.folders.locations}/${parent}.md`);
    const link = target instanceof TFile ? this.app.fileManager.generateMarkdownLink(target, placePath) : `[[${parent}]]`;
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (parent === null) delete fm.parent;
      else fm.parent = link;
    });
  }

  async setId(placePath: string, id: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(placePath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${placePath}`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm.id = id;
    });
  }
}
