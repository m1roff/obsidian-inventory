import { describe, expect, it } from "vitest";
import { holeRect, labelLines, logoModules } from "../../src/domain/QrLabel";

describe("labelLines", () => {
  it("shows the id first, then the caption, only what is switched on", () => {
    expect(labelLines("AB-1", { showId: true, showCaption: true, caption: "Glue" })).toEqual(["AB-1", "Glue"]);
    expect(labelLines("AB-1", { showId: false, showCaption: true, caption: "Glue" })).toEqual(["Glue"]);
    expect(labelLines("AB-1", { showId: true, showCaption: true, caption: "  " })).toEqual(["AB-1"]);
    expect(labelLines("AB-1", { showId: false, showCaption: true, caption: "" })).toEqual([]);
    expect(labelLines("AB-1", { showId: true, showCaption: false, caption: "Glue" })).toEqual(["AB-1"]);
  });
});

describe("logoModules", () => {
  it("keeps the emblem well inside what error correction can lose", () => {
    for (const size of [25, 29, 33, 37]) {
      const side = logoModules(size) + 2; // with its margin
      expect(side * side).toBeLessThan(size * size * 0.3);
    }
  });
});

describe("holeRect", () => {
  it("keeps the emblem square in the middle and grows downward for a place pin", () => {
    const plain = holeRect(29, 0);
    const place = holeRect(29, 0.6);
    expect(plain.x + plain.width / 2).toBe(29 / 2);
    expect(place.y).toBe(plain.y);
    expect(place.height).toBeGreaterThan(plain.height);
  });

  it("stays well inside what error correction can lose, even with the pin", () => {
    for (const size of [25, 29, 33, 37]) {
      const hole = holeRect(size, 0.6);
      expect(hole.width * hole.height).toBeLessThan(size * size * 0.2);
    }
  });
});
