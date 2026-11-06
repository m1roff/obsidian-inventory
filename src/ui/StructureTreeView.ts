import { setIcon } from "obsidian";
import { IssueCode, isReplacement, StructureIssue } from "../domain/structure/StructureReport";
import { NodeStatus, TreeNode } from "../domain/structure/StructureTree";
import { STRINGS } from "./strings";

export interface TreeViewOptions {
  /** Draws a checkbox for issues the plugin can fix. Omit for a plain preview. */
  readonly selection?: Set<string>;
  readonly onSelectionChanged?: () => void;
  /** Opens a note or file; only offered for entries that exist. */
  readonly onOpen?: (path: string) => void;
  /** Just the tree: no marks, no messages (the "will be created" picture). */
  readonly plain?: boolean;
}

const STATUS_ICON: Record<Exclude<NodeStatus, "ok">, string> = {
  missing: "plus",
  warning: "alert-triangle",
};

/** An entry that is simply absent says so by its mark; no sentence needed. */
const SELF_EVIDENT: ReadonlySet<IssueCode> = new Set([
  "folder-missing",
  "file-missing",
  "class-missing",
]);

/**
 * Draws the structure as a tree with connector lines (like `tree` in a terminal).
 * Each entry shows its own mark only when something is off; a plain tree shows none.
 */
export function renderStructureTree(
  parent: HTMLElement,
  nodes: readonly TreeNode[],
  options: TreeViewOptions = {},
): void {
  const root = parent.createEl("ul", { cls: "inventory-ui__tree is-root" });
  for (const node of nodes) renderNode(root, node, options);
}

function renderNode(list: HTMLElement, node: TreeNode, options: TreeViewOptions): void {
  const item = list.createEl("li", { cls: "inventory-ui__tree-item" });
  const row = item.createDiv({
    cls: `inventory-ui__tree-row is-${options.plain ? "ok" : node.status} is-${node.kind}`,
  });

  // The checkbox for adding the entry itself sits first, where the eye starts.
  const own = options.plain ? undefined : node.issues.find((issue) => SELF_EVIDENT.has(issue.code));
  if (own?.fix && options.selection) addCheckbox(row, own, options);

  setIcon(row.createSpan({ cls: "inventory-ui__tree-kind" }), iconFor(node));

  const canOpen = options.onOpen !== undefined && node.kind !== "folder" && node.status !== "missing";
  if (canOpen) {
    const link = row.createEl("a", { cls: "inventory-ui__tree-name", text: node.name });
    link.addEventListener("click", (event) => {
      event.preventDefault();
      options.onOpen?.(node.path);
    });
  } else {
    row.createSpan({ cls: "inventory-ui__tree-name", text: node.name });
  }

  if (node.module !== undefined) {
    row.createSpan({ cls: "inventory-ui__tree-module", text: STRINGS.structureModuleTag });
  }

  if (!options.plain && node.status !== "ok") {
    setIcon(row.createSpan({ cls: "inventory-ui__tree-status" }), STATUS_ICON[node.status]);
  }

  if (!options.plain) {
    for (const issue of node.issues) {
      if (!SELF_EVIDENT.has(issue.code)) renderIssue(item, issue, options);
    }
  }

  if (node.children.length > 0) {
    const inner = item.createEl("ul", { cls: "inventory-ui__tree" });
    for (const child of node.children) renderNode(inner, child, options);
  }
}

function iconFor(node: TreeNode): string {
  if (node.kind === "folder") return "folder";
  if (node.kind === "class") return "file-cog";
  return node.name.endsWith(".base") ? "table" : "file-text";
}

function renderIssue(item: HTMLElement, issue: StructureIssue, options: TreeViewOptions): void {
  const line = item.createDiv({ cls: `inventory-ui__tree-issue is-${issue.severity}` });
  if (issue.fix !== null && options.selection) addCheckbox(line, issue, options);
  line.createSpan({ text: STRINGS.structureIssue[issue.code](issue.detail, issue.found) });
  if (issue.fix !== null && isReplacement(issue.fix)) {
    const text = issue.fix.kind === "replace-file" ? STRINGS.structureReplaceFile : STRINGS.structureReplaceField;
    line.createSpan({ cls: "inventory-ui__tree-replace", text });
  } else if (issue.fix?.kind === "patch-file") {
    line.createSpan({
      cls: "inventory-ui__tree-replace",
      text: STRINGS.structurePatchFile(issue.fix.formulas.join(", ")),
    });
  }
}

function addCheckbox(parent: HTMLElement, issue: StructureIssue, options: TreeViewOptions): void {
  const { selection } = options;
  if (!selection) return;
  const box = parent.createEl("input", { type: "checkbox" });
  box.checked = selection.has(issue.id);
  box.addEventListener("change", () => {
    if (box.checked) selection.add(issue.id);
    else selection.delete(issue.id);
    options.onSelectionChanged?.();
  });
}
