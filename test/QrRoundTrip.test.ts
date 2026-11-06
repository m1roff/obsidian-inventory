import { describe, expect, it } from "vitest";
import { buildItemLink, buildPlaceLink, parseScanned } from "../src/domain/ItemLink";
import { finderLayers, insideLayer, isFinderModule } from "../src/domain/QrFinders";
import { holeRect } from "../src/domain/QrLabel";
import { JsQrDecoder } from "../src/obsidian/JsQrDecoder";
import { UqrEncoder } from "../src/obsidian/UqrEncoder";

/**
 * Draws the label as pixels the way the renderer does: rounded corner patterns,
 * the middle cleared for the emblem.
 */
function pixelsOf(grid: boolean[][], scale: number, border: number, extraBelow: number, light = false) {
  const size = grid.length;
  const side = (size + 2 * border) * scale;
  // A light label is white code on a black ground: every pixel starts black and the code is drawn white.
  const data = new Uint8ClampedArray(side * side * 4).fill(light ? 0 : 255);
  if (light) for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const hole = holeRect(size, extraBelow);
  const layers = finderLayers(size);

  for (let py = 0; py < side; py++) {
    for (let px = 0; px < side; px++) {
      const x = (px + 0.5) / scale - border;
      const y = (py + 0.5) / scale - border;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;

      let dark = false;
      if (isFinderModule(Math.floor(x), Math.floor(y), size)) {
        for (const layer of layers) if (insideLayer(layer, x, y)) dark = layer.dark;
      } else {
        dark = grid[Math.floor(y)][Math.floor(x)];
      }
      const inHole = x >= hole.x && x < hole.x + hole.width && y >= hole.y && y < hole.y + hole.height;
      if (!dark || inHole) continue;

      const i = (py * side + px) * 4;
      data[i] = data[i + 1] = data[i + 2] = light ? 255 : 0;
    }
  }
  return { data, side };
}

describe("QR label round trip, light on dark", () => {
  it("reads a white code on a black ground too", () => {
    const encoder = new UqrEncoder();
    const link = buildItemLink("Inventory", "AB-CD-123");
    const { data, side } = pixelsOf(encoder.encode(link), 8, 4, 0, true);
    expect(new JsQrDecoder().decode(data, side, side)).toBe(link);
  });
});

describe("QR label round trip", () => {
  const encoder = new UqrEncoder();
  const decoder = new JsQrDecoder();

  it("still reads the item id with rounded corner patterns and the emblem area cleared", () => {
    const link = buildItemLink("Inventory", "AB-CD-123");
    const { data, side } = pixelsOf(encoder.encode(link), 8, 4, 0);

    const text = decoder.decode(data, side, side);
    expect(text).toBe(link);
    expect(parseScanned(text ?? "")).toEqual({ kind: "item", id: "AB-CD-123" });
  });

  it("still reads a place link with the taller area cleared for the pin", () => {
    const link = buildPlaceLink("Inventory", "LC-482-915");
    const { data, side } = pixelsOf(encoder.encode(link), 8, 4, 0.6);

    const text = decoder.decode(data, side, side);
    expect(text).toBe(link);
    expect(parseScanned(text ?? "")).toEqual({ kind: "place", id: "LC-482-915" });
  });
});
