import { setFormula } from "./BasesFormulas";
import { StructureFix, StructureIssue, StructureReport } from "./StructureReport";
import { FieldSpec, FileClassSpec, FileSpec, StructureSkeleton } from "./StructureSkeleton";

/** What the checker may ask the vault. Reads only. */
export interface StructureVault {
  folderExists(path: string): boolean;
  fileExists(path: string): boolean;
  readText(path: string): Promise<string | null>;
  /** The note's frontmatter, or null when the note does not exist or cannot be read. */
  readFrontmatter(path: string): Promise<Record<string, unknown> | null>;
}

/**
 * Compares the vault with the skeleton. It never writes: what is missing becomes an
 * issue with a fix that adds it; what differs becomes a warning with a fix that replaces it
 * by the expected one (the owner chooses whether to apply it).
 * Extra things the owner added (fields, files) are not looked at.
 */
export class StructureChecker {
  constructor(private readonly vault: StructureVault) {}

  async check(skeleton: StructureSkeleton): Promise<StructureReport> {
    const issues: StructureIssue[] = [];

    skeleton.folders.forEach((path, index) => {
      if (this.vault.folderExists(path)) return;
      issues.push({
        id: index === 0 ? "folder:root" : `folder:${path}`,
        code: "folder-missing",
        severity: "error",
        path,
        detail: "",
        found: "",
        fix: { kind: "create-folder", path },
      });
    });

    for (const file of skeleton.files) {
      if (!this.vault.fileExists(file.path)) {
        issues.push({
          id: `file:${file.path}`,
          code: "file-missing",
          severity: "error",
          path: file.path,
          detail: "",
          found: "",
          fix: { kind: "create-file", path: file.path, content: file.content },
        });
        continue;
      }
      const text = (await this.vault.readText(file.path)) ?? "";
      const absent = file.mustMention.filter((expected) => !text.includes(expected));
      if (absent.length > 0) {
        // One issue per file: the fix is the same whatever is missing.
        const patch = this.patchOf(file, text, absent);
        issues.push({
          id: `file-paths:${file.path}`,
          code: "file-paths",
          severity: "warning",
          path: file.path,
          detail: absent.join('", "'),
          found: "",
          fix: patch ?? { kind: "replace-file", path: file.path, content: file.content },
        });
      }
    }

    for (const spec of skeleton.fileClasses) {
      issues.push(...(await this.checkClass(spec)));
    }

    return new StructureReport(issues);
  }

  /**
   * When everything a file lacks comes from formulas, only those formulas are set, so the
   * owner's columns and views stay. Anything else missing (a folder it filters by) needs the
   * whole file replaced.
   */
  private patchOf(file: FileSpec, text: string, absent: readonly string[]): StructureFix | null {
    const formulas = file.formulas ?? [];
    if (!absent.every((mention) => formulas.some((formula) => formula.mention === mention))) return null;
    const needed = formulas.filter((formula) => absent.includes(formula.mention));
    const content = needed.reduce((acc, formula) => setFormula(acc, formula.name, formula.expression), text);
    return { kind: "patch-file", path: file.path, content, formulas: needed.map((formula) => formula.name) };
  }

  /** Choices the plugin expects (for example every state) that the field does not list yet. */
  private checkChoices(
    spec: FileClassSpec,
    field: FieldSpec,
    existing: ReadonlySet<string>,
  ): StructureIssue[] {
    const expected = choiceValues(field.raw.options);
    return expected
      .filter((value) => !existing.has(value.toLowerCase()))
      .map((value) => ({
        id: `field-values:${spec.path}:${field.name}:${value}`,
        code: "field-values-missing" as const,
        severity: "error" as const,
        path: spec.path,
        detail: field.name,
        found: value,
        fix: { kind: "add-option" as const, classPath: spec.path, fieldName: field.name, value },
      }));
  }

  private async checkClass(spec: FileClassSpec): Promise<StructureIssue[]> {
    if (!this.vault.fileExists(spec.path)) {
      return [
        {
          id: `class:${spec.path}`,
          code: "class-missing",
          severity: "error",
          path: spec.path,
          detail: spec.name,
          found: "",
          fix: { kind: "create-class", spec },
        },
      ];
    }

    const data = await this.vault.readFrontmatter(spec.path);
    if (data === null) {
      return [
        {
          id: `class-unreadable:${spec.path}`,
          code: "class-unreadable",
          severity: "error",
          path: spec.path,
          detail: spec.name,
          found: "",
          fix: null,
        },
      ];
    }

    const issues: StructureIssue[] = [];
    const existing = existingFields(data);
    for (const field of spec.fields) {
      const found = existing.get(field.name)?.type;
      if (found === undefined) {
        issues.push({
          id: `field:${spec.path}:${field.name}`,
          code: "field-missing",
          severity: "error",
          path: spec.path,
          detail: field.name,
          found: "",
          fix: { kind: "add-field", classPath: spec.path, field },
        });
        continue;
      }
      issues.push(...this.checkChoices(spec, field, existing.get(field.name)?.choices ?? new Set()));
      if (found !== field.type) {
        issues.push({
          id: `field-type:${spec.path}:${field.name}`,
          code: "field-type",
          severity: "warning",
          path: spec.path,
          detail: `${field.name}: ${field.type}`,
          found,
          fix: { kind: "replace-field", classPath: spec.path, field },
        });
      }
    }

    const paths = stringList(data.filesPaths);
    for (const folder of spec.folders) {
      if (paths.includes(folder)) continue;
      issues.push({
        id: `class-folder:${spec.path}:${folder}`,
        code: "class-folder",
        severity: "warning",
        path: spec.path,
        detail: folder,
        found: paths.join(", "),
        fix: { kind: "add-class-folder", classPath: spec.path, folder },
      });
    }
    return issues;
  }
}

interface ExistingField {
  readonly type: string;
  /** The values of the field's list of choices (lower case), for a field that has one. */
  readonly choices: Set<string>;
}

/** Field name -> type and choices, for the fields a class note already has. */
function existingFields(data: Record<string, unknown>): Map<string, ExistingField> {
  const result = new Map<string, ExistingField>();
  const fields = data.fields;
  if (!Array.isArray(fields)) return result;
  for (const entry of fields as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, type, options } = entry as { name?: unknown; type?: unknown; options?: unknown };
    if (typeof name !== "string") continue;
    result.set(name, {
      type: typeof type === "string" ? type : "",
      choices: new Set(choiceValues(options).map((value) => value.toLowerCase())),
    });
  }
  return result;
}

/** The values of a field's `valuesList` option ("1": "stored", ...), as text. */
function choiceValues(options: unknown): string[] {
  if (typeof options !== "object" || options === null) return [];
  const list = (options as { valuesList?: unknown }).valuesList;
  if (typeof list !== "object" || list === null) return [];
  return Object.values(list as Record<string, unknown>).filter((v): v is string => typeof v === "string");
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === "string") : [];
}
