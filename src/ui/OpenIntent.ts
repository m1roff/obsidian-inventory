import { Keymap, PaneType } from "obsidian";

/** Where a tap on an item should open its card, and whether to switch to it. */
export interface OpenIntent {
  /** `false`: here, replacing what is shown. Otherwise a new tab, split or window. */
  readonly where: PaneType | boolean;
  /** Bring the opened card to the front; `false` leaves it in the background. */
  readonly activate: boolean;
}

export const OPEN_HERE: OpenIntent = { where: false, activate: true };

/**
 * Reads the keys held during a click, the way a browser does with a link: a plain click opens
 * here; Cmd (Ctrl) opens a new tab in the background, so several can be opened in a row; Cmd
 * (Ctrl) with Shift opens it and goes there. Alt adds a split, Alt with Shift a new window.
 */
export function openIntentOf(event: MouseEvent): OpenIntent {
  const where = Keymap.isModEvent(event);
  if (where === false) return OPEN_HERE;
  // A new window comes to the front by itself; Shift in a window request is part of the combination.
  return { where, activate: where === "window" || event.shiftKey };
}
