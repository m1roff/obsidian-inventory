import { App, Notice, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
  DashboardPreferencesStore,
  DashboardSettings,
  DEFAULT_DASHBOARD_PREFERENCES,
  FOLDED_COUNT_MAX,
  FOLDED_COUNT_MIN,
  PLACE_ITEMS_ALL,
  PLACE_ITEMS_MIN,
  SEARCH_THRESHOLD_MAX,
  SEARCH_THRESHOLD_MIN,
} from "../domain/DashboardPreferences";
import { AddReferenceError } from "../domain/AddReferenceService";
import { DefaultLocation } from "../domain/DefaultLocation";
import { InventoryEntry } from "../domain/InventoryEntry";
import { Item } from "../domain/Item";
import { Place } from "../domain/Place";
import { LocationLabelExport } from "../domain/LabelExport";
import { PlaceIds } from "../domain/PlaceIds";
import { QR_STYLES, QrStyle } from "../domain/QrStyle";
import { ReferenceLists } from "../domain/ReferenceLists";
import { StateUsage } from "../domain/StateUsage";
import { isBuiltInState, StockStateError, StockStatePolicy } from "../domain/StockState";
import { isValidBaseFolder, normalizeBaseFolder } from "../domain/structure/StructureLayout";
import { confirmAction } from "./ConfirmModal";
import { IconExportDeps, IconExportPanel } from "./IconExportPanel";
import { itemExportPanel, locationExportPanel } from "./LabelExportPanels";
import { LabelExportPanel } from "./LabelExportPanel";
import { promptForName } from "./NamePrompt";
import { SelectField } from "./SelectField";
import { STRINGS } from "./strings";

/**
 * `SliderComponent.setDisplayFormat` exists since Obsidian 1.13, above the version this plugin
 * supports, so it is reached through this shape and only called when the running app has it.
 */
interface FormattableSlider {
  setDisplayFormat?: (format: (value: number) => string) => unknown;
}

export const SETTINGS_TABS = ["general", "dashboard", "locations", "items", "states", "mobile", "structure", "danger"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Saving and redrawing happen once the slider has stopped moving. */
const APPLY_DELAY_MS = 300;

export interface InventorySettingTabDeps {
  readonly preferences: DashboardPreferencesStore;
  readonly placeIds: PlaceIds;
  /** Opens the structure check (the same window as on the dashboard). */
  readonly openStructure: () => void;
  /** Redraws the open dashboards. */
  readonly onChanged: () => void;
  /** How many positions sit in each state, read from the vault. */
  readonly stateUsage: () => StateUsage;
  /** Shows the items that have units in a state on the dashboard. */
  readonly showState: (state: string) => void;
  readonly references: ReferenceLists;
  readonly defaultLocation: DefaultLocation;
  /** Builds the label table of locations for export. */
  readonly locationExport: LocationLabelExport;
  /** Every item with its positions, read from the vault (only when a block that needs it opens). */
  readonly entries: () => readonly InventoryEntry[];
  /** The QR emblems that can be shared as PNG files. */
  readonly icons: IconExportDeps;
  /** Draws a sample QR code in the given look, to choose from. */
  readonly qrSample: (style: QrStyle) => HTMLCanvasElement;
  /** The file the debug log is kept in. */
  readonly debugLog: { read(): Promise<string>; clear(): Promise<void> };
}

export class InventorySettingTab extends PluginSettingTab {
  private tab: SettingsTab = "general";
  private pending: Partial<DashboardSettings> = {};
  private timer: number | null = null;
  private statesEl: HTMLElement | null = null;
  private modulesEl: HTMLElement | null = null;
  /** Read once when the tab opens: reading the vault on every tick would be wasteful. */
  private usage: StateUsage | null = null;
  private readonly exportPanel: LabelExportPanel<Place>;
  private readonly itemsPanel: LabelExportPanel<Item>;
  private readonly iconPanel: IconExportPanel;

  constructor(
    app: App,
    plugin: Plugin,
    private readonly deps: InventorySettingTabDeps,
  ) {
    super(app, plugin);
    this.exportPanel = locationExportPanel({
      places: () => deps.references.places(),
      vaultName: () => app.vault.getName(),
      exporter: deps.locationExport,
      showSearchHelp: () => deps.preferences.get().settings.showSearchHelp,
    });
    this.itemsPanel = itemExportPanel({
      app,
      entries: () => deps.entries(),
      locationOptions: () => deps.references.locationOptions(),
      placeTree: () => deps.references.placeTree(),
      vaultName: () => app.vault.getName(),
      searchThreshold: () => deps.preferences.get().settings.searchThreshold,
      showSearchHelp: () => deps.preferences.get().settings.showSearchHelp,
    });
    this.iconPanel = new IconExportPanel(deps.icons);
  }

  /** Makes the next opening of the settings land on this tab (the gear button on the dashboard). */
  showTab(tab: SettingsTab): void {
    this.flush();
    this.tab = tab;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("inventory-ui__settings");
    this.renderTabs(containerEl);
    const page = containerEl.createDiv({ cls: "inventory-ui__settings-page" });
    const settings = this.deps.preferences.get().settings;
    switch (this.tab) {
      case "general": this.renderGeneral(page, settings); break;
      case "dashboard": this.renderDashboard(page, settings); break;
      case "locations": this.renderLocations(page, settings); break;
      case "items": this.itemsPanel.render(page); break;
      case "states": this.renderStatesPage(page); break;
      case "mobile": this.renderMobile(page, settings); break;
      case "structure": this.renderStructure(page, settings); break;
      case "danger": this.renderDanger(page); break;
    }
  }

  /** The row of tabs at the top: one page of settings at a time. */
  private renderTabs(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: "inventory-ui__settings-tabs", attr: { role: "tablist" } });
    for (const tab of SETTINGS_TABS) {
      const button = bar.createEl("button", {
        text: STRINGS.settingsTabs[tab],
        cls: "inventory-ui__settings-tab",
        attr: { role: "tab", "aria-selected": String(tab === this.tab) },
      });
      button.toggleClass("is-active", tab === this.tab);
      button.toggleClass("is-danger", tab === "danger");
      button.addEventListener("click", () => {
        if (tab === this.tab) return;
        this.flush();
        this.tab = tab;
        this.display();
      });
    }
  }

  /** QR labels. */
  private renderGeneral(containerEl: HTMLElement, settings: DashboardSettings): void {
    this.addQrStyle(containerEl, settings.qrStyle);
    this.iconPanel.render(containerEl);
    new Setting(containerEl)
      .setName(STRINGS.searchHelpName)
      .setDesc(STRINGS.searchHelpDesc)
      .addToggle((toggle) =>
        toggle.setValue(settings.showSearchHelp).onChange((value) => this.change({ showSearchHelp: value })),
      );
    this.addDebugLog(containerEl, settings.debugLog);
  }

  /** The switch for the trace of photo steps, and buttons to take the text away or wipe it. */
  private addDebugLog(parent: HTMLElement, on: boolean): void {
    new Setting(parent)
      .setName(STRINGS.debugLogName)
      .setDesc(STRINGS.debugLogDesc)
      .addToggle((toggle) => toggle.setValue(on).onChange((value) => this.change({ debugLog: value })));
    new Setting(parent)
      .setName(STRINGS.debugLogCopyName)
      .setDesc(STRINGS.debugLogCopyDesc)
      .addButton((button) =>
        button.setButtonText(STRINGS.debugLogCopy).onClick(() => void this.copyDebugLog()),
      )
      .addButton((button) =>
        button.setButtonText(STRINGS.debugLogClear).onClick(() => {
          this.deps.debugLog.clear().then(
            () => new Notice(STRINGS.debugLogCleared),
            (error: unknown) => console.error(error),
          );
        }),
      );
  }

  private async copyDebugLog(): Promise<void> {
    try {
      const text = await this.deps.debugLog.read();
      if (text === "") {
        new Notice(STRINGS.debugLogEmpty);
        return;
      }
      await navigator.clipboard.writeText(text);
      new Notice(STRINGS.debugLogCopied);
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.debugLogCopyFailed);
    }
  }

  /** The main screen. */
  private renderDashboard(containerEl: HTMLElement, settings: DashboardSettings): void {
    new Setting(containerEl)
      .setName(STRINGS.openOnStartName)
      .setDesc(STRINGS.openOnStartDesc)
      .addToggle((toggle) =>
        toggle.setValue(settings.openOnStart).onChange((value) => this.change({ openOnStart: value })),
      );
    this.addCountSetting(
      containerEl,
      STRINGS.foldedItemsName,
      STRINGS.foldedItemsDesc,
      settings.foldedItemCount,
      (value) => this.change({ foldedItemCount: value }),
    );
    this.addCountSetting(
      containerEl,
      STRINGS.foldedLocationsName,
      STRINGS.foldedLocationsDesc,
      settings.foldedLocationCount,
      (value) => this.change({ foldedLocationCount: value }),
    );
    this.addCountSetting(
      containerEl,
      STRINGS.searchThresholdName,
      STRINGS.searchThresholdDesc,
      settings.searchThreshold,
      (value) => this.change({ searchThreshold: value }),
      SEARCH_THRESHOLD_MIN,
      SEARCH_THRESHOLD_MAX,
    );

  }

  /** Places and their tiles. */
  private renderLocations(containerEl: HTMLElement, settings: DashboardSettings): void {
    this.addDefaultLocation(containerEl);
    new Setting(containerEl)
      .setName(STRINGS.showPlaceCoversName)
      .setDesc(STRINGS.showPlaceCoversDesc)
      .addToggle((toggle) =>
        toggle.setValue(settings.showPlaceCovers).onChange((value) => this.change({ showPlaceCovers: value })),
      );
    this.addCountSetting(
      containerEl,
      STRINGS.placeItemsName,
      STRINGS.placeItemsDesc,
      settings.placeItemsShown,
      (value) => this.change({ placeItemsShown: value }),
      PLACE_ITEMS_MIN,
      PLACE_ITEMS_ALL,
      (count) => (count >= PLACE_ITEMS_ALL ? STRINGS.placeItemsAllValue : String(count)),
    );
    new Setting(containerEl)
      .setName(STRINGS.placeIdsName)
      .setDesc(STRINGS.placeIdsDesc)
      .addButton((button) =>
        button.setButtonText(STRINGS.placeIdsButton).onClick(() => this.confirmPlaceIds()),
      );
    this.exportPanel.render(containerEl);
  }

  /** The stock states list. */
  private renderStatesPage(containerEl: HTMLElement): void {
    this.usage = this.deps.stateUsage();
    this.statesEl = containerEl.createDiv();
    this.renderStates();

  }

  /** Things that only matter on a phone. */
  private renderMobile(containerEl: HTMLElement, settings: DashboardSettings): void {
    // A computer has nothing to feel: the switch is shown but muted, with the reason.
    const hapticsRow = new Setting(containerEl)
      .setName(STRINGS.hapticsName)
      .setDesc(Platform.isMobile ? STRINGS.hapticsDesc : `${STRINGS.hapticsDesc} ${STRINGS.hapticsDesktopNote}`)
      .addToggle((toggle) =>
        toggle
          .setValue(settings.haptics)
          .setDisabled(!Platform.isMobile)
          .onChange((value) => this.change({ haptics: value })),
      );
    if (!Platform.isMobile) hapticsRow.settingEl.addClass("inventory-ui__setting-muted");

  }

  /** What lies in the vault. */
  private renderStructure(containerEl: HTMLElement, settings: DashboardSettings): void {
    this.addBaseFolderSetting(containerEl, settings.baseFolder);
    this.modulesEl = containerEl.createDiv();
    this.renderModules();
    new Setting(containerEl)
      .setName(STRINGS.checkStructureName)
      .setDesc(STRINGS.checkStructureDesc)
      .addButton((button) =>
        button.setButtonText(STRINGS.checkStructureButton).onClick(() => this.deps.openStructure()),
      );

  }

  /** Set apart and in the warning colour, so it is not pressed by accident. */
  private renderDanger(containerEl: HTMLElement): void {
    const danger = containerEl.createDiv({ cls: "inventory-ui__danger-zone" });
    new Setting(danger).setName(STRINGS.sectionDanger).setDesc(STRINGS.sectionDangerDesc).setHeading();
    new Setting(danger)
      .setName(STRINGS.resetName)
      .setDesc(STRINGS.resetDesc)
      .addButton((button) =>
        button
          .setButtonText(STRINGS.resetButton)
          .setWarning()
          .onClick(() => this.confirmReset()),
      );
  }

  /** Two sample codes, dark and light: tap one to make it the default look of new QR labels. */
  private addQrStyle(parent: HTMLElement, current: QrStyle): void {
    new Setting(parent).setName(STRINGS.qrStyleName).setDesc(STRINGS.qrStyleDesc);
    const choices = parent.createDiv({ cls: "inventory-ui__qr-choices" });
    const names: Record<QrStyle, string> = { dark: STRINGS.qrStyleDark, light: STRINGS.qrStyleLight };
    const buttons = new Map<QrStyle, HTMLElement>();
    for (const style of QR_STYLES) {
      const button = choices.createEl("button", {
        cls: "inventory-ui__qr-choice",
        attr: { "aria-label": names[style], "aria-pressed": String(style === current) },
      });
      button.toggleClass("is-selected", style === current);
      button.appendChild(this.deps.qrSample(style));
      button.createSpan({ text: names[style] });
      button.addEventListener("click", () => {
        this.change({ qrStyle: style });
        for (const [other, el] of buttons) {
          el.toggleClass("is-selected", other === style);
          el.setAttribute("aria-pressed", String(other === style));
        }
      });
      buttons.set(style, button);
    }
  }

  /** Which location new items go to, and a way to rename it. There is always one. */
  private addDefaultLocation(parent: HTMLElement): void {
    const current = this.deps.defaultLocation.current();
    if (current === null) {
      // A fresh vault: the default location is created now, then this block is drawn again.
      void this.deps.defaultLocation
        .ensure()
        .then((name) => {
          if (name !== null) this.display();
        })
        .catch((error: unknown) => console.error(error));
      return;
    }
    const select = new SelectField(this.app, parent, {
      searchThreshold: () => this.deps.preferences.get().settings.searchThreshold,
      label: STRINGS.defaultLocationName,
      options: () => this.deps.references.locationOptions(),
      value: current,
      onChange: (name) => this.deps.defaultLocation.choose(name),
    });
    select.setting.setDesc(STRINGS.defaultLocationDesc);
    select.setting.settingEl.addClass("inventory-ui__select-inline");

    new Setting(parent)
      .setName(STRINGS.renameDefaultName)
      .setDesc(STRINGS.renameDefaultDesc)
      .addButton((button) =>
        button.setButtonText(STRINGS.renameButton).onClick(() => {
          promptForName(this.app, STRINGS.renameDefaultTitle, (typed) => {
            void this.renameDefault(typed);
          });
        }),
      );
  }

  private async renameDefault(typed: string): Promise<void> {
    try {
      const name = await this.deps.defaultLocation.rename(typed);
      this.deps.onChanged();
      new Notice(STRINGS.defaultLocationRenamed(name));
      this.display();
    } catch (error) {
      if (error instanceof AddReferenceError) new Notice(STRINGS.referenceErrors[error.code]);
      else {
        console.error(error);
        new Notice(STRINGS.unexpectedError);
      }
    }
  }

  private policy(): StockStatePolicy {
    return new StockStatePolicy(this.deps.preferences.get().settings.stockStates);
  }

  private saveStates(next: StockStatePolicy): void {
    this.flush();
    const prefs = this.deps.preferences.get();
    this.deps.preferences.set({ ...prefs, settings: { ...prefs.settings, stockStates: next.states } });
    this.deps.onChanged();
    this.renderStates();
  }

  /** The list of states: tick (counts in stock), order, remove for the owner's own, and adding. */
  private renderStates(): void {
    const parent = this.statesEl;
    if (!parent) return;
    parent.empty();
    const policy = this.policy();

    new Setting(parent).setName(STRINGS.statesName).setDesc(STRINGS.statesDesc).setHeading();

    const usage = this.usage ?? this.deps.stateUsage();
    policy.states.forEach((state, index) => {
      const used = usage.count(state.name);
      const base = isBuiltInState(state.name) ? STRINGS.stateBuiltIn : STRINGS.stateOwn;
      const row = new Setting(parent)
        .setName(STRINGS.stateLabel(state.name))
        .setDesc(used > 0 ? `${base} ${STRINGS.stateUsed(used)}.` : base)
        .addToggle((toggle) =>
          toggle.setValue(state.counts).onChange((value) => this.saveStates(policy.setCounts(state.name, value))),
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-up")
            .setTooltip(STRINGS.stateMoveUp)
            .setDisabled(index === 0)
            .onClick(() => this.saveStates(policy.shift(state.name, -1))),
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-down")
            .setTooltip(STRINGS.stateMoveDown)
            .setDisabled(index === policy.states.length - 1)
            .onClick(() => this.saveStates(policy.shift(state.name, 1))),
        );
      if (used > 0) {
        row.addExtraButton((button) =>
          button
            .setIcon("search")
            .setTooltip(STRINGS.stateFind)
            .onClick(() => {
              this.deps.showState(state.name);
              new Notice(STRINGS.stateFindNotice(STRINGS.stateLabel(state.name)));
            }),
        );
      }
      if (!isBuiltInState(state.name)) {
        // A state that is in use cannot go: its units would be left in a state the list does not know.
        row.addExtraButton((button) =>
          button
            .setIcon("trash-2")
            .setTooltip(used > 0 ? STRINGS.stateRemoveBlocked(used) : STRINGS.stateRemove)
            .setDisabled(used > 0)
            .onClick(() => {
              try {
                this.saveStates(policy.remove(state.name, usage));
              } catch (error) {
                if (error instanceof StockStateError) new Notice(STRINGS.stateErrors[error.code]);
                else throw error;
              }
            }),
        );
      }
    });

    let typed = "";
    new Setting(parent)
      .setName(STRINGS.stateAddName)
      .setDesc(STRINGS.stateAddDesc)
      .addText((text) => text.setPlaceholder(STRINGS.stateAddPlaceholder).onChange((value) => (typed = value)))
      .addButton((button) =>
        button.setButtonText(STRINGS.stateAddButton).onClick(() => {
          try {
            this.saveStates(policy.add(typed, true));
          } catch (error) {
            if (error instanceof StockStateError) new Notice(STRINGS.stateErrors[error.code]);
            else throw error;
          }
        }),
      );
  }

  /** Optional modules: for now only filament. */
  private renderModules(): void {
    const parent = this.modulesEl;
    if (!parent) return;
    parent.empty();
    const filament = this.deps.preferences.get().settings.filament;

    new Setting(parent)
      .setName(STRINGS.filamentName)
      .setDesc(STRINGS.filamentDesc)
      .addToggle((toggle) =>
        toggle.setValue(filament.enabled).onChange((value) => {
          this.saveFilament({ ...this.deps.preferences.get().settings.filament, enabled: value });
          if (value) new Notice(STRINGS.filamentTurnedOn);
          this.renderModules();
        }),
      );

    if (!filament.enabled) return;
    new Setting(parent)
      .setName(STRINGS.filamentKindName)
      .setDesc(STRINGS.filamentKindDesc)
      .addText((text) =>
        text
          .setPlaceholder(STRINGS.filamentKindPlaceholder)
          .setValue(filament.kind)
          .onChange((value) => {
            const kind = value.trim();
            if (kind === "") return;
            this.saveFilament({ ...this.deps.preferences.get().settings.filament, kind });
          }),
      );
  }

  private saveFilament(next: DashboardSettings["filament"]): void {
    this.flush();
    const prefs = this.deps.preferences.get();
    this.deps.preferences.set({ ...prefs, settings: { ...prefs.settings, filament: next } });
    this.deps.onChanged();
  }

  private addBaseFolderSetting(parent: HTMLElement, current: string): void {
    let typed = current;
    new Setting(parent)
      .setName(STRINGS.baseFolderName)
      .setDesc(STRINGS.baseFolderDesc)
      .addText((text) =>
        text
          .setPlaceholder(STRINGS.baseFolderPlaceholder)
          .setValue(current)
          .onChange((value) => {
            typed = value;
          }),
      )
      .addButton((button) =>
        button.setButtonText(STRINGS.baseFolderSave).onClick(() => {
          if (!isValidBaseFolder(typed)) {
            new Notice(STRINGS.baseFolderInvalid);
            return;
          }
          const name = normalizeBaseFolder(typed);
          this.flush();
          const prefs = this.deps.preferences.get();
          this.deps.preferences.set({ ...prefs, settings: { ...prefs.settings, baseFolder: name } });
          this.deps.onChanged();
          new Notice(STRINGS.baseFolderSaved(name));
        }),
      );
  }

  /** Applies a slider change that is still waiting when the tab is closed. */
  hide(): void {
    this.flush();
  }

  private addCountSetting(
    parent: HTMLElement,
    name: string,
    description: string,
    value: number,
    onChange: (value: number) => void,
    min = FOLDED_COUNT_MIN,
    max = FOLDED_COUNT_MAX,
    /** What the number beside the slider reads as; the number itself by default. */
    format?: (value: number) => string,
  ): void {
    new Setting(parent)
      .setName(name)
      .setDesc(description)
      .addSlider((slider) => {
        slider.setLimits(min, max, 1).setValue(value).onChange(onChange);
        const formattable = slider as unknown as FormattableSlider;
        // The inline readout and its formatter came with Obsidian 1.13; older ones show a tooltip.
        if (format && typeof formattable.setDisplayFormat === "function") formattable.setDisplayFormat(format);
        else slider.setDynamicTooltip();
      });
  }

  private change(patch: Partial<DashboardSettings>): void {
    this.pending = { ...this.pending, ...patch };
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), APPLY_DELAY_MS);
  }

  private flush(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (Object.keys(this.pending).length === 0) return;

    const current = this.deps.preferences.get();
    this.deps.preferences.set({
      ...current,
      settings: { ...current.settings, ...this.pending },
    });
    this.pending = {};
    this.deps.onChanged();
  }

  private confirmPlaceIds(): void {
    const missing = this.deps.placeIds.withoutId();
    if (missing.length === 0) {
      new Notice(STRINGS.placeIdsNothingToDo);
      return;
    }
    confirmAction(this.app, {
      items: missing.map((place) => place.name),
      title: STRINGS.placeIdsConfirmTitle,
      message: STRINGS.placeIdsConfirmMessage,
      confirmLabel: STRINGS.placeIdsButton,
      onConfirm: () => {
        this.deps.placeIds.assignMissing().then(
          (count) => {
            new Notice(STRINGS.placeIdsDone(count));
            this.deps.onChanged();
          },
          (error: unknown) => {
            console.error(error);
            new Notice(STRINGS.unexpectedError);
          },
        );
      },
    });
  }

  private confirmReset(): void {
    confirmAction(this.app, {
      title: STRINGS.resetConfirmTitle,
      message: STRINGS.resetConfirmMessage,
      confirmLabel: STRINGS.resetButton,
      onConfirm: () => {
        this.pending = {};
        // The base folder and the modules say what the vault is, not how it looks: they survive a reset.
        const { baseFolder, filament, defaultLocation } = this.deps.preferences.get().settings;
        this.deps.preferences.set({
          ...DEFAULT_DASHBOARD_PREFERENCES,
          settings: { ...DEFAULT_DASHBOARD_PREFERENCES.settings, baseFolder, filament, defaultLocation },
        });
        this.deps.onChanged();
        this.display();
        new Notice(STRINGS.resetDone);
      },
    });
  }
}
