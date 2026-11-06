import { App, Notice, setIcon, Setting, SuggestModal } from "obsidian";
import { AddReferenceError } from "../domain/AddReferenceService";
import { arrangeOptions, needsSearch, SelectOption } from "../domain/OptionList";
import { promptForName } from "./NamePrompt";
import { STRINGS } from "./strings";

export interface CreateOption {
  /** Title of the window that asks for the name when none was typed. */
  readonly promptTitle: string;
  /** Creates the new entry and returns the option value to select. */
  create(name: string): Promise<string>;
}

export interface SelectFieldConfig {
  readonly label: string;
  /** Read afresh each time: the list can grow while the form is open. */
  readonly options: () => SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Read afresh on each open: the list needs a search field when it is longer than this. */
  readonly searchThreshold: () => number;
  /** Alphabetical by default; false for lists with a meaningful order. */
  readonly alphabetical?: boolean;
  /** Offers "+ Add new" at the bottom of the list. */
  readonly create?: CreateOption;
}

type Choice =
  | { readonly kind: "option"; readonly option: SelectOption }
  | { readonly kind: "add"; readonly name: string };

/**
 * The one select used everywhere: a button showing the current value that
 * opens a list. Long lists get a quick search field, short ones do not; if new
 * entries can be created, "+ Add new" stays at the bottom whatever was searched.
 */
export class SelectField {
  readonly setting: Setting;
  private current: string;
  private readonly labelEl: HTMLElement;

  constructor(
    private readonly app: App,
    parent: HTMLElement,
    private readonly config: SelectFieldConfig,
  ) {
    this.current = config.value;
    this.setting = new Setting(parent).setName(config.label);
    this.setting.settingEl.addClass("inventory-ui__select-row");

    const button = this.setting.controlEl.createEl("button", {
      cls: "inventory-ui__select-button",
    });
    this.labelEl = button.createSpan({ cls: "inventory-ui__select-label" });
    setIcon(button.createSpan({ cls: "inventory-ui__select-icon" }), "chevrons-up-down");
    button.addEventListener("click", () => this.open());

    this.refreshLabel();
  }

  setValue(value: string): void {
    this.current = value;
    this.refreshLabel();
  }

  private refreshLabel(): void {
    const option = this.config.options().find((o) => o.value === this.current);
    this.labelEl.setText(option?.label ?? (this.current || STRINGS.choose));
  }

  private open(): void {
    new OptionSuggestModal(this.app, {
      options: this.config.options(),
      alphabetical: this.config.alphabetical ?? true,
      searchThreshold: this.config.searchThreshold(),
      canAdd: this.config.create !== undefined,
      selected: this.current,
      onPick: (value) => this.choose(value),
      onAdd: (name) => this.add(name),
    }).open();
  }

  private choose(value: string): void {
    this.setValue(value);
    this.config.onChange(value);
  }

  private add(name: string): void {
    const creator = this.config.create;
    if (!creator) return;

    if (name === "") {
      promptForName(this.app, creator.promptTitle, (typed) => {
        void this.create(creator, typed);
      });
      return;
    }
    void this.create(creator, name);
  }

  private async create(creator: CreateOption, name: string): Promise<void> {
    try {
      this.choose(await creator.create(name));
    } catch (error) {
      if (error instanceof AddReferenceError) {
        new Notice(STRINGS.referenceErrors[error.code]);
      } else {
        console.error(error);
        new Notice(STRINGS.unexpectedError);
      }
    }
  }
}

export interface SuggestConfig {
  readonly options: SelectOption[];
  readonly alphabetical: boolean;
  readonly searchThreshold: number;
  readonly canAdd: boolean;
  readonly onPick: (value: string) => void;
  readonly onAdd: (name: string) => void;
  /** The value that is picked now: its row gets a check mark. */
  readonly selected?: string;
}

export class OptionSuggestModal extends SuggestModal<Choice> {
  constructor(
    app: App,
    private readonly config: SuggestConfig,
  ) {
    super(app);
    this.setPlaceholder(STRINGS.selectSearch);
    if (!needsSearch(config.options.length, config.searchThreshold)) {
      this.modalEl.addClass("inventory-ui__select--no-search");
    }
  }

  getSuggestions(query: string): Choice[] {
    const choices: Choice[] = arrangeOptions(
      this.config.options,
      query,
      this.config.alphabetical,
    ).map((option) => ({ kind: "option", option }));

    // Stays even when nothing matched, so a missing entry can be created from here.
    if (this.config.canAdd) choices.push({ kind: "add", name: query.trim() });
    return choices;
  }

  renderSuggestion(choice: Choice, el: HTMLElement): void {
    if (choice.kind === "option") {
      el.addClass("inventory-ui__select-option");
      el.createSpan({ text: choice.option.label });
      if (choice.option.value === this.config.selected) {
        setIcon(el.createSpan({ cls: "inventory-ui__select-check" }), "check");
      }
      return;
    }
    el.addClass("inventory-ui__select-add");
    el.setText(choice.name ? STRINGS.addNamed(choice.name) : STRINGS.addNew);
  }

  onChooseSuggestion(choice: Choice): void {
    if (choice.kind === "option") this.config.onPick(choice.option.value);
    else this.config.onAdd(choice.name);
  }
}
