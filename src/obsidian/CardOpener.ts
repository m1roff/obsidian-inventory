import { App, TFile, WorkspaceLeaf } from "obsidian";
import { OpenIntent } from "../ui/OpenIntent";

/**
 * Opens a note next to where the owner is (a new tab, split or window). Obsidian shows a new
 * tab at once and `active: false` does not stop that, so for a background open the leaf the
 * owner came from is put back in front in the SAME turn, before the card is even loaded:
 * nothing is awaited between the two steps, so the screen never gets drawn with the new tab in
 * front (an earlier version restored the old leaf after loading, and the tab flashed).
 */
export async function openInNewPane(
  app: App,
  file: TFile,
  intent: OpenIntent,
  from: WorkspaceLeaf | null,
): Promise<void> {
  const workspace = app.workspace;
  // Taken before the new leaf exists: afterwards "most recent" is the new one.
  const previous = from ?? workspace.getMostRecentLeaf();
  const leaf = workspace.getLeaf(intent.where);
  if (!intent.activate && previous) workspace.setActiveLeaf(previous, { focus: true });
  await leaf.openFile(file, { active: intent.activate });
}
