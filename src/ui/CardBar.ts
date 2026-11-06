/** One button of the bar shown in a note. */
export interface BarButton {
  /** Stable name: the bar is redrawn only when ids or states change. */
  readonly id: string;
  readonly label: string;
  /** Obsidian icon name, or null for a text-only button. */
  readonly icon: string | null;
  readonly enabled: boolean;
  run(): Promise<void> | void;
}

/**
 * Knows which notes it owns (items, places, ...) and what their bar holds.
 * `CardToolbar` only places and draws bars; a new kind of note means a new
 * source, not a change to it.
 */
export interface BarSource {
  /** Buttons for the note at `path`, or null when this source does not own it. */
  buttonsFor(path: string): BarButton[] | null;
  /** A panel under the bar for the note at `path`, or nothing. */
  panelFor?(path: string): BarPanel | null;
}

/** Something drawn under the bar of a note, such as the list of items in a place. */
export interface BarPanel {
  /**
   * Draws into `host`, which stays the same element between calls: the panel keeps what
   * it needs (a search field the owner is typing in) and only redraws what changed.
   */
  render(host: HTMLElement): void;
}
