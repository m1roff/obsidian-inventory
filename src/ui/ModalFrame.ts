import { Modal } from "obsidian";

const FRAMED = "inventory-ui__framed";
const FRONT = "is-front";

/** Our open windows, the last one on top. */
const open: Modal[] = [];

/**
 * The look every window of the plugin shares: a thin frame, in the accent colour for the
 * window that is on top (when one opens over another, e.g. "New kind" over "Add item", only
 * the front one is accented, so it is clear which one the owner is working in).
 * Call it once in `onOpen`.
 */
export function frameModal(modal: Modal): void {
  modal.modalEl.addClass(FRAMED);
  open.push(modal);
  markFront();

  const original = modal.onClose.bind(modal);
  modal.onClose = (): void => {
    const index = open.indexOf(modal);
    if (index >= 0) open.splice(index, 1);
    markFront();
    original();
  };
}

function markFront(): void {
  open.forEach((modal, index) => {
    modal.modalEl.toggleClass(FRONT, index === open.length - 1);
  });
}
