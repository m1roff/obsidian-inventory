import { addIcon, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { AddItemService } from "./domain/AddItemService";
import { AddReferenceService } from "./domain/AddReferenceService";
import { DefaultLocation } from "./domain/DefaultLocation";
import { RenameReferenceService } from "./domain/RenameReferenceService";
import { AttachCoverService } from "./domain/AttachCoverService";
import { IdGenerator } from "./domain/IdGenerator";
import { stockStatePolicy } from "./domain/DashboardPreferences";
import { InventorySearch, stateQuery } from "./domain/InventorySearch";
import { InventorySorter } from "./domain/InventorySorter";
import { enabledModules } from "./domain/modules/ModuleSet";
import { LocationBoard } from "./domain/LocationBoard";
import { SimilarItemFinder } from "./domain/SimilarItemFinder";
import { StateUsage } from "./domain/StateUsage";
import { StockService } from "./domain/StockService";
import { CryptoRandomSource } from "./obsidian/CryptoRandomSource";
import { PreferenceFolders } from "./obsidian/PreferenceFolders";
import { addDevVaultCommands } from "./dev/DevVaultCommands";
import { addHapticsProbe } from "./dev/HapticsProbe";
import { addHoldLab } from "./dev/HoldLab";
import { addPatternLab } from "./dev/PatternLab";
import { SampleDataSeeder } from "./dev/SampleDataSeeder";
import { ExplorerShortcut } from "./ui/ExplorerShortcut";
import { StructureApplier } from "./domain/structure/StructureApplier";
import { SetupService } from "./domain/structure/SetupService";
import { InstalledPlugins } from "./obsidian/InstalledPlugins";
import { VaultStructure } from "./obsidian/VaultStructure";
import { StructureModal } from "./ui/StructureModal";
import { PluginPreferences } from "./obsidian/PluginPreferences";
import { VaultCoverWriter } from "./obsidian/VaultCoverWriter";
import { FileDebugLog } from "./obsidian/FileDebugLog";
import { VaultPlaceCoverWriter } from "./obsidian/VaultPlaceCoverWriter";
import { PhotoAttacher } from "./ui/PhotoAttacher";
import { VaultPhotoSectionChooser } from "./ui/PhotoSectionChooser";
import { Haptics } from "./ui/Haptics";
import { installToggleHaptics } from "./ui/ToggleHaptics";
import { DeviceHaptics } from "./obsidian/DeviceHaptics";
import { VaultInventoryRepository } from "./obsidian/VaultInventoryRepository";
import { VaultInventoryWriter } from "./obsidian/VaultInventoryWriter";
import { VaultReferenceLists } from "./obsidian/VaultReferenceLists";
import { VaultReferenceWriter } from "./obsidian/VaultReferenceWriter";
import { CardToolbar } from "./ui/CardToolbar";
import { ItemBarSource } from "./ui/ItemBarSource";
import { AddItemLauncher } from "./ui/AddItemLauncher";
import { ItemRow } from "./ui/ItemRow";
import { PlaceBarSource } from "./ui/PlaceBarSource";
import { PlaceItemsPanel } from "./ui/PlaceItemsPanel";
import { PlaceQr } from "./ui/PlaceQr";
import { findEntryById, findPlaceById, ITEM_LINK_ACTION } from "./domain/ItemLink";
import { PlaceIds } from "./domain/PlaceIds";
import { JsQrDecoder } from "./obsidian/JsQrDecoder";
import { UqrEncoder } from "./obsidian/UqrEncoder";
import { buildItemLink } from "./domain/ItemLink";
import { qrPalette } from "./domain/QrStyle";
import { renderQrLabel } from "./ui/QrLabelRenderer";
import { INVENTORY_ICON_ID, inventoryIconMarkup } from "./ui/InventoryIcon";
import { InventoryLogo, PlaceLogo } from "./ui/QrLogo";
import { QrLabels } from "./ui/QrLabels";
import { LocationLabelExport } from "./domain/LabelExport";
import { InventorySettingTab, SettingsTab } from "./ui/InventorySettingTab";
import { ItemActions } from "./ui/ItemActions";
import { STRINGS } from "./ui/strings";
import { INVENTORY_VIEW_TYPE, InventoryView } from "./ui/InventoryView";

/** What the dashboard was showing: kept so the "Dashboard" button of a card can bring it back. */
interface DashboardFilter {
  readonly query: string;
  readonly location: string | null;
}

/** Wait this long at startup for a link (a scanned label) before opening the dashboard on top of it. */
const STARTUP_LINK_GRACE_MS = 400;

export default class InventoryUiPlugin extends Plugin {
  /** A link opened a note since start: the dashboard must not cover it. */
  private linkHandled = false;
  private lastFilter: DashboardFilter | null = null;

  async onload(): Promise<void> {
    addIcon(INVENTORY_ICON_ID, inventoryIconMarkup());
    const preferences = new PluginPreferences(this);
    await preferences.load();

    const folders = new PreferenceFolders(preferences);
    const repository = new VaultInventoryRepository(this.app, folders, () => stockStatePolicy(preferences.get()));
    const clock = { now: () => new Date() };
    const writer = new VaultInventoryWriter(this.app, folders);
    const idGenerator = new IdGenerator(new CryptoRandomSource());
    const addItem = new AddItemService(repository, writer, idGenerator, clock);
    const stock = new StockService(writer, clock);
    const haptics = new Haptics(new DeviceHaptics(), () => preferences.get().settings.haptics);
    installToggleHaptics(this, haptics);
    const debugLog = new FileDebugLog(
      this.app,
      `${this.manifest.dir ?? ""}/debug.log`,
      () => preferences.get().settings.debugLog,
      clock,
    );
    const photoSections = new VaultPhotoSectionChooser(this.app);
    const itemPhotos = new PhotoAttacher(
      new AttachCoverService(new VaultCoverWriter(this.app, debugLog), clock),
      null,
      debugLog,
      true,
      photoSections,
    );
    const placeCovers = new VaultPlaceCoverWriter(this.app, debugLog);
    const placePhotos = new PhotoAttacher(new AttachCoverService(placeCovers, clock), placeCovers, debugLog);
    // The place's own note takes several photos; the tile on the dashboard has one cover, so one photo.
    const placeCardPhotos = new PhotoAttacher(
      new AttachCoverService(placeCovers, clock),
      placeCovers,
      debugLog,
      true,
      photoSections,
    );
    const references = new VaultReferenceLists(this.app, folders);
    const referenceWriter = new VaultReferenceWriter(this.app, folders);
    const addReference = new AddReferenceService(references, referenceWriter, idGenerator);
    const placeIds = new PlaceIds(references, idGenerator, referenceWriter);
    const actions = new ItemActions(this.app, {
      stock,
      photos: itemPhotos,
      haptics,
      references,
      addReference,
      searchThreshold: () => preferences.get().settings.searchThreshold,
      states: () => stockStatePolicy(preferences.get()),
    });

    const structure = new VaultStructure(this.app);
    const setup = new SetupService(
      structure,
      new StructureApplier(structure),
      new InstalledPlugins(this.app),
      () => folders.layout(),
      () => stockStatePolicy(preferences.get()),
      () => enabledModules(preferences.get().settings.filament),
    );
    const defaultLocation = new DefaultLocation(
      references,
      addReference,
      new RenameReferenceService(references, referenceWriter),
      {
        name: () => preferences.get().settings.defaultLocation,
        setName: (name) => {
          const current = preferences.get();
          preferences.set({ ...current, settings: { ...current.settings, defaultLocation: name } });
        },
      },
      () => setup.isInitialized(),
    );
    const openStructure = (): void => {
      new StructureModal(this.app, setup, () => this.refreshDashboards()).open();
    };

    const qrDecoder = new JsQrDecoder();
    const itemLogo = new InventoryLogo();
    const placeLogo = new PlaceLogo(itemLogo);
    const qrEncoder = new UqrEncoder();
    const qrLabels = new QrLabels(this.app, {
      encoder: qrEncoder,
      itemLogo,
      placeLogo,
      style: () => preferences.get().settings.qrStyle,
    });

    const placeQr = new PlaceQr(placeIds, qrLabels);
    const addItemLauncher = new AddItemLauncher(this.app, {
      service: addItem,
      references,
      addReference,
      preferences,
      defaultLocation,
      haptics,
      repository,
      similar: new SimilarItemFinder(),
    });

    // A scanned label (or a link) opens its item by id, wherever the note lives.
    this.registerObsidianProtocolHandler(ITEM_LINK_ACTION, (params) => {
      this.linkHandled = true;
      // A place label opens the dashboard filtered by that place.
      if (params.place) {
        const place = findPlaceById(references.places(), params.place);
        if (!place) {
          new Notice(STRINGS.qrNoPlace(params.place));
          return;
        }
        void this.showPlaceOnDashboard(place.name);
        return;
      }

      const entry = findEntryById(repository.loadEntries(), params.id ?? "");
      if (!entry) {
        new Notice(STRINGS.qrNoItem(params.id ?? ""));
        return;
      }
      void this.app.workspace.openLinkText(entry.item.path, "", false);
    });

    // The settings tab is made below; the views reach it only when a button is pressed.
    let settingTab: InventorySettingTab | null = null;
    const openSettings = (tab: SettingsTab): void => {
      settingTab?.showTab(tab);
      this.app.setting?.open();
      this.app.setting?.openTabById(this.manifest.id);
    };

    this.registerView(
      INVENTORY_VIEW_TYPE,
      (leaf) =>
        new InventoryView(leaf, {
          repository,
          search: new InventorySearch(),
          sorter: new InventorySorter(),
          references,
          addItemLauncher,
          actions,
          addReference,
          defaultLocation,
          placePhotos,
          haptics,
          locationBoard: new LocationBoard(),
          preferences,
          qrDecoder,
          placeQr,
          setup,
          openSettings,
          states: () => stockStatePolicy(preferences.get()),
          rememberFilter: (filter) => {
            this.lastFilter = filter;
          },
        }),
    );

    this.addRibbonIcon(INVENTORY_ICON_ID, STRINGS.openInventory, () => {
      void this.openInventory();
    });
    this.addCommand({
      id: "open-inventory",
      name: STRINGS.openInventory,
      callback: () => {
        void this.openInventory();
      },
    });

    settingTab = new InventorySettingTab(this.app, this, {
        preferences,
        placeIds,
        openStructure,
        onChanged: () => this.refreshDashboards(),
        references,
        defaultLocation,
        locationExport: new LocationLabelExport(placeIds),
        entries: () => repository.loadEntries(),
        icons: { itemLogo, placeLogo },
        qrSample: (style) =>
          renderQrLabel(
            qrEncoder.encode(buildItemLink("Inventory", "AB-CD-123")),
            "AB-CD-123",
            { showId: false, showCaption: false, caption: "" },
            itemLogo,
            qrPalette(style),
          ),
        debugLog,
        stateUsage: () => new StateUsage(repository.loadEntries()),
        showState: (state) => {
          this.app.setting?.close();
          void this.showSearchOnDashboard(stateQuery(state));
        },
    });
    this.addSettingTab(settingTab);

    // The rows of the list in a place's note are the dashboard's rows: one class draws both.
    const openCard = (path: string): void => {
      void this.app.workspace.openLinkText(path, "", false);
    };
    const placeItems = new PlaceItemsPanel({
      repository,
      search: new InventorySearch(),
      sorter: new InventorySorter(),
      preferences,
      onAdd: (place) =>
        addItemLauncher.open({
          fixedLocation: place.name,
          onOpenCard: (path) => openCard(path),
          // Added from the place's own note: stay in it, the new item shows up in its list.
          onAdded: (added) => {
            new Notice(STRINGS.added(added.name, added.id));
          },
        }),
      row: new ItemRow({
        states: () => stockStatePolicy(preferences.get()),
        actions,
        openCard,
        coverUrl: (path) => {
          const file = path === null ? null : this.app.vault.getFileByPath(path);
          return file ? this.app.vault.getResourcePath(file) : null;
        },
        onChanged: () => undefined,
      }),
    });

    new CardToolbar(this, {
      sources: [
        new ItemBarSource(repository, actions, qrLabels, () => folders.items),
        new PlaceBarSource(references, placeQr, () => folders.locations, placeItems, placeCardPhotos),
      ],
      openInventory: (fromLeaf) => {
        void this.openInventory(fromLeaf);
      },
    }).start();

    // A way to the dashboard from the left menu, wherever the owner is working.
    new ExplorerShortcut(this, () => {
      void this.openInventory();
    }).start();

    // The inventory screen is the home screen of this vault.
    // But not on top of a note the app was just opened to by a scanned label.
    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => {
        const { openOnStart } = preferences.get().settings;
        if (openOnStart && !this.linkHandled) void this.openInventory();
      }, STARTUP_LINK_GRACE_MS);
    });

    if (__DEV__) {
      addDevVaultCommands(this);
      addHapticsProbe(this);
      addHoldLab(this);
      addPatternLab(this);
      const seeder = new SampleDataSeeder(addReference, addItem);
      this.addCommand({
        id: "dev-add-sample-data",
        name: "Dev: add sample data (kinds, locations, items)",
        callback: () => {
          seeder.seed().then(
            (result) => {
              new Notice(`Sample data: added ${result.added}, already there ${result.skipped}`);
              this.refreshDashboards();
            },
            (error: unknown) => {
              console.error(error);
              new Notice("Could not add sample data. Is the structure set up? See the console.");
            },
          );
        },
      });
    }
  }

  private async showSearchOnDashboard(query: string): Promise<void> {
    await this.openInventory();
    for (const leaf of this.app.workspace.getLeavesOfType(INVENTORY_VIEW_TYPE)) {
      if (leaf.view instanceof InventoryView) leaf.view.showSearch(query);
    }
  }

  private async showPlaceOnDashboard(name: string): Promise<void> {
    await this.openInventory();
    for (const leaf of this.app.workspace.getLeavesOfType(INVENTORY_VIEW_TYPE)) {
      if (leaf.view instanceof InventoryView) leaf.view.showLocation(name);
    }
  }

  private refreshDashboards(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(INVENTORY_VIEW_TYPE)) {
      if (leaf.view instanceof InventoryView) leaf.view.refresh();
    }
  }

  /**
   * Shows the dashboard. Asked from a card (`fromLeaf`), it takes over that very
   * tab instead of opening another one next to it, or, when a dashboard is open
   * elsewhere, goes there and closes the card's tab.
   */
  private async openInventory(fromLeaf?: WorkspaceLeaf): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace
      .getLeavesOfType(INVENTORY_VIEW_TYPE)
      .find((leaf) => leaf !== fromLeaf);

    if (existing) {
      await workspace.revealLeaf(existing);
      fromLeaf?.detach();
      return;
    }

    const leaf = fromLeaf ?? workspace.getLeaf("tab");
    // Coming back from a card in the same tab: show the dashboard as it was left (filter, search).
    const state = fromLeaf && this.lastFilter ? { ...this.lastFilter } : undefined;
    if (fromLeaf) this.lastFilter = null;
    await leaf.setViewState({ type: INVENTORY_VIEW_TYPE, active: true, state });
    await workspace.revealLeaf(leaf);
  }
}
