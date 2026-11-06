import { FieldSpec, FileClassSpec } from "./StructureSkeleton";

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "folder-missing"
  | "file-missing"
  | "file-paths"
  | "class-missing"
  | "class-unreadable"
  | "field-missing"
  | "field-type"
  | "field-values-missing"
  | "class-folder";

/**
 * What fixing an issue does. Most fixes only add. The "replace" ones overwrite something
 * the owner has (a whole Bases file, one field of a class), so they are never chosen by default.
 */
export type StructureFix =
  | { readonly kind: "create-folder"; readonly path: string }
  | { readonly kind: "create-file"; readonly path: string; readonly content: string }
  | { readonly kind: "create-class"; readonly spec: FileClassSpec }
  | { readonly kind: "add-field"; readonly classPath: string; readonly field: FieldSpec }
  | { readonly kind: "replace-file"; readonly path: string; readonly content: string }
  /** The file with only the named formulas set; everything else in it is the owner's and stays. */
  | {
      readonly kind: "patch-file";
      readonly path: string;
      readonly content: string;
      readonly formulas: readonly string[];
    }
  | { readonly kind: "replace-field"; readonly classPath: string; readonly field: FieldSpec }
  | { readonly kind: "add-class-folder"; readonly classPath: string; readonly folder: string }
  | {
      readonly kind: "add-option";
      readonly classPath: string;
      readonly fieldName: string;
      readonly value: string;
    };

/** A fix that overwrites what the owner has instead of adding to it. */
export function isReplacement(fix: StructureFix): boolean {
  return fix.kind === "replace-file" || fix.kind === "replace-field";
}

export interface StructureIssue {
  /** Stable within one report: used for the checkboxes. */
  readonly id: string;
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  /** The folder or note the issue is about; the interface opens it. */
  readonly path: string;
  /** The field name, the expected text or the like: depends on the code. */
  readonly detail: string;
  /** What was found instead, when that matters. */
  readonly found: string;
  /** Set when the plugin can fix it (by adding or by replacing). */
  readonly fix: StructureFix | null;
}

/** The result of comparing the vault with the skeleton. */
export class StructureReport {
  constructor(readonly issues: readonly StructureIssue[]) {}

  get isHealthy(): boolean {
    return this.issues.length === 0;
  }

  /** Issues the plugin can fix. */
  get fixable(): StructureIssue[] {
    return this.issues.filter((issue) => issue.fix !== null);
  }

  /** Issues only the owner can resolve. */
  get manual(): StructureIssue[] {
    return this.issues.filter((issue) => issue.fix === null);
  }

  /** Nothing of the structure exists yet: the first run. */
  get isEmpty(): boolean {
    return this.issues.some((issue) => issue.code === "folder-missing" && issue.id === "folder:root");
  }
}
