import { App, parseYaml, stringifyYaml, TFile, TFolder } from "obsidian";
import { StructureVault } from "../domain/structure/StructureChecker";
import { StructureWriter } from "../domain/structure/StructureApplier";
import { FieldSpec, FileClassSpec } from "../domain/structure/StructureSkeleton";

/** Reads and writes the plugin's folders and notes. Only the "replace" writes overwrite. */
export class VaultStructure implements StructureVault, StructureWriter {
  constructor(private readonly app: App) {}

  folderExists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) instanceof TFolder;
  }

  fileExists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  async readText(path: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? this.app.vault.read(file) : null;
  }

  /** Read from the text, not from the metadata cache: the cache lags behind new files. */
  async readFrontmatter(path: string): Promise<Record<string, unknown> | null> {
    const text = await this.readText(path);
    if (text === null) return null;
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!match) return null;
    try {
      const parsed: unknown = parseYaml(match[1]);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return null;
    }
  }

  async createFolder(path: string): Promise<void> {
    await this.ensureFolder(path);
  }

  async createFile(path: string, content: string): Promise<void> {
    await this.ensureFolder(parentOf(path));
    await this.app.vault.create(path, content);
  }

  async createClass(spec: FileClassSpec): Promise<void> {
    const frontmatter = stringifyYaml(spec.data);
    await this.createFile(spec.path, `---\n${frontmatter}---\n`);
  }

  async addField(classPath: string, field: FieldSpec): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(classPath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${classPath}`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const fields = Array.isArray(fm.fields) ? (fm.fields as unknown[]) : [];
      fields.push({ ...field.raw });
      fm.fields = fields;
    });
  }

  async addOption(classPath: string, fieldName: string, value: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(classPath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${classPath}`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const fields = Array.isArray(fm.fields) ? (fm.fields as Array<Record<string, unknown>>) : [];
      const field = fields.find((entry) => entry.name === fieldName);
      if (!field) throw new Error(`No field ${fieldName} in ${classPath}`);
      const options = (typeof field.options === "object" && field.options !== null
        ? field.options
        : {}) as Record<string, unknown>;
      const list = (typeof options.valuesList === "object" && options.valuesList !== null
        ? options.valuesList
        : {}) as Record<string, string>;
      const keys = Object.keys(list).map(Number).filter((n) => Number.isFinite(n));
      // The next free number, so existing choices keep theirs.
      list[String(keys.length > 0 ? Math.max(...keys) + 1 : 1)] = value;
      options.valuesList = list;
      field.options = options;
    });
  }

  async replaceFile(path: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`No file at ${path}`);
    await this.app.vault.modify(file, content);
  }

  async replaceField(classPath: string, field: FieldSpec): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(classPath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${classPath}`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const fields = Array.isArray(fm.fields) ? (fm.fields as Array<Record<string, unknown>>) : [];
      const index = fields.findIndex((entry) => entry.name === field.name);
      if (index < 0) throw new Error(`No field ${field.name} in ${classPath}`);
      // The id ties the field to the values already written with it: it stays.
      const id = fields[index].id;
      fields[index] = { ...field.raw, ...(id !== undefined ? { id } : {}) };
      fm.fields = fields;
    });
  }

  async addClassFolder(classPath: string, folder: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(classPath);
    if (!(file instanceof TFile)) throw new Error(`No note at ${classPath}`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const paths = Array.isArray(fm.filesPaths) ? (fm.filesPaths as unknown[]) : [];
      if (!paths.includes(folder)) paths.push(folder);
      fm.filesPaths = paths;
    });
  }

  private async ensureFolder(path: string): Promise<void> {
    if (path === "") return;
    const parts = path.split("/");
    let current = "";
    for (const part of parts) {
      current = current === "" ? part : `${current}/${part}`;
      if (this.folderExists(current)) continue;
      await this.app.vault.createFolder(current);
    }
  }
}

function parentOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}
