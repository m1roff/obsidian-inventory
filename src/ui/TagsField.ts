import { App, Notice, setIcon } from "obsidian";
import { AddReferenceError } from "../domain/AddReferenceService";
import { SelectOption } from "../domain/OptionList";
import { promptForName } from "./NamePrompt";
import { OptionSuggestModal } from "./SelectField";
import { STRINGS } from "./strings";

export interface TagsFieldConfig {
  readonly label: string;
  readonly initial: readonly string[];
  /** Every tag the owner has, read afresh each time the picker opens. */
  readonly available: () => string[];
  /** Creates a new tag in the tags list and returns its name. */
  readonly create: (name: string) => Promise<string>;
  readonly searchThreshold: () => number;
  readonly onChange: (tags: string[]) => void;
}

/**
 * The tags of a new item: the chosen ones as chips (tap x to remove) and a "+" button.
 * "+" opens the same list as every other pick list: a search field that doubles as the
 * place to type a new tag. Picking an existing tag adds it; "Add" at the bottom creates it.
 */
export class TagsField {
  private tags: string[];
  private readonly chipsEl: HTMLElement;

  constructor(
    private readonly app: App,
    parent: HTMLElement,
    private readonly config: TagsFieldConfig,
  ) {
    this.tags = [...config.initial];
    // Not an Obsidian Setting: its mobile layout stacks the label over a full-width control,
    // and the label, "+" and tags must all flow in one wrapping row.
    const row = parent.createDiv({ cls: "inventory-ui__tags-row" });
    row.createSpan({ cls: "inventory-ui__tags-label", text: config.label });
    this.chipsEl = row.createDiv({ cls: "inventory-ui__chips" });
    this.draw();
  }

  private draw(): void {
    this.chipsEl.empty();
    // "+" goes first so that it never runs away to the end of a long cloud of tags.
    const add = this.chipsEl.createEl("button", {
      cls: "inventory-ui__chip inventory-ui__chip--add",
      attr: { "aria-label": STRINGS.tagAdd },
    });
    setIcon(add.createSpan(), "plus");
    add.addEventListener("click", () => this.open());
    for (const tag of this.tags) {
      const chip = this.chipsEl.createEl("button", {
        cls: "inventory-ui__chip",
        attr: { "aria-label": `${STRINGS.tagRemove}: ${tag}` },
      });
      chip.createSpan({ text: `#${tag}` });
      setIcon(chip.createSpan({ cls: "inventory-ui__chip-x" }), "x");
      chip.addEventListener("click", () => this.remove(tag));
    }
  }

  private open(): void {
    const options: SelectOption[] = this.config
      .available()
      .filter((tag) => !this.tags.some((own) => own.toLowerCase() === tag.toLowerCase()))
      .map((tag) => ({ value: tag, label: `#${tag}` }));
    new OptionSuggestModal(this.app, {
      options,
      alphabetical: true,
      searchThreshold: this.config.searchThreshold(),
      canAdd: true,
      onPick: (value) => this.add(value),
      onAdd: (name) => this.create(name),
    }).open();
  }

  private create(name: string): void {
    if (name === "") {
      promptForName(
        this.app,
        STRINGS.newTag,
        (typed) => {
          void this.createNamed(typed);
        },
        true,
      );
      return;
    }
    void this.createNamed(name);
  }

  private async createNamed(name: string): Promise<void> {
    try {
      this.add(await this.config.create(name.replace(/^#+/, "")));
    } catch (error) {
      if (error instanceof AddReferenceError) new Notice(STRINGS.referenceErrors[error.code]);
      else {
        console.error(error);
        new Notice(STRINGS.unexpectedError);
      }
    }
  }

  private add(tag: string): void {
    if (this.tags.some((own) => own.toLowerCase() === tag.toLowerCase())) return;
    this.tags = [...this.tags, tag];
    this.draw();
    this.config.onChange(this.tags);
  }

  private remove(tag: string): void {
    this.tags = this.tags.filter((own) => own !== tag);
    this.draw();
    this.config.onChange(this.tags);
  }
}
