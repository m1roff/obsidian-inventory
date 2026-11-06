import { App, Modal, Setting } from "obsidian";
import { AddedItem, AddItemService } from "../domain/AddItemService";
import { AddReferenceService } from "../domain/AddReferenceService";
import { InventoryEntry } from "../domain/InventoryEntry";
import { FilamentDetails, FilamentInput } from "../domain/FilamentDetails";
import { AddItemError, AddItemErrorCode, NewItemDraft } from "../domain/NewItemDraft";
import {
  FILAMENT_FORMATS,
  FILAMENT_MATERIALS,
  FILAMENT_VARIANTS,
} from "../domain/modules/FilamentModule";
import { FilamentSettings } from "../domain/modules/FilamentSettings";
import { SelectOption } from "../domain/OptionList";
import { ReferenceLists } from "../domain/ReferenceLists";
import { MIN_QUERY_LENGTH, SimilarItemFinder } from "../domain/SimilarItemFinder";
import { QuantityField } from "./QuantityField";
import { SelectField } from "./SelectField";
import { mergeTagNames } from "../domain/TagList";
import { TagsField } from "./TagsField";
import { guardKeyboard } from "./KeyboardGuard";
import { Haptics } from "./Haptics";
import { STRINGS } from "./strings";

export interface AddItemDefaults {
  readonly kind: string;
  readonly location: string;
}

/** What is typed into the form; kept so the form can be restored after peeking at a card. */
export interface AddItemFormState {
  readonly name: string;
  readonly kind: string;
  readonly location: string;
  readonly quantity: string;
  readonly tags: readonly string[];
  /** The filament fields, when the form had them. */
  readonly filament?: FilamentInput;
  /** The "add several in a row" switch. */
  readonly several?: boolean;
}

function parseFilament(raw: unknown): FilamentInput | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { material, spoolFormat, variant, colorId, colorName } = raw as Record<string, unknown>;
  if (
    typeof material !== "string" ||
    typeof spoolFormat !== "string" ||
    typeof variant !== "string" ||
    typeof colorId !== "string" ||
    typeof colorName !== "string"
  ) {
    return undefined;
  }
  return { material, spoolFormat, variant, colorId, colorName };
}

export function parseFormState(raw: unknown): AddItemFormState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { name, kind, location, quantity, tags, filament } = raw as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    typeof kind !== "string" ||
    typeof location !== "string" ||
    typeof quantity !== "string"
  ) {
    return null;
  }
  const savedTags = Array.isArray(tags)
    ? (tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    name,
    kind,
    location,
    quantity,
    tags: savedTags,
    filament: parseFilament(filament),
    several: (raw as Record<string, unknown>).several === true,
  };
}

export interface AddItemModalOptions {
  /** Pick lists longer than this get a search field. */
  readonly searchThreshold: () => number;
  /** The filament module: when it is on and its kind is picked, the form asks for filament fields. */
  readonly filament: () => FilamentSettings;
  readonly service: AddItemService;
  readonly references: ReferenceLists;
  readonly addReference: AddReferenceService;
  readonly defaults: AddItemDefaults;
  /** Where a new item goes when nothing was used before. */
  readonly defaultLocation: () => string | null;
  /** The item must go to this place: it is shown but cannot be changed (the form was opened from the place's note). */
  readonly fixedLocation?: string;
  readonly haptics: Haptics;
  /** Restores a form that was left open (e.g. to look at an existing card). */
  readonly initial?: AddItemFormState;
  /** Snapshot of the inventory, used to warn about duplicates while typing. */
  readonly entries: readonly InventoryEntry[];
  readonly similar: SimilarItemFinder;
  readonly onOpenCard: (path: string, form: AddItemFormState) => void;
  /** `openNote`: the form was closed after this one, so the new card should open. */
  readonly onAdded: (added: AddedItem, used: AddItemDefaults, openNote: boolean) => void;
}

const toOption = (name: string): SelectOption => ({ value: name, label: name });

export class AddItemModal extends Modal {
  private readonly kinds: string[];
  private readonly locations: string[];
  private name = "";
  private kind: string;
  private location: string;
  private quantity = "1";
  private tags: string[] = [];
  private filamentInput: FilamentInput = {
    material: FILAMENT_MATERIALS[0],
    spoolFormat: "Spool",
    variant: "",
    colorId: "",
    colorName: "",
  };
  /** The owner typed the name themself: the filament fields stop writing it. */
  private nameTouched = false;
  private nameInput: HTMLInputElement | null = null;
  private filamentEl: HTMLElement | null = null;
  private errorEl: HTMLElement | null = null;
  private similarEl: HTMLElement | null = null;
  private busy = false;
  /** "Add several in a row": the form stays after adding. */
  private several = false;
  /** The row of each field of the form, to light up the one an error is about. */
  private readonly fieldEls = new Map<string, HTMLElement>();

  constructor(
    app: App,
    private readonly options: AddItemModalOptions,
  ) {
    super(app);
    this.kinds = options.references.kinds();
    this.locations = options.references.locations();
    const restored = options.initial;
    this.name = restored?.name ?? "";
    this.quantity = restored?.quantity ?? "1";
    this.tags = [...(restored?.tags ?? [])];
    if (restored?.filament) this.filamentInput = restored.filament;
    this.nameTouched = this.name !== "";
    this.several = restored?.several === true;
    this.kind = this.initial(this.kinds, restored?.kind ?? options.defaults.kind);
    this.location =
      options.fixedLocation ??
      this.initial(
        this.locations,
        restored?.location || options.defaults.location || (options.defaultLocation() ?? ""),
      );
  }

  onOpen(): void {
    this.setTitle(STRINGS.addItem);
    this.contentEl.addClass("inventory-ui__modal");
    this.buildForm();
    guardKeyboard(this);
  }

  /** Draws the whole form from the current values; also how the form starts over for the next item. */
  private buildForm(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.fieldEls.clear();

    new Setting(contentEl).setName(STRINGS.fieldName).addText((text) => {
      text.setPlaceholder(STRINGS.namePlaceholder);
      text.setValue(this.name);
      this.nameInput = text.inputEl;
      text.onChange((value) => {
        this.name = value;
        this.clearFieldErrors("name");
        this.nameTouched = value !== "";
        this.renderSimilar();
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    this.trackField("name");

    const several = new Setting(contentEl)
      .setName(STRINGS.addSeveralName)
      .addToggle((toggle) => toggle.setValue(this.several).onChange((value) => (this.several = value)));
    // The explanation takes room, so it opens only on the round "?" next to the name.
    const hint = createDiv({ cls: "inventory-ui__hint", text: STRINGS.addSeveralDesc });
    several.settingEl.after(hint);
    const help = several.nameEl.createEl("button", {
      cls: "inventory-ui__help",
      text: "?",
      attr: { "aria-label": STRINGS.helpLabel, "aria-expanded": "false" },
    });
    help.addEventListener("click", () => {
      hint.toggleClass("is-open", !hint.hasClass("is-open"));
      help.setAttr("aria-expanded", String(hint.hasClass("is-open")));
    });

    this.similarEl = contentEl.createDiv({ cls: "inventory-ui__similar" });

    new QuantityField(contentEl, STRINGS.fieldQuantity, {
      initial: this.quantity,
      haptics: this.options.haptics,
      onChange: (value) => {
        this.quantity = value;
        this.clearFieldErrors("quantity");
      },
    });
    this.trackField("quantity");

    if (this.options.fixedLocation !== undefined) {
      // Added from the place's own note: the place is a given, shown but not editable.
      new Setting(contentEl)
        .setName(STRINGS.fieldLocation)
        .setDesc(STRINGS.fieldLocationFixed)
        .addText((text) => text.setValue(this.options.fixedLocation ?? "").setDisabled(true));
    } else {
      new SelectField(this.app, contentEl, {
        searchThreshold: this.options.searchThreshold,
        label: STRINGS.fieldLocation,
        options: () => this.options.references.locations().map(toOption),
        value: this.location,
        onChange: (value) => {
          this.location = value;
          this.clearFieldErrors("location");
        },
        create: {
          promptTitle: STRINGS.newLocation,
          create: (name) => this.options.addReference.add("location", name),
        },
      });
      this.trackField("location");
    }

    new SelectField(this.app, contentEl, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldKind,
      options: () => this.options.references.kinds().map(toOption),
      value: this.kind,
      onChange: (value) => {
        this.kind = value;
        this.clearFieldErrors("kind");
        this.renderFilament();
      },
      create: {
        promptTitle: STRINGS.newKind,
        create: (name) => this.options.addReference.add("kind", name),
      },
    });
    this.trackField("kind");

    this.filamentEl = contentEl.createDiv();
    this.fieldEls.set("details", this.filamentEl);
    this.renderFilament();

    new TagsField(this.app, contentEl, {
      label: STRINGS.fieldTags,
      initial: this.tags,
      available: () => this.availableTags(),
      create: (name) => this.options.addReference.add("tag", name),
      searchThreshold: this.options.searchThreshold,
      onChange: (tags) => (this.tags = tags),
    });

    this.errorEl = createDiv({ cls: "inventory-ui__error" });
    this.renderSimilar();

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(STRINGS.addButton)
          .setCta()
          .onClick(() => {
            void this.submit();
          }),
      )
      .settingEl.addClass("inventory-ui__modal-actions");
    // The error lives in the sticky buttons row, right above "Add": always in view, even
    // when the keyboard shrinks the window and the field itself has scrolled away.
    const actions = contentEl.lastElementChild;
    if (actions && this.errorEl) actions.prepend(this.errorEl);
  }

  private filamentActive(): boolean {
    const settings = this.options.filament();
    return settings.enabled && this.kind.toLowerCase() === settings.kind.toLowerCase();
  }

  /** The filament fields, shown only for the filament kind. They write the name until the owner does. */
  private renderFilament(): void {
    const box = this.filamentEl;
    if (!box) return;
    box.empty();
    if (!this.filamentActive()) return;

    const input = this.filamentInput;
    const choices = (list: readonly string[]): SelectOption[] => list.map(toOption);
    const change = (patch: Partial<FilamentInput>): void => {
      this.filamentInput = { ...this.filamentInput, ...patch };
      this.syncName();
    };

    new SelectField(this.app, box, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldMaterial,
      options: () => choices(FILAMENT_MATERIALS),
      value: input.material,
      onChange: (value) => change({ material: value }),
      alphabetical: false,
    });
    new SelectField(this.app, box, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldSpoolFormat,
      options: () => choices(FILAMENT_FORMATS),
      value: input.spoolFormat,
      onChange: (value) => change({ spoolFormat: value }),
      alphabetical: false,
    });
    new SelectField(this.app, box, {
      searchThreshold: this.options.searchThreshold,
      label: STRINGS.fieldVariant,
      options: () => [{ value: "", label: STRINGS.variantNone }, ...choices(FILAMENT_VARIANTS)],
      value: input.variant,
      onChange: (value) => change({ variant: value }),
      alphabetical: false,
    });
    new Setting(box).setName(STRINGS.fieldColorName).addText((text) =>
      text.setValue(input.colorName).onChange((value) => change({ colorName: value })),
    );
    new Setting(box).setName(STRINGS.fieldColorId).addText((text) =>
      text.setValue(input.colorId).onChange((value) => change({ colorId: value })),
    );
    this.syncName();
  }

  /** Builds the name from the filament fields, unless the owner has written their own. */
  private syncName(): void {
    if (this.nameTouched || !this.filamentActive()) return;
    this.name = FilamentDetails.nameOf(this.filamentInput);
    if (this.nameInput) this.nameInput.value = this.name;
    this.renderSimilar();
  }

  private renderSimilar(): void {
    const container = this.similarEl;
    if (!container) return;
    container.empty();

    const { exact, similar } = this.options.similar.find(
      this.options.entries,
      this.name,
    );
    if (exact) {
      container.createDiv({
        cls: "inventory-ui__similar-title inventory-ui__similar-title--exists",
        text: STRINGS.alreadyExists,
      });
      this.renderSimilarRow(container, exact);
    }
    if (!exact && similar.length === 0 && this.name.trim().length >= MIN_QUERY_LENGTH) {
      container.createDiv({
        cls: "inventory-ui__no-similar",
        text: STRINGS.noSimilarItems,
      });
    }
    if (similar.length > 0) {
      container.createDiv({
        cls: "inventory-ui__similar-title",
        text: STRINGS.similarItems,
      });
      for (const entry of similar) this.renderSimilarRow(container, entry);
    }
  }

  private renderSimilarRow(parent: HTMLElement, entry: InventoryEntry): void {
    const row = parent.createEl("button", { cls: "inventory-ui__similar-row" });
    row.createSpan({ cls: "inventory-ui__similar-name", text: entry.item.name });
    if (entry.item.id) {
      row.createSpan({ cls: "inventory-ui__id", text: entry.item.id });
    }
    row.createSpan({
      cls: "inventory-ui__similar-qty",
      text: `× ${entry.availableQuantity()}`,
    });
    row.addEventListener("click", () => {
      this.close();
      this.options.onOpenCard(entry.item.path, {
        name: this.name,
        kind: this.kind,
        location: this.location,
        quantity: this.quantity,
        tags: this.tags,
        filament: this.filamentActive() ? this.filamentInput : undefined,
        several: this.several,
      });
    });
  }

  private initial(options: string[], preferred: string): string {
    return options.includes(preferred) ? preferred : (options[0] ?? "");
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.showError("");
    this.clearFieldErrors();

    try {
      const input = {
        name: this.name,
        kind: this.kind,
        location: this.location,
        quantity: Number(this.quantity),
        tags: this.tags,
      };
      const problems = NewItemDraft.problems(input);
      let details;
      if (this.filamentActive()) {
        try {
          details = FilamentDetails.create(this.filamentInput).toDetails();
        } catch (error) {
          if (!(error instanceof AddItemError)) throw error;
          problems.push(error.code);
        }
      }
      if (problems.length > 0) {
        this.showFieldErrors(problems);
        return;
      }
      const draft = NewItemDraft.create({ ...input, details });
      await this.ensureTagNotes(draft.tags);
      const added = await this.options.service.add(draft);
      this.options.onAdded(added, { kind: this.kind, location: this.location }, !this.several);
      if (this.several) this.startNext();
      else this.close();
    } catch (error) {
      if (error instanceof AddItemError) {
        this.showFieldErrors([error.code]);
      } else {
        console.error(error);
        this.showError(STRINGS.unexpectedError);
      }
    } finally {
      this.busy = false;
    }
  }

  /**
   * One cloud: the tags list plus the tags already written on the cards and on the locations,
   * also by hand in a note. A tag without spaces only: Obsidian does not treat anything with a
   * space as a tag.
   */
  private availableTags(): string[] {
    return mergeTagNames(
      this.options.references.tags(),
      this.options.entries.flatMap((entry) => entry.item.tags),
      this.options.references.places().flatMap((place) => place.tags),
    );
  }

  /** Tags that come with the card (filament's) must exist in the tags list too. */
  private async ensureTagNotes(tags: readonly string[]): Promise<void> {
    const known = new Set(this.options.references.tags().map((tag) => tag.toLowerCase()));
    for (const tag of tags) {
      if (known.has(tag.toLowerCase())) continue;
      await this.options.addReference.add("tag", tag);
    }
  }

  /** The form for the next item: the name and what tells items apart are empty; place, kind and tags stay. */
  private startNext(): void {
    this.name = "";
    this.nameTouched = false;
    this.quantity = "1";
    this.filamentInput = { ...this.filamentInput, colorId: "", colorName: "" };
    this.showError("");
    this.buildForm();
  }

  /** Remembers the row just added to the form as the place of this field. */
  private trackField(key: string): void {
    const row = this.contentEl.lastElementChild;
    if (row instanceof HTMLElement) this.fieldEls.set(key, row);
  }

  private fieldOf(code: AddItemErrorCode): string {
    if (code.startsWith("name-")) return "name";
    if (code === "kind-missing") return "kind";
    if (code === "location-missing") return "location";
    if (code === "quantity-invalid") return "quantity";
    return "details";
  }

  /**
   * Like a web form: each wrong field is outlined and says what is wrong right under itself.
   * The first one is brought into view, and a name gets the cursor.
   */
  private showFieldErrors(codes: readonly AddItemErrorCode[]): void {
    let first: HTMLElement | null = null;
    for (const code of codes) {
      const key = this.fieldOf(code);
      const row = this.fieldEls.get(key);
      if (!row) continue;
      row.addClass("is-invalid");
      const message = createDiv({ cls: "inventory-ui__field-error", text: STRINGS.errors[code] });
      message.dataset.forField = key;
      row.after(message);
      first ??= row;
      if (key === "name") this.nameInput?.focus();
    }
    first?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  private clearFieldErrors(key?: string): void {
    for (const [field, row] of this.fieldEls) {
      if (key !== undefined && field !== key) continue;
      row.removeClass("is-invalid");
      const next = row.nextElementSibling;
      if (next instanceof HTMLElement && next.dataset.forField === field) next.remove();
    }
  }

  private showError(message: string): void {
    this.errorEl?.setText(message);
  }
}
