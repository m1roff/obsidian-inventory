import { StructureFix, StructureIssue } from "./StructureReport";
import { FieldSpec, FileClassSpec } from "./StructureSkeleton";

/** What the applier may do to the vault. Only the "replace" operations overwrite. */
export interface StructureWriter {
  createFolder(path: string): Promise<void>;
  createFile(path: string, content: string): Promise<void>;
  createClass(spec: FileClassSpec): Promise<void>;
  addField(classPath: string, field: FieldSpec): Promise<void>;
  /** Adds a value to a field's list of choices (never removes or renames one). */
  addOption(classPath: string, fieldName: string, value: string): Promise<void>;
  /** Overwrites a whole file with the expected text. */
  replaceFile(path: string, content: string): Promise<void>;
  /** Replaces one field of a class by the expected one (the field keeps its id). */
  replaceField(classPath: string, field: FieldSpec): Promise<void>;
  /** Adds a folder to the class's list of folders (never removes one). */
  addClassFolder(classPath: string, folder: string): Promise<void>;
}

export interface ApplyFailure {
  readonly issue: StructureIssue;
  readonly error: unknown;
}

export interface ApplyResult {
  readonly applied: number;
  readonly failed: readonly ApplyFailure[];
}

const ORDER: Record<StructureFix["kind"], number> = {
  "create-folder": 0,
  "create-file": 1,
  "replace-file": 1,
  "patch-file": 1,
  "create-class": 2,
  "add-field": 3,
  "replace-field": 3,
  "add-option": 4,
  "add-class-folder": 5,
};

/** Carries out the chosen fixes: folders first, then files, classes and their fields. */
export class StructureApplier {
  constructor(private readonly writer: StructureWriter) {}

  async apply(issues: readonly StructureIssue[]): Promise<ApplyResult> {
    const chosen = issues
      .filter((issue): issue is StructureIssue & { fix: StructureFix } => issue.fix !== null)
      .sort((a, b) => ORDER[a.fix.kind] - ORDER[b.fix.kind]);

    let applied = 0;
    const failed: ApplyFailure[] = [];
    for (const issue of chosen) {
      try {
        await this.run(issue.fix);
        applied++;
      } catch (error) {
        failed.push({ issue, error });
      }
    }
    return { applied, failed };
  }

  private run(fix: StructureFix): Promise<void> {
    switch (fix.kind) {
      case "create-folder":
        return this.writer.createFolder(fix.path);
      case "create-file":
        return this.writer.createFile(fix.path, fix.content);
      case "create-class":
        return this.writer.createClass(fix.spec);
      case "add-field":
        return this.writer.addField(fix.classPath, fix.field);
      case "add-option":
        return this.writer.addOption(fix.classPath, fix.fieldName, fix.value);
      case "patch-file":
      case "replace-file":
        return this.writer.replaceFile(fix.path, fix.content);
      case "replace-field":
        return this.writer.replaceField(fix.classPath, fix.field);
      case "add-class-folder":
        return this.writer.addClassFolder(fix.classPath, fix.folder);
    }
  }
}
