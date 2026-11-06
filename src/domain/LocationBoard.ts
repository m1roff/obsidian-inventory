import { InventoryEntry } from "./InventoryEntry";
import { Place } from "./Place";

export const LOCATION_SORT_MODES = ["alpha", "added", "updated"] as const;

/**
 * `alpha`: by name. `added`: the place where something was added most recently.
 * `updated`: the place where something changed most recently.
 */
export type LocationSortMode = (typeof LOCATION_SORT_MODES)[number];

export interface LocationPreferences {
  /** Pinned locations, in the order the owner arranged them. */
  readonly pinned: readonly string[];
  readonly sort: LocationSortMode;
  readonly expanded: boolean;
}

export const DEFAULT_LOCATION_PREFERENCES: LocationPreferences = {
  pinned: [],
  sort: "alpha",
  expanded: false,
};

export function parseLocationPreferences(raw: unknown): LocationPreferences {
  if (typeof raw !== "object" || raw === null) return DEFAULT_LOCATION_PREFERENCES;
  const { pinned, sort, expanded } = raw as Record<string, unknown>;

  return {
    pinned: Array.isArray(pinned)
      ? pinned.filter((name): name is string => typeof name === "string")
      : [],
    sort: LOCATION_SORT_MODES.find((mode) => mode === sort) ?? "alpha",
    expanded: expanded === true,
  };
}

export interface LocationTile {
  readonly name: string;
  readonly path: string;
  /** Empty until the place has an id. */
  readonly id: string;
  /** Units still in stock there. */
  readonly quantity: number;
  /** Vault path of the place's photo, or null. */
  readonly cover: string | null;
  readonly pinned: boolean;
  readonly lastAddedAt: number;
  readonly lastUpdatedAt: number;
}

interface Stats {
  quantity: number;
  lastAddedAt: number;
  lastUpdatedAt: number;
}

/** What the location tiles on the dashboard show, and in which order. */
export class LocationBoard {
  tiles(
    places: readonly Place[],
    entries: readonly InventoryEntry[],
    preferences: LocationPreferences,
  ): LocationTile[] {
    const stats = this.statsByLocation(entries);
    const names = places.map((place) => place.name);
    const pinnedNames = preferences.pinned.filter((name) => names.includes(name));

    const tile = (place: Place): LocationTile => {
      const own = stats.get(place.name);
      return {
        name: place.name,
        path: place.path,
        id: place.id,
        quantity: own?.quantity ?? 0,
        cover: place.cover,
        pinned: pinnedNames.includes(place.name),
        lastAddedAt: own?.lastAddedAt ?? 0,
        lastUpdatedAt: own?.lastUpdatedAt ?? 0,
      };
    };

    const placeNamed = (name: string): Place =>
      places.find((place) => place.name === name) as Place;
    const rest = places
      .filter((place) => !pinnedNames.includes(place.name))
      .map(tile)
      .sort((a, b) => this.compare(a, b, preferences.sort));

    return [...pinnedNames.map((name) => tile(placeNamed(name))), ...rest];
  }

  private statsByLocation(entries: readonly InventoryEntry[]): Map<string, Stats> {
    const stats = new Map<string, Stats>();
    for (const entry of entries) {
      for (const position of entry.positions) {
        const own = stats.get(position.location) ?? {
          quantity: 0,
          lastAddedAt: 0,
          lastUpdatedAt: 0,
        };
        if (position.isAvailable()) own.quantity += position.quantity;
        own.lastAddedAt = Math.max(own.lastAddedAt, position.createdAt);
        own.lastUpdatedAt = Math.max(own.lastUpdatedAt, position.updatedAt);
        stats.set(position.location, own);
      }
    }
    return stats;
  }

  private compare(a: LocationTile, b: LocationTile, mode: LocationSortMode): number {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (mode === "alpha") return byName;
    const date = (tile: LocationTile): number =>
      mode === "added" ? tile.lastAddedAt : tile.lastUpdatedAt;
    return date(b) - date(a) || byName;
  }
}

/**
 * The tiles as shown while a location filters the list: that one goes first, pinned or not,
 * so a folded row never hides the place that is doing the filtering. The pinned order itself is not changed.
 */
export function withSelectedFirst(tiles: readonly LocationTile[], selected: string | null): LocationTile[] {
  const chosen = tiles.find((tile) => tile.name === selected);
  return chosen ? [chosen, ...tiles.filter((tile) => tile !== chosen)] : [...tiles];
}

/** Pins an unpinned location (at the end), or unpins a pinned one. */
export function togglePinned(pinned: readonly string[], name: string): string[] {
  return pinned.includes(name)
    ? pinned.filter((candidate) => candidate !== name)
    : [...pinned, name];
}

/** Moves a pinned location one place earlier (-1) or later (1). */
export function movePinned(
  pinned: readonly string[],
  name: string,
  direction: -1 | 1,
): string[] {
  const from = pinned.indexOf(name);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= pinned.length) return [...pinned];

  const result = [...pinned];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

/** Items that have units in stock in the given location. */
export function entriesInLocation(
  entries: readonly InventoryEntry[],
  location: string,
): InventoryEntry[] {
  return entries.filter((entry) =>
    entry.availablePositions().some((position) => position.location === location),
  );
}

export interface LocationPreferencesStore {
  get(): LocationPreferences;
  set(next: LocationPreferences): void;
}
