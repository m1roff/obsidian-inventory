import { DEFAULT_QR_STYLE, parseQrStyle, QrStyle } from "./QrStyle";
import { DEFAULT_LOCATION_NAME } from "./DefaultLocation";
import { hasForbiddenCharacters } from "./NoteName";
import { LocationPreferences, parseLocationPreferences } from "./LocationBoard";
import { DEFAULT_FILAMENT_SETTINGS, FilamentSettings, parseFilamentSettings } from "./modules/FilamentSettings";
import { DEFAULT_BASE_FOLDER, isValidBaseFolder, normalizeBaseFolder } from "./structure/StructureLayout";
import { DEFAULT_STOCK_STATES, parseStockStates, StockStatePolicy, StockStateSetting } from "./StockState";
import { DEFAULT_SORT_MODE, parseSortMode, SortMode } from "./SortMode";

export const FOLDED_COUNT_MIN = 1;
export const FOLDED_COUNT_MAX = 20;
export const DEFAULT_FOLDED_COUNT = 3;

export const SEARCH_THRESHOLD_MIN = 0;
export const SEARCH_THRESHOLD_MAX = 20;
export const DEFAULT_SEARCH_THRESHOLD = 5;

/** What the owner can tune in the plugin's settings. */
export interface DashboardSettings {
  /** How many items a folded item list still shows. */
  readonly foldedItemCount: number;
  /** How many location tiles a folded locations block still shows. */
  readonly foldedLocationCount: number;
  /** A pick list longer than this gets a search field; 0 means always. */
  readonly searchThreshold: number;
  /** Open the dashboard when Obsidian starts. On by default. */
  readonly openOnStart: boolean;
  /** The states a unit can have, in the owner's order, and which of them count as in stock. */
  readonly stockStates: readonly StockStateSetting[];
  /** The folder everything of the plugin lives in. Not touched by "reset". */
  readonly baseFolder: string;
  /** The filament module. Like the base folder it says what the vault is, so "reset" keeps it. */
  readonly filament: FilamentSettings;
  /** The location a new item goes to by default. It names a note, so "reset" keeps it. */
  readonly defaultLocation: string;
  /** Show the place's photo as the background of its tile. On by default. */
  readonly showPlaceCovers: boolean;
  /** A small tick under the finger on switches and on a long press. On by default. */
  readonly haptics: boolean;
  /** The look of QR labels by their ground: light (black code on white, the default) or dark. */
  readonly qrStyle: QrStyle;
}

/** Settings plus what the dashboard remembers between sessions. */
export interface DashboardPreferences {
  readonly settings: DashboardSettings;
  readonly locations: LocationPreferences;
  /** Folded (the default): only the first few items show. Open: all of them. */
  readonly itemsExpanded: boolean;
  readonly itemsSort: SortMode;
  /** Runs the items sort against its natural direction (oldest first). */
  readonly itemsSortReversed: boolean;
}

/** Factory state: also what "reset" goes back to. */
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  settings: {
    foldedItemCount: DEFAULT_FOLDED_COUNT,
    foldedLocationCount: DEFAULT_FOLDED_COUNT,
    searchThreshold: DEFAULT_SEARCH_THRESHOLD,
    openOnStart: true,
    stockStates: DEFAULT_STOCK_STATES,
    baseFolder: DEFAULT_BASE_FOLDER,
    filament: DEFAULT_FILAMENT_SETTINGS,
    defaultLocation: DEFAULT_LOCATION_NAME,
    showPlaceCovers: true,
    haptics: true,
    qrStyle: DEFAULT_QR_STYLE,
  },
  locations: parseLocationPreferences(null),
  itemsExpanded: false,
  itemsSort: DEFAULT_SORT_MODE,
  itemsSortReversed: false,
};

/** A whole number within the allowed range; anything else gives the default. */
export function parseFoldedCount(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_FOLDED_COUNT;
  return Math.min(FOLDED_COUNT_MAX, Math.max(FOLDED_COUNT_MIN, Math.round(raw)));
}

/** A whole number within the allowed range; anything else gives the default. */
export function parseSearchThreshold(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_SEARCH_THRESHOLD;
  return Math.min(SEARCH_THRESHOLD_MAX, Math.max(SEARCH_THRESHOLD_MIN, Math.round(raw)));
}

/** A usable folder name; anything else gives the default. */
export function parseBaseFolder(raw: unknown): string {
  if (typeof raw !== "string" || !isValidBaseFolder(raw)) return DEFAULT_BASE_FOLDER;
  return normalizeBaseFolder(raw);
}

/** A usable note name; anything else gives the default. */
export function parseDefaultLocation(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_LOCATION_NAME;
  const name = raw.trim();
  return name === "" || hasForbiddenCharacters(name) ? DEFAULT_LOCATION_NAME : name;
}

export function parseDashboardPreferences(raw: unknown): DashboardPreferences {
  if (typeof raw !== "object" || raw === null) return DEFAULT_DASHBOARD_PREFERENCES;
  const { settings, locations, itemsExpanded, itemsSort, itemsSortReversed } = raw as Record<string, unknown>;
  const own = (typeof settings === "object" && settings !== null ? settings : {}) as Record<
    string,
    unknown
  >;

  return {
    settings: {
      foldedItemCount: parseFoldedCount(own.foldedItemCount),
      foldedLocationCount: parseFoldedCount(own.foldedLocationCount),
      searchThreshold: parseSearchThreshold(own.searchThreshold),
      // Only an explicit "off" turns it off: an old file without the field keeps the default.
      openOnStart: own.openOnStart !== false,
      stockStates: parseStockStates(own.stockStates),
      baseFolder: parseBaseFolder(own.baseFolder),
      filament: parseFilamentSettings(own.filament),
      defaultLocation: parseDefaultLocation(own.defaultLocation),
      // Only an explicit "off" turns it off: an old file without the field keeps the default.
      showPlaceCovers: own.showPlaceCovers !== false,
      haptics: own.haptics !== false,
      qrStyle: parseQrStyle(own.qrStyle),
    },
    locations: parseLocationPreferences(locations),
    itemsExpanded: itemsExpanded === true,
    itemsSort: parseSortMode(itemsSort),
    itemsSortReversed: itemsSortReversed === true,
  };
}

/** The first `foldedCount` entries while folded, everything when open. */
export function visibleWhenFolded<T>(
  entries: readonly T[],
  expanded: boolean,
  foldedCount: number,
): T[] {
  return expanded ? [...entries] : entries.slice(0, foldedCount);
}

export interface DashboardPreferencesStore {
  get(): DashboardPreferences;
  set(next: DashboardPreferences): void;
}

/** The states as a policy object, for the code that asks "does this state count". */
export function stockStatePolicy(preferences: DashboardPreferences): StockStatePolicy {
  return new StockStatePolicy(preferences.settings.stockStates);
}
