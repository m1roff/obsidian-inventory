import { Plugin } from "obsidian";
import { AddItemService } from "./domain/AddItemService";
import { AddReferenceService } from "./domain/AddReferenceService";

/**
 * What the development tools (kept outside this repository, see `dev-tools`) are given to work
 * with. A normal build, and anyone building from this repository alone, has no such tools.
 */
export interface DevToolsContext {
  readonly plugin: Plugin;
  readonly addReference: AddReferenceService;
  readonly addItem: AddItemService;
  /** Redraws the open dashboards. */
  readonly refreshDashboards: () => void;
}
