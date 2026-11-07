import { suggestTags, withTag } from "../domain/TagSuggestions";
import { STRINGS } from "./strings";
import { addSearchClear, SearchClear } from "./SearchClear";

/** The tag chips under a field show at most this many. */
const MAX_TAG_SUGGESTIONS = 8;
/** A little after the field loses focus, so a tap on a chip still lands. */
const HIDE_SUGGESTIONS_MS = 150;

export interface SearchFieldConfig {
  readonly placeholder: string;
  /** What the field holds when it appears (a query kept from before). */
  readonly initial?: string;
  /** The tags to offer while a `#word` is typed: those of the list this field narrows. Read when needed. */
  readonly tags: () => readonly string[];
  /** The text changed (typed, cleared, or a tag was picked). */
  readonly onChange: (query: string) => void;
  /** Where the tag chips and the help go; by default right after the field. */
  readonly suggestIn?: HTMLElement;
  /** Whether the round "?" shows (a setting); read again by `syncHelp`. On when not given. */
  readonly showHelp?: () => boolean;
}

/**
 * The search field of the plugin, the same wherever a list is searched: the field, the "x",
 * the return key that puts the keyboard away, and the tag chips that appear under it while a
 * `#word` is being typed, and a round "?" inside the field that opens a short note on how to
 * search (it can be switched off in the settings). What the words mean is `SearchQuery`; this
 * only takes the text.
 */
export class SearchField {
  readonly inputEl: HTMLInputElement;
  private readonly clear: SearchClear;
  private readonly box: HTMLElement;
  private readonly wrap: HTMLElement;
  private readonly helpButton: HTMLElement;
  private readonly helpPanel: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly config: SearchFieldConfig,
  ) {
    const wrap = parent.createDiv({ cls: "inventory-ui__search-wrap" });
    this.wrap = wrap;
    this.inputEl = wrap.createEl("input", {
      cls: "inventory-ui__search",
      attr: { type: "search", placeholder: config.placeholder, "aria-label": config.placeholder },
    });
    this.inputEl.value = config.initial ?? "";
    const below = config.suggestIn ?? parent;
    this.helpPanel = below.createDiv({ cls: "inventory-ui__search-help" });
    this.box = below.createDiv({ cls: "inventory-ui__tag-suggest" });
    this.box.hide();
    this.renderHelpPanel();
    this.helpButton = wrap.createEl("button", {
      cls: "inventory-ui__search-help-button",
      text: "?",
      attr: { type: "button", "aria-label": STRINGS.searchHelpLabel, "aria-expanded": "false" },
    });
    // Does not take the focus from the field, so the keyboard stays as it is.
    this.helpButton.addEventListener("mousedown", (event) => event.preventDefault());
    this.helpButton.addEventListener("click", () => this.toggleHelp());
    this.syncHelp();

    this.clear = addSearchClear(wrap, this.inputEl, () => {
      config.onChange("");
      this.refreshSuggestions();
    });
    this.inputEl.addEventListener("input", () => {
      config.onChange(this.inputEl.value);
      this.refreshSuggestions();
    });
    this.inputEl.addEventListener("blur", () => {
      window.setTimeout(() => this.box.hide(), HIDE_SUGGESTIONS_MS);
    });
  }

  get value(): string {
    return this.inputEl.value;
  }

  /** Sets the text from code (a scanned label, a saved query). Does not call `onChange`: the caller redraws. */
  setValue(value: string): void {
    this.inputEl.value = value;
    this.clear.sync();
    this.refreshSuggestions();
  }

  /** The "x" shows by what the field holds; call it after the text was changed by something else. */
  sync(): void {
    this.clear.sync();
  }

  /** Shows or hides the "?" by the setting (the stylesheet shows it only inside a field marked `has-help`); an open panel goes with it. */
  syncHelp(): void {
    const visible = this.config.showHelp?.() ?? true;
    this.wrap.toggleClass("has-help", visible);
    if (!visible) this.setHelpOpen(false);
  }

  focus(): void {
    this.inputEl.focus();
  }

  private renderHelpPanel(): void {
    this.helpPanel.createDiv({ cls: "inventory-ui__search-help-title", text: STRINGS.searchHelpTitle });
    const list = this.helpPanel.createEl("ul");
    for (const line of STRINGS.searchHelpLines) list.createEl("li", { text: line });
  }

  private toggleHelp(): void {
    this.setHelpOpen(!this.helpPanel.hasClass("is-open"));
  }

  private setHelpOpen(open: boolean): void {
    this.helpPanel.toggleClass("is-open", open);
    this.helpButton.setAttribute("aria-expanded", String(open));
  }

  private refreshSuggestions(): void {
    this.box.empty();
    const tags = suggestTags(this.inputEl.value, this.config.tags(), MAX_TAG_SUGGESTIONS);
    if (tags.length === 0) {
      this.box.hide();
      return;
    }
    for (const tag of tags) {
      const chip = this.box.createEl("button", { cls: "inventory-ui__chip", text: `#${tag}` });
      // Keep the focus in the field, so the keyboard stays up.
      chip.addEventListener("pointerdown", (event) => event.preventDefault());
      chip.addEventListener("click", () => this.pick(tag));
    }
    this.box.show();
  }

  private pick(tag: string): void {
    this.inputEl.value = withTag(this.inputEl.value, tag);
    this.clear.sync();
    this.config.onChange(this.inputEl.value);
    this.refreshSuggestions();
    this.inputEl.focus();
  }
}
