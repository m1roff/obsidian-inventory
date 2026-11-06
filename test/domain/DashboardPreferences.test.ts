import { describe, expect, it } from "vitest";
import { DEFAULT_STOCK_STATES } from "../../src/domain/StockState";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  parseDashboardPreferences,
  parseBaseFolder,
  parseFoldedCount,
  parseSearchThreshold,
  visibleWhenFolded,
} from "../../src/domain/DashboardPreferences";

describe("parseDashboardPreferences", () => {
  it("defaults to the item list folded", () => {
    expect(parseDashboardPreferences(null).itemsExpanded).toBe(false);
    expect(parseDashboardPreferences({}).itemsExpanded).toBe(false);
    expect(DEFAULT_DASHBOARD_PREFERENCES.itemsExpanded).toBe(false);
  });

  it("remembers an opened list", () => {
    expect(parseDashboardPreferences({ itemsExpanded: true }).itemsExpanded).toBe(true);
  });

  it("reads the locations part, and an older file that has only that part", () => {
    const parsed = parseDashboardPreferences({
      locations: { pinned: ["A"], sort: "updated", expanded: true },
    });
    expect(parsed.locations).toEqual({ pinned: ["A"], sort: "updated", reversed: false, expanded: true });
    expect(parsed.itemsSortReversed).toBe(false);
    expect(parsed.itemsExpanded).toBe(false);
  });
});

describe("settings", () => {
  it("limits the folded counts to whole numbers within range", () => {
    expect(parseFoldedCount(5)).toBe(5);
    expect(parseFoldedCount(0)).toBe(1);
    expect(parseFoldedCount(99)).toBe(20);
    expect(parseFoldedCount(2.6)).toBe(3);
    expect(parseFoldedCount("5")).toBe(3);
    expect(parseFoldedCount(Number.NaN)).toBe(3);
  });

  it("limits the search threshold to 0-20 and defaults to 5", () => {
    expect(parseSearchThreshold(0)).toBe(0);
    expect(parseSearchThreshold(12)).toBe(12);
    expect(parseSearchThreshold(-3)).toBe(0);
    expect(parseSearchThreshold(99)).toBe(20);
    expect(parseSearchThreshold(undefined)).toBe(5);
  });

  it("reads the settings and falls back to 3 for missing ones", () => {
    const parsed = parseDashboardPreferences({ settings: { foldedItemCount: 7 } });
    expect(parsed.settings).toEqual({ foldedItemCount: 7, foldedLocationCount: 3, searchThreshold: 5, openOnStart: true, stockStates: DEFAULT_STOCK_STATES, baseFolder: "Inventory", filament: { enabled: false, kind: "Plastic for 3d" }, defaultLocation: "Unsorted", showPlaceCovers: true, haptics: true, qrStyle: "light" });
  });

  it("reads the remembered item sort and ignores nonsense", () => {
    expect(parseDashboardPreferences({ itemsSort: "updated" }).itemsSort).toBe("updated");
    expect(parseDashboardPreferences({ itemsSort: "weird" }).itemsSort).toBe("created");
  });

  it("has factory defaults that a reset can restore", () => {
    expect(DEFAULT_DASHBOARD_PREFERENCES).toEqual({
      settings: { foldedItemCount: 3, foldedLocationCount: 3, searchThreshold: 5, openOnStart: true, stockStates: DEFAULT_STOCK_STATES, baseFolder: "Inventory", filament: { enabled: false, kind: "Plastic for 3d" }, defaultLocation: "Unsorted", showPlaceCovers: true, haptics: true, qrStyle: "light" },
      locations: { pinned: [], sort: "alpha", reversed: false, expanded: false },
      itemsExpanded: false,
      itemsSort: "created",
      itemsSortReversed: false,
    });
    expect(parseDashboardPreferences(DEFAULT_DASHBOARD_PREFERENCES)).toEqual(
      DEFAULT_DASHBOARD_PREFERENCES,
    );
  });
});

describe("visibleWhenFolded", () => {
  const entries = [1, 2, 3, 4, 5];

  it("shows the first few while folded", () => {
    expect(visibleWhenFolded(entries, false, 3)).toEqual([1, 2, 3]);
    expect(visibleWhenFolded(entries, false, 2)).toEqual([1, 2]);
    expect(visibleWhenFolded([1, 2], false, 3)).toEqual([1, 2]);
  });

  it("shows everything when open", () => {
    expect(visibleWhenFolded(entries, true, 3)).toEqual(entries);
  });
});

describe("parseBaseFolder", () => {
  it("keeps a usable name, tidied", () => {
    expect(parseBaseFolder(" /Home stuff/ ")).toBe("Home stuff");
  });
  it("falls back to the default for anything unusable", () => {
    expect(parseBaseFolder("")).toBe("Inventory");
    expect(parseBaseFolder("../x")).toBe("Inventory");
    expect(parseBaseFolder(42)).toBe("Inventory");
  });
});

describe("openOnStart", () => {
  it("is on unless it was explicitly turned off", () => {
    expect(parseDashboardPreferences({ settings: {} }).settings.openOnStart).toBe(true);
    expect(parseDashboardPreferences({ settings: { openOnStart: "no" } }).settings.openOnStart).toBe(true);
    expect(parseDashboardPreferences({ settings: { openOnStart: false } }).settings.openOnStart).toBe(false);
  });
});

describe("place covers setting", () => {
  it("is on by default, and only an explicit off turns it off", () => {
    expect(parseDashboardPreferences({ settings: {} }).settings.showPlaceCovers).toBe(true);
    expect(parseDashboardPreferences({ settings: { showPlaceCovers: "no" } }).settings.showPlaceCovers).toBe(true);
    expect(parseDashboardPreferences({ settings: { showPlaceCovers: false } }).settings.showPlaceCovers).toBe(false);
  });
});

describe("QR style setting", () => {
  it("is light (black on white) by default and ignores nonsense", () => {
    expect(parseDashboardPreferences({ settings: {} }).settings.qrStyle).toBe("light");
    expect(parseDashboardPreferences({ settings: { qrStyle: "dark" } }).settings.qrStyle).toBe("dark");
    expect(parseDashboardPreferences({ settings: { qrStyle: "pink" } }).settings.qrStyle).toBe("light");
  });
});
