import { Modal, Platform } from "obsidian";
import { debugLog } from "./ModalDebug";
import { frameModal } from "./ModalFrame";

const TYPING_CLASS = "is-typing";
/** Obsidian's phone app tells nothing reliable about the keyboard: below this a reading is noise. */
const MIN_KEYBOARD_PX = 120;
/** The keyboard needs a moment to slide in before the field can be placed above it. */
const REVEAL_DELAY_MS = 350;
/** Moving from one field to the next must not flicker the window's size. */
const BLUR_GRACE_MS = 120;
const KEYBOARD_EVENTS = ["keyboardWillShow", "keyboardDidShow"];
const TEXT_TYPES = new Set(["text", "search", "number", "tel", "email", "url", ""]);
/** Things a tap on is "doing something": a tap on anything else puts the keyboard away. */
const INTERACTIVE = "input, textarea, button, select, a, label, .checkbox-container, .dropdown";

/** The last keyboard height the app reported: the next window starts from it. */
let knownKeyboardHeight = 0;

function isTextEntry(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_TYPES.has(target.type);
}

/**
 * Makes a window with text fields usable on a phone. The keyboard is drawn over the
 * page and nothing tells the page how big it is, so a window cannot just "see" it.
 * Instead, on a phone:
 *  - the window sticks to the top of the screen (Obsidian centres it, and a centred
 *    window ends up under the keyboard);
 *  - while a field has focus the window is only as tall as the space above the
 *    keyboard, everything else scrolls inside it, and the focused field is brought
 *    into view; the buttons row (`inventory-ui__modal-actions`) sticks a little above
 *    the bottom edge of the visible window;
 *  - without focus the window is as tall as its content needs;
 *  - a tap on an empty place, or the return key, puts the keyboard away.
 * The keyboard height comes from the app's keyboard events or its `--keyboard-height`
 * variable when those exist; otherwise the stylesheet's guess is used. Costs nothing
 * while idle: it only reacts to focus, taps and the few keyboard events.
 * On a computer it only adds style hooks.
 */
export function guardKeyboard(modal: Modal): void {
  const { modalEl, contentEl, containerEl } = modal;
  frameModal(modal);
  modalEl.addClass("inventory-ui__kb-modal");
  containerEl.addClass("inventory-ui__kb-container");
  if (!Platform.isMobile) return;

  let graceTimer: number | null = null;
  let revealTimer: number | null = null;

  const setKeyboardHeight = (height: number | undefined, source: string): void => {
    if (typeof height === "number" && height >= MIN_KEYBOARD_PX) knownKeyboardHeight = height;
    if (knownKeyboardHeight >= MIN_KEYBOARD_PX) {
      modalEl.setCssProps({ "--inventory-ui-keyboard-height": `${knownKeyboardHeight}px` });
    }
    if (__DEV__) debugLog(`keyboard height from ${source}`, modalEl, contentEl, { height, knownKeyboardHeight });
  };

  const onKeyboard = (event: Event): void => {
    setKeyboardHeight((event as Event & { keyboardHeight?: number }).keyboardHeight, event.type);
  };
  for (const name of KEYBOARD_EVENTS) window.addEventListener(name, onKeyboard);

  const onFocusIn = (event: FocusEvent): void => {
    const field = event.target;
    if (!isTextEntry(field)) return;
    if (graceTimer !== null) window.clearTimeout(graceTimer);
    graceTimer = null;

    const fromApp = parseFloat(getComputedStyle(modalEl).getPropertyValue("--keyboard-height"));
    setKeyboardHeight(Number.isFinite(fromApp) ? fromApp : undefined, "--keyboard-height");
    modalEl.addClass(TYPING_CLASS);

    if (revealTimer !== null) window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
      revealTimer = null;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      field.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }, REVEAL_DELAY_MS);
  };

  const onFocusOut = (event: FocusEvent): void => {
    if (!isTextEntry(event.target)) return;
    graceTimer = window.setTimeout(() => {
      graceTimer = null;
      const stillTyping = Array.from(modalEl.querySelectorAll("input, textarea")).some(
        (el) => el === document.activeElement && isTextEntry(el),
      );
      if (!stillTyping) modalEl.removeClass(TYPING_CLASS);
    }, BLUR_GRACE_MS);
  };

  const onTap = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE)) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && isTextEntry(active)) active.blur();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    if (!isTextEntry(event.target)) return;
    const field = event.target;
    // After the field's own Enter handling (for example submit) has run.
    window.setTimeout(() => field.blur(), 0);
  };

  modalEl.addEventListener("focusin", onFocusIn);
  modalEl.addEventListener("focusout", onFocusOut);
  modalEl.addEventListener("click", onTap);
  modalEl.addEventListener("keydown", onKeydown);

  const original = modal.onClose.bind(modal);
  modal.onClose = (): void => {
    for (const name of KEYBOARD_EVENTS) window.removeEventListener(name, onKeyboard);
    if (graceTimer !== null) window.clearTimeout(graceTimer);
    if (revealTimer !== null) window.clearTimeout(revealTimer);
    original();
  };
}
