import { StructureReport } from "./StructureReport";

/** A plugin the inventory needs next to this one. */
export interface PluginRequirement {
  readonly id: string;
  readonly name: string;
  readonly installed: boolean;
}

/** The two setup steps of a fresh vault, and which one the owner can do now. */
export class SetupStatus {
  constructor(
    readonly requirements: readonly PluginRequirement[],
    readonly report: StructureReport,
  ) {}

  /** Step 1: every required plugin is installed and on. */
  get pluginsReady(): boolean {
    return this.requirements.every((requirement) => requirement.installed);
  }

  get missingPlugins(): PluginRequirement[] {
    return this.requirements.filter((requirement) => !requirement.installed);
  }

  /** Step 2 is muted until step 1 is done. */
  get canInitialize(): boolean {
    return this.pluginsReady && !this.initialized;
  }

  /** The base folder exists: the structure was set up (it may still have problems). */
  get initialized(): boolean {
    return !this.report.isEmpty;
  }

  /** The dashboard works only on a set-up structure. */
  get dashboardAvailable(): boolean {
    return this.initialized;
  }
}
