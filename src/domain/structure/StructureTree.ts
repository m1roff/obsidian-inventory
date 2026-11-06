import { StructureIssue, StructureReport } from "./StructureReport";
import { StructureSkeleton } from "./StructureSkeleton";

export type NodeKind = "folder" | "file" | "class";
/** `ok`: as expected. `missing`: not there. `warning`: there, but something differs. */
export type NodeStatus = "ok" | "missing" | "warning";

export interface TreeNode {
  readonly name: string;
  readonly path: string;
  readonly kind: NodeKind;
  readonly status: NodeStatus;
  /** Issues about this very entry (a missing folder, a differing field, ...). */
  readonly issues: readonly StructureIssue[];
  readonly children: readonly TreeNode[];
  /** Set for entries that belong to an optional module (its id). */
  readonly module?: string;
}

/**
 * The expected structure as a tree, each entry marked by what the report found.
 * With an empty report everything is "ok": use `StructureReport` of a vault
 * with nothing in it to get the "will be created" picture.
 */
export function buildTree(skeleton: StructureSkeleton, report: StructureReport): TreeNode[] {
  const byPath = new Map<string, StructureIssue[]>();
  for (const issue of report.issues) {
    const list = byPath.get(issue.path) ?? [];
    list.push(issue);
    byPath.set(issue.path, list);
  }

  const modules = new Map<string, string>();
  for (const entry of [...skeleton.files, ...skeleton.fileClasses]) {
    if (entry.module !== undefined) modules.set(entry.path, entry.module);
  }

  const kinds = new Map<string, NodeKind>();
  skeleton.folders.forEach((path) => kinds.set(path, "folder"));
  skeleton.files.forEach((file) => kinds.set(file.path, "file"));
  skeleton.fileClasses.forEach((spec) => kinds.set(spec.path, "class"));

  interface Builder {
    name: string;
    path: string;
    kind: NodeKind;
    children: Map<string, Builder>;
  }
  const roots = new Map<string, Builder>();

  for (const [fullPath, kind] of kinds) {
    const parts = fullPath.split("/");
    let level = roots;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isLast = index === parts.length - 1;
      let node = level.get(part);
      if (!node) {
        node = { name: part, path, kind: isLast ? kind : "folder", children: new Map() };
        level.set(part, node);
      } else if (isLast) {
        node.kind = kind;
      }
      level = node.children;
    });
  }

  const finish = (builder: Builder): TreeNode => {
    const issues = byPath.get(builder.path) ?? [];
    const children = [...builder.children.values()]
      .map(finish)
      .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    const missing = issues.some((i) => i.code === "folder-missing" || i.code === "file-missing" || i.code === "class-missing");
    const status: NodeStatus = missing ? "missing" : issues.length > 0 ? "warning" : "ok";
    const module = modules.get(builder.path);
    return {
      name: builder.name,
      path: builder.path,
      kind: builder.kind,
      status,
      issues,
      children,
      ...(module !== undefined ? { module } : {}),
    };
  };

  return [...roots.values()].map(finish);
}

/** Folders first, then files. */
function order(node: TreeNode): number {
  return node.kind === "folder" ? 0 : 1;
}
