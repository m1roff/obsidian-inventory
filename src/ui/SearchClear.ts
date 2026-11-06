import { setIcon } from "obsidian";
import { STRINGS } from "./strings";

export interface SearchClear {
  /** Shows or hides the "x" by what the field holds now; call it after setting the value from code. */
  sync(): void;
}

/**
 * The round "x" at the end of a search field: one tap empties it. It shows only while there is
 * something to clear. Clearing and the return key both end the typing: the field loses focus,
 * the keyboard hides (and is not raised if it was not up).
 * `wrap` is the field's wrapper (`inventory-ui__search-wrap`); `onClear` redraws what depends on it.
 */
export function addSearchClear(wrap: HTMLElement, input: HTMLInputElement, onClear: () => void): SearchClear {
  const button = wrap.createEl("button", {
    cls: "inventory-ui__search-clear",
    attr: { "aria-label": STRINGS.searchClear, type: "button" },
  });
  setIcon(button, "x");

  const sync = (): void => button.toggleClass("is-visible", input.value !== "");
  sync();

  input.addEventListener("input", sync);
  // A tap on the "x" is a tap on something else than the field: it must not pull the focus
  // into it (and with it the keyboard) just to empty it.
  // The return key puts the keyboard away, as it does in every window of the plugin.
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.blur();
  });
  button.addEventListener("click", () => {
    input.value = "";
    sync();
    onClear();
    // Erasing is done with: the keyboard goes away if it was up, and does not come up if it was not.
    input.blur();
  });
  return { sync };
}
