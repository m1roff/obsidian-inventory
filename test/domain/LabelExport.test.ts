import { describe, expect, it } from "vitest";
import { IdGenerator } from "../../src/domain/IdGenerator";
import { labelsCsv, labelsFileName, LabelSelection, LocationLabelExport } from "../../src/domain/LabelExport";
import { Place } from "../../src/domain/Place";
import { PlaceIds } from "../../src/domain/PlaceIds";

const shelf: Place = { name: "Shelf", path: "Shelf.md", id: "LC-AB-123", cover: null };
const box: Place = { name: "Box", path: "Box.md", id: "", cover: null };
const drawer: Place = { name: "Drawer", path: "Drawer.md", id: "", cover: null };

describe("labelsCsv", () => {
  it("writes a header and one line per label", () => {
    const csv = labelsCsv([{ id: "LC-AB-123", name: "Shelf", link: "obsidian://x?a=1&b=2" }]);
    expect(csv).toBe("id,name,link\r\nLC-AB-123,Shelf,obsidian://x?a=1&b=2\r\n");
  });

  it("quotes fields with a comma, a quote or a line break", () => {
    const csv = labelsCsv([{ id: "A", name: 'Big "tool", red\nbox', link: "l" }]);
    expect(csv).toBe('id,name,link\r\nA,"Big ""tool"", red\nbox",l\r\n');
  });

  it("is just the header for no labels", () => {
    expect(labelsCsv([])).toBe("id,name,link\r\n");
  });
});

describe("labelsFileName", () => {
  it("adds the local date and time with seconds", () => {
    expect(labelsFileName("locations", new Date(2026, 10, 6, 13, 5, 9))).toBe("locations-labels_20261106-130509.csv");
  });
});

describe("LabelSelection", () => {
  it("starts with everything ticked, also places that appear later", () => {
    const selection = new LabelSelection();
    expect(selection.selected([shelf, box])).toEqual([shelf, box]);
  });

  it("unticks one place and ticks it again", () => {
    const selection = new LabelSelection();
    selection.set(box, false);
    expect(selection.selected([shelf, box])).toEqual([shelf]);
    selection.set(box, true);
    expect(selection.selected([shelf, box])).toEqual([shelf, box]);
  });

  it("deselects and selects all", () => {
    const selection = new LabelSelection();
    selection.deselectAll([shelf, box]);
    expect(selection.selected([shelf, box])).toEqual([]);
    selection.selectAll();
    expect(selection.selected([shelf, box])).toEqual([shelf, box]);
  });
});

describe("LocationLabelExport", () => {
  function setup() {
    const written: Array<[string, string]> = [];
    let counter = 0;
    const generator = new IdGenerator({ nextInt: (max) => Math.floor(counter++ / 2) % max });
    const places = [shelf, box, drawer];
    const lists = { kinds: () => [], tags: () => [], locations: () => places.map((p) => p.name), places: () => places };
    const writer = {
      async setId(path: string, id: string) {
        written.push([path, id]);
      },
    };
    return { exporter: new LocationLabelExport(new PlaceIds(lists, generator, writer)), written };
  }

  it("builds rows with the place link and gives ids only to places without one", async () => {
    const { exporter, written } = setup();
    const rows = await exporter.rows([shelf, box, drawer], "My vault");

    expect(rows[0]).toEqual({
      id: "LC-AB-123",
      name: "Shelf",
      link: "obsidian://inventory-ui?vault=My%20vault&place=LC-AB-123",
    });
    expect(written.map(([path]) => path)).toEqual(["Box.md", "Drawer.md"]);
    expect(rows[1]?.id).toBe(written[0]?.[1]);
    expect(rows[2]?.id).toBe(written[1]?.[1]);
    expect(rows[1]?.id).not.toBe(rows[2]?.id);
    expect(rows[1]?.link).toContain(`place=${rows[1]?.id}`);
  });

  it("writes nothing for places that already have ids", async () => {
    const { exporter, written } = setup();
    await exporter.rows([shelf], "V");
    expect(written).toEqual([]);
  });
});
