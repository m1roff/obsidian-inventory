import { Notice, setIcon } from "obsidian";
import { SetupService } from "../domain/structure/SetupService";
import { buildTree } from "../domain/structure/StructureTree";
import { STRINGS } from "./strings";
import { renderStructureTree } from "./StructureTreeView";

/** Long enough for the spinner to be seen: a check is quick, and an instant redraw looks like nothing happened. */
const MIN_CHECK_MS = 600;

/** What the dashboard shows instead of itself until the structure exists. */
export class SetupPanel {
  constructor(
    private readonly parent: HTMLElement,
    private readonly setup: SetupService,
    /** Called when the structure got created, so the dashboard can take over. */
    private readonly onInitialized: () => void,
  ) {}

  async render(): Promise<void> {
    const status = await this.setup.status();
    const preview = await this.setup.preview();
    const root = this.parent;
    root.empty();

    root.createEl("h2", { text: STRINGS.setupTitle });
    root.createEl("p", { text: STRINGS.setupIntro });

    const step1 = root.createDiv({ cls: "inventory-ui__step" });
    step1.createEl("h3", { text: STRINGS.setupStep1 });
    for (const requirement of status.requirements) {
      const line = step1.createDiv({
        cls: `inventory-ui__step-line ${requirement.installed ? "is-ok" : "is-bad"}`,
      });
      setIcon(line.createSpan(), requirement.installed ? "check-circle-2" : "x-circle");
      line.createSpan({
        text: requirement.installed
          ? STRINGS.setupPluginOk(requirement.name)
          : STRINGS.setupPluginMissing(requirement.name),
      });
    }

    // Installed the missing plugin? One tap here instead of scrolling to the bottom.
    if (!status.pluginsReady) {
      const recheck = step1.createEl("button", {
        cls: "inventory-ui__step-recheck",
        text: STRINGS.setupCheckAgain,
      });
      recheck.addEventListener("click", () => {
        void this.recheck(recheck);
      });
    }

    const step2 = root.createDiv({
      cls: `inventory-ui__step ${status.pluginsReady ? "" : "is-muted"}`,
    });
    step2.createEl("h3", { text: STRINGS.setupStep2 });
    step2.createEl("p", {
      text: status.pluginsReady
        ? STRINGS.setupStep2Text(this.setup.skeleton().folders[0] ?? "")
        : STRINGS.setupStep2Muted,
    });
    renderStructureTree(
      step2.createDiv({ cls: "inventory-ui__structure-tree" }),
      buildTree(this.setup.skeleton(), preview),
      { plain: true },
    );

    const actions = root.createDiv({ cls: "inventory-ui__step-actions" });
    const check = actions.createEl("button", { text: STRINGS.setupCheckAgain });
    check.addEventListener("click", () => {
      void this.recheck(check);
    });
    const initialize = actions.createEl("button", {
      cls: "mod-cta",
      text: STRINGS.setupInitialize,
    });
    initialize.disabled = !status.canInitialize;
    initialize.addEventListener("click", () => {
      void this.initialize();
    });
  }

  /**
   * Looks again. The answer is often "nothing changed", and a button that does
   * nothing visible feels stuck: so it shows a spinner for a moment and then says what it found.
   */
  private async recheck(button: HTMLButtonElement): Promise<void> {
    if (button.disabled) return;
    button.disabled = true;
    button.empty();
    setIcon(button.createSpan({ cls: "inventory-ui__spinner" }), "loader-2");
    button.createSpan({ text: STRINGS.setupChecking });

    const [status] = await Promise.all([
      this.setup.status(),
      new Promise<void>((resolve) => window.setTimeout(resolve, MIN_CHECK_MS)),
    ]);
    await this.render();
    new Notice(
      status.pluginsReady
        ? STRINGS.setupAllFound
        : STRINGS.setupStillMissing(status.missingPlugins.map((p) => p.name).join(", ")),
    );
  }

  private async initialize(): Promise<void> {
    try {
      const report = await this.setup.report();
      const result = await this.setup.apply(report.fixable);
      for (const failure of result.failed) console.error(failure.issue.id, failure.error);
      new Notice(STRINGS.setupDone(result.applied));
      this.onInitialized();
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.unexpectedError);
    }
  }
}
