import { StructureApplier } from "./StructureApplier";
import { StructureChecker, StructureVault } from "./StructureChecker";
import { StructureLayout } from "./StructureLayout";
import { StructureReport } from "./StructureReport";
import { SetupStatus, PluginRequirement } from "./SetupStatus";
import { DEFAULT_STOCK_STATE_POLICY, StockStatePolicy } from "../StockState";
import { StructureModule } from "../modules/StructureModule";
import { buildSkeleton, StructureSkeleton } from "./StructureSkeleton";
import { ApplyResult } from "./StructureApplier";
import { StructureIssue } from "./StructureReport";

/** Which of the needed plugins are on right now. */
export interface PluginRequirements {
  current(): PluginRequirement[];
}

/**
 * The setup of the vault: the cheap question "was it set up", the full check, and
 * the fixes the owner chose. The full check reads about ten notes, so it only
 * runs when asked, never on events or timers.
 */
export class SetupService {
  constructor(
    private readonly vault: StructureVault,
    private readonly applier: StructureApplier,
    private readonly requirements: PluginRequirements,
    private readonly layout: () => StructureLayout,
    private readonly states: () => StockStatePolicy = () => DEFAULT_STOCK_STATE_POLICY,
    private readonly modules: () => readonly StructureModule[] = () => [],
  ) {}

  /** One folder lookup: is the base folder there. */
  isInitialized(): boolean {
    return this.vault.folderExists(this.layout().root);
  }

  skeleton(): StructureSkeleton {
    return buildSkeleton(this.layout(), this.states(), this.modules());
  }

  async report(): Promise<StructureReport> {
    return new StructureChecker(this.vault).check(this.skeleton());
  }

  async status(): Promise<SetupStatus> {
    return new SetupStatus(this.requirements.current(), await this.report());
  }

  /** The report as if nothing existed yet: what a first run would create. */
  async preview(): Promise<StructureReport> {
    const nothing: StructureVault = {
      folderExists: () => false,
      fileExists: () => false,
      readText: () => Promise.resolve(null),
      readFrontmatter: () => Promise.resolve(null),
    };
    return new StructureChecker(nothing).check(this.skeleton());
  }

  apply(issues: readonly StructureIssue[]): Promise<ApplyResult> {
    return this.applier.apply(issues);
  }
}
