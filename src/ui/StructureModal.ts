import { App, Modal, Notice, Setting } from "obsidian";
import { SetupService } from "../domain/structure/SetupService";
import { isReplacement, StructureReport } from "../domain/structure/StructureReport";
import { buildTree } from "../domain/structure/StructureTree";
import { STRINGS } from "./strings";
import { renderStructureTree } from "./StructureTreeView";

/**
 * The check result: the expected tree with what is missing or different marked.
 * Fixable entries have a checkbox; the ones that only add are on by default, the ones that
 * replace something the owner has stay off until they tick them.
 */
export class StructureModal extends Modal {
  private selection = new Set<string>();
  private report: StructureReport | null = null;

  constructor(
    app: App,
    private readonly setup: SetupService,
    private readonly onChanged: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(STRINGS.structureTitle);
    this.modalEl.addClass("inventory-ui__structure-modal");
    void this.check();
  }

  private async check(): Promise<void> {
    try {
      this.report = await this.setup.report();
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.unexpectedError);
      return;
    }
    this.selection = new Set(
      this.report.fixable
        .filter((issue) => issue.fix !== null && !isReplacement(issue.fix))
        .map((issue) => issue.id),
    );
    this.render(false);
  }

  /** A tick redraws the tree, so the scroll position is kept; a new check starts from the top. */
  private render(keepScroll = true): void {
    const report = this.report;
    if (!report) return;
    const { contentEl } = this;
    const scrolled = keepScroll
      ? (contentEl.querySelector<HTMLElement>(".inventory-ui__structure-tree")?.scrollTop ?? 0)
      : 0;
    contentEl.empty();

    contentEl.createEl("p", {
      cls: "inventory-ui__structure-legend",
      text: report.isHealthy ? STRINGS.structureAllGood : STRINGS.structureLegend,
    });

    const holder = contentEl.createDiv({ cls: "inventory-ui__structure-tree" });
    renderStructureTree(holder, buildTree(this.setup.skeleton(), report), {
      selection: this.selection,
      onSelectionChanged: () => this.render(),
      onOpen: (path) => {
        void this.app.workspace.openLinkText(path, "", false);
        this.close();
      },
    });

    holder.scrollTop = scrolled;

    const chosen = report.fixable.filter((issue) => this.selection.has(issue.id));
    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText(STRINGS.structureRecheck).onClick(() => {
          void this.check();
        }),
      )
      .addButton((button) => {
        button
          .setButtonText(STRINGS.structureApply(chosen.length))
          .setCta()
          .setDisabled(chosen.length === 0)
          .onClick(() => {
            void this.apply(chosen);
          });
      })
      .addButton((button) =>
        button.setButtonText(STRINGS.structureClose).onClick(() => this.close()),
      );
  }

  private async apply(chosen: StructureReport["issues"]): Promise<void> {
    const result = await this.setup.apply(chosen);
    for (const failure of result.failed) console.error(failure.issue.id, failure.error);
    new Notice(STRINGS.structureApplied(result.applied, result.failed.length));
    this.onChanged();
    await this.check();
  }
}
